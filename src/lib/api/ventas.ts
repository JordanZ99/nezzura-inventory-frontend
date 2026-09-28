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
        params: RangoFechas & { pagina?: number; por_pagina?: number; busqueda?: string; orden?: string; todo?: boolean }
    ) =>
        request<RespuestaOrdenesPaginadas>(
            conQuery("/ventas/ordenes/paginadas", {
                desde: params.desde,
                hasta: params.hasta,
                todo: params.todo ? 1 : undefined,
                pagina: params.pagina,
                por_pagina: params.por_pagina,
                busqueda: params.busqueda,
                orden: params.orden,
            })
        ),

    actualizarOrden: (ordenId: string, data: { fecha?: string; metodo_pago?: string; propina?: number }) =>
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
        },
        mesa_id?: string | null,
        // ── Cliente + puntos (Fase B): canje y ajuste manual en el ticket ──
        cliente?: {
            cliente_id: string
            puntos_usados?: number
            ajuste_puntos?: number
            ajuste_concepto?: string
        } | null
    ) =>
        request<{
            ok: boolean
            ventas: number
            total_cobrado: number
            n_ticket?: number | null
            metodo_pago?: string | null
            propina?: number
            cambio?: number | null
            mesa_id?: string | null
            mesa_nombre?: string | null
            cliente_id?: string | null
            cliente_nombre?: string | null
            puntos_ganados?: number
            puntos_canjeados?: number
            saldo_cliente?: number | null
        }>("/ventas/cobrar", {
            method: "POST",
            body: JSON.stringify({
                items,
                pago: pago ?? null,
                mesa_id: mesa_id || null,
                ...(cliente ? {
                    cliente_id: cliente.cliente_id,
                    puntos_usados: cliente.puntos_usados ?? 0,
                    ajuste_puntos: cliente.ajuste_puntos ?? 0,
                    ajuste_concepto: cliente.ajuste_concepto ?? null,
                } : {}),
            }),
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
