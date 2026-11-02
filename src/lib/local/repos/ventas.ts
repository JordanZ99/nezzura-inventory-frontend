// ==============================================================================
// src/lib/local/repos/ventas.ts
// Ventas y tickets (POS) en LOCAL — replica el comportamiento del backend:
//
//   * cobrarCarrito: crea UNA orden (ticket) con sus renglones de venta y
//     CONSUME STOCK PEPS (lote más antiguo primero) de cada producto. Los
//     compuestos consumen los materiales de su receta. Cada consumo escribe
//     su renglón en el ledger.
//   * anularOrden / eliminarVenta: devuelven stock al lote original
//     (movimiento 'anulacion') y marcan estado 'Anulada'.
//
// El shape de respuesta/consulta es idéntico al de routers/ventas.py.
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import type { ItemCarrito, Orden, RangoFechas, Venta } from "@/types"
import type { LoteLocal, VentaLocal, OrdenLocal, MesaLocal } from "../db"
import { registrarMovimiento } from "./inventario"

function redondear(n: number): number {
    return Math.round(n * 100) / 100
}

/** Convierte "ISO local" del ledger/ventas al formato fecha texto. */
function hoyTexto(): string {
    return ahoraISO().replace("T", " ")
}

// ============================================================================
// Cobrar el carrito (PEPS)
// ============================================================================
export interface RespuestaCobro {
    ok: boolean
    ventas: number
    total_cobrado: number
    n_ticket: number
    metodo_pago?: string | null
    propina?: number
    cambio?: number | null
}

export async function cobrarCarrito(
    items: ItemCarrito[],
    pago?: {
        metodo: string
        propina?: number
        pagos?: { metodo: string; monto: number; referencia?: string; terminal_id?: string }[]
        monto_recibido?: number
        terminal_id?: string
    },
    _mesa_id?: string | null,
    _cliente?: { cliente_id: string; puntos_usados?: number } | null
): Promise<RespuestaCobro> {
    const d = abrirDB()
    const productos = await d.productos.toArray()
    const lotes = await d.lotes.where("estado").equals("Activo").toArray()

    // ── n_ticket: consecutivo local del negocio ──
    const ticketsExistentes = await d.ordenes.orderBy("n_ticket").last()
    const n_ticket = (ticketsExistentes?.n_ticket || 0) + 1
    const orden_id = crypto.randomUUID()
    const fecha = hoyTexto()

    const renglones: VentaLocal[] = []
    let totalCobrado = 0
    let gananciaOrden = 0

    // Consumo PEPS de un conjunto de lotes candidatos
    async function consumir(
        producto: string,
        cantidad: number,
        variacionNombre: string | undefined,
        variacionId: number | null,
        orden_id: string
    ): Promise<{ costo_total: number; consumos: { id_lote: string | null; cantidad: number; costo: number }[] }> {
        let pendiente = cantidad
        let costoTotal = 0
        const consumos: { id_lote: string | null; cantidad: number; costo: number }[] = []
        const candidatos = lotes
            .filter(l => {
                if (l.producto !== producto) return false
                if (variacionId == null) return !l.variacion_id
                return l.variacion_id === variacionId
            })
            .sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada))

        for (const lote of candidatos) {
            if (pendiente <= 0) break
            const tomado = Math.min(lote.stock_lote, pendiente)
            if (tomado <= 0) continue

            await d.lotes.update(lote.id_lote, { stock_lote: redondear(lote.stock_lote - tomado) })
            await registrarMovimiento({
                producto,
                variacion: variacionNombre ?? null,
                id_lote: lote.id_lote,
                tipo: "salida",
                origen: "venta",
                cantidad: -tomado,
                stock_resultante: redondear(lote.stock_lote - tomado),
                referencia_id: orden_id,
                concepto: "Venta",
            })
            costoTotal += lote.costo * tomado
            consumos.push({ id_lote: lote.id_lote, cantidad: tomado, costo: lote.costo })
            pendiente = redondear(pendiente - tomado)
        }
        if (pendiente > 0.001) {
            throw new Error(`No hay stock suficiente de "${producto}"${variacionNombre ? ` (${variacionNombre})` : ""}.`)
        }
        return { costo_total: redondear(costoTotal), consumos }
    }

    for (const item of items) {
        const prod = productos.find(p => p.producto === item.producto)
        const tipo = prod?.tipo_producto || "stock"

        // Precio de lista del renglón: variación > servicio > lote PEPS
        let precioLista = 0
        let variacionId: number | null = null
        if (item.variacion) {
            const vars = await d.variaciones.where("producto").equals(item.producto).toArray()
            const v = vars.find(x => x.nombre === item.variacion)
            variacionId = v?.id ?? null
            precioLista = v?.precio || 0
        } else if (tipo === "servicio" || tipo === "compuesto") {
            precioLista = prod?.precio_servicio || 0
        } else if (item.producto === "Venta libre") {
            // Venta libre: precio puramente manual
            precioLista = item.precio_real
        }

        const cantidad = item.cantidad
        const precioReal = item.precio_real ?? precioLista
        const totalRenglon = redondear(precioReal * cantidad)

        let costoUnitario = 0
        let consumo: { material: string; id_lote: string | null; cantidad: number; costo: number }[] | null = null

        if (tipo === "servicio") {
            costoUnitario = prod?.costo_servicio || 0
        } else if (tipo === "compuesto") {
            // Consume los materiales de su receta (PEPS por material)
            const receta = await d.recetas.where("producto").equals(item.producto).toArray()
            consumo = []
            let costoAcum = 0
            for (const mat of receta) {
                const cantidadMaterial = redondear(mat.cantidad * cantidad)
                const vars = mat.variacion_id
                    ? [{ id: mat.variacion_id, nombre: (await d.variaciones.get(mat.variacion_id))?.nombre || "" }]
                    : []
                const nombreVar = vars[0]?.nombre || undefined
                const res = await consumir(
                    mat.material, cantidadMaterial,
                    nombreVar || undefined, mat.variacion_id ?? null, orden_id
                )
                costoAcum += res.costo_total
                for (const c of res.consumos) {
                    consumo.push({ material: mat.material, id_lote: c.id_lote, cantidad: c.cantidad, costo: c.costo })
                }
            }
            costoUnitario = cantidad > 0 ? redondear(costoAcum / cantidad) : 0
        } else {
            // Stock normal (con o sin variación): PEPS
            const res = await consumir(item.producto, cantidad, item.variacion, variacionId, orden_id)
            costoUnitario = cantidad > 0 ? redondear(res.costo_total / cantidad) : 0
            // precio de lista del lote PEPS vendido (como el backend)
            if (!item.variacion && !precioLista) {
                const primerLote = res.consumos[0]
                if (primerLote?.id_lote) {
                    const l = await d.lotes.get(primerLote.id_lote)
                    precioLista = l?.precio_venta || precioLista
                }
            }
        }

        const ganancia = redondear(totalRenglon - costoUnitario * cantidad)
        renglones.push({
            orden_id,
            n_ticket,
            fecha,
            producto: item.producto,
            cantidad,
            precio_lista: redondear(precioLista),
            precio_real: redondear(precioReal),
            costo_unitario: costoUnitario,
            total_venta: totalRenglon,
            ganancia_bruta: ganancia,
            estado: "Activo",
            tipo_producto: tipo,
            variacion: item.variacion || undefined,
            descripcion: item.descripcion || null,
            id_lote: null,
            consumo,
        })
        totalCobrado = redondear(totalCobrado + totalRenglon)
        gananciaOrden = redondear(gananciaOrden + ganancia)
    }

    if (!renglones.length) throw new Error("El carrito está vacío.")

    const propina = pago?.propina || 0

    // ── Comisiones de terminal (Fase B): monto × pct + fija, como backend ──
    const terminalesTabla = await d.terminales.toArray()
    let comisionTotal = 0
    const pagosNorm = (pago?.pagos || (pago?.metodo && pago.metodo !== "mixto"
        ? [{ metodo: pago.metodo, monto: totalCobrado + propina, terminal_id: pago?.terminal_id }]
        : []))?.map(p => {
        let comision = 0
        const terminal = p.terminal_id ? terminalesTabla.find(t => t.id === p.terminal_id) : undefined
        if (terminal && (p.metodo === "tarjeta_debito" || p.metodo === "tarjeta_credito")) {
            const pct = p.metodo === "tarjeta_debito" ? terminal.comision_debito_pct : terminal.comision_credito_pct
            comision = Math.round(p.monto * (pct || 0) / 100 * 100) / 100 + (terminal.comision_fija || 0)
        }
        comisionTotal = redondear(comisionTotal + comision)
        return {
            metodo: p.metodo,
            monto: p.monto,
            referencia: (p as { referencia?: string }).referencia || null,
            terminal_id: p.terminal_id || null,
            comision,
        }
    }) || null

    // Turno de caja abierto: los cobros del día se adscriben al turno (arqueo)
    const turnoAbierto = (await d.turnos.where("estado").equals("Abierto").toArray())[0]

    // Cobro desde mesa (preset restaurante): snapshot + cierra la mesa
    let mesaId: string | null = null
    let mesaNombre: string | null = null
    if (_mesa_id) {
        const mesa = await d.mesas.get(_mesa_id)
        if (mesa) {
            mesaId = mesa.id
            mesaNombre = mesa.nombre
            await d.mesa_items.where("mesa_id").equals(mesa.id).delete()
            await d.mesas.update(mesa.id, { estado: "Libre" as MesaLocal["estado"], abierta_en: null })
        }
    }

    const orden: OrdenLocal = {
        id: orden_id,
        n_ticket,
        fecha,
        total: redondear(totalCobrado + propina),
        ganancia: gananciaOrden,
        cantidad_items: renglones.length,
        estado: "Activa",
        metodo_pago: pago?.metodo || null,
        pagos: pagosNorm,
        propina,
        monto_recibido: pago?.monto_recibido ?? null,
        cambio: pago?.monto_recibido != null
            ? redondear(Math.max(0, pago.monto_recibido - totalCobrado))
            : null,
        comision_total: comisionTotal,
        turno_id: turnoAbierto?.id ?? null,
        mesa_id: mesaId,
        mesa_nombre: mesaNombre,
    }

    await d.transaction("rw", d.ordenes, d.ventas, d.mesas, d.mesa_items, async () => {
        await d.ordenes.add(orden)
        for (const r of renglones) await d.ventas.add(r)
    })

    return {
        ok: true,
        ventas: renglones.length,
        total_cobrado: orden.total,
        n_ticket,
        metodo_pago: orden.metodo_pago,
        propina,
        cambio: orden.cambio,
    }
}

// ============================================================================
// Consultas
// ============================================================================
function filaVenta(v: VentaLocal, id: number): Venta {
    return {
        id,
        n_ticket: v.n_ticket,
        fecha: v.fecha,
        producto: v.producto,
        cantidad: v.cantidad,
        precio_lista: v.precio_lista,
        precio_real: v.precio_real,
        costo_unitario: v.costo_unitario,
        total_venta: v.total_venta,
        ganancia_bruta: v.ganancia_bruta,
        estado: v.estado,
        tipo_producto: v.tipo_producto,
        variacion: v.variacion || undefined,
        descripcion: v.descripcion || undefined,
        consumo: v.consumo || undefined,
        orden_id: v.orden_id,
    }
}

export async function getVentas(rango?: RangoFechas): Promise<Venta[]> {
    const d = abrirDB()
    let filas = await d.ventas.orderBy("fecha").toArray()
    if (rango?.desde) filas = filas.filter(f => f.fecha.slice(0, 10) >= rango.desde!)
    if (rango?.hasta) filas = filas.filter(f => f.fecha.slice(0, 10) <= rango.hasta!)
    filas.reverse()
    return filas.map((f, i) => filaVenta(f, f.id ?? i + 1))
}

/** Agrupa ventas por orden → Orden[] (como getOrdenes del backend). */
export async function getOrdenes(limit = 500, rango?: RangoFechas): Promise<Orden[]> {
    const d = abrirDB()
    let ventas = await d.ventas.orderBy("fecha").toArray()
    if (rango?.desde) ventas = ventas.filter(v => v.fecha.slice(0, 10) >= rango.desde!)
    if (rango?.hasta) ventas = ventas.filter(v => v.fecha.slice(0, 10) <= rango.hasta!)
    ventas.reverse()

    const ordenesFilas = await d.ordenes.toArray()
    const porOrden = new Map<string, OrdenLocal | undefined>(
        ordenesFilas.map(o => [o.id, o])
    )

    const grupos = new Map<string, VentaLocal[]>()
    for (const v of ventas) {
        const lista = grupos.get(v.orden_id) || []
        lista.push(v)
        grupos.set(v.orden_id, lista)
    }

    const ordenes: Orden[] = []
    for (const [ordenId, lista] of grupos) {
        if (!lista.length) continue
        const cabecera = porOrden.get(ordenId)
        const primera = lista[0]
        const subTotal = lista.reduce((s, v) => s + v.total_venta, 0)
        const propina = cabecera?.propina || 0
        ordenes.push({
            id: ordenId,
            n_ticket: primera.n_ticket,
            fecha: primera.fecha,
            total: redondear(cabecera?.total ?? subTotal),
            ganancia: redondear(lista.reduce((s, v) => s + v.ganancia_bruta, 0)),
            cantidad_items: lista.length,
            estado: cabecera?.estado || primera.estado === "Anulada" || lista.every(v => v.estado === "Anulada")
                ? "Anulada" : "Activa",
            ventas: lista.map((v, i) => filaVenta(v, v.id ?? i + 1)),
            metodo_pago: cabecera?.metodo_pago ?? null,
            pagos: cabecera?.pagos ?? null,
            propina: propina || undefined,
            monto_recibido: cabecera?.monto_recibido ?? null,
            cambio: cabecera?.cambio ?? null,
            comision_total: cabecera?.comision_total ?? undefined,
            turno_id: cabecera?.turno_id ?? undefined,
            mesa_id: cabecera?.mesa_id ?? null,
            mesa_nombre: cabecera?.mesa_nombre ?? null,
        })
        if (ordenes.length >= limit) break
    }
    return ordenes
}

// ============================================================================
// Edición / anulación
// ============================================================================
/** Devuelve `cantidad` unidades al lote original (o crea lote de restitución). */
async function restituirStock(v: VentaLocal, cantidad: number): Promise<void> {
    const d = abrirDB()
    if (v.tipo_producto !== "stock") return
    const lotes = await d.lotes.toArray()
    const lote = lotes.find(l => l.id_lote === v.consumo?.[0]?.id_lote)
    if (lote) {
        await d.lotes.update(lote.id_lote, {
            stock_lote: redondear(lote.stock_lote + cantidad),
        })
        await registrarMovimiento({
            producto: v.producto,
            variacion: v.variacion ?? null,
            id_lote: lote.id_lote,
            tipo: "entrada",
            origen: "anulacion",
            cantidad,
            stock_resultante: redondear(lote.stock_lote + cantidad),
            referencia_id: v.orden_id,
            concepto: "Devolución de stock",
        })
    }
}

export async function anularOrden(
    ordenId: string
): Promise<{ ok: boolean; anuladas: number; stock_restaurado?: number }> {
    const d = abrirDB()
    const filas = await d.ventas.where("orden_id").equals(ordenId).toArray()
    const activas = filas.filter(v => v.estado === "Activo")
    let restaurado = 0
    for (const v of activas) {
        await restituirStock(v, v.cantidad)
        restaurado += v.cantidad
        await d.ventas.update(v.id!, { estado: "Anulada" })
    }
    await d.ordenes.update(ordenId, { estado: "Anulada" })
    return { ok: true, anuladas: activas.length, stock_restaurado: restaurado }
}

export async function actualizarVenta(
    id: number,
    data: { fecha?: string; precio_real?: number; cantidad?: number }
): Promise<{ ok: boolean; mensaje?: string }> {
    const d = abrirDB()
    const v = await d.ventas.get(id)
    if (!v) return { ok: false, mensaje: "Venta no encontrada." }

    if (data.cantidad !== undefined && data.cantidad !== v.cantidad) {
        // delta: negativo = se vendió más → consumir; positivo = devolver
        const delta = redondear(data.cantidad - v.cantidad)
        if (delta < 0) {
            // Consumir |delta| adicional
            const deltaRecorte = -delta
            const lotes = await d.lotes.where("estado").equals("Activo").toArray()
            const candidatos = lotes
                .filter(l => l.producto === v.producto
                    && (!v.variacion ? !l.variacion_id : l.variacion === v.variacion))
                .sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada))
            let pendiente = deltaRecorte
            let costoAdicional = 0
            for (const lote of candidatos) {
                if (pendiente <= 0) break
                const tomado = Math.min(lote.stock_lote, pendiente)
                if (tomado <= 0) return { ok: false, mensaje: "No hay stock disponible para el ajuste." }
                await d.lotes.update(lote.id_lote, {
                    stock_lote: redondear(lote.stock_lote - tomado),
                })
                costoAdicional += lote.costo * tomado
                pendiente = redondear(pendiente - tomado)
            }
            if (pendiente > 0) return { ok: false, mensaje: "No hay stock suficiente." }
            v.costo_unitario = cantidadNuevaCosto(v, redondear(v.costo_unitario * v.cantidad + costoAdicional), data.cantidad)
        } else if (delta > 0) {
            await restituirStock(v, delta)
            v.costo_unitario = cantidadNuevaCosto(
                v,
                Math.max(0, v.costo_unitario * v.cantidad - v.costo_unitario * delta),
                data.cantidad
            )
        }
    }

    const cantidad = data.cantidad ?? v.cantidad
    const precioReal = data.precio_real ?? v.precio_real
    const total = redondear(precioReal * cantidad)
    const ganancia = redondear(total - v.costo_unitario * cantidad)

    await d.ventas.update(id, {
        fecha: data.fecha ?? v.fecha,
        cantidad,
        precio_real: redondear(precioReal),
        total_venta: total,
        ganancia_bruta: ganancia,
        costo_unitario: v.costo_unitario,
    })
    // Sincronizar la cabecera de la orden (total por renglones activos)
    const hermanas = (await d.ventas.where("orden_id").equals(v.orden_id).toArray())
        .filter(x => x.estado === "Activo")
    const nuevaBase = hermanas.reduce((s, h) => s + (h.id === id ? total : h.total_venta), 0)
    const cab = await d.ordenes.get(v.orden_id)
    if (cab) {
        await d.ordenes.update(v.orden_id, {
            total: redondear(nuevaBase + (cab.propina || 0)),
            ganancia: redondear(hermanas.reduce((s, h) => s + (h.id === id ? ganancia : h.ganancia_bruta), 0)),
            cantidad_items: Math.max(1, hermanas.length),
        })
    }
    return { ok: true }
}

function cantidadNuevaCosto(_v: VentaLocal, costoTotal: number, cantidad: number): number {
    return cantidad > 0 ? redondear(costoTotal / cantidad) : 0
}

export async function eliminarVenta(id: number): Promise<{ ok: boolean; mensaje?: string }> {
    const d = abrirDB()
    const v = await d.ventas.get(id)
    if (!v) return { ok: false, mensaje: "Venta no encontrada." }
    await restituirStock(v, v.cantidad)
    await d.ventas.delete(id)
    // ¿La orden quedó vacía? → anularla
    const restantes = await d.ventas.where("orden_id").equals(v.orden_id).toArray()
    if (!restantes.length) {
        await d.ordenes.delete(v.orden_id)
    } else {
        const cab = await d.ordenes.get(v.orden_id)
        if (cab) {
            const base = restantes.filter(x => x.estado === "Activo").reduce((s, x) => s + x.total_venta, 0)
            await d.ordenes.update(v.orden_id, {
                total: redondear(base + (cab.propina || 0)),
                ganancia: redondear(restantes.reduce((s, x) => s + x.ganancia_bruta, 0)),
                cantidad_items: restantes.length,
            })
        }
    }
    return { ok: true }
}

export async function actualizarOrden(
    ordenId: string,
    data: { fecha?: string; metodo_pago?: string; propina?: number }
): Promise<{ ok: boolean; n_ticket: number }> {
    const d = abrirDB()
    const cab = await d.ordenes.get(ordenId)
    if (!cab) return { ok: true, n_ticket: 0 }
    const cambios: Partial<OrdenLocal> = {}
    if (data.fecha !== undefined) {
        cambios.fecha = data.fecha
        await Promise.all(
            (await d.ventas.where("orden_id").equals(ordenId).toArray())
                .map(v => d.ventas.update(v.id!, { fecha: data.fecha! }))
        )
    }
    if (data.metodo_pago !== undefined) cambios.metodo_pago = data.metodo_pago
    if (data.propina !== undefined) {
        const base = (await d.ventas.where("orden_id").equals(ordenId).toArray())
            .filter(v => v.estado === "Activo").reduce((s, v) => s + v.total_venta, 0)
        cambios.propina = data.propina
        cambios.total = redondear(base + data.propina)
    }
    await d.ordenes.update(ordenId, cambios)
    return { ok: true, n_ticket: cab.n_ticket }
}
