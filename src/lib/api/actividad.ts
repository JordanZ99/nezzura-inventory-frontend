// ==============================================================================
// src/lib/api/actividad.ts
// Cliente HTTP del Historial completo (migración 062). Solo-nube: hoy el modo
// local no tiene registro de actividad server-side.
// ==============================================================================

import { request, conQuery } from "./client"
import type { RespuestaActividad } from "@/types"

export interface ActividadFiltros {
    limit?: number
    offset?: number
    /** 'producto' | 'cliente' | 'cobro' — vacío = todos. */
    dominio?: string
    /** Búsqueda libre sobre el resumen legible. */
    texto?: string
    /** 'YYYY-MM-DD' (inclusivo), zona horaria del negocio. */
    desde?: string
    hasta?: string
}

export const actividadApi = {
    listar: (params?: ActividadFiltros) =>
        request<RespuestaActividad>(conQuery("/actividad", {
            limit: params?.limit,
            offset: params?.offset,
            dominio: params?.dominio || undefined,
            texto: params?.texto || undefined,
            desde: params?.desde || undefined,
            hasta: params?.hasta || undefined,
        })),
}
