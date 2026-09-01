import { conQuery, conRango, request } from "./client"
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
    getStatsSerie: (params?: RangoFechas & { granularidad?: string }) =>
        request<FilaSerie[]>(conQuery("/stats/serie", { ...params })),
    getStatsProductos: (rango?: RangoFechas) =>
        request<StatsProducto[]>(conRango("/stats/productos", rango)),
    getVentasProductoStats: (producto: string, rango?: RangoFechas) =>
        request<Venta[]>(conQuery("/stats/ventas-producto", { producto, desde: rango?.desde, hasta: rango?.hasta })),
}
