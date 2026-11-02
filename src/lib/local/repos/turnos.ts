// ==============================================================================
// src/lib/local/repos/turnos.ts
// Turnos de caja con arqueo — contracto idéntico a routers/turnos.py.
// El arqueo se calcula en vivo: ordenes del turno → efectivo esperado.
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import type { Turno } from "@/types"
import type { TurnoLocal } from "../db"

function redondear(n: number): number {
    return Math.round(n * 100) / 100
}

/** KPIs del turno contados en vivo (ordenes activas con turno_id). */
export async function calcularArqueo(turnoId: string): Promise<{
    num_ordenes: number
    total_turno: number
    efectivo_cobrado: number
}> {
    const d = abrirDB()
    const ordenes = (await d.ordenes.where("turno_id").equals(turnoId).toArray())
        .filter(o => o.estado === "Activa")
    let total = 0
    let efectivo = 0
    for (const o of ordenes) {
        total += o.total
        // Efectivo: de pagos mixtos cuenta solo el renglón de efectivo
        if (o.metodo_pago === "efectivo") efectivo += o.total
        else if (o.pagos) for (const p of o.pagos) if (p.metodo === "efectivo") efectivo += p.monto
    }
    return { num_ordenes: ordenes.length, total_turno: redondear(total), efectivo_cobrado: redondear(efectivo) }
}

async function filaTurno(t: TurnoLocal): Promise<Turno> {
    const arqueo = await calcularArqueo(t.id)
    return {
        id: t.id,
        estado: t.estado,
        abierta_en: t.abierta_en,
        cerrada_en: t.cerrada_en,
        monto_apertura: t.monto_apertura,
        efectivo_esperado: t.cerrada_en
            ? t.efectivo_esperado
            : redondear((t.monto_apertura || 0) + arqueo.efectivo_cobrado),
        efectivo_contado: t.efectivo_contado,
        diferencia: t.diferencia,
        notas: t.notas ?? null,
        num_ordenes: arqueo.num_ordenes,
        total_turno: arqueo.total_turno,
        efectivo_cobrado: arqueo.efectivo_cobrado,
    }
}

export async function getTurnos(limit = 50): Promise<Turno[]> {
    const d = abrirDB()
    const filas = await d.turnos.orderBy("abierta_en").toArray()
    filas.reverse()
    // (cálculo del arqueo solo para las del historial visible — barato)
    const visibles: Turno[] = []
    for (const t of filas.slice(0, limit)) visibles.push(await filaTurno(t))
    return visibles
}

export async function abrirTurno(monto_apertura: number): Promise<{ ok: boolean; turno: Turno }> {
    const d = abrirDB()
    const abiertos = (await d.turnos.where("estado").equals("Abierto").toArray())
    if (abiertos.length) throw new Error("Ya hay un turno abierto.")

    const turno: TurnoLocal = {
        id: crypto.randomUUID(),
        estado: "Abierto",
        abierta_en: ahoraISO(),
        cerrada_en: null,
        monto_apertura: monto_apertura,
        efectivo_esperado: null,
        efectivo_contado: null,
        diferencia: null,
        notas: null,
        num_ordenes: 0,
        total_turno: 0,
        efectivo_cobrado: 0,
    }
    await d.turnos.add(turno)
    return { ok: true, turno: await filaTurno(turno) }
}

export async function cerrarTurno(
    turnoId: string,
    efectivo_contado: number,
    notas?: string
): Promise<{ ok: boolean; efectivo_esperado: number; efectivo_contado: number; diferencia: number }> {
    const d = abrirDB()
    const t = await d.turnos.get(turnoId)
    if (!t || t.estado !== "Abierto") throw new Error("Ese turno no está abierto.")
    const fila = await filaTurno(t)
    const esperado = fila.efectivo_esperado || 0
    const diferencia = redondear(efectivo_contado - esperado)

    await d.turnos.update(turnoId, {
        estado: "Cerrado",
        cerrada_en: ahoraISO(),
        efectivo_esperado: esperado,
        efectivo_contado,
        diferencia,
        notas: notas ?? t.notas,
        num_ordenes: fila.num_ordenes,
        total_turno: fila.total_turno,
        efectivo_cobrado: fila.efectivo_cobrado,
    })
    return { ok: true, efectivo_esperado: esperado, efectivo_contado, diferencia }
}

export async function editarTurno(
    turnoId: string,
    data: { monto_apertura?: number; efectivo_contado?: number; notas?: string | null }
): Promise<
    | { ok: boolean; mensaje: string }
    | { ok: boolean; efectivo_esperado: number; efectivo_contado: number; diferencia: number }
> {
    const d = abrirDB()
    const t = await d.turnos.get(turnoId)
    if (!t) throw new Error("Turno no encontrado.")

    if (t.estado === "Abierto") {
        const cambios: Partial<TurnoLocal> = {}
        if (data.monto_apertura !== undefined) cambios.monto_apertura = data.monto_apertura
        if (data.notas !== undefined) cambios.notas = data.notas
        await d.turnos.update(turnoId, cambios)
        return { ok: true, mensaje: "Turno actualizado." }
    }

    // Corrección de arqueo de turnos cerrados: solo contado/notas
    if (data.monto_apertura !== undefined) {
        throw new Error("No se puede editar el monto de apertura de un turno cerrado.")
    }
    const cambios: Partial<TurnoLocal> = {}
    if (data.notas !== undefined) cambios.notas = data.notas
    const contado = data.efectivo_contado ?? t.efectivo_contado ?? 0
    const esperado = t.efectivo_esperado ?? 0
    if (data.efectivo_contado !== undefined && data.efectivo_contado !== t.efectivo_contado) {
        cambios.efectivo_contado = data.efectivo_contado
        cambios.diferencia = redondear(data.efectivo_contado - esperado)
    }
    await d.turnos.update(turnoId, cambios)
    return { ok: true, efectivo_esperado: esperado, efectivo_contado: contado, diferencia: redondear(contado - esperado) }
}
