import { conQuery, conRango, request } from "./client"
import type {
    Venta,
    Orden,
    RespuestaOrdenesPaginadas,
    ItemCarrito,
    RangoFechas
} from "@/types"

export const ventasApi = {
    getVentas: (rango?: RangoFechas) => request<Venta[]>(conRango("/ventas/", rango)),
    getOrdenes: (limit = 500, rango?: RangoFechas) =>
        request<Orden[]>(conRango(`/ventas/ordenes?limit=${limit}`, rango)),
    getOrdenesPaginadas: (
        params: RangoFechas & { pagina?: number; por_pagina?: number; busqueda?: string; orden?: string }
    ) => request<RespuestaOrdenesPaginadas>(conQuery("/ventas/ordenes/paginadas", { ...params })),

    actualizarOrden: (ordenId: string, data: { fecha: string }) =>
        request<{ ok: boolean; n_ticket: number }>(`/ventas/ordenes/${ordenId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),
    anularOrden: (ordenId: string) =>
        request<{ ok: boolean; anuladas: number; stock_restaurado?: number }>(`/ventas/ordenes/${ordenId}`, {
            method: "DELETE",
        }),
    cobrarCarrito: (
        items: ItemCarrito[],
        pago?: {
            metodo: string
            propina?: number
            pagos?: { metodo: string; monto: number; referencia?: string; terminal_id?: string }[]
            monto_recibido?: number
            terminal_id?: string
        }
    ) =>
        request<{
            ok: boolean
            ventas: number
            total_cobrado: number
            n_ticket?: number | null
            metodo_pago?: string | null
            propina?: number
            cambio?: number | null
        }>("/ventas/cobrar", {
            method: "POST",
            body: JSON.stringify({ items, pago: pago ?? null }),
        }),
    actualizarVenta: (
        id: number,
        data: {
            fecha?: string
            precio_real?: number
            costo_unitario?: number
            cantidad?: number
            total_venta?: number
            ganancia_bruta?: number
        }
    ) => request(`/ventas/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    eliminarVenta: (id: number) => request(`/ventas/${id}`, { method: "DELETE" }),
}
