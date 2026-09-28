import { request } from "./client"
import type { Turno } from "@/types"

export const turnosApi = {
    getTurnos: (limit = 50) => request<Turno[]>(`/turnos/?limit=${limit}`),
    abrirTurno: (monto_apertura: number) =>
        request<{ ok: boolean; turno: Turno }>("/turnos/", {
            method: "POST",
            body: JSON.stringify({ monto_apertura }),
        }),
    cerrarTurno: (turnoId: string, efectivo_contado: number, notas?: string) =>
        request<{ ok: boolean; efectivo_esperado: number; efectivo_contado: number; diferencia: number }>(
            `/turnos/${turnoId}/cerrar`,
            { method: "POST", body: JSON.stringify({ efectivo_contado, notas }) }
        ),
    editarTurno: (turnoId: string, data: { monto_apertura?: number; efectivo_contado?: number; notas?: string | null }) =>
        request<
            | { ok: boolean; mensaje: string } // turno abierto
            | { ok: boolean; efectivo_esperado: number; efectivo_contado: number; diferencia: number } // corrección de arqueo
        >(
            `/turnos/${turnoId}`,
            { method: "PATCH", body: JSON.stringify(data) }
        ),
}
