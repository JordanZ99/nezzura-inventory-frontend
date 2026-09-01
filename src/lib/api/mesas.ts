import { request } from "./client"
import type { Mesa } from "@/types"

export const mesasApi = {
    getMesas: () => request<Mesa[]>("/mesas/"),

    crearMesa: (data: { nombre: string; capacidad?: number | null }) =>
        request<{ ok: boolean; id: string; nombre: string }>("/mesas/", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    actualizarMesa: (id: string, data: { nombre?: string; capacidad?: number | null }) =>
        request<{ ok: boolean }>(`/mesas/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    eliminarMesa: (id: string) => request<{ ok: boolean }>(`/mesas/${id}`, { method: "DELETE" }),

    reordenarMesas: (mesas: { id: string; orden: number }[]) =>
        request<{ ok: boolean }>("/mesas/reordenar", {
            method: "PATCH",
            body: JSON.stringify({ mesas }),
        }),

    agregarItems: (mesaId: string, items: {
        producto: string
        cantidad: number
        precio_unitario: number
        descripcion?: string
        variacion?: string
        costo?: number
        notas?: string
    }[]) =>
        request<{ ok: boolean; agregados: number }>(`/mesas/${mesaId}/items`, {
            method: "POST",
            body: JSON.stringify({ items }),
        }),

    editarItem: (mesaId: string, itemId: string, data: { cantidad?: number; precio_unitario?: number; notas?: string }) =>
        request<{ ok: boolean }>(`/mesas/${mesaId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) }),

    quitarItem: (mesaId: string, itemId: string) =>
        request<{ ok: boolean }>(`/mesas/${mesaId}/items/${itemId}`, { method: "DELETE" }),

    pedirCuenta: (mesaId: string) =>
        request<{ ok: boolean; estado: string }>(`/mesas/${mesaId}/cuenta`, { method: "POST" }),

    regresarAOcupada: (mesaId: string) =>
        request<{ ok: boolean; estado: string }>(`/mesas/${mesaId}/regresar`, { method: "POST" }),

    cancelarOrden: (mesaId: string) =>
        request<{ ok: boolean; cancelados: number }>(`/mesas/${mesaId}/cancelar`, { method: "POST" }),
}
