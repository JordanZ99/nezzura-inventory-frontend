import { request, conQuery } from "./client"
import type {
    Cliente, ClienteDetalle, ResumenClientes,
    Etiqueta, Segmento, LtvResumen, Interaccion, TipoInteraccion,
} from "@/types"

export interface CrearClientePayload {
    nombre: string
    email?: string
    telefono?: string
    pin?: string
    notas?: string
    /** CRM: cumpleaños ISO (YYYY-MM-DD) y canal/campaña de adquisición. */
    cumpleanos?: string | null
    origen?: string | null
}

export interface ActualizarClientePayload {
    nombre?: string
    email?: string
    telefono?: string
    /** undefined = sin cambio; "" = quitar contraseña; valor = re-hashear. */
    pin?: string
    notas?: string
    activo?: boolean
    /** CRM: undefined = sin cambio; "" = borrar; "YYYY-MM-DD" = fijar. */
    cumpleanos?: string | ""
    origen?: string
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

    // ── CRM (Fase B: etiquetas libres, timeline, segmentos y LTV) ──

    //Catálogo de etiquetas del negocio (con conteo de clientes por etiqueta).
    getEtiquetas: () => request<Etiqueta[]>("/clientes/etiquetas"),

    crearEtiqueta: (nombre: string, color?: string) =>
        request<{ ok: boolean; etiqueta: Etiqueta }>("/clientes/etiquetas", {
            method: "POST", body: JSON.stringify({ nombre, color: color ?? null }),
        }),

    actualizarEtiqueta: (id: string, data: { nombre?: string; color?: string }) =>
        request<{ ok: boolean; etiqueta: Etiqueta }>(`/clientes/etiquetas/${id}`, {
            method: "PATCH", body: JSON.stringify(data),
        }),

    //Elimina la etiqueta y la desasigna de todos los clientes (CASCADE).
    eliminarEtiqueta: (id: string) =>
        request<{ ok: boolean; mensaje: string }>(`/clientes/etiquetas/${id}`, { method: "DELETE" }),

    //Sincroniza el set de etiquetas de UN cliente (replace-all): la lista
    //enviada ES el resultado final.
    setEtiquetasCliente: (idCliente: string, etiquetaIds: string[]) =>
        request<{ ok: boolean; etiquetas: Etiqueta[] }>(`/clientes/${idCliente}/etiquetas`, {
            method: "PUT", body: JSON.stringify({ etiqueta_ids: etiquetaIds }),
        }),

    //Nueva nota de seguimiento: nota | llamada | visita | promo.
    addInteraccion: (idCliente: string, tipo: TipoInteraccion, texto: string, creadoPor?: string) =>
        request<{ ok: boolean; interaccion: Interaccion }>(`/clientes/${idCliente}/interacciones`, {
            method: "POST", body: JSON.stringify({ tipo, texto, creado_por: creadoPor ?? null }),
        }),

    getInteracciones: (idCliente: string, limite = 50) =>
        request<Interaccion[]>(conQuery(`/clientes/${idCliente}/interacciones`, { limite })),

    //Segmentos dinámicos de la cartera activa (censados contra compras/puntos).
    getSegmentos: () => request<Segmento[]>("/clientes/segmentos"),

    //LTV con datos observados: por cliente, resumen global y por segmento.
    getLtv: (horizonteMeses = 12) =>
        request<LtvResumen>(conQuery("/clientes/ltv", { horizonte_meses: horizonteMeses })),
}
