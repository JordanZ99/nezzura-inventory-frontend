// ==============================================================================
// src/lib/api/conteos.ts
// Conteos de auditoría (migración 041): abrir sesión, autosave de capturas,
// cierre con resoluciones e historial.
// ==============================================================================

import { conQuery, request } from "./client"
import type { CapturaConteo, Conteo, ConteoItem, ResolucionConteoItem, ResumenConteo } from "@/types"

export const conteosApi = {
    /** Sesión abierta (con sus renglones) o conteo: null si no hay ninguna. */
    getConteoActivo: () =>
        request<{ ok: boolean; conteo: Conteo | null; items: ConteoItem[] }>("/inventario/conteos/activo"),

    /** Abre una sesión congelando el snapshot del stock actual. */
    abrirConteo: () =>
        request<{ ok: boolean; conteo: Conteo; items: ConteoItem[] }>("/inventario/conteos", { method: "POST" }),

    /** Autosave: fija el total contado (absoluto) de cada renglón. */
    guardarCapturas: (conteoId: string, items: CapturaConteo[]) =>
        request<{
            ok: boolean
            guardados: number
            no_encontrados: { producto: string; variacion: string }[]
        }>(`/inventario/conteos/${conteoId}/items`, {
            method: "PATCH",
            body: JSON.stringify({ items }),
        }),

    /**
     * Cierra la sesión resolviendo cada diferencia contra el stock VIVO.
     * Todo atómico: si una resolución falla, no se aplica nada.
     */
    cerrarConteo: (conteoId: string, items: ResolucionConteoItem[], fecha?: string) =>
        request<{ ok: boolean; resumen: ResumenConteo }>(`/inventario/conteos/${conteoId}/cerrar`, {
            method: "POST",
            body: JSON.stringify({ items, fecha: fecha || null }),
        }),

    /** Historial de sesiones cerradas (con su resumen). */
    getHistorialConteos: (limit?: number) =>
        request<Conteo[]>(conQuery("/inventario/conteos", { limit })),

    /** Detalle de una sesión (abierto o cerrado) con el veredicto por renglón. */
    getConteo: (conteoId: string) =>
        request<{ ok: boolean; conteo: Conteo; items: ConteoItem[] }>(`/inventario/conteos/${conteoId}`),
}
