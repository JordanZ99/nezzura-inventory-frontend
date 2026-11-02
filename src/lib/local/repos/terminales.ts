// ==============================================================================
// src/lib/local/repos/terminales.ts
// Terminales bancarias — contracto idéntico a routers/terminales.py.
// NOTA: el cobro con comisión de terminal en local se registra el método,
// el cálculo de comisión se aplica al cobro si la terminal viene en `pago`.
// ==============================================================================

import { abrirDB } from "../db"
import type { Terminal } from "@/types"
import type { TerminalLocal } from "../db"

function filaTerminal(t: TerminalLocal): Terminal {
    return {
        id: t.id,
        nombre: t.nombre,
        banco: t.banco,
        comision_debito_pct: t.comision_debito_pct,
        comision_credito_pct: t.comision_credito_pct,
        comision_fija: t.comision_fija,
        activo: t.activo,
    }
}

export async function getTerminales(): Promise<Terminal[]> {
    const d = abrirDB()
    const filas = await d.terminales.toArray()
    return filas.filter(t => t.activo).map(filaTerminal)
}

export async function crearTerminal(data: {
    nombre: string
    banco?: string
    comision_debito_pct: number
    comision_credito_pct: number
    comision_fija: number
}): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.terminales.add({
        id: crypto.randomUUID(),
        nombre: data.nombre,
        banco: data.banco || null,
        comision_debito_pct: data.comision_debito_pct,
        comision_credito_pct: data.comision_credito_pct,
        comision_fija: data.comision_fija,
        activo: true,
    })
    return { ok: true }
}

export async function actualizarTerminal(
    id: string,
    data: Partial<{
        nombre: string
        banco: string
        comision_debito_pct: number
        comision_credito_pct: number
        comision_fija: number
        activo: boolean
    }>
): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.terminales.update(id, {
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.banco !== undefined ? { banco: data.banco } : {}),
        ...(data.comision_debito_pct !== undefined ? { comision_debito_pct: data.comision_debito_pct } : {}),
        ...(data.comision_credito_pct !== undefined ? { comision_credito_pct: data.comision_credito_pct } : {}),
        ...(data.comision_fija !== undefined ? { comision_fija: data.comision_fija } : {}),
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
    })
    return { ok: true }
}

export async function eliminarTerminal(id: string): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.terminales.delete(id)
    return { ok: true }
}
