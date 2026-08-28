// ==============================================================================
// src/hooks/useEstadisticasCalculos.ts
// Transformación de las RESPUESTAS del servidor (resumen/serie/statsProductos/
// historial) al contrato de los componentes: KPIs, cobros, top5, datos de las
// 4 gráficas, catálogo de productos con sus métricas, paginación del historial.
// Ya no recibe ni recalcula dumps de ventas/gastos: la BDD suma, esto dibuja.
// ==============================================================================

import type { Producto } from "@/lib/api"
import type { ResumenStats, FilaSerie, StatsProducto, RespuestaOrdenesPaginadas } from "@/lib/api"
import { categoriasUnicas, compararProductos, filtrarProductos } from "@/lib/ordenamiento"

interface PropsEstadisticasCalculos {
    resumen: ResumenStats | null
    serie: FilaSerie[]
    statsProductos: StatsProducto[]
    historial: RespuestaOrdenesPaginadas | null
    productos: Producto[]
    busquedaProdDebounced: string
    catSelecProd: string
    ordenProd: string
}

interface FilaCostoGanancia {
    name: string
    "Costo Lotes": number
    "Ganancia": number
    total: number
}

const CERO_COBROS = { efectivo: 0, tarjeta_debito: 0, tarjeta_credito: 0, no_registrado: 0 }

export function useEstadisticasCalculos({ resumen, serie, statsProductos, historial, productos, busquedaProdDebounced, catSelecProd, ordenProd }: PropsEstadisticasCalculos) {
    const ITEMS_POR_PAGINA = historial?.por_pagina ?? 10

    // ── Historial de tickets: paginado en servidor ──
    const ordenesPaginadas = historial?.ordenes ?? []
    const totalTickets = historial?.total ?? 0
    const totalPaginas = historial?.total_paginas ?? 1

    // ── KPIs: llegan ya calculados por la BDD ──
    const totalVendido = resumen?.total_vendido ?? 0
    const gananciaBruta = resumen?.ganancia_bruta ?? 0
    const totalGastos = resumen?.total_gastos ?? 0
    const gananciaNeta = gananciaBruta - totalGastos
    const costoTotalGlobal = totalVendido - gananciaBruta
    const ticketPromedio = resumen?.ticket_promedio ?? 0

    const cobrosPorMetodo = resumen?.cobros_por_metodo ?? CERO_COBROS
    const propinasPeriodo = resumen?.propinas ?? 0
    const conMetodo = resumen?.con_metodo ?? false
    const porTerminal = resumen?.por_terminal ?? []

    // ── Gráficas (transformaciones de las respuestas) ──
    const globalCostProfit = [
        { name: "Costo de Productos", value: costoTotalGlobal },
        { name: "Ganancia Bruta", value: gananciaBruta }
    ]

    // Top 5 productos + "Otros" (lo que no está en el top, respecto al total)
    const topOrdenados = [...(resumen?.top_productos ?? [])].sort((a, b) => b.total - a.total)
    const top5 = topOrdenados.slice(0, 5).map(p => ({ name: p.producto, value: p.total }))
    const sumaTop5 = top5.reduce((a, p) => a + p.value, 0)
    const otros = totalVendido - sumaTop5
    if (otros > 0.005) top5.push({ name: "Otros", value: otros })

    // Línea de evolución: un punto por cubo (día/semana/mes según el rango)
    const chartDataLine = serie.map(f => ({ date: f.periodo, "Ventas": f.ventas }))

    // Contribución marginal por producto: un renglón por producto vendido
    const chartDataBar: FilaCostoGanancia[] = statsProductos
        .map(p => ({ name: p.producto, "Costo Lotes": p.total - p.ganancia, "Ganancia": p.ganancia, total: p.total }))
        .sort((a, b) => b.total - a.total)

    // ── Catálogo de productos con métricas del período ──
    const categoriasCatalogo = categoriasUnicas(productos)
    const statsPorProducto = new Map(statsProductos.map(p => [p.producto, p]))
    // Los 4 órdenes de ventas/ganancia dependen de los totales por producto
    // que llegan del servidor; el resto delega en compararProductos.
    const productosFiltrados = filtrarProductos(productos, busquedaProdDebounced, catSelecProd, true)
        .sort((a, b) => {
            const sa = statsPorProducto.get(a.producto)
            const sb = statsPorProducto.get(b.producto)
            switch (ordenProd) {
                case "ventas-desc": return (sb?.unidades ?? 0) - (sa?.unidades ?? 0)
                case "ventas-asc": return (sa?.unidades ?? 0) - (sb?.unidades ?? 0)
                case "ganancia-desc": return (sb?.ganancia ?? 0) - (sa?.ganancia ?? 0)
                case "ganancia-asc": return (sa?.ganancia ?? 0) - (sb?.ganancia ?? 0)
                default: return compararProductos(a, b, ordenProd)
            }
        })

    /** Métricas de un producto: búsqueda en el mapa de respuestas (sin recorrer ventas). */
    function getVentasProducto(prod: Producto) {
        const s = statsPorProducto.get(prod.producto)
        return {
            totalVentas: s?.num_ventas ?? 0,
            totalVendido: s?.total ?? 0,
            totalGanancia: s?.ganancia ?? 0,
            totalUnidades: s?.unidades ?? 0,
        }
    }

    const valFormatter = (number: number) => `$${Intl.NumberFormat("us").format(number).toString()}`

    /**
     * Genera el rango de páginas con truncado inteligente.
     * - Móvil (< 900px): máximo 3 números de página
     * - Escritorio (>= 900px): máximo 9 números de página (casillas)
     * Siempre muestra primera y última página.
     */
    function getPaginationRange(current: number, total: number, mobile: boolean): (number | "ellipsis")[] {
        if (mobile) {
            if (total <= 3) {
                return Array.from({ length: total }, (_, i) => i + 1)
            }
            if (current <= 2) {
                return [1, 2, "ellipsis", total]
            }
            if (current >= total - 1) {
                return [1, "ellipsis", total - 1, total]
            }
            return [1, "ellipsis", current, "ellipsis", total]
        }

        // Desktop: hasta 9 casillas
        if (total <= 9) {
            return Array.from({ length: total }, (_, i) => i + 1)
        }

        if (current <= 4) {
            return [1, 2, 3, 4, 5, "ellipsis", total]
        }

        if (current >= total - 3) {
            return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total]
        }

        return [1, "ellipsis", current - 2, current - 1, current, current + 1, current + 2, "ellipsis", total]
    }

    return {
        ITEMS_POR_PAGINA,
        ordenesPaginadas,
        totalTickets,
        totalPaginas,
        categoriasCatalogo,
        productosFiltrados,
        getVentasProducto,
        totalVendido,
        gananciaBruta,
        totalGastos,
        gananciaNeta,
        ticketPromedio,
        cobrosPorMetodo,
        propinasPeriodo,
        conMetodo,
        porTerminal,
        globalCostProfit,
        top5,
        chartDataLine,
        chartDataBar,
        valFormatter,
        getPaginationRange,
    }
}
