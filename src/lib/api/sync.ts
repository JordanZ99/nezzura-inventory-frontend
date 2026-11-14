// ==============================================================================
// src/lib/api/sync.ts
// HTTP de sincronización del Modo Offline híbrido. Usa request() NORMAL:
// el híbrido opera con SESIÓN Supabase (no licencia de dispositivo), así
// que los headers estándar sirven tal cual.
// ==============================================================================

import { request } from "./client"

/** Delta del dispositivo. Las secciones son opcionales: el extractor solo
 * manda lo que cambió (hash contra el espejo local). */
export interface SolicitudSync {
    /** Cursor de bajada del dispositivo (para detectar divergencias) */
    desde?: string | null
    productos?: Record<string, unknown>[]
    variaciones?: Record<string, unknown>[]
    lotes?: Record<string, unknown>[]
    ediciones_productos?: Record<string, unknown>[]
    ediciones_lotes?: Record<string, unknown>[]
    ordenes?: Record<string, unknown>[]
    gastos?: Record<string, unknown>[]
}

export interface RespuestaSync {
    ok: boolean
    subidas: {
        productos: number
        variaciones: number
        lotes: number
        ordenes: number
        ventas: number
        gastos: number
        ediciones_productos: number
        ediciones_lotes: number
    }
    omitidas: { ventas_sin_producto: number; lotes_sin_producto: number }
    /** Filas que la nube tenía más nuevas que el cursor del dispositivo */
    divergencias: { tabla: string; clave: string }[]
    /** Stock en negativo tras el replay PEPS: verdad del negocio, no error */
    alertas: { tipo: string; id_lote: string; producto: string; stock: number }[]
}

export interface DeltaNube {
    ok: boolean
    cursor: string
    productos: Record<string, unknown>[]
    categorias: Record<string, unknown>[]
    variaciones: Record<string, unknown>[]
    lotes: Record<string, unknown>[]
    config: Record<string, unknown> | null
}

export function subirSync(payload: SolicitudSync): Promise<RespuestaSync> {
    return request<RespuestaSync>("/sync/subir", {
        method: "POST",
        body: JSON.stringify(payload),
    })
}

export function bajarSync(desde?: string | null): Promise<DeltaNube> {
    const q = desde ? `?desde=${encodeURIComponent(desde)}` : ""
    return request<DeltaNube>(`/sync/bajar${q}`)
}

/** Auditoría: últimas decisiones de la sync (LWW, descartados). */
export function logSync(limite = 30): Promise<{ ok: boolean; log: Record<string, unknown>[] }> {
    return request(`/sync/log?limite=${limite}`)
}
