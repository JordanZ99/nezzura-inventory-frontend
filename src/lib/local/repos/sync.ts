// ==============================================================================
// src/lib/local/repos/sync.ts
// Motor de sincronización del Modo Offline HÍBRIDO (planes básico/plus).
//
// Patrón EXTRACTOR (el mismo que publicarCatalogo, sin tocar los repos):
// la sync LEE el estado local, lo mapea a forma-de-nube, calcula un hash
// determinista por fila y lo compara contra sync_espejo ("lo que la nube ya
// tiene"). Solo lo distinto viaja. La BAJADA aplica el delta inverso y
// actualiza el espejo, así ninguna fila se sube/baja dos veces.
//
// Estrategia de conflictos (ver docs/design):
//   * ventas/gastos → append-only por cursor (dos dispositivos = unión).
//   * stock → NUNCA como valor: la nube repite descontar_stock_peps con el
//     id_lote que PEPS local asignó (lote en negativo = alerta, no error).
//   * ediciones → LWW por llegada al servidor con auditoría (sync_log).
//
// Los mapeos de identidad viven SOLO aquí: local usa NOMBRES (producto,
// variación); el backend resuelve ids al aplicar.
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import { obtenerIdDispositivo } from "../hibrido"
import { subirSync, bajarSync, type SolicitudSync, type RespuestaSync } from "@/lib/api/sync"
import type {
    ProductoLocal, LoteLocal, VariacionLocal, VentaLocal, OrdenLocal,
    GastoLocal, SyncEspejoLocal, SyncEstadoLocal, PerfilLocal,
} from "../db"

// ── Hash determinista (djb2, 8 hex) — misma función que el publish engine ──
function hashTexto(s: string): string {
    let h = 5381
    for (let i = 0; i < s.length; i++) {
        h = (((h << 5) + h) | 0) ^ s.charCodeAt(i)
    }
    return (h >>> 0).toString(16).padStart(8, "0")
}

function hashObjeto(obj: unknown): string {
    return hashTexto(JSON.stringify(obj))
}

const ES_DATAURL = /^data:image\//i

// ════════════════════════════════════════════════════════════════════════
// Mapeo local → forma-de-nube (las claves que espera database/sync.py)
// ════════════════════════════════════════════════════════════════════════

function filaProducto(p: ProductoLocal): Record<string, unknown> {
    return {
        producto: p.producto,
        descripcion: p.descripcion || "",
        imagen: p.imagen || "",
        estado: p.estado || "Activo",
        categoria: p.categorias || [],
        visible_en_catalogo: p.visible_en_catalogo ?? true,
        sufijo_precio: p.sufijo_precio || "",
        tamano_cm: p.tamano_cm ?? null,
        tipo_producto: p.tipo_producto || "stock",
        costo_servicio: p.costo_servicio ?? null,
        precio_servicio: p.precio_servicio ?? null,
        fraccionable: p.fraccionable || false,
        codigo_interno: p.codigo_interno || null,
        codigo_barras: p.codigo_barras || null,
        ubicacion: p.ubicacion || null,
    }
}

function filaLote(l: LoteLocal, nombreVariacion: string): Record<string, unknown> {
    return {
        id_lote: l.id_lote,
        producto: l.producto,
        variacion: nombreVariacion || "",
        costo: l.costo,
        precio_venta: l.precio_venta,
        stock_lote: l.stock_lote,
        fecha_entrada: l.fecha_entrada || "",
        etiqueta: l.etiqueta || null,
    }
}

function filaVariacion(v: VariacionLocal): Record<string, unknown> {
    return {
        producto: v.producto,
        nombre: v.nombre,
        precio: v.precio,
        foto: v.foto || "",
        tamano_cm: v.tamano_cm ?? null,
    }
}

function filaGasto(g: GastoLocal): Record<string, unknown> {
    return {
        uid: "",
        fecha: g.fecha,
        categoria: g.categoria,
        descripcion: g.descripcion,
        monto: g.monto,
        estado: g.estado || "Activo",
    }
}

function filaVenta(v: VentaLocal, dispositivo: string, ordenId: string, idx: number): Record<string, unknown> {
    return {
        uid: `${dispositivo}::${ordenId}::${idx}`,
        fecha: v.fecha,
        producto: v.producto,
        variacion: v.variacion || "",
        cantidad: v.cantidad,
        precio_lista: v.precio_lista,
        precio_real: v.precio_real,
        costo_unitario: v.costo_unitario,
        total_venta: v.total_venta,
        ganancia_bruta: v.ganancia_bruta,
        estado: "Activa",
        tipo_producto: v.tipo_producto || "stock",
        id_lote: v.id_lote || null,
        consumo: v.consumo || null,
        n_ticket: v.n_ticket,
        descripcion: v.descripcion || null,
        categoria: v.categoria || null,
    }
}

function filaOrden(o: OrdenLocal): Record<string, unknown> {
    return {
        orden_id: o.id,
        fecha: o.fecha,
        n_ticket: o.n_ticket,
        total: o.total,
        ganancia: o.ganancia,
        cantidad_items: o.cantidad_items,
        estado: o.estado,
        metodo_pago: o.metodo_pago || null,
        pagos: o.pagos || null,
        propina: o.propina ?? null,
        monto_recibido: o.monto_recibido ?? null,
        cambio: o.cambio ?? null,
        comision_total: o.comision_total ?? null,
        mesa_nombre: o.mesa_nombre || null,
    }
}

const CAMPOS_EDITABLES_PRODUCTO = [
    "descripcion", "imagen", "sufijo_precio", "tamano_cm",
    "visible_en_catalogo", "ubicacion", "codigo_interno", "codigo_barras",
] as const

const CAMPOS_EDITABLES_LOTE = ["precio_venta", "estado", "costo"] as const

/** Diferencia superficial de campos editables entre la fila en el espejo y
 * la actual: {campo: valor_actual} SOLO de lo que cambió. */
function diffEditable(
    espejoData: Record<string, unknown>, actual: Record<string, unknown>,
    campos: readonly string[],
): Record<string, unknown> | null {
    const cambios: Record<string, unknown> = {}
    for (const campo of campos) {
        const a = espejoData[campo]
        const b = actual[campo]
        if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
            cambios[campo] = b
        }
    }
    return Object.keys(cambios).length ? cambios : null
}

// ════════════════════════════════════════════════════════════════════════
// Extractor: construye el delta a partir del estado local + espejo
// ════════════════════════════════════════════════════════════════════════

interface Delta {
    payload: SolicitudSync
    // confirmaciones por sección (uid → fila mapeada/hash a escribir en espejo)
    confirmar_productos: { uid: string; fila: Record<string, unknown> }[]
    confirmar_variaciones: { uid: string; fila: Record<string, unknown> }[]
    confirmar_lotes: { uid: string; fila: Record<string, unknown> }[]
    ventasHasta: number
    gastosHasta: number
    cambios: number
}

async function extraerDelta(d: Awaited<ReturnType<typeof abrirDB>>): Promise<Delta> {
    const dispositivo = obtenerIdDispositivo()
    const ahora = ahoraISO()

    const [productos, lotes, variaciones, ventas, gastos, espejo, estado] = await Promise.all([
        d.productos.toArray(),
        d.lotes.toArray(),
        d.variaciones.toArray(),
        d.ventas.toArray(),
        d.gastos.toArray(),
        d.sync_espejo.toArray(),
        d.sync_estado.get(1),
    ])
    const ventasHasta = estado?.ventas_hasta ?? 0
    const gastosHasta = estado?.gastos_hasta ?? 0

    const espejoPorUid = new Map(espejo.map(e => [e.uid, e]))
    const nombreVariacion = new Map<number, string>(
        variaciones.map(v => [v.id as number, v.nombre]),
    )

    const payload: SolicitudSync = { desde: estado?.cursor_descarga ?? null }
    const delta: Delta = {
        payload,
        confirmar_productos: [], confirmar_variaciones: [], confirmar_lotes: [],
        ventasHasta, gastosHasta,
        cambios: 0,
    }

    // ── Productos: nuevos y ediciones ──
    for (const p of productos) {
        const fila = filaProducto(p)
        const hash = hashObjeto(fila)
        const uid = `${dispositivo}::productos::${p.producto}`
        const guardada = espejoPorUid.get(uid)
        if (!guardada) {
            payload.productos = payload.productos ?? []
            payload.productos.push(fila)
            delta.confirmar_productos.push({ uid, fila })
            delta.cambios++
        } else if (guardada.hash !== hash) {
            const campos = diffEditable(guardada.data, fila, CAMPOS_EDITABLES_PRODUCTO)
            if (campos) {
                payload.ediciones_productos = payload.ediciones_productos ?? []
                payload.ediciones_productos.push({ producto: p.producto, campos })
                delta.cambios++
            }
            delta.confirmar_productos.push({ uid, fila })
        }
    }

    // ── Variaciones (solo nuevas: editarlas offline no va en el MVP) ──
    for (const v of variaciones) {
        const uid = `${dispositivo}::variaciones::${v.producto}::${v.nombre}`
        if (!espejoPorUid.has(uid)) {
            const fila = filaVariacion(v)
            payload.variaciones = payload.variaciones ?? []
            payload.variaciones.push(fila)
            delta.confirmar_variaciones.push({ uid, fila })
            delta.cambios++
        }
    }

    // ── Lotes: restocks nuevos + ediciones de precio/estado ──
    for (const l of lotes) {
        const fila = filaLote(l, l.variacion || nombreVariacion.get(l.variacion_id as number) || "")
        const hash = hashObjeto(fila)
        const uid = `${dispositivo}::lotes::${l.id_lote}`
        const guardada = espejoPorUid.get(uid)
        if (!guardada) {
            payload.lotes = payload.lotes ?? []
            payload.lotes.push(fila)
            delta.confirmar_lotes.push({ uid, fila })
            delta.cambios++
        } else if (guardada.hash !== hash) {
            const campos = diffEditable(guardada.data, fila, CAMPOS_EDITABLES_LOTE)
            if (campos) {
                payload.ediciones_lotes = payload.ediciones_lotes ?? []
                payload.ediciones_lotes.push({ id_lote: l.id_lote, campos })
                delta.cambios++
            }
            delta.confirmar_lotes.push({ uid, fila })
        }
    }

    // ── Ventas + órdenes: append-only por cursor de id local ──
    const ventasNuevas = ventas
        .filter(v => (v.id ?? 0) > ventasHasta && (v.estado || "Activo") !== "Anulada")
        .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    if (ventasNuevas.length) {
        const porOrden = new Map<string, VentaLocal[]>()
        for (const v of ventasNuevas) {
            const lista = porOrden.get(v.orden_id) ?? []
            lista.push(v)
            porOrden.set(v.orden_id, lista)
        }
        payload.ordenes = payload.ordenes ?? []
        for (const [ordenId, lista] of porOrden) {
            const orden = await d.ordenes.get(ordenId)
            if (!orden) continue
            const ventasMapeadas = lista.map((v, i) => filaVenta(v, dispositivo, ordenId, i))
            // Skip total: si la orden quedó sin ventas válidas (todas anuladas)
            // no subimos ni la orden (nada económico que sincronizar).
            payload.ordenes.push({ orden: filaOrden(orden), ventas: ventasMapeadas })
            delta.cambios += ventasMapeadas.length
        }
        delta.ventasHasta = Math.max(ventasHasta, ...ventasNuevas.map(v => v.id ?? 0))
    }

    // ── Gastos: append-only por cursor de id local ──
    const gastosNuevos = gastos.filter(g => (g.id ?? 0) > gastosHasta)
    if (gastosNuevos.length) {
        payload.gastos = gastosNuevos.map(g => ({ ...filaGasto(g), uid: `${dispositivo}::g::${g.id}` }))
        delta.cambios += gastosNuevos.length
        delta.gastosHasta = Math.max(gastosHasta, ...gastosNuevos.map(g => g.id ?? 0))
    }

    return delta
}

// ════════════════════════════════════════════════════════════════════════
// Aplicadores: bajada de la nube → repos locales (+ espejo actualizado)
// ════════════════════════════════════════════════════════════════════════

interface ResultadoBajada {
    productos: number
    categorias: number
    variaciones: number
    lotes: number
}

async function aplicarBajada(
    d: Awaited<ReturnType<typeof abrirDB>>,
    delta: import("@/lib/api/sync").DeltaNube,
): Promise<ResultadoBajada> {
    const dispositivo = obtenerIdDispositivo()
    const ahora = ahoraISO()
    const r: ResultadoBajada = { productos: 0, categorias: 0, variaciones: 0, lotes: 0 }
    const espejoPorUid = new Map((await d.sync_espejo.toArray()).map(e => [e.uid, e]))

    const marcarEspejo = async (tabla: string, clave: string, fila: Record<string, unknown>) => {
        const uid = `${dispositivo}::${tabla}::${clave}`
        const hash = hashObjeto(fila)
        const previa = espejoPorUid.get(uid)
        const entrada: SyncEspejoLocal = {
            uid, tabla, clave_local: clave, hash, data: fila, sincronizado_en: ahora,
        }
        // Entradas ya idénticas no se reescriben (evita escrituras tontas).
        if (previa && previa.hash === hash) return
        await d.sync_espejo.put(entrada)
        espejoPorUid.set(uid, entrada)
    }

    const estaSucia = async (tabla: string, clave: string, fila: Record<string, unknown>): Promise<boolean> => {
        const guardada = espejoPorUid.get(`${dispositivo}::${tabla}::${clave}`)
        return Boolean(guardada && guardada.hash !== hashObjeto(fila))
    }

    // ── Productos (por NOMBRE; se salta el que tenga cambios locales pendientes) ──
    for (const pNube of delta.productos ?? []) {
        const nombre = String(pNube["producto"] ?? "").trim()
        if (!nombre) continue
        const actual = await d.productos.get(nombre)
        const filaActual = actual ? filaProducto(actual) : null
        if (filaActual && (await estaSucia("productos", nombre, filaActual))) continue

        const filaLocal: ProductoLocal = {
            producto: nombre,
            descripcion: String(pNube["descripcion"] ?? ""),
            imagen: String(pNube["imagen"] ?? ""),
            estado: String(pNube["estado"] ?? "Activo"),
            categorias: (pNube["categoria"] as string[] | undefined) ?? [],
            visible_en_catalogo: Boolean(pNube["visible_en_catalogo"] ?? true),
            sufijo_precio: (pNube["sufijo_precio"] as string) || undefined,
            tamano_cm: (pNube["tamano_cm"] as number | null) ?? undefined,
            tipo_producto: String(pNube["tipo_producto"] ?? "stock"),
            costo_servicio: (pNube["costo_servicio"] as number | null) ?? undefined,
            precio_servicio: (pNube["precio_servicio"] as number | null) ?? undefined,
            fraccionable: Boolean(pNube["fraccionable"] ?? false),
            codigo_interno: (pNube["codigo_interno"] as string) || undefined,
            codigo_barras: (pNube["codigo_barras"] as string) || undefined,
            ubicacion: (pNube["ubicacion"] as string) || undefined,
        }
        await d.productos.put(filaLocal)
        await marcarEspejo("productos", nombre, filaProducto(filaLocal))
        r.productos++
    }

    // ── Categorías (upsert por nombre; id local = slug) ──
    for (const cNube of delta.categorias ?? []) {
        const nombre = String(cNube["nombre"] ?? "").trim()
        if (!nombre) continue
        const slug = String(cNube["slug"] ?? nombre.toLowerCase().replace(" ", "-"))
        await d.categorias.put({
            id: slug,
            nombre,
            slug,
            visible_en_catalogo: Boolean(cNube["visible_en_catalogo"] ?? true),
            orden: (cNube["orden"] as number | null) ?? undefined,
        })
        r.categorias++
    }

    // ── Variaciones (por producto+nombre: local conserva su id) ──
    for (const vNube of delta.variaciones ?? []) {
        const producto = String(vNube["producto"] ?? "").trim()
        const nombre = String(vNube["nombre"] ?? "").trim()
        if (!producto || !nombre) continue
        const existente = (await d.variaciones.toArray()).find(
            v => v.producto === producto && v.nombre === nombre,
        )
        const datos = {
            precio: Number(vNube["precio"] ?? 0),
            foto: String(vNube["foto"] ?? ""),
            tamano_cm: (vNube["tamano_cm"] as number | null) ?? null,
        }
        if (existente?.id !== undefined) {
            await d.variaciones.update(existente.id, datos)
        } else {
            await d.variaciones.add({ producto, nombre, ...datos })
        }
        r.variaciones++
    }

    // ── Lotes (por id_lote; variación resuelta por nombre) ──
    const variacionesLocales = await d.variaciones.toArray()
    for (const lNube of delta.lotes ?? []) {
        const idLote = String(lNube["id_lote"] ?? "").trim()
        const producto = String(lNube["producto"] ?? "").trim()
        if (!idLote || !producto) continue
        const actual = await d.lotes.get(idLote)
        const filaActual = actual
            ? filaLote(actual, actual.variacion || variacionesLocales.find(v => v.id === actual.variacion_id)?.nombre || "")
            : null
        if (filaActual && (await estaSucia("lotes", idLote, filaActual))) continue

        const nombreVar = String(lNube["variacion"] ?? "")
        const variacionId = nombreVar
            ? variacionesLocales.find(v => v.producto === producto && v.nombre === nombreVar)?.id ?? null
            : null
        const filaLocal: LoteLocal = {
            id_lote: idLote,
            producto,
            costo: Number(lNube["costo"] ?? 0),
            precio_venta: Number(lNube["precio_venta"] ?? 0),
            stock_lote: Number(lNube["stock_lote"] ?? 0),
            fecha_entrada: String(lNube["fecha_entrada"] ?? ""),
            estado: String(lNube["estado"] ?? "Activo"),
            etiqueta: (lNube["etiqueta"] as string) || undefined,
            variacion_id: variacionId,
            variacion: nombreVar || undefined,
        }
        await d.lotes.put(filaLocal)
        await marcarEspejo("lotes", idLote, filaLote(filaLocal, nombreVar))
        r.lotes++
    }

    // ── Config del catálogo (merge en perfil.catalogo_config) ──
    if (delta.config) {
        const perfil = await d.perfil.get(1)
        const actual = ((perfil?.catalogo_config || {}) as Record<string, unknown>) || {}
        await d.perfil.update(1, { catalogo_config: { ...actual, ...delta.config } } as Partial<PerfilLocal>)
    }

    return r
}

// ════════════════════════════════════════════════════════════════════════
// Orquestador + estado para la UI
// ════════════════════════════════════════════════════════════════════════

export interface ResumenSync {
    subida: RespuestaSync | null
    bajada: ResultadoBajada | null
    pendientes: number
}

/** Estado para la tarjeta: es híbrido activo, cuánto pendiente, última sync. */
export async function estadoSync(): Promise<{
    hibrido: boolean
    ultima_sync: string | null
    pendientes: number
}> {
    const d = abrirDB()
    const estado = await d.sync_estado.get(1)
    const delta = await extraerDelta(d)
    return {
        hibrido: true,
        ultima_sync: estado?.ultima_sync ?? null,
        pendientes: delta.cambios,
    }
}

/**
 * Sincroniza: BAJA el delta de la nube y SUBE el delta local (en ese orden:
 * así las filas de la nube llegan antes de calcular qué queda pendiente).
 * Cada llamada es un ciclo completo; reintentos seguros por idempotencia.
 */
export async function ejecutarSync(): Promise<ResumenSync> {
    const d = abrirDB()
    const ahora = ahoraISO()

    // ── 1. Bajada ──
    const estado = (await d.sync_estado.get(1)) ?? {
        id: 1 as const, cursor_descarga: null, ventas_hasta: 0, gastos_hasta: 0, ultima_sync: "",
    }
    const bajadaResp = await bajarSync(estado.cursor_descarga)
    const bajada = await aplicarBajada(d, bajadaResp)
    await d.sync_estado.put({
        ...estado,
        cursor_descarga: bajadaResp.cursor,
        ultima_sync: ahora,
    } as SyncEstadoLocal)

    // ── 2. Subida ──
    const delta = await extraerDelta(d)
    let subida: RespuestaSync | null = null
    if (delta.cambios > 0) {
        subida = await subirSync(delta.payload)

        // ── 3. Confirmar: espejo actualizado + cursors avanzados ──
        const confirmado = ahoraISO()
        for (const c of delta.confirmar_productos) {
            await d.sync_espejo.put({
                uid: c.uid, tabla: "productos", clave_local: String(c.fila["producto"]),
                hash: hashObjeto(c.fila), data: c.fila, sincronizado_en: confirmado,
            })
        }
        for (const c of delta.confirmar_variaciones) {
            await d.sync_espejo.put({
                uid: c.uid, tabla: "variaciones",
                clave_local: `${c.fila["producto"]}::${c.fila["nombre"]}`,
                hash: hashObjeto(c.fila), data: c.fila, sincronizado_en: confirmado,
            })
        }
        for (const c of delta.confirmar_lotes) {
            await d.sync_espejo.put({
                uid: c.uid, tabla: "lotes", clave_local: String(c.fila["id_lote"]),
                hash: hashObjeto(c.fila), data: c.fila, sincronizado_en: confirmado,
            })
        }
        const estadoPost = (await d.sync_estado.get(1)) ?? estado
        await d.sync_estado.put({
            ...estadoPost,
            ventas_hasta: delta.ventasHasta,
            gastos_hasta: delta.gastosHasta,
            ultima_sync: confirmado,
        } as SyncEstadoLocal)
    }

    return { subida, bajada, pendientes: subida ? 0 : delta.cambios }
}
