// ==============================================================================
// src/lib/local/repos/stats.ts
// Estadísticas en LOCAL — misma respuesta que database/stats.py, pero agregada
// en el navegador sobre IndexedDB (ventas/ordenes/gastos). El frontend nunca ve
// renglones: lo que sale son KPIs, series en cubos y tops.
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import type { ResumenStats, FilaSerie, StatsProducto, Venta, RangoFechas } from "@/types"
import type { VentaLocal, GastoLocal, OrdenLocal } from "../db"

function redondear(n: number): number {
    return Math.round(n * 100) / 100
}

/** Sin rango → mes contable actual (como resolver_rango_q del backend). */
export function resolverRango(rango?: RangoFechas & { todo?: boolean }): {
    desde: string | null
    hasta: string | null
} {
    if (rango?.todo) return { desde: null, hasta: null }
    if (rango?.desde || rango?.hasta) return { desde: rango.desde ?? null, hasta: rango.hasta ?? null }
    const hoy = new Date()
    return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10), hasta: null }
}

// ============================================================================
// Resumen (GET /stats/resumen)
// ============================================================================
export async function getStatsResumen(
    rango?: RangoFechas & { todo?: boolean }
): Promise<ResumenStats> {
    const d = abrirDB()
    const { desde, hasta } = resolverRango(rango)

    const enVentana = (fecha: string): boolean => {
        const dia = fecha.slice(0, 10)
        return (!desde || dia >= desde) && (!hasta || dia < hasta)
    }

    const compras = await d.ventas.toArray()
    const ventas: VentaLocal[] = compras.filter(v => enVentana(v.fecha))

    const activas = ventas.filter(v => v.estado !== "Anulada")
    const totalVendido = redondear(activas.reduce((s, v) => s + v.total_venta, 0))
    const gananciaBruta = redondear(activas.reduce((s, v) => s + v.ganancia_bruta, 0))
    const unidades = redondear(activas.reduce((s, v) => s + v.cantidad, 0))

    // Gastos: por día contable; 'pendiente'/'descartado' no son salida de caja
    const gastosFilas: GastoLocal[] = (await d.gastos.toArray())
        .filter(g => enVentana(g.fecha))
    const gastoReal = (g: GastoLocal): boolean =>
        !["pendiente", "Pendiente", "descartado", "Descartado"].includes(g.estado || "")
    const totalGastos = redondear(gastosFilas.filter(gastoReal).reduce((s, g) => s + g.monto, 0))

    // Tickets activos en la ventana
    const ordenes: OrdenLocal[] = (await d.ordenes.toArray()).filter(o => enVentana(o.fecha))
    const activasOrden = ordenes.filter(o => o.estado !== "Anulada")
    const tickets = activasOrden.length

    // Cobros por método (orden activa suma cada pago); legado sin pagos → total
    let efectivo = 0, debito = 0, credito = 0, otros = 0, legado = 0
    const porTerminal = new Map<string, { cobrado: number; comision: number }>()
    let propinas = 0
    let conMetodo = false
    for (const o of activasOrden) {
        propinas = redondear(propinas + (o.propina || 0))
        if (o.metodo_pago) conMetodo = true
        const pagos = Array.isArray(o.pagos) ? o.pagos : []
        if (!pagos.length) {
            legado = redondear(legado + o.total)
            continue
        }
        for (const p of pagos) {
            if (p.metodo === "efectivo") efectivo = redondear(efectivo + p.monto)
            else if (p.metodo === "tarjeta_debito") debito = redondear(debito + p.monto)
            else if (p.metodo === "tarjeta_credito") credito = redondear(credito + p.monto)
            else otros = redondear(otros + p.monto)
            if (p.terminal_id) {
                const nombre = (await d.terminales.get(p.terminal_id))?.nombre || p.terminal_id
                const fila = porTerminal.get(nombre) || { cobrado: 0, comision: 0 }
                fila.cobrado = redondear(fila.cobrado + p.monto)
                fila.comision = redondear(fila.comision + (p.comision || 0))
                porTerminal.set(nombre, fila)
            }
        }
    }

    // Top productos (mismo criterio de agregación que el backend)
    const acumulado = new Map<string, StatsProducto>()
    for (const v of activas) {
        const fila = acumulado.get(v.producto) || {
            producto: v.producto, total: 0, unidades: 0, ganancia: 0, num_ventas: 0,
        }
        fila.total = redondear(fila.total + v.total_venta)
        fila.unidades = redondear(fila.unidades + v.cantidad)
        fila.ganancia = redondear(fila.ganancia + v.ganancia_bruta)
        fila.num_ventas += 1
        acumulado.set(v.producto, fila)
    }
    const top = [...acumulado.values()].sort((a, b) => b.total - a.total).slice(0, 10)

    return {
        total_vendido: totalVendido,
        ganancia_bruta: gananciaBruta,
        unidades,
        num_ventas: activas.length,
        num_anuladas: ventas.filter(v => v.estado === "Anulada").length,
        tickets,
        ticket_promedio: tickets > 0 ? redondear(totalVendido / tickets) : 0,
        total_gastos: totalGastos,
        cobros_por_metodo: {
            efectivo,
            tarjeta_debito: debito,
            tarjeta_credito: credito,
            no_registrado: redondear(otros + legado),
        },
        propinas,
        con_metodo: conMetodo,
        por_terminal: [...porTerminal.entries()]
            .map(([nombre, t]) => ({ nombre, ...t }))
            .sort((a, b) => b.cobrado - a.cobrado),
        top_productos: top,
    }
}

// ============================================================================
// Serie temporal en cubos (GET /stats/serie)
// ============================================================================
function inicioCubo(fechaDia: string, granularidad: string): string {
    if (granularidad === "dia") return fechaDia
    if (granularidad === "mes") return `${fechaDia.slice(0, 7)}-01`
    // Semana → lunes ISO de esa fecha
    const f = new Date(`${fechaDia}T12:00:00`)
    const diaSemana = (f.getDay() + 6) % 7   // 0 = lunes
    f.setDate(f.getDate() - diaSemana)
    return f.toISOString().slice(0, 10)
}

function resuelveGranularidad(desde: string | null, hasta: string | null, pedida: string): string {
    if (pedida === "dia" || pedida === "semana" || pedida === "mes") return pedida
    if (!desde) return "mes"                 // histórico abierto → cubos mensuales
    const fin = hasta
        ? new Date(`${hasta}T12:00:00`)
        : new Date(`${ahoraISO().slice(0, 10)}T12:00:00`)
    const dias = (fin.getTime() - new Date(`${desde}T12:00:00`).getTime()) / 86400000
    if (dias <= 62) return "dia"
    if (dias <= 730) return "semana"
    return "mes"
}

export async function getStatsSerie(
    params?: RangoFechas & { granularidad?: string; todo?: boolean }
): Promise<FilaSerie[]> {
    const d = abrirDB()
    const { desde, hasta } = resolverRango(params)
    const g = resuelveGranularidad(desde, hasta, params?.granularidad || "auto")

    const enVentana = (fecha: string): boolean => {
        const dia = fecha.slice(0, 10)
        return (!desde || dia >= desde) && (!hasta || dia < hasta)
    }

    const cubos = new Map<string, { ventas: number; ganancia: number; gastos: number }>()

    const compras = await d.ventas.toArray()
    for (const v of compras) {
        if (!enVentana(v.fecha) || v.estado === "Anulada") continue
        const periodo = inicioCubo(v.fecha.slice(0, 10), g)
        const fila = cubos.get(periodo) || { ventas: 0, ganancia: 0, gastos: 0 }
        fila.ventas = redondear(fila.ventas + v.total_venta)
        fila.ganancia = redondear(fila.ganancia + v.ganancia_bruta)
        cubos.set(periodo, fila)
    }

    const gastosFilas = await d.gastos.toArray()
    for (const ga of gastosFilas) {
        if (!enVentana(ga.fecha)) continue
        if (["pendiente", "Pendiente", "descartado", "Descartado"].includes(ga.estado || "")) continue
        const periodo = inicioCubo(ga.fecha.slice(0, 10), g)
        const fila = cubos.get(periodo) || { ventas: 0, ganancia: 0, gastos: 0 }
        fila.gastos = redondear(fila.gastos + ga.monto)
        cubos.set(periodo, fila)
    }

    return [...cubos.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([periodo, v]) => ({ periodo, ...v }))
}

// ============================================================================
// Totales por producto (GET /stats/productos)
// ============================================================================
export async function getStatsProductos(
    rango?: RangoFechas & { todo?: boolean }
): Promise<StatsProducto[]> {
    const d = abrirDB()
    const { desde, hasta } = resolverRango(rango)
    const enVentana = (fecha: string): boolean => {
        const dia = fecha.slice(0, 10)
        return (!desde || dia >= desde) && (!hasta || dia < hasta)
    }

    const compras = await d.ventas.toArray()
    const acumulado = new Map<string, StatsProducto>()
    for (const v of compras) {
        if (!enVentana(v.fecha) || v.estado === "Anulada") continue
        const fila = acumulado.get(v.producto) || {
            producto: v.producto, total: 0, unidades: 0, ganancia: 0, num_ventas: 0,
        }
        fila.total = redondear(fila.total + v.total_venta)
        fila.unidades = redondear(fila.unidades + v.cantidad)
        fila.ganancia = redondear(fila.ganancia + v.ganancia_bruta)
        fila.num_ventas += 1
        acumulado.set(v.producto, fila)
    }
    return [...acumulado.values()].sort((a, b) => b.total - a.total)
}

// ============================================================================
// Renglones de UN producto (GET /stats/ventas-producto → modal de detalle)
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

export async function getVentasProductoStats(
    producto: string,
    rango?: RangoFechas & { todo?: boolean }
): Promise<Venta[]> {
    const d = abrirDB()
    const { desde, hasta } = resolverRango(rango)
    let filas = await d.ventas.where("producto").equals(producto).toArray()
    filas = filas.filter(v => {
        const dia = v.fecha.slice(0, 10)
        return (!desde || dia >= desde) && (!hasta || dia < hasta)
    })
    filas.sort((a, b) => b.fecha.localeCompare(a.fecha))
    return filas.map((v, i) => filaVenta(v, v.id ?? i + 1))
}
