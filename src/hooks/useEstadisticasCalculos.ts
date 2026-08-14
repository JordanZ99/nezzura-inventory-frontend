// ==============================================================================
// src/hooks/useEstadisticasCalculos.ts
// Cálculos puros de Estadísticas: recibe ventas/gastos/productos + los estados
// de filtro por props (patrón useInventarioForm) y devuelve los derivados:
// ventasFiltradas (fechas + búsqueda + 6 órdenes), gastosFiltrados, KPIs,
// datos de las 4 gráficas, unidadesPorProducto / gananciaPorProducto,
// categoriasCatalogo, productosFiltrados (10 órdenes), getVentasProducto,
// getPaginationRange y la paginación (totalPaginas / ventasPaginadas).
// ==============================================================================

import type { Venta, Gasto, Producto } from "@/lib/api"
import type { DateRangePickerValue } from "@tremor/react"

interface PropsEstadisticasCalculos {
    ventas: Venta[]
    gastos: Gasto[]
    productos: Producto[]
    dates: DateRangePickerValue
    busquedaVentas: string
    ordenVentas: string
    busquedaProdDebounced: string
    catSelecProd: string
    ordenProd: string
    paginaActual: number
}

interface FilaCostoGanancia {
    name: string
    "Costo Lotes": number
    "Ganancia": number
    total: number
}

export function useEstadisticasCalculos({ ventas, gastos, productos, dates, busquedaVentas, ordenVentas, busquedaProdDebounced, catSelecProd, ordenProd, paginaActual }: PropsEstadisticasCalculos) {
    const ITEMS_POR_PAGINA = 10

    // --- Filtrado ---
    const ventasFiltradas = ventas.filter(v => {
        const f = new Date(v.fecha)
        if (dates.from && f < dates.from) return false
        if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
        // Buscador por nombre o descripción del producto
        if (busquedaVentas.trim()) {
            const q = busquedaVentas.toLowerCase()
            const prod = v.producto?.toLowerCase().includes(q)
            if (!prod) return false
        }
        return true
    }).sort((a, b) => {
        switch (ordenVentas) {
            case "fecha-asc": return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
            case "monto-desc": return (b.total_venta || 0) - (a.total_venta || 0)
            case "monto-asc": return (a.total_venta || 0) - (b.total_venta || 0)
            case "producto": return (a.producto || "").localeCompare(b.producto || "")
            case "ganancia-desc": return (b.ganancia_bruta || 0) - (a.ganancia_bruta || 0)
            case "fecha-desc":
            default: return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        }
    })

    const gastosFiltrados = gastos.filter(g => {
        const f = new Date(g.fecha)
        if (dates.from && f < dates.from) return false
        if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
        return true
    })

    // --- Catálogo de productos ---
    const categoriasCatalogo = ["Todas", ...Array.from(new Set(productos.flatMap(p => (p.categoria || ["General"]).map(c => c.trim())))).sort()]

    // Unidades totales vendidas por producto (suma de cantidades)
    const unidadesPorProducto = ventas
        .filter(v => v.estado !== "Inactivo")
        .reduce((acc, v) => {
            acc[v.producto] = (acc[v.producto] || 0) + v.cantidad
            return acc
        }, {} as Record<string, number>)
    // Ganancia bruta total por producto
    const gananciaPorProducto = ventas
        .filter(v => v.estado !== "Inactivo")
        .reduce((acc, v) => {
            acc[v.producto] = (acc[v.producto] || 0) + v.ganancia_bruta
            return acc
        }, {} as Record<string, number>)

    const productosFiltrados = productos.filter(p => {
        const q = busquedaProdDebounced.toLowerCase()
        const porBusqueda = !q || p.producto.toLowerCase().includes(q) ||
            p.descripcion?.toLowerCase().includes(q) ||
            p.codigo_interno?.toLowerCase().includes(q) ||
            p.codigo_barras?.toLowerCase().includes(q) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(q)
        const porCategoria = catSelecProd === "Todas" || (p.categoria || ["General"]).includes(catSelecProd)
        return porBusqueda && porCategoria
    }).sort((a, b) => {
        switch (ordenProd) {
            case "alfabetico-desc": return b.producto.localeCompare(a.producto, "es", { sensitivity: "base" })
            case "precio-desc": return b.precio_venta - a.precio_venta
            case "precio-asc": return a.precio_venta - b.precio_venta
            case "stock-desc": return b.stock_total - a.stock_total
            case "stock-asc": return a.stock_total - b.stock_total
            case "ventas-desc": return (unidadesPorProducto[b.producto] || 0) - (unidadesPorProducto[a.producto] || 0)
            case "ventas-asc": return (unidadesPorProducto[a.producto] || 0) - (unidadesPorProducto[b.producto] || 0)
            case "ganancia-desc": return (gananciaPorProducto[b.producto] || 0) - (gananciaPorProducto[a.producto] || 0)
            case "ganancia-asc": return (gananciaPorProducto[a.producto] || 0) - (gananciaPorProducto[b.producto] || 0)
            case "alfabetico":
            default: return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
        }
    })

    function getVentasProducto(prod: Producto) {
        const ventasProd = ventas.filter(v => v.producto === prod.producto && v.estado !== "Inactivo")
        const ventasEnRango = ventasProd.filter(v => {
            const f = new Date(v.fecha)
            if (dates.from && f < dates.from) return false
            if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
            return true
        })
        const totalVendido = ventasEnRango.reduce((a, v) => a + v.total_venta, 0)
        const totalGanancia = ventasEnRango.reduce((a, v) => a + v.ganancia_bruta, 0)
        const totalUnidades = ventasEnRango.reduce((a, v) => a + v.cantidad, 0)
        return { totalVentas: ventasEnRango.length, totalVendido, totalGanancia, totalUnidades }
    }

    // --- Paginación ---
    const totalPaginas = Math.max(1, Math.ceil(ventasFiltradas.length / ITEMS_POR_PAGINA))
    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA
    const ventasPaginadas = ventasFiltradas.slice(inicio, inicio + ITEMS_POR_PAGINA)

    // --- KPIs ---
    const ventasActivas = ventasFiltradas.filter(v => v.estado !== "Inactivo")

    const totalVendido = ventasActivas.reduce((a, v) => a + v.total_venta, 0)
    const gananciaBruta = ventasActivas.reduce((a, v) => a + v.ganancia_bruta, 0)
    const totalGastos = gastosFiltrados.reduce((a, g) => a + g.monto, 0)
    const gananciaNeta = gananciaBruta - totalGastos
    const costoTotalGlobal = totalVendido - gananciaBruta

    // --- Transformación de datos para Gráficas ---
    const globalCostProfit = [
        { name: "Costo de Productos", value: costoTotalGlobal },
        { name: "Ganancia Bruta", value: gananciaBruta }
    ]

    const productSales = ventasActivas.reduce((acc, v) => {
        acc[v.producto] = (acc[v.producto] || 0) + v.total_venta
        return acc
    }, {} as Record<string, number>)
    const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1])
    const top5 = sortedProducts.slice(0, 5).map(p => ({ name: p[0], value: p[1] }))
    const otros = sortedProducts.slice(5).reduce((a, p) => a + p[1], 0)
    if (otros > 0) top5.push({ name: "Otros", value: otros })

    const salesByDate = ventasActivas.reduce((acc, v) => {
        const d = v.fecha.substring(0, 10)
        acc[d] = (acc[d] || 0) + v.total_venta
        return acc
    }, {} as Record<string, number>)
    const chartDataLine = Object.entries(salesByDate).sort((a, b) => a[0].localeCompare(b[0])).map(d => ({ date: d[0], "Ventas": d[1] }))

    const productCostProfit = ventasActivas.reduce((acc, v) => {
        if (!acc[v.producto]) acc[v.producto] = { name: v.producto, "Costo Lotes": 0, "Ganancia": 0, total: 0 }
        acc[v.producto]["Costo Lotes"] += (v.total_venta - v.ganancia_bruta)
        acc[v.producto]["Ganancia"] += v.ganancia_bruta
        acc[v.producto].total += v.total_venta
        return acc
    }, {} as Record<string, FilaCostoGanancia>)
    const chartDataBar = Object.values(productCostProfit).sort((a, b) => b.total - a.total)

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
        ventasFiltradas,
        gastosFiltrados,
        categoriasCatalogo,
        productosFiltrados,
        getVentasProducto,
        totalPaginas,
        ventasPaginadas,
        totalVendido,
        gananciaBruta,
        totalGastos,
        gananciaNeta,
        globalCostProfit,
        top5,
        chartDataLine,
        chartDataBar,
        valFormatter,
        getPaginationRange,
    }
}
