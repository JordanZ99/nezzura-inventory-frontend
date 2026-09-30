import { conQuery, request } from "./client"
import type { AnalisisInteligente, RangoFechas } from "@/types"

export const analiticaApi = {
    getAnalisis: (rango?: RangoFechas & { todo?: boolean }) =>
        request<AnalisisInteligente>(
            conQuery("/analitica/resumen", {
                desde: rango?.desde,
                hasta: rango?.hasta,
                todo: rango?.todo ? 1 : undefined,
            })
        ),
}
