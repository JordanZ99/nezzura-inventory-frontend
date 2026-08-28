// ==============================================================================
// src/hooks/useEstadisticasRango.ts
// Métricas de Estadísticas POR PERÍODO — todo "respuestas de la BDD":
//   - resumen: KPIs agregados en SQL (totales, cobros, top productos)
//   - serie: cubos temporales día/semana/mes (granularidad adaptativa)
//   - statsProductos: un renglón por producto vendido
//   - historial: tickets PAGINADOS en servidor (búsqueda/orden incluidas)
//   - ventasProducto: renglones de UN producto (modal de detalle)
// Las claves incluyen el rango: cada período se cachea por separado.
// ==============================================================================

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { DateRangePickerValue } from "@tremor/react"
import { api, type RangoFechas } from "@/lib/api"
import { useTenant } from "@/contexts/TenantContext"

const POR_PAGINA_HISTORIAL = 10

/** Convierte el DateRangePicker de Tremor al rango contable del backend. */
export function rangoDeDates(dates: DateRangePickerValue): RangoFechas {
    return {
        desde: dates.from ? fechaISO(dates.from) : undefined,
        hasta: dates.to ? fechaISO(dates.to) : undefined,
    }
}

function fechaISO(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${dd}`
}

interface Opciones {
    rango: RangoFechas
    pagina: number
    busqueda: string
    orden: string
    productoDetalle: string | null
}

export function useEstadisticasRango({ rango, pagina, busqueda, orden, productoDetalle }: Opciones) {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const rangoKey = `${rango.desde ?? ""}|${rango.hasta ?? ""}`

    const resumenQuery = useQuery({
        queryKey: ["stats-resumen", tenantId, rangoKey],
        queryFn: () => api.getStatsResumen(rango),
        enabled: Boolean(tenantId),
    })
    const serieQuery = useQuery({
        queryKey: ["stats-serie", tenantId, rangoKey],
        queryFn: () => api.getStatsSerie({ desde: rango.desde, hasta: rango.hasta, granularidad: "auto" }),
        enabled: Boolean(tenantId),
    })
    const productosStatsQuery = useQuery({
        queryKey: ["stats-productos", tenantId, rangoKey],
        queryFn: () => api.getStatsProductos(rango),
        enabled: Boolean(tenantId),
    })
    // Historial paginado en servidor: keepPreviousData evita el parpadeo al
    // cambiar de página o mientras llega la búsqueda con debounce.
    const historialQuery = useQuery({
        queryKey: ["ordenes-pag", tenantId, rangoKey, pagina, busqueda, orden],
        queryFn: () =>
            api.getOrdenesPaginadas({
                desde: rango.desde,
                hasta: rango.hasta,
                pagina,
                por_pagina: POR_PAGINA_HISTORIAL,
                busqueda: busqueda || undefined,
                orden,
            }),
        enabled: Boolean(tenantId),
        placeholderData: keepPreviousData,
    })
    // Renglones del producto abierto en el modal (una sola petición chica)
    const ventasProductoQuery = useQuery({
        queryKey: ["stats-venta-producto", tenantId, rangoKey, productoDetalle],
        queryFn: () => api.getVentasProductoStats(productoDetalle as string, rango),
        enabled: Boolean(tenantId && productoDetalle),
    })

    return {
        resumen: resumenQuery.data ?? null,
        serie: serieQuery.data ?? [],
        statsProductos: productosStatsQuery.data ?? [],
        historial: historialQuery.data ?? null,
        ventasProducto: ventasProductoQuery.data ?? [],
        cargando: resumenQuery.isPending || serieQuery.isPending || productosStatsQuery.isPending,
    }
}
