// ==============================================================================
// src/lib/local/repos/mesas.ts
// Mesas del preset restaurante — contracto idéntico a routers/mesas.py.
// La orden abierta es implícita: mesa Ocupada/Cuenta ⇒ tiene mesa_items.
// Al cobrar, el POS debe pasarle los items como ItemCarrito (se vacía la
// mesa), igual que la versión en nube.
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import type { Mesa } from "@/types"
import type { MesaLocal, MesaItemLocal } from "../db"

async function filaMesa(m: MesaLocal, items: MesaItemLocal[]): Promise<Mesa> {
    const d = abrirDB()
    const deLaMesa = items.length ? items : (await d.mesa_items.where("mesa_id").equals(m.id).toArray())
    return {
        ...m,
        num_items: deLaMesa.reduce((s, it) => s + it.cantidad, 0),
        total: Math.round(deLaMesa.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0) * 100) / 100,
        items: deLaMesa.map(it => ({
            id: it.id,
            mesa_id: it.mesa_id,
            producto: it.producto,
            descripcion: it.descripcion ?? null,
            categoria: it.categoria ?? null,
            variacion: it.variacion ?? null,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            costo: it.costo ?? null,
            notas: it.notas ?? null,
            creado_en: it.creado_en,
        })),
    }
}

export async function getMesas(): Promise<Mesa[]> {
    const d = abrirDB()
    const mesas = await d.mesas.orderBy("orden").toArray()
    const items = await d.mesa_items.toArray()
    return Promise.all(mesas.map(m => filaMesa(m, items.filter(i => i.mesa_id === m.id))))
}

export async function crearMesa(data: { nombre: string; capacidad?: number | null }): Promise<{ ok: boolean; id: string; nombre: string }> {
    const d = abrirDB()
    const todas = await d.mesas.toArray()
    const orden = todas.length
    const id = crypto.randomUUID()
    await d.mesas.add({
        id,
        nombre: data.nombre,
        capacidad: data.capacidad ?? null,
        orden,
        estado: "Libre",
        abierta_en: null,
        creada_en: ahoraISO(),
    })
    return { ok: true, id, nombre: data.nombre }
}

export async function actualizarMesa(
    id: string,
    data: { nombre?: string; capacidad?: number | null }
): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.mesas.update(id, {
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.capacidad !== undefined ? { capacidad: data.capacidad } : {}),
    })
    return { ok: true }
}

export async function eliminarMesa(id: string): Promise<{ ok: boolean }> {
    const d = abrirDB()
    const items = await d.mesa_items.where("mesa_id").equals(id).toArray()
    if (items.length) throw new Error("La mesa tiene una orden abierta; cáncerala primero.")
    await d.mesas.delete(id)
    return { ok: true }
}

export async function reordenarMesas(mesas: { id: string; orden: number }[]): Promise<{ ok: boolean }> {
    const d = abrirDB()
    for (const m of mesas) await d.mesas.update(m.id, { orden: m.orden })
    return { ok: true }
}

export async function agregarItems(
    mesaId: string,
    items: {
        producto: string
        cantidad: number
        precio_unitario: number
        descripcion?: string
        variacion?: string
        costo?: number
        categoria?: string
        notas?: string
    }[]
): Promise<{ ok: boolean; agregados: number }> {
    const d = abrirDB()
    const mesa = await d.mesas.get(mesaId)
    if (!mesa) throw new Error("Mesa no encontrada.")
    await d.transaction("rw", d.mesas, d.mesa_items, async () => {
        for (const it of items) {
            await d.mesa_items.add({
                id: crypto.randomUUID(),
                mesa_id: mesaId,
                producto: it.producto,
                descripcion: it.descripcion || null,
                categoria: it.categoria || null,
                variacion: it.variacion || null,
                cantidad: it.cantidad,
                precio_unitario: it.precio_unitario,
                costo: it.costo ?? null,
                notas: it.notas || null,
                creado_en: ahoraISO(),
            })
        }
        await d.mesas.update(mesaId, {
            estado: mesas_estado_apertura(mesa.estado),
            abierta_en: mesa.abierta_en || ahoraISO(),
        })
    })
    return { ok: true, agregados: items.length }
}

function mesas_estado_apertura(estado: string): "Ocupada" | "Cuenta" {
    // Marcar cuenta SOLO lo hace pedirCuenta; agregar ítems re-ocupa
    return estado === "Cuenta" ? "Cuenta" : "Ocupada"
}

export async function editarItem(
    mesaId: string,
    itemId: string,
    data: { cantidad?: number; precio_unitario?: number; notas?: string }
): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.mesa_items.update(itemId, {
        ...(data.cantidad !== undefined ? { cantidad: data.cantidad } : {}),
        ...(data.precio_unitario !== undefined ? { precio_unitario: data.precio_unitario } : {}),
        ...(data.notas !== undefined ? { notas: data.notas } : {}),
    })
    void mesaId
    return { ok: true }
}

export async function quitarItem(mesaId: string, itemId: string): Promise<{ ok: boolean }> {
    const d = abrirDB()
    await d.mesa_items.delete(itemId)
    const quedan = await d.mesa_items.where("mesa_id").equals(mesaId).toArray()
    if (!quedan.length) {
        const mesa = await d.mesas.get(mesaId)
        if (mesa) await d.mesas.update(mesaId, {
            estado: mesa.estado === "Cuenta" ? "Libre" : "Libre",
            abierta_en: null,
        })
    }
    return { ok: true }
}

export async function pedirCuenta(mesaId: string): Promise<{ ok: boolean; estado: string }> {
    const d = abrirDB()
    const mesa = await d.mesas.get(mesaId)
    if (!mesa) throw new Error("Mesa no encontrada.")
    if (mesa.estado !== "Ocupada") throw new Error("Solo las mesas ocupadas pueden pedir cuenta.")
    await d.mesas.update(mesaId, { estado: "Cuenta" })
    return { ok: true, estado: "Cuenta" }
}

export async function regresarAOcupada(mesaId: string): Promise<{ ok: boolean; estado: string }> {
    const d = abrirDB()
    await d.mesas.update(mesaId, { estado: "Ocupada" })
    return { ok: true, estado: "Ocupada" }
}

export async function cancelarOrden(mesaId: string): Promise<{ ok: boolean; cancelados: number }> {
    const d = abrirDB()
    const items = await d.mesa_items.where("mesa_id").equals(mesaId).toArray()
    const cancelados = items.length
    for (const it of items) await d.mesa_items.delete(it.id)
    await d.mesas.update(mesaId, { estado: "Libre", abierta_en: null })
    return { ok: true, cancelados }
}

/** Convierte los items de la mesa en ItemCarrito para el cobro del POS. */
export async function itemsComoCarrito(mesaId: string): Promise<{
    items: { producto: string; cantidad: number; precio_real: number; variacion?: string; descripcion?: string; costo?: number }[]
}> {
    const d = abrirDB()
    const items = await d.mesa_items.where("mesa_id").equals(mesaId).toArray()
    return {
        items: items.map(it => ({
            producto: it.producto,
            cantidad: it.cantidad,
            precio_real: it.precio_unitario,
            variacion: it.variacion || undefined,
            descripcion: it.descripcion || undefined,
            costo: it.costo ?? undefined,
        })),
    }
}
