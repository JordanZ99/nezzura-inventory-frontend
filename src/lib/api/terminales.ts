import { request } from "./client"
import type { Terminal } from "@/types"

export const terminalesApi = {
    getTerminales: () => request<Terminal[]>("/terminales/"),
    crearTerminal: (data: {
        nombre: string
        banco?: string
        comision_debito_pct: number
        comision_credito_pct: number
        comision_fija: number
    }) => request<{ ok: boolean }>("/terminales/", { method: "POST", body: JSON.stringify(data) }),
    actualizarTerminal: (
        id: string,
        data: Partial<{
            nombre: string
            banco: string
            comision_debito_pct: number
            comision_credito_pct: number
            comision_fija: number
            activo: boolean
        }>
    ) => request<{ ok: boolean }>(`/terminales/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    eliminarTerminal: (id: string) => request<{ ok: boolean }>(`/terminales/${id}`, { method: "DELETE" }),
}
