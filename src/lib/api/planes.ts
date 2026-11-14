// ==============================================================================
// src/lib/api/planes.ts
// Cliente HTTP del dominio "Mis cuentas" (giro 'servicios', migración 075):
// registro manual de planes del gestor por cliente. Siempre nube (igual que
// cobros): el giro servicios no tiene puerto Modo Local.
// ==============================================================================

import { request, conQuery } from "./client"
import type { PlanCliente, EstadoCobroPlan } from "@/types"

export interface PlanPayload {
    cliente_id: string
    plan: string
    estado_cobro: EstadoCobroPlan
    /** Informativo; undefined = sin monto. */
    monto_acordado?: number | null
    /** 'YYYY-MM-DD'; ausente = hoy (backend). */
    otorgado?: string
    notas?: string
}

export interface PlanEditarPayload {
    cliente_id?: string
    plan?: string
    estado_cobro?: EstadoCobroPlan
    /** undefined = sin cambio; 0 = quitar el monto; >0 = fijar. */
    monto_acordado?: number
    otorgado?: string
    notas?: string
}

export const planesApi = {
    listar: (estado?: EstadoCobroPlan) =>
        request<PlanCliente[]>(conQuery("/planes/", { estado })),

    crear: (data: PlanPayload) =>
        request<{ ok: boolean; plan: PlanCliente }>("/planes/", {
            method: "POST", body: JSON.stringify(data),
        }),

    actualizar: (id: string, data: PlanEditarPayload) =>
        request<{ ok: boolean; plan: PlanCliente }>(`/planes/${id}`, {
            method: "PATCH", body: JSON.stringify(data),
        }),

    eliminar: (id: string) =>
        request<{ ok: boolean; mensaje: string }>(`/planes/${id}`, { method: "DELETE" }),
}
