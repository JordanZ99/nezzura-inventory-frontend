// ==============================================================================
// src/lib/local/repos/gastos.ts
// Gastos + gastos programados + categorías de gasto, LOCAL.
// Contracto idéntico a routers/gastos.py + gastos_programados.py.
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import type { Gasto, GastoProgramado, RangoFechas } from "@/types"
import type { GastoLocal, GastoProgramadoLocal } from "../db"
import { redondear } from "./utilidades"

function filaGasto(g: GastoLocal, id: number): Gasto {
    return {
        id,
        fecha: g.fecha,
        categoria: g.categoria,
        descripcion: g.descripcion,
        monto: g.monto,
        estado: g.estado || "Activo",
        gasto_programado_id: g.gasto_programado_id ?? undefined,
    }
}

// ============================================================================
// CRUD de gastos
// ============================================================================
export async function getGastos(rango?: RangoFechas): Promise<Gasto[]> {
    const d = abrirDB()
    let filas = await d.gastos.orderBy("fecha").toArray()
    if (rango?.desde) filas = filas.filter(f => f.fecha.slice(0, 10) >= rango.desde!)
    if (rango?.hasta) filas = filas.filter(f => f.fecha.slice(0, 10) <= rango.hasta!)
    filas.reverse()
    return filas.map((f, i) => filaGasto(f, f.id ?? i + 1))
}

export async function crearGasto(data: {
    fecha: string
    categoria: string
    descripcion: string
    monto: number
    estado?: string
    gasto_programado_id?: string
}): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.gastos.add({
        fecha: data.fecha,
        categoria: data.categoria,
        descripcion: data.descripcion || "",
        monto: data.monto,
        estado: data.estado || "Activo",
        gasto_programado_id: data.gasto_programado_id ?? null,
    })
    return { ok: true }
}

export async function actualizarGasto(
    id: number,
    data: { monto: number; categoria: string; descripcion: string }
): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.gastos.update(id, {
        monto: data.monto,
        categoria: data.categoria,
        descripcion: data.descripcion,
    })
    return { ok: true }
}

/** Confirmar un gasto automático pendiente (de gastos programados). */
export async function confirmarGasto(id: number): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.gastos.update(id, { estado: "Activo" })
    return { ok: true }
}

export async function descartarGasto(id: number): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.gastos.delete(id)
    return { ok: true }
}

export async function eliminarGasto(id: number): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.gastos.delete(id)
    return { ok: true }
}

// ============================================================================
// Categorías de gasto
// ============================================================================
export async function getCategoriasGasto(): Promise<{ id: string; nombre: string }[]> {
    const d = abrirDB()
    const filas = await d.gastos_categorias.orderBy("nombre").toArray()
    return filas.map(c => ({ id: c.id, nombre: c.nombre }))
}

export async function crearCategoriaGasto(
    nombre: string
): Promise<{ ok: boolean; categoria: { id: string; nombre: string }; mensaje: string }> {
    const d = abrirDB()
    const existentes = await d.gastos_categorias.toArray()
    if (existentes.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
        throw new Error("La categoría de gasto ya existe.")
    }
    const id = crypto.randomUUID()
    await d.gastos_categorias.add({ id, nombre })
    return { ok: true, categoria: { id, nombre }, mensaje: "Categoría creada." }
}

export async function editarCategoriaGasto(
    viejoNombre: string,
    nuevoNombre: string
): Promise<{ ok: boolean; categoria: { id: string; nombre: string } }> {
    const d = abrirDB()
    const fila = (await d.gastos_categorias.toArray()).find(c => c.nombre === viejoNombre)
    if (!fila) throw new Error("Categoría no encontrada.")
    await d.gastos_categorias.update(fila.id, { nombre: nuevoNombre })
    // Renombrar en los gastos que la llevan
    const gastos = await d.gastos.where("categoria").equals(viejoNombre).toArray()
    for (const g of gastos) await d.gastos.update(g.id!, { categoria: nuevoNombre })
    return { ok: true, categoria: { id: fila.id, nombre: nuevoNombre } }
}

export async function eliminarCategoriaGasto(
    categoria: string
): Promise<{ ok: boolean; categoria_eliminada: string }> {
    const d = abrirDB()
    const fila = (await d.gastos_categorias.toArray()).find(c => c.nombre === categoria)
    if (fila) await d.gastos_categorias.delete(fila.id)
    return { ok: true, categoria_eliminada: categoria }
}

// ============================================================================
// Gastos programados (semanal / mensual / anual)
// ============================================================================
function filaProgramado(g: GastoProgramadoLocal): GastoProgramado {
    return {
        id: g.id,
        tenant_id: "",
        nombre: g.nombre,
        tipo: g.tipo,
        valor: g.valor,
        frecuencia: g.frecuencia,
        proxima_fecha: g.proxima_fecha,
        ultimo_monto: g.ultimo_monto ?? null,
    }
}

/** Próxima fecha según frecuencia (como backend: suma sobre proxima_fecha). */
function siguienteFecha(fecha: string, frecuencia: string): string {
    const f = new Date(`${fecha}T00:00:00`)
    if (frecuencia === "semanal") f.setDate(f.getDate() + 7)
    else if (frecuencia === "mensual") f.setMonth(f.getMonth() + 1)
    else if (frecuencia === "anual") f.setFullYear(f.getFullYear() + 1)
    return f.toISOString().slice(0, 10)
}

/** Estimación del monto: fijo = valor; porcentaje = pct de la ganancia bruta. */
async function estimar(programado: GastoProgramadoLocal): Promise<{
    monto: number
    ganancia_bruta: number
    ganancia_neta: number
    total_gastos: number
}> {
    const d = abrirDB()
    const ventas = (await d.ventas.where("estado").equals("Activo").toArray())
    const gananciaBruta = redondear(ventas.reduce((s, v) => s + v.ganancia_bruta, 0))
    const gastos = await d.gastos.toArray()
    const totalGastos = redondear(
        gastos.filter(g => g.estado !== "Pendiente").reduce((s, g) => s + g.monto, 0)
    )
    const monto = programado.tipo === "fijo"
        ? programado.valor
        : redondear(gananciaBruta * (programado.valor / 100))
    return {
        monto: redondear(monto),
        ganancia_bruta: gananciaBruta,
        ganancia_neta: redondear(gananciaBruta - totalGastos - monto),
        total_gastos: redondear(totalGastos + monto),
    }
}

export async function getGastosProgramados(): Promise<GastoProgramado[]> {
    const d = abrirDB()
    const filas = await d.gastos_programados.toArray()
    return filas.map(filaProgramado)
}

export async function crearGastoProgramado(data: {
    nombre: string
    tipo: string
    valor: number
    frecuencia: string
    proxima_fecha: string
}): Promise<{ ok: boolean }> {
    const d = abrirDB()
    gastoProgramadoValidar(data.tipo, data.frecuencia)
    if (data.tipo === "fijo" && (data.valor || 0) <= 0) {
        throw new Error("El valor del gasto fijo debe ser mayor a 0.")
    }
    await d.gastos_programados.add({
        id: crypto.randomUUID(),
        nombre: data.nombre,
        tipo: data.tipo as GastoProgramadoLocal["tipo"],
        valor: data.valor,
        frecuencia: data.frecuencia as GastoProgramadoLocal["frecuencia"],
        proxima_fecha: data.proxima_fecha,
        ultimo_monto: null,
    })
    return { ok: true }
}

function gastoProgramadoValidar(tipo: string, frecuencia: string): void {
    if (!["fijo", "porcentaje"].includes(tipo)) throw new Error(`Tipo de gasto inválido: ${tipo}`)
    if (!["semanal", "mensual", "anual"].includes(frecuencia)) throw new Error(`Frecuencia inválida: ${frecuencia}`)
}

export async function actualizarGastoProgramado(
    id: string,
    data: { nombre?: string; tipo?: string; valor?: number; frecuencia?: string; proxima_fecha?: string }
): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB()
    const fila = await d.gastos_programados.get(id)
    if (!fila) throw new Error("Gasto programado no encontrado.")
    const cambios: Partial<GastoProgramadoLocal> = {}
    if (data.nombre !== undefined) cambios.nombre = data.nombre
    if (data.tipo !== undefined) {
        gastoProgramadoValidar(data.tipo, data.frecuencia || fila.frecuencia)
        cambios.tipo = data.tipo as GastoProgramadoLocal["tipo"]
    }
    if (data.valor !== undefined) cambios.valor = data.valor
    if (data.frecuencia !== undefined) {
        cambios.frecuencia = data.frecuencia as GastoProgramadoLocal["frecuencia"]
    }
    if (data.proxima_fecha !== undefined) cambios.proxima_fecha = data.proxima_fecha
    await d.gastos_programados.update(id, cambios)
    return { ok: true, mensaje: "Gasto programado actualizado." }
}

export async function eliminarGastoProgramado(id: string): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB()
    await d.gastos_programados.delete(id)
    return { ok: true, mensaje: "Gasto programado eliminado." }
}

/** Ejecuta: registra el gasto pendiente + avanza la proxima_fecha. */
export async function ejecutarGastoProgramado(id: string): Promise<{
    ok: boolean; monto: number; nombre: string; mensaje: string
}> {
    const d = abrirDB()
    const fila = await d.gastos_programados.get(id)
    if (!fila) throw new Error("Gasto programado no encontrado.")

    const est = await estimar(fila)
    await d.gastos.add({
        fecha: ahoraISO(),
        categoria: fila.nombre,
        descripcion: `Automático (${fila.frecuencia}): ${fila.nombre}`,
        monto: est.monto,
        estado: "Pendiente",          // el dueño lo confirma o descarta
        gasto_programado_id: fila.id,
    })
    const proxima = siguienteFecha(fila.proxima_fecha, fila.frecuencia)
    await d.gastos_programados.update(id, {
        proxima_fecha: proxima,
        ultimo_monto: est.monto,
    })
    return {
        ok: true,
        monto: est.monto,
        nombre: fila.nombre,
        mensaje: `Gasto registrado por $${est.monto}. Próxima fecha: ${proxima}.`,
    }
}

export async function estimarMontoGastoProgramado(id: string): Promise<{
    ok: boolean
    monto: number
    tipo: string
    nombre: string
    proxima_fecha: string
    ganancia_bruta: number
    ganancia_neta: number
    total_gastos: number
}> {
    const d = abrirDB()
    const fila = await d.gastos_programados.get(id)
    if (!fila) throw new Error("Gasto programado no encontrado.")
    const est = await estimar(fila)
    return {
        ok: true,
        tipo: fila.tipo,
        nombre: fila.nombre,
        proxima_fecha: fila.proxima_fecha,
        ...est,
    }
}

/** Chequeo del día: genera los gastos cuya próxima fecha llegó o pasó.
 * (El backend lo hace al pedir la lista; local igual.) */
export async function sincronizarProgramados(): Promise<void> {
    const d = abrirDB()
    const hoy = ahoraISO().slice(0, 10)
    const filas = await d.gastos_programados.toArray()
    for (const fila of filas) {
        if (fila.proxima_fecha <= hoy) {
            const est = await estimar(fila)
            const yaExiste = (await d.gastos
                .where("gasto_programado_id").equals(fila.id)
                .toArray())
                .some(g => g.fecha.slice(0, 10) === hoy)
            if (!yaExiste) {
                await d.gastos.add({
                    fecha: ahoraISO(),
                    categoria: fila.nombre,
                    descripcion: `Automático (${fila.frecuencia}): ${fila.nombre}`,
                    monto: est.monto,
                    estado: "Pendiente",
                    gasto_programado_id: fila.id,
                })
            }
            await d.gastos_programados.update(fila.id, {
                proxima_fecha: siguienteFecha(fila.proxima_fecha, fila.frecuencia),
                ultimo_monto: est.monto,
            })
        }
    }
}
