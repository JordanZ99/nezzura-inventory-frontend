import { request, conQuery } from "./client"
import type { Cliente, ClienteDetalle, ResumenClientes } from "@/types"

export interface CrearClientePayload {
    nombre: string
    email?: string
    telefono?: string
    pin?: string
    notas?: string
}

export interface ActualizarClientePayload {
    nombre?: string
    email?: string
    telefono?: string
    /** undefined = sin cambio; "" = quitar contraseña; valor = re-hashear. */
    pin?: string
    notas?: string
    activo?: boolean
}

export const clientesApi = {
    getClientes: (params?: { q?: string; incluir_inactivos?: boolean }) =>
        request<Cliente[]>(conQuery("/clientes/", { q: params?.q, incluir_inactivos: params?.incluir_inactivos })),

    crearCliente: (data: CrearClientePayload) =>
        request<{ ok: boolean; cliente: Cliente }>("/clientes/", { method: "POST", body: JSON.stringify(data) }),

    //Identificación en el POS: valida número/correo + contraseña con hash en el backend.
    verificarCliente: (identificador: string, pin?: string) =>
        request<{ ok: boolean; cliente: { id: string; nombre: string; email: string | null; telefono: string | null; saldo_puntos: number } }>(
            "/clientes/verificar",
            { method: "POST", body: JSON.stringify({ identificador, pin: pin ?? null }) }
        ),

    getCliente: (id: string) => request<ClienteDetalle>(`/clientes/${id}`),

    actualizarCliente: (id: string, data: ActualizarClientePayload) =>
        request<{ ok: boolean; cliente: ClienteDetalle }>(`/clientes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    //Baja lógica: conserva el historial de compras y movimientos de puntos.
    eliminarCliente: (id: string) =>
        request<{ ok: boolean; mensaje: string }>(`/clientes/${id}`, { method: "DELETE" }),

    //Ajuste manual del ledger: puntos > 0 da, < 0 quita (propio del promo manual).
    ajustarPuntos: (id: string, puntos: number, concepto: string) =>
        request<{ ok: boolean; saldo_anterior: number; saldo_nuevo: number; cliente: string }>(
            `/clientes/${id}/puntos`,
            { method: "POST", body: JSON.stringify({ puntos, concepto }) }
        ),

    //KPIs de fidelización del período (tab "Clientes" de Estadísticas).
    //granularidad 'auto': la BDD elige cubos día/semana/mes según el ancho.
    getStatsClientes: (params?: { desde?: string; hasta?: string; todo?: boolean; granularidad?: string }) =>
        request<ResumenClientes>(conQuery("/stats/clientes", {
            desde: params?.desde,
            hasta: params?.hasta,
            todo: params?.todo,
            granularidad: params?.granularidad,
        })),
}
