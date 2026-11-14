// ==============================================================================
// src/lib/api/ordenes.ts
// Cliente HTTP del dominio "Órdenes de servicio" (giro 'servicios', mig 077).
// Siempre nube (igual que cobros): el giro servicios no tiene puerto Modo Local.
// ==============================================================================

import { request, conQuery } from "./client"
import type { OrdenServicio, EstadoOrden, TipoOrden } from "@/types"

export interface OrdenPayload {
    titulo: string
    tipo?: TipoOrden
    cliente_id?: string | null
    equipo?: string | null
    detalle_reportado?: string | null
    solucion?: string | null
    estado?: EstadoOrden
    fecha_recibido?: string
    precio?: number | null
    notas?: string
}

export interface OrdenEditarPayload {
    cliente_id?: string | null
    tipo?: TipoOrden
    titulo?: string
    equipo?: string | null
    detalle_reportado?: string | null
    solucion?: string | null
    estado?: EstadoOrden
    fecha_recibido?: string
    /** undefined = sin cambio; "" = quitarla; "YYYY-MM-DD" = fijar. */
    fecha_entregado?: string | ""
    /** undefined = sin cambio; 0 = quitar; >0 = fijar. */
    precio?: number
    /** Enlace de cobro (mutuamente excluyentes): cobro puntual → cobro_id;
     *  venta a plazos → cuota_id. Mig 078. */
    cobro_id?: string | null
    cuota_id?: string | null
    notas?: string | null
}

export const ordenesApi = {
    listar: (params?: { estado?: EstadoOrden; cliente_id?: string; solo_abiertas?: boolean }) =>
        request<OrdenServicio[]>(conQuery("/ordenes/", {
            estado: params?.estado,
            cliente_id: params?.cliente_id,
            solo_abiertas: params?.solo_abiertas ? true : undefined,
        })),

    crear: (data: OrdenPayload) =>
        request<{ ok: boolean; orden: OrdenServicio }>("/ordenes/", {
            method: "POST", body: JSON.stringify(data),
        }),

    actualizar: (id: string, data: OrdenEditarPayload) =>
        request<{ ok: boolean; orden: OrdenServicio }>(`/ordenes/${id}`, {
            method: "PATCH", body: JSON.stringify(data),
        }),

    eliminar: (id: string) =>
        request<{ ok: boolean; mensaje: string }>(`/ordenes/${id}`, { method: "DELETE" }),
}
