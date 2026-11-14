// ==============================================================================
// src/lib/local/repos/conteos.ts
// Conteos de auditoría LOCAL (conteo físico vs sistema). Cumple el MISMO
// contrato que lib/api/conteos.ts (que a su vez habla con
// routers/inventario.py + database/conteos.py):
//
//   abrirConteo          → congela snapshot (un renglón por producto+variación,
//                          incluidos los de stock 0), alcance parcial opcional
//                          (057: categorías y/o productos).
//   guardarCapturas      → autosave ABSOLUTO e idempotente por renglón.
//   agregarRenglonManual → producto nunca registrado (056), idempotente.
//   cerrarConteo         → resuelve cada diferencia contra el stock VIVO:
//                          merma / venta declarada (orden retroactiva) /
//                          error_sistema / entrada_no_registrada. La merma
//                          crea su gasto en Egresos (categoría "Merma").
//
// Diferencias honestas vs backend:
//   * En local los productos NO tienen id numérico (viven por nombre), así
//     que `producto_id` de los items va en 0/null y el alcance parcial
//     guarda `productos` (nombres) + `producto_ids` de relleno 1..n SOLO
//     para que el banner del conteo parcial cuente bien (solo lee .length).
//   * El descuento PEPS se hace leyendo lotes frescos en cada consumo
//     (lote más antiguo primero, actualizando el stock en el paso).
// ==============================================================================

import { abrirDB, ahoraISO, hoyISO } from "../db"
import type {
    AlcanceConteo, CapturaConteo, Conteo, ConteoItem, ResolucionConteoItem,
    RenglonManualConteo, ResumenConteo,
} from "@/types"
import type { ConteoLocal, ConteoItemLocal, LoteLocal } from "../db"
import { registrarMovimiento } from "./inventario"
import { redondear, redondear3 } from "./utilidades"

// Dos décimas de kilo no cuentan como "diferencia" (igual que el backend).
const EPS = 0.001

// ============================================================================
// Utilidades de composición del snapshot / stock vivo
// ============================================================================
interface RenglonSnapshot {
    producto: string
    variacion: string
    stock: number
}

/**
 * Stock consolidado por (producto, variación) de los productos de stock
 * ACTIVOS, espejo del SQL agrupado del backend:
 *   - producto con lotes → grupos SOLO de las variaciones presentes en lotes
 *   - producto sin lotes → un renglón con variación '' y stock 0
 */
async function snapshotAgrupado(soloProductos?: Set<string> | null): Promise<RenglonSnapshot[]> {
    const d = abrirDB()
    const [productos, lotes] = await Promise.all([
        d.productos.toArray(),
        d.lotes.where("estado").equals("Activo").toArray(),
    ])
    const activos = productos.filter(p =>
        p.estado === "Activo" && (p.tipo_producto || "stock") === "stock"
        && (!soloProductos || soloProductos.has(p.producto)))
    const nombres = new Set(activos.map(p => p.producto))

    const mapas = new Map<string, number>()
    const productosConLotes = new Set<string>()
    for (const l of lotes) {
        if (!nombres.has(l.producto)) continue
        productosConLotes.add(l.producto)
        const key = `${l.producto}||${l.variacion || ""}`
        mapas.set(key, (mapas.get(key) || 0) + l.stock_lote)
    }
    // Producto vivo pero sin lote alguno → renglón base con stock 0
    for (const p of activos) {
        if (productosConLotes.has(p.producto)) continue
        mapas.set(`${p.producto}||`, 0)
    }
    return Array.from(mapas.entries())
        .map(([key, stock]) => {
            const [producto, ...resto] = key.split("||")
            return { producto, variacion: resto.join("||"), stock: redondear3(stock) }
        })
        .sort((a, b) => a.producto.localeCompare(b.producto) || a.variacion.localeCompare(b.variacion))
}

function aItemContrato(it: ConteoItemLocal): ConteoItem {
    return {
        id: it.id,
        producto_id: it.producto_id ?? 0,
        producto: it.producto,
        variacion: it.variacion,
        esperado: it.esperado,
        contado: it.contado,
        vivo: it.vivo,
        delta: it.delta,
        resolucion: it.resolucion,
        origen: it.origen || "snapshot",
        inicial: it.inicial ?? undefined,
    }
}

function aConteoContrato(c: ConteoLocal): Conteo {
    return {
        id: c.id,
        estado: c.estado,
        abierto_at: c.abierto_at,
        cerrado_at: c.cerrado_at,
        resumen: c.resumen,
        alcance: c.alcance ?? undefined,
    }
}

// ============================================================================
// Lectura: activo, detalle e historial
// ============================================================================
export async function getConteoActivo(): Promise<{ ok: boolean; conteo: Conteo | null; items: ConteoItem[] }> {
    const d = abrirDB()
    const abierto = (await d.conteos.where("estado").equals("abierto").toArray())
        .sort((a, b) => b.abierto_at.localeCompare(a.abierto_at))[0]
    if (!abierto) return { ok: true, conteo: null, items: [] }
    const items = (await d.conteo_items.where("conteo_id").equals(abierto.id).toArray())
        .sort((a, b) => a.producto.localeCompare(b.producto) || a.variacion.localeCompare(b.variacion))
    return { ok: true, conteo: aConteoContrato(abierto), items: items.map(aItemContrato) }
}

export async function getConteo(conteoId: string): Promise<{ ok: boolean; conteo: Conteo; items: ConteoItem[] }> {
    const d = abrirDB()
    const conteo = await d.conteos.get(conteoId)
    if (!conteo) throw new Error("Conteo no encontrado")
    const items = (await d.conteo_items.where("conteo_id").equals(conteoId).toArray())
        .sort((a, b) => a.producto.localeCompare(b.producto) || a.variacion.localeCompare(b.variacion))
    return { ok: true, conteo: aConteoContrato(conteo), items: items.map(aItemContrato) }
}

export async function getHistorialConteos(limit?: number): Promise<Conteo[]> {
    const d = abrirDB()
    const filas = (await d.conteos.where("estado").equals("cerrado").toArray())
        .sort((a, b) => (b.cerrado_at || "").localeCompare(a.cerrado_at || ""))
    return filas.slice(0, Math.min(Math.max(1, limit ?? 30), 100)).map(aConteoContrato)
}

// ============================================================================
// Abrir el conteo (snapshot congelado)
// ============================================================================
export async function abrirConteo(
    alcance?: AlcanceConteo | null
): Promise<{ ok: boolean; conteo: Conteo; items: ConteoItem[] }> {
    const d = abrirDB()
    const yaAbierto = await d.conteos.where("estado").equals("abierto").count()
    if (yaAbierto > 0) {
        throw new Error("Ya hay un conteo abierto: captura y ciérralo antes de iniciar otro.")
    }

    // Alcance parcial (057): resolver a NOMBRES de producto (categoría ∪ elegidos)
    let productosAlcance: string[] | null = null
    let alcanceGuardado: AlcanceConteo | null = null
    const cats = (alcance?.categorias || []).map(c => String(c).trim()).filter(Boolean)
    const prods = (alcance?.productos || []).map(p => String(p).trim()).filter(Boolean)
    if (cats.length || prods.length) {
        const todos = (await d.productos.toArray()).filter(p => p.estado === "Activo")
        const set = new Set<string>()
        for (const p of todos) {
            if (prods.includes(p.producto) || cats.some(c => (p.categorias || []).includes(c))) {
                set.add(p.producto)
            }
        }
        if (set.size === 0) {
            throw new Error("El alcance del conteo parcial no incluye ningún producto")
        }
        productosAlcance = Array.from(set)
        // producto_ids va de relleno (1..n): el banner del conteo parcial solo
        // lee su .length para decir "N productos elegidos".
        alcanceGuardado = {
            categorias: cats.length ? cats : undefined,
            productos: productosAlcance,
            producto_ids: productosAlcance.map((_, i) => i + 1),
        }
    }

    const conteo: ConteoLocal = {
        id: crypto.randomUUID(),
        estado: "abierto",
        abierto_at: ahoraISO(),
        cerrado_at: null,
        resumen: null,
        alcance: alcanceGuardado,
    }
    await d.conteos.add(conteo)

    const snapshot = await snapshotAgrupado(productosAlcance ? new Set(productosAlcance) : null)
    await d.conteo_items.bulkAdd(snapshot.map(s => ({
        id: crypto.randomUUID(),
        conteo_id: conteo.id,
        producto_id: 0,
        producto: s.producto,
        variacion: s.variacion,
        esperado: s.stock,
        contado: null,
        vivo: null,
        delta: null,
        resolucion: null,
        origen: "snapshot" as const,
    })))

    const items = (await d.conteo_items.where("conteo_id").equals(conteo.id).toArray())
        .sort((a, b) => a.producto.localeCompare(b.producto) || a.variacion.localeCompare(b.variacion))
    return { ok: true, conteo: aConteoContrato(conteo), items: items.map(aItemContrato) }
}

// ============================================================================
// Capturas (autosave) y renglón manual
// ============================================================================
export async function guardarCapturas(
    conteoId: string,
    items: CapturaConteo[]
): Promise<{ ok: boolean; guardados: number; no_encontrados: { producto: string; variacion: string }[] }> {
    const d = abrirDB()
    const conteo = await d.conteos.get(conteoId)
    if (!conteo) throw new Error("Conteo no encontrado")
    if (conteo.estado !== "abierto") throw new Error("El conteo ya está cerrado")

    for (const it of items) {
        if (it.contado !== null && it.contado < 0) {
            throw new Error(`"${it.producto}": lo contado no puede ser negativo`)
        }
    }

    const filas = await d.conteo_items.where("conteo_id").equals(conteoId).toArray()
    let guardados = 0
    const no_encontrados: { producto: string; variacion: string }[] = []
    for (const cap of items) {
        const variacionLimpia = (cap.variacion || "").trim()
        const objetivo = filas.find(
            f => f.producto === cap.producto && f.variacion === variacionLimpia)
        if (!objetivo) {
            no_encontrados.push({ producto: cap.producto, variacion: variacionLimpia })
            continue
        }
        await d.conteo_items.update(objetivo.id, {
            contado: cap.contado === null ? null : redondear3(cap.contado),
        })
        guardados++
    }
    return { ok: true, guardados, no_encontrados }
}

export async function agregarRenglonManual(
    conteoId: string,
    data: RenglonManualConteo
): Promise<{ ok: boolean; accion: "creado" | "actualizado"; producto: string }> {
    const d = abrirDB()
    const nombre = (data.producto || "").trim()
    if (!nombre) throw new Error("Escribe el nombre del producto no registrado")
    if (nombre.length > 200) throw new Error("El nombre es demasiado largo (máx 200 caracteres)")
    const inicial = data.inicial == null ? null : redondear3(data.inicial)
    const contado = data.contado == null ? null : redondear3(data.contado)
    if (inicial !== null && inicial < 0) throw new Error("El inicial no puede ser negativo")
    if (contado !== null && contado < 0) throw new Error("Lo contado no puede ser negativo")

    const conteo = await d.conteos.get(conteoId)
    if (!conteo) throw new Error("Conteo no encontrado")
    if (conteo.estado !== "abierto") throw new Error("El conteo ya está cerrado")

    // El nombre no debe chocar con un producto existente: ese ya vive en el
    // snapshot del conteo (o es servicio/compuesto).
    if (await d.productos.get(nombre)) {
        throw new Error(`"${nombre}" ya existe en tu inventario — cuéntalo en su renglón normal del conteo`)
    }

    const existente = (await d.conteo_items.where("conteo_id").equals(conteoId).toArray())
        .find(f => f.producto === nombre && f.variacion === "")
    if (existente) {
        await d.conteo_items.update(existente.id, { inicial })
        return { ok: true, accion: "actualizado", producto: nombre }
    }

    await d.conteo_items.add({
        id: crypto.randomUUID(),
        conteo_id: conteoId,
        producto_id: null,
        producto: nombre,
        variacion: "",
        esperado: 0,
        contado,
        vivo: null,
        delta: null,
        resolucion: null,
        origen: "manual",
        inicial,
    })
    return { ok: true, accion: "creado", producto: nombre }
}

// ============================================================================
// Cierre: resolución de diferencias contra el stock VIVO
// ============================================================================
interface ChunkPeps {
    id_lote: string
    cantidad: number
    costo_unitario: number
    precio_lista: number
    stock_resultante: number
}

/**
 * Consume `cantidad` PEPS (lote más antiguo con stock primero) de un
 * producto+variación: ACTUALIZA los lotes y devuelve los chunks consumidos
 * (el ledger lo escriben los llamadores, que conocen el concepto correcto).
 * Si la variación dejó de existir o el stock no alcanza, se lanza y el
 * cierre entero se aborta (nada se marca cerrado — paridad con el rollback
 * transaccional del backend).
 */
async function consumirStockPeps(
    producto: string,
    variacionNombre: string,
    cantidad: number
): Promise<ChunkPeps[]> {
    const d = abrirDB()
    // Resolver el id de la variación por NOMBRE (si desapareció a mitad del
    // conteo, el cierre se frena — igual que el backend).
    let variacionId: number | null = null
    if (variacionNombre) {
        const v = (await d.variaciones.where("producto").equals(producto).toArray())
            .find(x => x.nombre === variacionNombre)
        if (!v) {
            throw new Error(
                `La variación "${variacionNombre}" ya no existe. Quita esa captura del conteo ` +
                "o vuelve a crear la variación antes de cerrar.")
        }
        variacionId = v.id ?? null
    }

    const candidatos = (await d.lotes
        .where("estado").equals("Activo")
        .filter(l => l.producto === producto
            && (variacionId == null ? !l.variacion_id : l.variacion_id === variacionId))
        .toArray())
        .sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada) || a.id_lote.localeCompare(b.id_lote))

    let pendiente = cantidad
    const chunks: ChunkPeps[] = []
    for (const lote of candidatos) {
        if (pendiente <= EPS) break
        const tomado = Math.min(lote.stock_lote, pendiente)
        if (tomado <= 0) continue
        const restante = redondear3(Math.max(0, lote.stock_lote - tomado))
        await d.lotes.update(lote.id_lote, { stock_lote: restante })
        chunks.push({
            id_lote: lote.id_lote,
            cantidad: tomado,
            costo_unitario: lote.costo,
            precio_lista: lote.precio_venta,
            stock_resultante: restante,
        })
        pendiente = redondear3(pendiente - tomado)
    }
    if (pendiente > EPS) {
        throw new Error(`No hay stock registrado de "${producto}" para resolver la diferencia.`)
    }
    return chunks
}

/**
 * Devuelve TRUE solo si existe la variación por nombre. Los caminos de
 * cierre que crean lotes la necesitan para mapear nombre → variacion_id.
 */
async function resolverVariacionId(
    producto: string,
    variacionNombre: string
): Promise<number | null> {
    const d = abrirDB()
    if (!variacionNombre) return null
    const v = (await d.variaciones.where("producto").equals(producto).toArray())
        .find(x => x.nombre === variacionNombre)
    if (!v) {
        throw new Error(
            `La variación "${variacionNombre}" ya no existe. Quita esa captura del conteo ` +
            "o vuelve a crear la variación antes de cerrar.")
    }
    return v.id ?? null
}

/** Cierra la sesión resolviendo cada diferencia contra el stock vivo. */
export async function cerrarConteo(
    conteoId: string,
    resoluciones: ResolucionConteoItem[],
    fecha?: string
): Promise<{ ok: boolean; resumen: ResumenConteo }> {
    const d = abrirDB()
    const conteo = await d.conteos.get(conteoId)
    if (!conteo) throw new Error("Conteo no encontrado")
    if (conteo.estado !== "abierto") {
        throw new Error("El conteo ya está cerrado; revisa el historial para ver su resultado.")
    }

    // Fecha de las ventas declaradas: 'YYYY-MM-DD' o ISO completo; nunca futura.
    let fechaVenta: string | null = null
    if (fecha && String(fecha).trim()) {
        const s = String(fecha).trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            if (s > hoyISO()) {
                throw new Error("La fecha de las ventas declaradas no puede ser futura")
            }
            fechaVenta = `${s} 00:00`
        } else {
            if (s.slice(0, 10) > hoyISO()) {
                throw new Error("La fecha de las ventas declaradas no puede ser futura")
            }
            fechaVenta = s.replace("T", " ").slice(0, 16)
        }
    }
    const ahoraTexto = ahoraISO().replace("T", " ")

    const items = (await d.conteo_items.where("conteo_id").equals(conteoId).toArray())
        .sort((a, b) => a.producto.localeCompare(b.producto) || a.variacion.localeCompare(b.variacion))
    const stockVivo = await snapshotAgrupado()
    const vivo = new Map(stockVivo.map(s => [`${s.producto}||${s.variacion}`, s.stock]))

    const pedidas = new Map<string, ResolucionConteoItem>(
        (resoluciones || []).map(r => [
            `${r.producto}||${(r.variacion || "").trim()}`, r]))

    const resumen: ResumenConteo = {
        cuadrados: 0, sin_contar: 0, omitidos: 0,
        mermas: 0, merma_costo: 0,
        ventas: 0, venta_total: 0,
        entradas: 0, ajustes: 0,
    }
    interface VentaPendiente {
        fecha: string; producto: string; cantidad: number; precio_lista: number
        precio_real: number; costo_unitario: number; total_venta: number; ganancia_bruta: number
        id_lote: string | null; variacion: string; descripcion: string
    }
    const ventasAGuardar: VentaPendiente[] = []

    for (const it of items) {
        const key = `${it.producto}||${it.variacion}`
        const contado = it.contado

        // Sin captura → no se resuelve (el usuario no llegó a contarlo).
        if (contado === null || contado === undefined) {
            await d.conteo_items.update(it.id, { vivo: null, delta: null, resolucion: "sin_contar" })
            resumen.sin_contar++
            continue
        }

        // ── Renglón MANUAL (producto que nunca se registró) ──
        if ((it.origen || "snapshot") === "manual") {
            const pedida = pedidas.get(key) || ({} as ResolucionConteoItem)
            const costoM = pedida.costo != null ? redondear(pedida.costo) : 0
            if (costoM < 0) {
                throw new Error(`"${it.producto}": el costo no puede ser negativo`)
            }
            const precioRealM = pedida.precio_real != null ? redondear(pedida.precio_real) : null
            const inicialM = it.inicial ?? null
            const vendidas = inicialM === null ? null : redondear3(inicialM - contado)

            // Alta del producto no registrado (reutiliza si ya existe de stock)
            const yaExiste = await d.productos.get(it.producto)
            if (!yaExiste) {
                await d.productos.add({
                    producto: it.producto,
                    descripcion: "Dado de alta desde un conteo de auditoría",
                    imagen: "",
                    estado: "Activo",
                    tipo_producto: "stock",
                    categorias: [],
                    post_override: null,
                })
            } else if ((yaExiste.tipo_producto || "stock") !== "stock") {
                throw new Error(
                    `Ya existe un producto/servicio no-contable llamado "${it.producto}". ` +
                    "Usa otro nombre para el renglón no registrado.")
            }

            // Venta declarada (solo si recordó el inicial y vendió algo)
            if (vendidas !== null && vendidas > EPS) {
                if (precioRealM === null) {
                    throw new Error(
                        `"${it.producto}": declara el precio REAL al que vendió — ` +
                        "al no estar registrado no hay precio de lista")
                }
                if (precioRealM < 0) {
                    throw new Error(`"${it.producto}": el precio real de la venta declarada no puede ser negativo`)
                }
                ventasAGuardar.push({
                    fecha: fechaVenta || ahoraTexto,
                    producto: it.producto,
                    cantidad: vendidas,
                    precio_lista: precioRealM,
                    precio_real: precioRealM,
                    costo_unitario: costoM,
                    total_venta: redondear(precioRealM * vendidas),
                    ganancia_bruta: redondear((precioRealM - costoM) * vendidas),
                    id_lote: null,
                    variacion: "",
                    descripcion: "Venta declarada en conteo (producto no registrado)",
                })
                resumen.ventas++
            }

            // Alta del remanente físico (si quedó algo que contar)
            if (contado > EPS) {
                // Sin precio declarado, el lote hereda el precio real de la
                // venta (mejor default que 0: el producto acaba de nacer).
                const precioLote = pedida.precio_venta != null ? redondear(pedida.precio_venta) : precioRealM
                const idLote = `LT-${crypto.randomUUID().slice(0, 13)}`
                const lote: LoteLocal = {
                    id_lote: idLote,
                    producto: it.producto,
                    costo: costoM,
                    precio_venta: precioLote ?? 0,
                    stock_lote: contado,
                    fecha_entrada: ahoraISO(),
                    estado: "Activo",
                    etiqueta: "Conteo",
                    variacion_id: null,
                    variacion: undefined,
                }
                await d.lotes.add(lote)
                await registrarMovimiento({
                    producto: it.producto,
                    variacion: null,
                    id_lote: idLote,
                    tipo: "entrada",
                    origen: "conteo",
                    cantidad: contado,
                    stock_resultante: contado,
                    referencia_id: conteoId,
                    concepto: "Alta desde conteo (producto no registrado)",
                })
                resumen.entradas++
            }

            // Historial autocontenido: vivo=inicial declarado; delta=contado−vivo
            const resolucionManual: import("@/types").ResolucionConteo =
                vendidas !== null && vendidas > EPS ? "venta" : "entrada_no_registrada"
            await d.conteo_items.update(it.id, {
                vivo: inicialM,
                delta: inicialM !== null ? redondear3(contado - inicialM) : null,
                resolucion: resolucionManual,
            })
            continue
        }

        // El producto desapareció durante el conteo (baja/renombre): omite.
        if (!vivo.has(key)) {
            await d.conteo_items.update(it.id, { vivo: null, delta: null, resolucion: "sin_contar" })
            resumen.sin_contar++
            resumen.omitidos++
            continue
        }

        const v = vivo.get(key)!
        const delta = redondear3(contado - v)
        if (Math.abs(delta) <= EPS) {
            await d.conteo_items.update(it.id, { vivo: v, delta, resolucion: "cuadrado" })
            resumen.cuadrados++
            continue
        }

        const pedida = pedidas.get(key) || ({} as ResolucionConteoItem)
        let res = (pedida.resolucion || "").trim().toLowerCase()
        if (!res) res = delta < 0 ? "merma" : "error_sistema"
        if (delta < 0 && !["merma", "venta", "error_sistema"].includes(res)) {
            throw new Error(
                `"${it.producto}" (${it.variacion || "base"}): faltan ${Math.abs(delta)} — ` +
                "un faltante solo admite merma, venta o error_sistema")
        }
        if (delta > 0 && !["entrada_no_registrada", "error_sistema"].includes(res)) {
            throw new Error(
                `"${it.producto}" (${it.variacion || "base"}): sobran ${delta} — ` +
                "un sobrante solo admite entrada_no_registrada o error_sistema")
        }

        const cantidad = Math.abs(delta)

        if (res === "venta") {
            // Venta declarada: descuenta PEPS y cada chunk se cobra al precio
            // REAL declarado (o al de lista del lote que salió). El ledger de
            // la venta se firma tras crear la orden retroactiva.
            const precioDeclarado = pedida.precio_real
            if (precioDeclarado != null && precioDeclarado < 0) {
                throw new Error(
                    `"${it.producto}" (${it.variacion || "base"}): ` +
                    "el precio real de la venta declarada no puede ser negativo")
            }
            const chunks = await consumirStockPeps(it.producto, it.variacion, cantidad)
            for (const ch of chunks) {
                const precio = precioDeclarado != null ? redondear(precioDeclarado) : redondear(ch.precio_lista)
                ventasAGuardar.push({
                    fecha: fechaVenta || ahoraTexto,
                    producto: it.producto,
                    cantidad: ch.cantidad,
                    precio_lista: redondear(ch.precio_lista),
                    precio_real: precio,
                    costo_unitario: redondear(ch.costo_unitario),
                    total_venta: redondear(precio * ch.cantidad),
                    ganancia_bruta: redondear((precio - ch.costo_unitario) * ch.cantidad),
                    id_lote: ch.id_lote,
                    variacion: it.variacion,
                    descripcion: "Venta declarada en conteo de auditoría",
                })
            }
        } else if ((res === "merma" || res === "error_sistema") && delta < 0) {
            // FALTANTE: el stock sale de los lotes (PEPS) SIN venta.
            // merma → tipo 'salida' (pérdida); error_sistema → 'ajuste'.
            const tipoLedger: "salida" | "ajuste" = res === "merma" ? "salida" : "ajuste"
            const concepto = res === "merma"
                ? "Merma detectada en conteo"
                : "Corrección de stock en conteo (faltante)"
            const chunks = await consumirStockPeps(it.producto, it.variacion, cantidad)
            for (const ch of chunks) {
                await registrarMovimiento({
                    producto: it.producto,
                    variacion: it.variacion || null,
                    id_lote: ch.id_lote,
                    tipo: tipoLedger,
                    origen: "conteo",
                    cantidad: -ch.cantidad,
                    stock_resultante: ch.stock_resultante,
                    referencia_id: conteoId,
                    concepto,
                })
                if (res === "merma") {
                    resumen.merma_costo += ch.costo_unitario * ch.cantidad
                }
            }
        } else if (res === "entrada_no_registrada") {
            // Sobrante = mercancía que llegó sin darse de alta: lote nuevo.
            await crearLoteEntrada(it.producto, it.variacion, cantidad, pedida, conteoId,
                "Mercancía hallada en conteo (ingreso no registrado)")
        } else {
            // SOBRANTE con error_sistema: ajuste +stock sobre el lote activo.
            await ajustarSobrante(it.producto, it.variacion, cantidad, conteoId)
        }

        if (res === "merma") resumen.mermas++
        else if (res === "venta") resumen.ventas++
        else if (res === "entrada_no_registrada") resumen.entradas++
        else resumen.ajustes++

        await d.conteo_items.update(it.id, {
            vivo: v, delta,
            resolucion: res as import("@/types").ResolucionConteo,
        })
    }

    // ── Orden retroactiva con las ventas declaradas ──
    // Mismo formato de cobro que el POS: folio consecutivo, pago en efectivo
    // ("el dinero llegó a la mano") y fecha de la venta declarada.
    if (ventasAGuardar.length > 0) {
        const total = redondear(ventasAGuardar.reduce((s, v) => s + v.total_venta, 0))
        const ganancia = redondear(ventasAGuardar.reduce((s, v) => s + v.ganancia_bruta, 0))
        const cantidadItems = redondear3(ventasAGuardar.reduce((s, v) => s + v.cantidad, 0))
        const ticketsExistentes = await d.ordenes.orderBy("n_ticket").last()
        const nTicket = (ticketsExistentes?.n_ticket || 0) + 1
        const ordenId = crypto.randomUUID()
        const fechaOrden = fechaVenta || ahoraTexto
        await d.ordenes.add({
            id: ordenId,
            n_ticket: nTicket,
            fecha: fechaOrden,
            total,
            ganancia,
            cantidad_items: cantidadItems,
            estado: "Activa",
            metodo_pago: "efectivo",
            pagos: [{
                metodo: "efectivo",
                monto: total,
                referencia: "Declarada en conteo de auditoría",
                terminal_id: null,
                comision: 0,
            }],
            propina: 0,
            monto_recibido: null,
            cambio: null,
            comision_total: 0,
            cliente_id: null,
            turno_id: null,
        })
        for (const v of ventasAGuardar) {
            await d.ventas.add({
                orden_id: ordenId,
                n_ticket: nTicket,
                fecha: v.fecha,
                producto: v.producto,
                cantidad: v.cantidad,
                precio_lista: redondear(v.precio_lista),
                precio_real: redondear(v.precio_real),
                costo_unitario: redondear(v.costo_unitario),
                total_venta: v.total_venta,
                ganancia_bruta: v.ganancia_bruta,
                estado: "Activo",
                tipo_producto: "stock",
                variacion: v.variacion || undefined,
                descripcion: v.descripcion,
                id_lote: v.id_lote,
                consumo: null,
            })
            await registrarMovimiento({
                producto: v.producto,
                variacion: v.variacion || null,
                id_lote: v.id_lote,
                tipo: "salida",
                origen: "venta",
                cantidad: -v.cantidad,
                stock_resultante: null,
                referencia_id: ordenId,
                concepto: `Ticket #${nTicket} — venta declarada en conteo`,
            })
        }
        resumen.venta_total = total
        resumen.orden_id = ordenId
        resumen.n_ticket = nTicket
    }

    // ── Gasto automático de merma: la pérdida figura en Egresos ──
    resumen.merma_costo = redondear(resumen.merma_costo)
    if (resumen.merma_costo > 0) {
        let categoria = (await d.gastos_categorias.toArray()).find(c => c.nombre === "Merma")
        if (!categoria) {
            const id = crypto.randomUUID()
            await d.gastos_categorias.add({ id, nombre: "Merma" })
        }
        const mermaId = await d.gastos.add({
            fecha: hoyISO(),
            categoria: "Merma",
            descripcion: `Merma del conteo de auditoría — ${resumen.mermas} producto(s)`,
            monto: resumen.merma_costo,
            estado: "Activo",
            gasto_programado_id: null,
        }) as unknown as number
        resumen.gasto_merma_id = mermaId
    }

    // Cerrar el conteo con su resumen (el veredicto de cada renglón ya quedó
    // persistido renglón por renglón dentro del bucle).
    await d.conteos.update(conteoId, {
        estado: "cerrado",
        cerrado_at: ahoraISO(),
        resumen,
    })
    return { ok: true, resumen }
}

// ============================================================================
// Auxiliares de escritura de stock
// ============================================================================
/** Lote nuevo por mercancía hallada / alta desde conteo (etiqueta 'Conteo'). */
async function crearLoteEntrada(
    producto: string,
    variacionNombre: string,
    cantidad: number,
    pedida: ResolucionConteoItem,
    conteoId: string,
    concepto: string
): Promise<void> {
    const d = abrirDB()
    const variacionId = await resolverVariacionId(producto, variacionNombre)
    // Costo/precio por defecto: los del último lote activo de esa variación.
    const ultimo = (await d.lotes
        .where("estado").equals("Activo")
        .filter(l => l.producto === producto
            && (variacionId == null ? !l.variacion_id : l.variacion_id === variacionId))
        .toArray())
        .sort((a, b) => b.fecha_entrada.localeCompare(a.fecha_entrada))[0]
    const costo = pedida.costo != null ? redondear(pedida.costo) : (ultimo?.costo ?? 0)
    const precio = pedida.precio_venta != null ? redondear(pedida.precio_venta) : (ultimo?.precio_venta ?? 0)
    const idLote = `LT-${crypto.randomUUID().slice(0, 13)}`
    await d.lotes.add({
        id_lote: idLote,
        producto,
        costo,
        precio_venta: precio,
        stock_lote: cantidad,
        fecha_entrada: ahoraISO(),
        estado: "Activo",
        etiqueta: "Conteo",
        variacion_id: variacionId,
        variacion: variacionNombre || undefined,
    })
    await registrarMovimiento({
        producto,
        variacion: variacionNombre || null,
        id_lote: idLote,
        tipo: "entrada",
        origen: "conteo",
        cantidad,
        stock_resultante: cantidad,
        referencia_id: conteoId,
        concepto,
    })
}

/** SOBRANTE con error_sistema: suma stock al lote activo más reciente (o crea uno). */
async function ajustarSobrante(
    producto: string,
    variacionNombre: string,
    cantidad: number,
    conteoId: string
): Promise<void> {
    const d = abrirDB()
    const variacionId = await resolverVariacionId(producto, variacionNombre)
    const activos = (await d.lotes
        .where("estado").equals("Activo")
        .filter(l => l.producto === producto
            && (variacionId == null ? !l.variacion_id : l.variacion_id === variacionId))
        .toArray())
        .sort((a, b) => b.fecha_entrada.localeCompare(a.fecha_entrada))
    let idLote: string
    let stockResultante: number
    if (activos.length) {
        idLote = activos[0].id_lote
        stockResultante = redondear3(activos[0].stock_lote + cantidad)
        await d.lotes.update(idLote, { stock_lote: stockResultante })
    } else {
        idLote = `LT-${crypto.randomUUID().slice(0, 13)}`
        stockResultante = cantidad
        await d.lotes.add({
            id_lote: idLote,
            producto,
            costo: 0,
            precio_venta: 0,
            stock_lote: cantidad,
            fecha_entrada: ahoraISO(),
            estado: "Activo",
            variacion_id: variacionId,
            variacion: variacionNombre || undefined,
        })
    }
    await registrarMovimiento({
        producto,
        variacion: variacionNombre || null,
        id_lote: idLote,
        tipo: "ajuste",
        origen: "conteo",
        cantidad,
        stock_resultante: stockResultante,
        referencia_id: conteoId,
        concepto: "Corrección de stock en conteo (sobrante)",
    })
}
