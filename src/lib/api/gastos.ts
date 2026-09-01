import { conRango, request } from "./client"
import type { Gasto, GastoProgramado, RangoFechas } from "@/types"

export const gastosApi = {
    // Gastos
    getGastos: (rango?: RangoFechas) => request<Gasto[]>(conRango("/gastos/", rango)),
    crearGasto: (data: {
        fecha: string
        categoria: string
        descripcion: string
        monto: number
        estado?: string
        gasto_programado_id?: string
    }) => request("/gastos/", { method: "POST", body: JSON.stringify(data) }),
    actualizarGasto: (id: number, data: { monto: number; categoria: string; descripcion: string }) =>
        request(`/gastos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    confirmarGasto: (id: number) => request(`/gastos/${id}/confirmar`, { method: "PUT" }),
    descartarGasto: (id: number) => request(`/gastos/${id}/descartar`, { method: "PUT" }),
    eliminarGasto: (id: number) => request(`/gastos/${id}`, { method: "DELETE" }),

    // Gastos Programados
    getGastosProgramados: () => request<GastoProgramado[]>("/gastos_programados"),
    crearGastoProgramado: (data: {
        nombre: string
        tipo: string
        valor: number
        frecuencia: string
        proxima_fecha: string
    }) => request("/gastos_programados", { method: "POST", body: JSON.stringify(data) }),
    ejecutarGastoProgramado: (id: string) =>
        request<{ ok: boolean; monto: number; nombre: string; mensaje: string }>(
            `/gastos_programados/${id}/ejecutar`,
            { method: "POST" }
        ),
    estimarMontoGastoProgramado: (id: string) =>
        request<{
            ok: boolean
            monto: number
            tipo: string
            nombre: string
            proxima_fecha: string
            ganancia_bruta: number
            ganancia_neta: number
            total_gastos: number
        }>(`/gastos_programados/${id}/estimacion`),
    actualizarGastoProgramado: (
        id: string,
        data: { nombre?: string; tipo?: string; valor?: number; frecuencia?: string; proxima_fecha?: string }
    ) => request<{ ok: boolean; mensaje: string }>(`/gastos_programados/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    eliminarGastoProgramado: (id: string) =>
        request<{ ok: boolean; mensaje: string }>(`/gastos_programados/${id}`, { method: "DELETE" }),

    // Categorías de gasto
    getCategoriasGasto: () => request<{ id: string; nombre: string }[]>("/gastos/categorias"),
    crearCategoriaGasto: (nombre: string) =>
        request<{ ok: boolean; categoria: { id: string; nombre: string }; mensaje: string }>("/gastos/categorias", {
            method: "POST",
            body: JSON.stringify({ nombre }),
        }),
    editarCategoriaGasto: (viejoNombre: string, nuevoNombre: string) =>
        request<{ ok: boolean; categoria: { id: string; nombre: string } }>(
            `/gastos/categorias/${encodeURIComponent(viejoNombre)}`,
            { method: "PUT", body: JSON.stringify({ nuevo_nombre: nuevoNombre }) }
        ),
    eliminarCategoriaGasto: (categoria: string) =>
        request<{ ok: boolean; categoria_eliminada: string }>(
            `/gastos/categorias/${encodeURIComponent(categoria)}`,
            { method: "DELETE" }
        ),
}
