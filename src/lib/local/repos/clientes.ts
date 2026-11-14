// ==============================================================================
// src/lib/local/repos/clientes.ts
// Cartera de clientes + puntos + CRM básico (etiquetas/interacciones/segmentos)
// — contracto idéntico a routers/clientes.py. El PIN se guarda con SHA-256
// (SubtleCrypto), jamás texto plano, igual que el backend.
//
// Segmentos/LTV: censados en vivo sobre la cartera local (sin ventas
// cruzadas por cliente todavía: coincide con clientes_activos=false del
// perfil local —_fase 3_ conectar el cobro del POS al cliente).
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import type {
    Cliente, ClienteDetalle, Etiqueta, Interaccion, LtvResumen,
    MovimientoPuntos, Segmento, TipoInteraccion, TopCliente,
} from "@/types"
import type { ClienteLocal, EtiquetaLocal, InteraccionLocal, MovimientoPuntosLocal } from "../db"
import { redondear } from "./utilidades"

async function hashPin(pin: string): Promise<string> {
    const bytes = new TextEncoder().encode(pin)
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

/** Fila Cliente de cartera con etiquetas sincronizadas. */
async function aCliente(c: ClienteLocal): Promise<Cliente> {
    const d = abrirDB()
    const relaciones = await d.clientes_cliente_etiqueta.where("cliente_id").equals(c.id).toArray()
    const etiquetas: Etiqueta[] = []
    for (const rel of relaciones) {
        const et = await d.clientes_etiquetas.get(rel.etiqueta_id)
        if (et) etiquetas.push({ id: et.id, nombre: et.nombre, color: et.color })
    }
    return {
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        telefono: c.telefono,
        notas: c.notas,
        activo: c.activo,
        fecha_registro: c.fecha_registro,
        cumpleanos: c.cumpleanos,
        origen: c.origen,
        etiquetas,
        saldo_puntos: c.saldo_puntos,
        compras: 0,
        total_gastado: 0,
        ticket_promedio: 0,
        ultima_compra: null,
    }
}

// ============================================================================
// CRUD
// ============================================================================
export async function getClientes(params?: { q?: string; incluir_inactivos?: boolean }): Promise<Cliente[]> {
    const d = abrirDB()
    let filas = await d.clientes.orderBy("nombre").toArray()
    if (!params?.incluir_inactivos) filas = filas.filter(c => c.activo)
    if (params?.q) {
        const t = params.q.toLowerCase()
        filas = filas.filter(c =>
            c.nombre.toLowerCase().includes(t) ||
            (c.email || "").toLowerCase().includes(t) ||
            (c.telefono || "").includes(t))
    }
    return Promise.all(filas.map(aCliente))
}

export async function crearCliente(data: {
    nombre: string
    email?: string
    telefono?: string
    pin?: string
    notas?: string
    cumpleanos?: string | null
    origen?: string | null
}): Promise<{ ok: boolean; cliente: Cliente }> {
    const d = abrirDB()
    if ((data.pin || "").length > 0 && !/^\d{4}$/.test(data.pin!)) {
        throw new Error("El PIN debe ser de 4 dígitos.")
    }
    const cliente: ClienteLocal = {
        id: crypto.randomUUID(),
        nombre: data.nombre,
        email: data.email || null,
        telefono: data.telefono || null,
        notas: data.notas || null,
        pin_hash: data.pin ? await hashPin(data.pin) : null,
        activo: true,
        fecha_registro: ahoraISO(),
        cumpleanos: data.cumpleanos ?? null,
        origen: data.origen ?? null,
        saldo_puntos: 0,
        total_gastado: 0,
    }
    await d.clientes.add(cliente)
    return { ok: true, cliente: await aCliente(cliente) }
}

/** Identificación en el POS: valida correo/teléfono + PIN. */
export async function verificarCliente(identificador: string, pin?: string): Promise<{
    ok: boolean
    cliente: { id: string; nombre: string; email: string | null; telefono: string | null; saldo_puntos: number }
}> {
    const d = abrirDB()
    const filas = await d.clientes.toArray()
    const id = identificador.trim().toLowerCase()
    const cliente = filas.find(c => c.activo && (
        (c.email || "").toLowerCase() === id ||
        (c.telefono || "") === identificador.trim()
    ))
    if (!cliente) throw new Error("No encontramos a ningún cliente con ese correo o teléfono.")
    if (cliente.pin_hash) {
        if (!pin) throw new Error("Tu cliente tiene PIN: pídeselo.")
        if (await hashPin(pin) !== cliente.pin_hash) throw new Error("PIN incorrecto.")
    }
    return {
        ok: true,
        cliente: {
            id: cliente.id,
            nombre: cliente.nombre,
            email: cliente.email,
            telefono: cliente.telefono,
            saldo_puntos: cliente.saldo_puntos,
        },
    }
}

export async function getCliente(id: string): Promise<ClienteDetalle> {
    const d = abrirDB()
    const fila = await d.clientes.get(id)
    if (!fila) throw new Error("Cliente no encontrado.")
    const base = await aCliente(fila)
    const movimientos: MovimientoPuntos[] = (await d.clientes_puntos
        .where("cliente_id").equals(id).toArray())
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(m => ({
            id: m.id,
            tipo: m.tipo,
            puntos: m.puntos,
            valor_monetario: m.valor_monetario,
            concepto: m.concepto,
            fecha: m.fecha,
            orden_id: m.orden_id,
        }))
    const interacciones: Interaccion[] = (await d.clientes_interacciones
        .where("cliente_id").equals(id).toArray())
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(i => ({
            id: i.id, tipo: i.tipo, texto: i.texto,
            creado_por: i.creado_por, fecha: i.fecha,
        }))
    return { ...base, movimientos, ultimas_compras: [], interacciones }
}

export async function actualizarCliente(
    id: string,
    data: { nombre?: string; email?: string; telefono?: string; pin?: string; notas?: string; activo?: boolean; cumpleanos?: string | ""; origen?: string }
): Promise<{ ok: boolean; cliente: ClienteDetalle }> {
    const d = abrirDB()
    const fila = await d.clientes.get(id)
    if (!fila) throw new Error("Cliente no encontrado.")
    const cambios: Partial<ClienteLocal> = {}
    if (data.nombre !== undefined) cambios.nombre = data.nombre
    if (data.email !== undefined) cambios.email = data.email || null
    if (data.telefono !== undefined) cambios.telefono = data.telefono || null
    if (data.notas !== undefined) cambios.notas = data.notas || null
    if (data.activo !== undefined) cambios.activo = data.activo
    if (data.cumpleanos !== undefined) cambios.cumpleanos = data.cumpleanos === "" ? null : data.cumpleanos
    if (data.origen !== undefined) cambios.origen = data.origen || null
    if (data.pin !== undefined) {
        cambios.pin_hash = data.pin ? await hashPin(data.pin) : null    // "" = quitar PIN
    }
    await d.clientes.update(id, cambios)
    return { ok: true, cliente: await getCliente(id) }
}

export async function eliminarCliente(id: string): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB()
    await d.clientes.update(id, { activo: false })    // baja lógica (historial queda)
    return { ok: true, mensaje: "Cliente dado de baja." }
}

// ============================================================================
// Puntos (ledger: ganados | canjeados | ajuste)
// ============================================================================
export async function registrarMovimientoPuntos(m: {
    cliente_id: string
    tipo: "ganados" | "canjeados" | "ajuste"
    puntos: number
    valor_monetario?: number | null
    concepto?: string | null
    orden_id?: string | null
}): Promise<MovimientoPuntosLocal> {
    const d = abrirDB()
    const fila: MovimientoPuntosLocal = {
        id: crypto.randomUUID(),
        cliente_id: m.cliente_id,
        tipo: m.tipo,
        puntos: m.puntos,
        valor_monetario: m.valor_monetario ?? null,
        concepto: m.concepto ?? null,
        fecha: ahoraISO(),
        orden_id: m.orden_id ?? null,
    }
    await d.clientes_puntos.add(fila)
    const c = await d.clientes.get(m.cliente_id)
    if (c) await d.clientes.update(m.cliente_id, {
        saldo_puntos: redondear(c.saldo_puntos + m.puntos),
    })
    return fila
}

export async function ajustarPuntos(
    id: string,
    puntos: number,
    concepto: string
): Promise<{ ok: boolean; saldo_anterior: number; saldo_nuevo: number; cliente: string }> {
    const d = abrirDB()
    const c = await d.clientes.get(id)
    if (!c) throw new Error("Cliente no encontrado.")
    if (puntos === 0) throw new Error("El ajuste no puede ser 0.")
    if (c.saldo_puntos + puntos < 0) throw new Error("El ajuste dejaría el saldo de puntos en negativo.")
    const saldo_anterior = c.saldo_puntos
    await registrarMovimientoPuntos({
        cliente_id: id,
        tipo: "ajuste",
        puntos: Math.round(puntos),
        concepto: concepto || "Ajuste manual",
        valor_monetario: null,
    })
    return { ok: true, saldo_anterior, saldo_nuevo: redondear(c.saldo_puntos + puntos), cliente: c.nombre }
}

// ============================================================================
// CRM: etiquetas
// ============================================================================
export async function getEtiquetas(): Promise<Etiqueta[]> {
    const d = abrirDB()
    const filas = await d.clientes_etiquetas.orderBy("nombre").toArray()
    return filas.map(e => ({ id: e.id, nombre: e.nombre, color: e.color }))
}

export async function crearEtiqueta(nombre: string, color?: string): Promise<{ ok: boolean; etiqueta: Etiqueta }> {
    const d = abrirDB()
    const existentes = await d.clientes_etiquetas.toArray()
    if (existentes.some(e => e.nombre.toLowerCase() === nombre.toLowerCase())) {
        throw new Error("Esa etiqueta ya existe.")
    }
    const fila: EtiquetaLocal = { id: crypto.randomUUID(), nombre, color: color || "#6366f1" }
    await d.clientes_etiquetas.add(fila)
    return { ok: true, etiqueta: { id: fila.id, nombre: fila.nombre, color: fila.color } }
}

export async function actualizarEtiqueta(
    id: string,
    data: { nombre?: string; color?: string }
): Promise<{ ok: boolean; etiqueta: Etiqueta }> {
    const d = abrirDB()
    await d.clientes_etiquetas.update(id, {
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
    })
    const fila = await d.clientes_etiquetas.get(id)
    if (!fila) throw new Error("Etiqueta no encontrada.")
    return { ok: true, etiqueta: { id: fila.id, nombre: fila.nombre, color: fila.color } }
}

export async function eliminarEtiqueta(id: string): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB()
    await d.clientes_etiquetas.delete(id)
    // Desasignar de los clientes
    const rels = await d.clientes_cliente_etiqueta.where("etiqueta_id").equals(id).toArray()
    for (const r of rels) await d.clientes_cliente_etiqueta.delete([r.cliente_id, r.etiqueta_id])
    return { ok: true, mensaje: "Etiqueta eliminada." }
}

/** Sincroniza el set completo de etiquetas de un cliente (replace-all). */
export async function setEtiquetasCliente(
    idCliente: string,
    etiquetaIds: string[]
): Promise<{ ok: boolean; etiquetas: Etiqueta[] }> {
    const d = abrirDB()
    const actuales = await d.clientes_cliente_etiqueta.where("cliente_id").equals(idCliente).toArray()
    for (const r of actuales) await d.clientes_cliente_etiqueta.delete([r.cliente_id, r.etiqueta_id])
    for (const idEtiqueta of etiquetaIds) {
        await d.clientes_cliente_etiqueta.add({ cliente_id: idCliente, etiqueta_id: idEtiqueta })
    }
    const cliente = await d.clientes.get(idCliente)
    return { ok: true, etiquetas: cliente ? (await aCliente(cliente)).etiquetas : [] }
}

// ============================================================================
// CRM: interacciones (timeline)
// ============================================================================
export async function addInteraccion(
    idCliente: string,
    tipo: TipoInteraccion,
    texto: string,
    creadoPor?: string
): Promise<{ ok: boolean; interaccion: Interaccion }> {
    const d = abrirDB()
    if (!(await d.clientes.get(idCliente))) throw new Error("Cliente no encontrado.")
    const fila: InteraccionLocal = {
        id: crypto.randomUUID(),
        cliente_id: idCliente,
        tipo,
        texto,
        creado_por: creadoPor || "Propietario",
        fecha: ahoraISO(),
    }
    await d.clientes_interacciones.add(fila)
    return {
        ok: true,
        interaccion: {
            id: fila.id, tipo: fila.tipo, texto: fila.texto,
            creado_por: fila.creado_por, fecha: fila.fecha,
        },
    }
}

export async function getInteracciones(idCliente: string, limite = 50): Promise<Interaccion[]> {
    const d = abrirDB()
    const filas = await d.clientes_interacciones.where("cliente_id").equals(idCliente).toArray()
    return filas
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, limite)
        .map(i => ({ id: i.id, tipo: i.tipo, texto: i.texto, creado_por: i.creado_por, fecha: i.fecha }))
}

// ============================================================================
// Segmentos dinámicos (censados en vivo contra la cartera local)
// ============================================================================
export async function getSegmentos(): Promise<Segmento[]> {
    const d = abrirDB()
    const clientes = (await d.clientes.toArray()).filter(c => c.activo)
    const hoy = new Date()
    function makeSeg(id: string, nombre: string, descripcion: string, incluidos: ClienteLocal[]): Segmento {
        return {
            id, nombre, descripcion,
            conteo: incluidos.length,
            ids: incluidos.map(c => c.id),
        }
    }
    const conPuntos = clientes.filter(c => c.saldo_puntos > 0)
    const conPin = clientes.filter(c => c.pin_hash)
    const conNotas = clientes.filter(c => c.notas)
    const cumpleaneros = clientes.filter(c => {
        if (!c.cumpleanos) return false
        const [, mesDia] = c.cumpleanos.split("-")
        const hoyMesDia = `${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
        return mesDia === hoyMesDia
    })
    return [
        makeSeg("puntos", "Con puntos", "Aún tienen saldo de puntos por canjear.", conPuntos),
        makeSeg("pin", "Con PIN", "Configuraron PIN para identificarse en el POS.", conPin),
        makeSeg("notas", "Con notas", "Tiene notas de seguimiento escritas.", conNotas),
        makeSeg("cumple", "Cumpleañeros de hoy", "Su cumpleaños es hoy.", cumpleaneros),
    ]
}

// ============================================================================
// LTV (plan Plus en nube; local igual porque ya portamos las tablas)
// ============================================================================
export async function getLtv(_horizonteMeses = 12): Promise<LtvResumen> {
    const d = abrirDB()
    const clientes = (await d.clientes.toArray()).filter(c => c.activo)
    const totales = clientes.reduce((s, c) => s + c.total_gastado, 0)
    return {
        global: {
            horizonte_meses: 12,
            tasa_retencion: 0,
            clientes_con_compras: clientes.length,
            clientes_recurrentes: 0,
            ltv_promedio_proyectado: 0,
            gasto_total_historico: redondear(totales),
        },
        segmentos: [],
        clientes: clientes.map(c => ({
            cliente_id: c.id,
            nombre: c.nombre,
            activo: c.activo,
            compras: 0,
            gasto: redondear(c.total_gastado),
            ticket_promedio: 0,
            frecuencia_mensual: 0,
            dias_sin_comprar: 0,
            ltv_historico: redondear(c.total_gastado),
            ltv_proyectado: redondear(c.total_gastado),
        })),
    }
}

export async function getStatsClientes(): Promise<
    import("@/types").ResumenClientes & { top_clientes: TopCliente[] }
> {
    const d = abrirDB()
    const clientes = await d.clientes.toArray()
    const activos = clientes.filter(c => c.activo)
    const movs = await d.clientes_puntos.toArray()
    const puntosAnulados = movs.filter(m => m.tipo === "canjeados")
    const ganados = movs.filter(m => m.tipo === "ganados").reduce((s, m) => s + m.puntos, 0)
    const canjeados = puntosAnulados.reduce((s, m) => s + Math.abs(m.puntos), 0)
    const ajustados = movs.filter(m => m.tipo === "ajuste").reduce((s, m) => s + Math.abs(m.puntos), 0)
    const saldo = activos.reduce((s, c) => s + c.saldo_puntos, 0)
    const valorPunto = 1
    const top: TopCliente[] = activos
        .sort((a, b) => b.saldo_puntos - a.saldo_puntos)
        .slice(0, 5)
        .map(c => ({
            id: c.id, nombre: c.nombre, telefono: c.telefono, email: c.email,
            compras: 0, total_gastado: redondear(c.total_gastado),
            saldo_puntos: c.saldo_puntos, ultima_compra: null,
        }))
    return {
        clientes_total: clientes.length,
        clientes_activos: activos.length,
        clientes_nuevos_periodo: 0,
        clientes_recurrentes: 0,
        pct_recurrentes: 0,
        puntos_otorgados: ganados,
        puntos_canjeados: canjeados,
        puntos_ajustados: ajustados,
        pct_canjeados: ganados > 0 ? redondear((canjeados / ganados) * 100) : 0,
        saldo_puntos: redondear(saldo),
        valor_punto: valorPunto,
        pasivo_monetario: redondear(saldo * valorPunto),
        tickets_total: 0,
        tickets_identificadas: 0,
        pct_identificadas: 0,
        ticket_con_cliente: 0,
        ticket_sin_cliente: 0,
        diferencia_ticket: 0,
        top_clientes: top,
        serie: [],
    }
}
