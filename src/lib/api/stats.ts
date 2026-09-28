import { conQuery, request } from "./client"
import type {
    ResumenStats,
    FilaSerie,
    StatsProducto,
    Venta,
    RangoFechas
} from "@/types"

export const statsApi = {
    getStatsResumen: (rango?: RangoFechas & { todo?: boolean }) =>
        request<ResumenStats>(
            conQuery("/stats/resumen", { desde: rango?.desde, hasta: rango?.hasta, todo: rango?.todo ? 1 : undefined })
        ),
    getStatsSerie: (params?: RangoFechas & { granularidad?: string; todo?: boolean }) =>
        request<FilaSerie[]>(
            conQuery("/stats/serie", {
                desde: params?.desde,
                hasta: params?.hasta,
                granularidad: params?.granularidad ?? "auto",
                todo: params?.todo ? 1 : undefined,
            })
        ),
    getStatsProductos: (rango?: RangoFechas & { todo?: boolean }) =>
        request<StatsProducto[]>(
            conQuery("/stats/productos", { desde: rango?.desde, hasta: rango?.hasta, todo: rango?.todo ? 1 : undefined })
        ),
    getVentasProductoStats: (producto: string, rango?: RangoFechas & { todo?: boolean }) =>
        request<Venta[]>(
            conQuery("/stats/ventas-producto", {
                producto,
                desde: rango?.desde,
                hasta: rango?.hasta,
                todo: rango?.todo ? 1 : undefined,
            })
        ),
}
