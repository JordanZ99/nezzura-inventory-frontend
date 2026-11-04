// ==============================================================================
// src/lib/api/cobros.ts
// Cliente HTTP del dominio "Cobros" (giro 'servicios', migración 059).
// Sin puerto Modo Local por ahora: la app de servicios siempre corre en nube.
// ==============================================================================

import { request, conQuery } from "./client"
import type { Cobro, CuotaCliente, EntradaPrograma, ResumenCobros } from "@/types"

export interface CobroExtraPayload {
    cliente_id: string
    concepto: string
    monto: number
    vencimiento?: string | null   // ISO (YYYY-MM-DD)
    programa?: EntradaPrograma[]
    notas?: string
}

export interface CobroEditarPayload {
    concepto?: string
    monto?: number
    /** undefined = sin cambio; "" = quitar la fecha; "YYYY-MM-DD" = fijar. */
    vencimiento?: string | ""
    programa?: EntradaPrograma[]
    notas?: string
}

export interface CuotaPayload {
    cliente_id: string
    concepto: string
    monto: number
    dia_cobro: number
    notas?: string
}

export interface CuotaEditarPayload {
    cliente_id?: string
    concepto?: string
    monto?: number
    dia_cobro?: number
    activo?: boolean
    notas?: string
}

export interface AbonoPayload {
    monto: number
    metodo?: "efectivo" | "transferencia" | "tarjeta" | "otro" | null
    fecha?: string                 // ISO; ausente = hoy (backend)
}

export const cobrosApi = {
    getResumen: (periodo?: string) =>
        request<ResumenCobros>(conQuery("/cobros/resumen", { periodo })),

    // Idempotente: re-generar el mismo mes no duplica cobros.
    generar: (periodo: string) =>
        request<{ ok: boolean; creados: number; omitidos: number; periodo: string; mensaje: string }>(
            "/cobros/generar", { method: "POST", body: JSON.stringify({ periodo }) }
        ),

    listar: (params?: { periodo?: string; cliente_id?: string; solo_pendientes?: boolean }) =>
        request<Cobro[]>(conQuery("/cobros/", {
            periodo: params?.periodo,
            cliente_id: params?.cliente_id,
            solo_pendientes: params?.solo_pendientes ? true : undefined,
        })),

    crearExtra: (data: CobroExtraPayload) =>
        request<{ ok: boolean; cobro: Cobro }>("/cobros/", { method: "POST", body: JSON.stringify(data) }),

    actualizarCobro: (id: string, data: CobroEditarPayload) =>
        request<{ ok: boolean; cobro: Cobro }>(`/cobros/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    eliminarCobro: (id: string) =>
        request<{ ok: boolean; mensaje: string }>(`/cobros/${id}`, { method: "DELETE" }),

    // ── Abonos (dinero entrante; el saldo lo recalcula el backend) ──
    abonar: (id: string, data: AbonoPayload) =>
        request<{ ok: boolean; saldo: number; estado: string }>(`/cobros/${id}/pagos`, {
            method: "POST", body: JSON.stringify(data),
        }),

    quitarAbono: (id: string, indice: number) =>
        request<{ ok: boolean; saldo: number; estado: string }>(`/cobros/${id}/pagos/${indice}`, { method: "DELETE" }),

    // ── Cuotas (suscripciones mensuales) ──
    getCuotas: (soloActivas = false) =>
        request<CuotaCliente[]>(conQuery("/cobros/cuotas", { solo_activas: soloActivas || undefined })),

    crearCuota: (data: CuotaPayload) =>
        request<{ ok: boolean; cuota: CuotaCliente }>("/cobros/cuotas", { method: "POST", body: JSON.stringify(data) }),

    actualizarCuota: (id: string, data: CuotaEditarPayload) =>
        request<{ ok: boolean; cuota: CuotaCliente }>(`/cobros/cuotas/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    eliminarCuota: (id: string) =>
        request<{ ok: boolean; mensaje: string }>(`/cobros/cuotas/${id}`, { method: "DELETE" }),
}
