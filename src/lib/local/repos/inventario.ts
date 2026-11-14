// ==============================================================================
// src/lib/local/repos/inventario.ts
// Repositorio LOCAL de inventario (IndexedDB/Dexie). Cumple el MISMO
// contrato de respuestas que routers/inventario.py del backend:
//
//   - getInventario: vista consolidada (stock_total, PEPS precio_sugerido,
//     precio_min/max, costo_promedio ponderado, variaciones con su stock,
//     recetas y disponibilidad de compuestos).
//   - alta/edición/restock/lotes/categorías/variaciones/recetas/fotos/perfil.
//
// Reglas de negocio replicadas del backend Python:
//   * PEPS: el precio sugerido (modo 'antiguo') es el del lote MÁS ANTIGUO
//     con stock > 0 (el que va a vender el POS).
//   * Servicios y compuestos: sin lotes; precio/costo viven en el producto.
//   * Eliminar el último lote activo de un producto lo da de BAJA.
//   * Ledger append-only (migración 040) en cada cambio de stock.
//
// Nota de diseño: NO llevan tenantId como parámetro — la DB ya es namespaced
// por tenant (nezzura_local_<id>, ver db.ts). Los repos ignoran el primer
// argumento de compatibilidad cuando existe (_tenantId).
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import { Capacitor } from "@capacitor/core"
import type {
    Producto, Lote, Variacion, MaterialReceta, NuevoProducto, Restock,
    RespuestaMovimientos, MovimientoInventario, Categoria, ClienteCampos,
    ImagenProducto, CatalogoConfig,
} from "@/types"
import type { ProductoLocal, LoteLocal, PerfilLocal, CategoriaLocal } from "../db"
import { redondear } from "./utilidades"
import { DBSQLite } from "../sqlite/tablas"

// ============================================================================
// Utilidades
// ============================================================================

function idNuevo(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().slice(0, 13)}`
}

function slug(nombre: string): string {
    return nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

// ============================================================================
// Ledger (migración 040): cada cambio de stock escribe un renglón append-only
// ============================================================================
export async function registrarMovimiento(m: {
    producto: string
    variacion?: string | null
    id_lote?: string | null
    tipo: "entrada" | "salida" | "ajuste"
    origen: MovimientoInventario["origen"]
    cantidad: number            // con signo: + entra, − sale
    stock_resultante?: number | null
    referencia_id?: string | null
    concepto?: string | null
}): Promise<void> {
    const d = abrirDB()
    await d.movimientos.add({
        id: crypto.randomUUID(),
        producto_id: null,
        producto: m.producto,
        variacion: m.variacion ?? null,
        id_lote: m.id_lote ?? null,
        tipo: m.tipo,
        origen: m.origen,
        cantidad: m.cantidad,
        stock_resultante: m.stock_resultante ?? null,
        referencia_id: m.referencia_id ?? null,
        concepto: m.concepto ?? null,
        fecha: ahoraISO(),
    })
}

async function stockDeVariacion(variacionId: number): Promise<number> {
    const d = abrirDB()
    const lotes = (await d.lotes.where("variacion_id").equals(variacionId).toArray())
        .filter(l => l.estado === "Activo")
    return lotes.reduce((s, l) => s + l.stock_lote, 0)
}

// ============================================================================
// Vista consolidada (equivale a get_inventario_consolidado)
// ============================================================================
export async function getInventario(): Promise<Producto[]> {
    const d = abrirDB()
    const [productos, lotes, variaciones, recetas] = await Promise.all([
        d.productos.toArray(),
        d.lotes.where("estado").equals("Activo").toArray(),
        d.variaciones.toArray(),
        d.recetas.toArray(),
    ])
    const activos = productos.filter(p => p.estado === "Activo")

    // Stock BASE (lotes sin variación) por producto — para disponibilidad
    const stockBase = new Map<string, number>()
    for (const l of lotes) {
        if (l.variacion_id) continue
        stockBase.set(l.producto, (stockBase.get(l.producto) || 0) + l.stock_lote)
    }

    const modo = await getModoPrecio()

    const inventario: Producto[] = activos.map(p => {
        const misLotes = lotes
            .filter(l => l.producto === p.producto)
            .sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada))
        const conStock = misLotes.filter(l => l.stock_lote > 0)

        const esServicioOCompuesto = p.tipo_producto === "servicio" || p.tipo_producto === "compuesto"
        const precioServicio = p.precio_servicio || 0

        let stockTotal = 0, precioVenta = 0, precioMin = 0, precioMax = 0, precioSugerido = 0, costoProm = 0
        if (esServicioOCompuesto) {
            // Sin lotes: el precio es su precio propio (precio_servicio se
            // reutiliza como 'precio sin stock', como en el backend)
            stockTotal = 0
            costoProm = p.costo_servicio || 0
            precioVenta = precioMin = precioMax = precioSugerido = precioServicio
        } else {
            stockTotal = misLotes.reduce((s, l) => s + l.stock_lote, 0)
            const referencia = conStock.length > 0 ? conStock : misLotes
            precioVenta = referencia.length ? Math.max(...referencia.map(l => l.precio_venta)) : 0
            precioMin = conStock.length ? Math.min(...conStock.map(l => l.precio_venta)) : precioVenta
            precioMax = conStock.length ? Math.max(...conStock.map(l => l.precio_venta)) : precioVenta
            const loteAntiguo = conStock[0]
            const loteReciente = conStock.length ? conStock[conStock.length - 1] : undefined
            precioSugerido = modo === "maximo" ? precioMax
                : modo === "reciente" ? (loteReciente?.precio_venta ?? precioVenta)
                : (loteAntiguo?.precio_venta ?? precioVenta)
            const denom = misLotes.reduce((s, l) => s + l.stock_lote, 0)
            costoProm = denom > 0
                ? misLotes.reduce((s, l) => s + l.costo * l.stock_lote, 0) / denom
                : 0
        }

        const misVars = variaciones.filter(v => v.producto === p.producto)
        const misRecetas = recetas.filter(r => r.producto === p.producto)

        const fila: Producto = {
            producto: p.producto,
            descripcion: p.descripcion,
            imagen: p.imagen || "",
            estado: p.estado,
            stock_total: redondear(stockTotal),
            precio_venta: redondear(precioVenta),
            precio_min: redondear(precioMin),
            precio_max: redondear(precioMax),
            costo_promedio: redondear(costoProm),
            categoria: p.categorias || [],
            codigo_interno: p.codigo_interno || undefined,
            codigo_barras: p.codigo_barras || undefined,
            ubicacion: p.ubicacion || undefined,
            visible_en_catalogo: p.visible_en_catalogo ?? true,
            sufijo_precio: p.sufijo_precio || undefined,
            fraccionable: p.fraccionable || false,
            tamano_cm: p.tamano_cm,
            tipo_producto: p.tipo_producto || "stock",
            costo_servicio: p.costo_servicio,
            precio_servicio: p.precio_servicio,
            post_override: (p as { post_override?: unknown }).post_override ?? null,
        }
        if (conStock.length) fila.precio_sugerido = redondear(precioSugerido)

        if (misVars.length) {
            fila.variaciones = misVars.map(v => ({
                id: v.id as number,
                nombre: v.nombre,
                precio: v.precio,
                foto: v.foto || "",
                tamano_cm: v.tamano_cm ?? null,
                stock: redondear(lotes.filter(l => l.variacion_id === v.id).reduce((s, l) => s + l.stock_lote, 0)),
            }))
        }
        if (misRecetas.length) {
            fila.recetas = misRecetas.map(r => ({
                id: r.id as number,
                material: r.material,
                cantidad: r.cantidad,
                variacion_id: r.variacion_id ?? null,
                variacion: r.variacion_id ? misVars.find(v => v.id === r.variacion_id)?.nombre : undefined,
            }))
            // Disponibilidad del compuesto: el material más escaso manda
            const porMaterial = misRecetas.map(r => {
                if (r.cantidad <= 0) return null
                const stockMat = r.variacion_id
                    ? lotes.filter(l => l.variacion_id === r.variacion_id)
                        .reduce((s, l) => s + l.stock_lote, 0)
                    : (stockBase.get(r.material) || 0)
                return Math.floor((stockMat || 0) / r.cantidad)
            })
            fila.disponibilidad_estimada = porMaterial.every(x => x !== null)
                ? Math.min(...(porMaterial as number[]))
                : null
        }
        return fila
    })

    // Orden alfabético por producto, como el backend (ORDER BY Producto ASC)
    inventario.sort((a, b) => a.producto.localeCompare(b.producto))
    return inventario
}

// ============================================================================
// Lotes
// ============================================================================
function filaLote(l: LoteLocal): Lote {
    return {
        id_lote: l.id_lote,
        producto: l.producto,
        costo: l.costo,
        precio_venta: l.precio_venta,
        stock_lote: l.stock_lote,
        fecha_entrada: l.fecha_entrada,
        estado: l.estado,
        etiqueta: l.etiqueta || undefined,
        variacion_id: l.variacion_id ?? undefined,
        variacion: l.variacion || undefined,
    }
}

export async function getLotes(): Promise<Lote[]> {
    const d = abrirDB()
    const filas = await d.lotes.where("estado").equals("Activo").toArray()
    return filas
        .map(filaLote)
        .sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada) || a.id_lote.localeCompare(b.id_lote))
}

/** Alta de lote (restock / alta inicial de variación). Validación de `variacion` por NOMBRE. */
export async function agregarLote(args: {
    producto: string
    costo: number
    precio_venta: number
    stock: number
    etiqueta?: string
    variacion?: string
    origen_movimiento?: MovimientoInventario["origen"]
}): Promise<{ ok: boolean; mensaje: string; id_lote: string }> {
    const d = abrirDB()
    if (!(await d.productos.get(args.producto))) {
        return { ok: false, mensaje: "El producto no existe.", id_lote: "" }
    }

    let variacionId: number | null = null
    if (args.variacion) {
        const vars = await d.variaciones.where("producto").equals(args.producto).toArray()
        const v = vars.find(x => x.nombre.toLowerCase() === args.variacion!.toLowerCase())
        if (!v) return { ok: false, mensaje: "La variación no existe.", id_lote: "" }
        variacionId = v.id ?? null
    }

    const nuevo: LoteLocal = {
        id_lote: idNuevo("LT"),
        producto: args.producto,
        costo: args.costo,
        precio_venta: args.precio_venta,
        stock_lote: args.stock,
        fecha_entrada: ahoraISO(),
        estado: "Activo",
        etiqueta: args.etiqueta || undefined,
        variacion_id: variacionId,
        variacion: args.variacion || undefined,
    }
    await d.lotes.add(nuevo)

    await registrarMovimiento({
        producto: args.producto,
        id_lote: nuevo.id_lote,
        variacion: args.variacion || null,
        tipo: "entrada",
        origen: args.origen_movimiento || "restock",
        cantidad: args.stock,
        stock_resultante: args.stock,
        concepto: "Alta de lote",
    })

    return { ok: true, mensaje: "Lote registrado", id_lote: nuevo.id_lote }
}

/** Restock directo (mismo shape que POST /inventario/restock). */
export async function restockear(data: Restock): Promise<{ ok: boolean; mensaje: string }> {
    const r = await agregarLote({
        producto: data.producto,
        costo: data.costo,
        precio_venta: data.precio_venta,
        stock: data.stock,
        etiqueta: data.etiqueta,
        variacion: data.variacion || "",
    })
    return { ok: r.ok, mensaje: r.mensaje }
}

/** Edición absoluta del lote (costo/precio/stock). Delta → movimento 'ajuste_manual'. */
export async function editarLote(
    id_lote: string,
    data: { costo: number; precio_venta: number; stock: number; etiqueta?: string; variacion?: string }
): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB()
    const lote = await d.lotes.get(id_lote)
    if (!lote) return { ok: false, mensaje: "Lote no encontrado." }

    const delta = redondear(data.stock - lote.stock_lote)
    await d.lotes.update(id_lote, {
        costo: data.costo,
        precio_venta: data.precio_venta,
        stock_lote: data.stock,
        ...(data.etiqueta !== undefined ? { etiqueta: data.etiqueta } : {}),
        ...(data.variacion !== undefined ? { variacion: data.variacion } : {}),
    })
    if (delta !== 0) {
        await registrarMovimiento({
            producto: lote.producto,
            variacion: data.variacion ?? lote.variacion ?? null,
            id_lote,
            tipo: "ajuste",
            origen: "ajuste_manual",
            cantidad: delta,
            stock_resultante: data.stock,
            concepto: "Ajuste manual del lote",
        })
    }
    return { ok: true, mensaje: "Lote actualizado." }
}

/** Baja de lote. Si era el último activo del producto → producto 'Baja'. */
export async function eliminarLote(
    id_lote: string
): Promise<{ ok: boolean; producto: string; producto_desactivado: boolean }> {
    const d = abrirDB()
    const lote = await d.lotes.get(id_lote)
    if (!lote) return { ok: true, producto: "", producto_desactivado: false }

    if (lote.stock_lote > 0) {
        await registrarMovimiento({
            producto: lote.producto,
            variacion: lote.variacion ?? null,
            id_lote,
            tipo: "salida",
            origen: "baja_lote",
            cantidad: -lote.stock_lote,
            stock_resultante: 0,
            concepto: "Baja de lote",
        })
    }
    await d.lotes.delete(id_lote)

    const restantes = await d.lotes.where("producto").equals(lote.producto).toArray()
    const quedaActivo = restantes.some(l => l.estado === "Activo")
    if (!quedaActivo) {
        await d.productos.update(lote.producto, { estado: "Baja" })
    }
    return { ok: true, producto: lote.producto, producto_desactivado: !quedaActivo }
}

// ============================================================================
// Productos: alta y edición
// ============================================================================
export async function crearProducto(
    data: NuevoProducto & { imagen?: string }
): Promise<{ ok: boolean; mensaje: string; producto: string }> {
    const d = abrirDB()
    if (await d.productos.get(data.producto)) {
        return { ok: false, mensaje: `El producto "${data.producto}" ya existe.`, producto: data.producto }
    }

    const tipo = data.tipo_producto || "stock"
    const esServicio = tipo === "servicio"
    await d.productos.add({
        producto: data.producto,
        descripcion: data.descripcion || "",
        imagen: data.imagen || "",
        estado: "Activo",
        categorias: data.categoria || [],
        codigo_interno: data.codigo_interno || undefined,
        codigo_barras: data.codigo_barras || undefined,
        ubicacion: data.ubicacion || undefined,
        visible_en_catalogo: data.visible_en_catalogo ?? true,
        sufijo_precio: data.sufijo_precio || undefined,
        fraccionable: data.fraccionable || false,
        tamano_cm: data.tamano_cm,
        tipo_producto: tipo,
        costo_servicio: data.costo_servicio,
        precio_servicio: data.precio_servicio,
        post_override: null,
        imagenes_extras: [],
    })

    // Lote inicial — solo productos CON inventario (servicio/compuesto no llevan)
    if (!esServicio && tipo !== "compuesto" && data.stock && data.stock > 0) {
        await agregarLote({
            producto: data.producto,
            costo: data.costo || 0,
            precio_venta: data.precio_venta || 0,
            stock: data.stock,
            etiqueta: data.etiqueta,
        })
    }

    // Variaciones con lote inicial si traen stock
    if (data.variaciones?.length) {
        for (const v of data.variaciones) {
            const variacionId = (await d.variaciones.add({
                producto: data.producto,
                nombre: v.nombre,
                precio: v.precio,
                foto: "",
                tamano_cm: v.tamano_cm ?? null,
            })) as unknown as number
            if (v.stock_inicial && v.stock_inicial > 0) {
                const vars = await d.variaciones.where("producto").equals(data.producto).toArray()
                const laVariable = vars.find(x => x.nombre === v.nombre)
                await agregarLote({
                    producto: data.producto,
                    costo: v.costo || data.costo || 0,
                    precio_venta: v.precio,
                    stock: v.stock_inicial,
                    variacion: laVariable?.nombre || v.nombre,
                })
                void variacionId
            }
        }
    }

    // Receta del compuesto
    if (tipo === "compuesto" && data.recetas?.length) {
        for (const r of data.recetas) {
            await d.recetas.add({
                producto: data.producto,
                material: r.material,
                cantidad: r.cantidad,
                variacion_id: null,
            })
        }
    }

    return { ok: true, mensaje: "Producto creado", producto: data.producto }
}

export interface ActualizarProductoArgs {
    descripcion: string
    imagen: string
    estado: string
    categoria: string[]
    costo?: number
    precio_venta?: number
    producto?: string
    codigo_interno?: string
    codigo_barras?: string
    ubicacion?: string
    visible_en_catalogo?: boolean
    sufijo_precio?: string
    fraccionable?: boolean
    tamano_cm?: number
    tipo_producto?: string
    costo_servicio?: number
    precio_servicio?: number
}

export async function editarProducto(
    prod: string,
    data: ActualizarProductoArgs
): Promise<{ ok: boolean; mensaje: string; producto?: string }> {
    const d = abrirDB()
    const anterior = await d.productos.get(prod)
    if (!anterior) return { ok: false, mensaje: "Producto no encontrado." }

    const nuevoNombre = data.producto || prod
    const cambios: Partial<ProductoLocal> = {
        descripcion: data.descripcion,
        imagen: data.imagen,
        estado: data.estado,
        categorias: data.categoria,
        codigo_interno: data.codigo_interno,
        codigo_barras: data.codigo_barras,
        ubicacion: data.ubicacion,
        visible_en_catalogo: data.visible_en_catalogo,
        sufijo_precio: data.sufijo_precio,
        fraccionable: data.fraccionable,
        tamano_cm: data.tamano_cm,
        tipo_producto: data.tipo_producto,
        costo_servicio: data.costo_servicio,
        precio_servicio: data.precio_servicio,
    }

    await d.transaction("rw", d.productos, d.lotes, d.variaciones, d.recetas, async () => {
        if (nuevoNombre !== prod) {
            await d.productos.delete(prod)
            await d.productos.add({ ...anterior, ...cambios, producto: nuevoNombre })
            // Renombrar referencias en cascada (lotes, variaciones, recetas)
            const lotes = await d.lotes.where("producto").equals(prod).toArray()
            for (const l of lotes) await d.lotes.update(l.id_lote, { producto: nuevoNombre })
            const vars = await d.variaciones.where("producto").equals(prod).toArray()
            for (const v of vars) await d.variaciones.update(v.id!, { producto: nuevoNombre })
            const recs = await d.recetas.where("producto").equals(prod).toArray()
            for (const r of recs) await d.recetas.update(r.id!, { producto: nuevoNombre })
            const comoMaterial = await d.recetas.where("material").equals(prod).toArray()
            for (const r of comoMaterial) await d.recetas.update(r.id!, { material: nuevoNombre })
        } else {
            await d.productos.update(prod, cambios)
        }
    })

    return { ok: true, mensaje: "Producto actualizado.", producto: nuevoNombre }
}

// ============================================================================
// Categorías
// ============================================================================
export async function getCategorias(): Promise<Categoria[]> {
    const d = abrirDB()
    const [filas, productos] = await Promise.all([
        d.categorias.orderBy("orden").toArray(),
        d.productos.toArray(),
    ])
    return filas.map(c => ({
        ...c,
        visible_en_catalogo: c.visible_en_catalogo ?? true,
        orden: c.orden ?? null,
        total_productos: productos.filter(p => (p.categorias || []).includes(c.nombre) && p.estado === "Activo").length,
    }))
}

function aCategoria(c: { id: string; nombre: string; slug: string; visible_en_catalogo?: boolean; orden?: number }): Categoria {
    return {
        id: c.id,
        nombre: c.nombre,
        slug: c.slug,
        total_productos: 0,
        visible_en_catalogo: c.visible_en_catalogo ?? true,
        orden: c.orden ?? null,
    }
}

export async function crearCategoria(nombre: string): Promise<{ ok: boolean; categoria: Categoria; mensaje: string }> {
    const d = abrirDB()
    const existentes = await d.categorias.toArray()
    if (existentes.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
        return { ok: false, categoria: { id: "", nombre: "", slug: "", total_productos: 0 }, mensaje: "La categoría ya existe." }
    }
    const id = crypto.randomUUID()
    const fila = { id, nombre, slug: slug(nombre), visible_en_catalogo: true, orden: existentes.length }
    await d.categorias.add(fila as CategoriaLocal)
    return { ok: true, categoria: aCategoria(fila), mensaje: "Categoría creada." }
}

export async function editarCategoria(
    viejoNombre: string,
    nuevoNombre: string
): Promise<{ ok: boolean; categoria: Categoria }> {
    const d = abrirDB()
    const existentes = await d.categorias.toArray()
    const fila = existentes.find(c => c.nombre === viejoNombre)
    if (!fila) return { ok: false, categoria: { id: "", nombre: "", slug: "", total_productos: 0 } }
    if (existentes.some(c => c.nombre.toLowerCase() === nuevoNombre.toLowerCase() && c.id !== fila.id)) {
        return { ok: false, categoria: { id: fila.id, nombre: viejoNombre, slug: fila.slug, total_productos: 0 } }
    }
    await d.categorias.update(fila.id, { nombre: nuevoNombre, slug: slug(nuevoNombre) })
    const prods = await d.productos.toArray()
    for (const p of prods) {
        if ((p.categorias || []).includes(viejoNombre)) {
            await d.productos.update(p.producto, {
                categorias: (p.categorias || []).map(c => (c === viejoNombre ? nuevoNombre : c)),
            })
        }
    }
    return { ok: true, categoria: aCategoria({ ...fila, nombre: nuevoNombre, slug: slug(nuevoNombre) }) }
}

export async function eliminarCategoria(categoria: string): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB()
    const fila = (await d.categorias.toArray()).find(c => c.nombre === categoria)
    if (fila) await d.categorias.delete(fila.id)
    const prods = await d.productos.toArray()
    for (const p of prods) {
        if ((p.categorias || []).includes(categoria)) {
            await d.productos.update(p.producto, {
                categorias: (p.categorias || []).filter(c => c !== categoria),
            })
        }
    }
    return { ok: true, mensaje: "Categoría eliminada." }
}

export async function toggleVisibilidadCategoria(
    categoria: string
): Promise<{ ok: boolean; categoria: string; visible_en_catalogo: boolean; mensaje: string }> {
    const d = abrirDB()
    const fila = (await d.categorias.toArray()).find(c => c.nombre === categoria)
    if (!fila) {
        return { ok: false, categoria, visible_en_catalogo: false, mensaje: "No encontrada." }
    }
    const nuevo = !(fila.visible_en_catalogo ?? true)
    await d.categorias.update(fila.id, { visible_en_catalogo: nuevo })
    return { ok: true, categoria, visible_en_catalogo: nuevo, mensaje: "Visibilidad actualizada." }
}

export async function reordenarCategorias(
    ordenes: { id: string; orden: number }[]
): Promise<{ ok: boolean; mensaje?: string }> {
    const d = abrirDB()
    for (const o of ordenes) await d.categorias.update(o.id, { orden: o.orden })
    return { ok: true, mensaje: "Orden guardado." }
}

// ============================================================================
// Variaciones
// ============================================================================
function filaVariacion(v: { id: number; nombre: string; precio: number; foto?: string; tamano_cm?: number | null; stock?: number }): Variacion {
    return { id: v.id, nombre: v.nombre, precio: v.precio, foto: v.foto || "", tamano_cm: v.tamano_cm ?? null, stock: v.stock }
}

export async function getVariaciones(producto: string): Promise<Variacion[]> {
    const d = abrirDB()
    const vars = await d.variaciones.where("producto").equals(producto).toArray()
    return vars.map(v => filaVariacion({ id: v.id!, nombre: v.nombre, precio: v.precio, foto: v.foto }))
}

export async function crearVariacion(
    producto: string,
    nombre: string,
    precio: number,
    foto?: string,
    stockInicial?: number,
    costo?: number,
    tamanoCm?: number
): Promise<{ ok: boolean; variacion: Variacion }> {
    const d = abrirDB()
    const id = (await d.variaciones.add({
        producto,
        nombre,
        precio,
        foto: foto || "",
        tamano_cm: tamanoCm ?? null,
    })) as unknown as number
    let stock = 0
    if (stockInicial && stockInicial > 0) {
        await agregarLote({
            producto,
            costo: costo || 0,
            precio_venta: precio,
            stock: stockInicial,
            variacion: nombre,
        })
        stock = stockInicial
    }
    return { ok: true, variacion: filaVariacion({ id, nombre, precio, foto, tamano_cm: tamanoCm ?? null, stock }) }
}

export async function editarVariacion(
    id: number,
    nombre: string,
    precio: number,
    foto?: string,
    tamanoCm?: number
): Promise<{ ok: boolean; variacion: Variacion }> {
    const d = abrirDB()
    await d.variaciones.update(id, {
        nombre, precio,
        ...(foto !== undefined ? { foto } : {}),
        ...(tamanoCm !== undefined ? { tamano_cm: tamanoCm } : {}),
    })
    const stock = await stockDeVariacion(id)
    const actual = await d.variaciones.get(id)
    return { ok: true, variacion: filaVariacion({ id, nombre, precio, foto, tamano_cm: actual?.tamano_cm ?? null, stock }) }
}

export type RespEliminarVariacion =
    | { ok: boolean; id: number }
    | { ok: boolean; requiere_confirmacion: boolean; unidades: number; lotes: number; mensaje: string }

export async function eliminarVariacion(id: number, confirmar = false): Promise<RespEliminarVariacion> {
    const d = abrirDB()
    const lotes = (await d.lotes.where("variacion_id").equals(id).toArray())
        .filter(l => l.estado === "Activo" && l.stock_lote > 0)
    const unidades = lotes.reduce((s, l) => s + l.stock_lote, 0)
    if (unidades > 0 && !confirmar) {
        return { ok: true, requiere_confirmacion: true, unidades, lotes: lotes.length, mensaje: "Hay stock en esta variación." }
    }
    for (const l of lotes) {
        await registrarMovimiento({
            producto: l.producto,
            variacion: l.variacion ?? null,
            id_lote: l.id_lote,
            tipo: "salida",
            origen: "baja_lote",
            cantidad: -l.stock_lote,
            stock_resultante: 0,
            concepto: "Eliminación de variación",
        })
        await d.lotes.delete(l.id_lote)
    }
    for (const l of (await d.lotes.where("variacion_id").equals(id).toArray())) {
        await d.lotes.delete(l.id_lote)
    }
    for (const r of (await d.recetas.where("variacion_id").equals(id).toArray())) {
        await d.recetas.delete(r.id!)
    }
    await d.variaciones.delete(id)
    return { ok: true, id }
}

// ============================================================================
// Recetas (compuestos)
// ============================================================================
export async function getRecetas(producto: string): Promise<MaterialReceta[]> {
    const d = abrirDB()
    const filas = await d.recetas.where("producto").equals(producto).toArray()
    const vars = await d.variaciones.where("producto").equals(producto).toArray()
    return filas.map(r => ({
        id: r.id as number,
        material: r.material,
        cantidad: r.cantidad,
        variacion_id: r.variacion_id ?? null,
        variacion: r.variacion_id ? vars.find(v => v.id === r.variacion_id)?.nombre : undefined,
    }))
}

export async function agregarMaterial(
    producto: string,
    material: string,
    cantidad: number,
    variacion_id?: number | null
): Promise<{ ok: boolean; material: string; cantidad: number }> {
    const d = abrirDB()
    // El material debe existir como producto de stock (validación del backend)
    if (!(await d.productos.get(material))) {
        throw new Error(`El material "${material}" no existe en tu inventario.`)
    }
    await d.recetas.add({ producto, material, cantidad, variacion_id: variacion_id ?? null })
    return { ok: true, material, cantidad }
}

export async function editarMaterial(id: number, cantidad: number): Promise<{ ok: boolean; id: number; cantidad: number }> {
    const d = abrirDB()
    await d.recetas.update(id, { cantidad })
    return { ok: true, id, cantidad }
}

export async function eliminarMaterial(id: number): Promise<{ ok: boolean; id: number }> {
    const d = abrirDB()
    await d.recetas.delete(id)
    return { ok: true, id }
}

// ============================================================================
// Movimientos (ledger, migración 040)
// ============================================================================
export async function getMovimientos(
    params: { limit?: number; offset?: number; tipo?: string; producto?: string; desde?: string; hasta?: string } = {}
): Promise<RespuestaMovimientos> {
    const d = abrirDB()
    let filas = await d.movimientos.orderBy("fecha").toArray()
    filas.reverse() // más recientes primero, como el backend
    if (params.tipo) filas = filas.filter(f => f.tipo === params.tipo)
    if (params.producto) {
        const t = params.producto.toLowerCase()
        filas = filas.filter(f => f.producto.toLowerCase().includes(t))
    }
    if (params.desde) filas = filas.filter(f => f.fecha.slice(0, 10) >= params.desde!)
    if (params.hasta) filas = filas.filter(f => f.fecha.slice(0, 10) <= params.hasta!)

    const total = filas.length
    const offset = params.offset ?? 0
    const limit = params.limit ?? 50
    const movimientos: MovimientoInventario[] = filas.slice(offset, offset + limit).map(f => ({
        id: f.id as string,
        producto_id: f.producto_id,
        producto: f.producto,
        variacion: f.variacion,
        id_lote: f.id_lote,
        tipo: f.tipo,
        origen: f.origen,
        cantidad: f.cantidad,
        stock_resultante: f.stock_resultante,
        referencia_id: f.referencia_id,
        concepto: f.concepto,
        fecha: f.fecha,
    }))
    return { movimientos, total, limit, offset }
}

// ============================================================================
// Perfil (config del negocio — equivalente de /inventario/me)
// ============================================================================
const PERFIL_FILA_ID = 1

export interface PerfilNegocio {
    tenant_id: string
    modo_precio_sugerido: string
    zona_horaria: string
    metodo_pago_default: string
    gasto_comision_automatico: boolean
    dias_cerrados: string[]
    clientes_activos: boolean
    cliente_campos: ClienteCampos
    puntos_activos: boolean
    puntos_valor_punto: number
    puntos_modo: import("@/types").ModoPuntos
    puntos_gasto_monto: number
    puntos_gasto_pts: number
    puntos_fijos: number | null
}

/** Crea la fila del perfil si el negocio está recién activado en este aparato. */
export async function asegurarPerfil(): Promise<PerfilLocal> {
    const d = abrirDB()
    let p = await d.perfil.get(PERFIL_FILA_ID)
    if (!p) {
        const { obtenerLicencia } = await import("../licencia")
        p = {
            id: PERFIL_FILA_ID,
            empresa: obtenerLicencia()?.empresa || "",
            logo: obtenerLicencia()?.logo || "",
            zona_horaria: "America/Cancun",
            metodo_pago_default: "efectivo",
            gasto_comision_automatico: false,
            dias_cerrados: [],
            clientes_activos: false,
            giro: "tienda",
            modulos: null,
        }
        await d.perfil.put(p)
    }
    return p
}

export async function getPerfil(tenantId: string): Promise<PerfilNegocio> {
    const p = await asegurarPerfil()
    return {
        tenant_id: tenantId,
        modo_precio_sugerido: p.modo_precio_sugerido || "antiguo",
        zona_horaria: p.zona_horaria || "America/Cancun",
        metodo_pago_default: p.metodo_pago_default || "efectivo",
        gasto_comision_automatico: p.gasto_comision_automatico ?? false,
        dias_cerrados: p.dias_cerrados || [],
        clientes_activos: p.clientes_activos ?? false,
        cliente_campos: {
            email: { activo: true, requerido: true },
            telefono: { activo: true, requerido: true },
            pin: { activo: false, requerido: false },
        },
        // Puntos: fase posterior del modo local (estructura lista)
        puntos_activos: false,
        puntos_valor_punto: 1,
        puntos_modo: "por_gasto",
        puntos_gasto_monto: 10,
        puntos_gasto_pts: 1,
        puntos_fijos: null,
    }
}

const CLAVES_PERFIL: string[] = [
    "empresa", "logo", "zona_horaria", "metodo_pago_default",
    "gasto_comision_automatico", "dias_cerrados", "clientes_activos",
    "modo_precio_sugerido",
    // Contacto (migración 043)
    "telefono", "correo", "instagram", "facebook", "tiktok", "sitio_web", "maps",
]

/** PATCH genérico de config (como PATCH /inventario/me). */
export async function actualizarPerfil(
    data: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const d = abrirDB()
    await asegurarPerfil()
    const cambios: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(data)) {
        if (CLAVES_PERFIL.includes(clave)) cambios[clave] = valor
    }
    await d.perfil.update(PERFIL_FILA_ID, cambios as Partial<PerfilLocal>)
    return { ok: true, ...data }
}

export async function actualizarModoPrecioSugerido(
    modo: string
): Promise<{ ok: boolean; modo_precio_sugerido: string }> {
    const d = abrirDB()
    await asegurarPerfil()
    await d.perfil.update(PERFIL_FILA_ID, { modo_precio_sugerido: modo })
    return { ok: true, modo_precio_sugerido: modo }
}

async function getModoPrecio(): Promise<string> {
    try {
        const p = await abrirDB().perfil.get(PERFIL_FILA_ID)
        return p?.modo_precio_sugerido || "antiguo"
    } catch {
        return "antiguo"
    }
}

// ============================================================================
// Fotos: en modo local NO hay Cloudinary — la foto vive en IndexedDB como
// dataURL redimensionada (máx 900px, JPEG 0.82). La UI no cambia: el campo
// imagen sigue siendo un string usable en <img src>.
// ============================================================================
const MAX_LADO = 900

export async function archivoADataURL(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL("image/jpeg", 0.82)
}

export async function subirFoto(_producto: string, file: File): Promise<{ ruta: string }> {
    return { ruta: await archivoADataURL(file) }
}

export async function subirFotoVariacion(_id: number, file: File): Promise<{ ok: boolean; url: string }> {
    return { ok: true, url: await archivoADataURL(file) }
}

export async function borrarImagen(_url: string): Promise<{ ok: boolean; mensaje: string }> {
    return { ok: true, mensaje: "Imagen eliminada de este dispositivo." }
}

/** Override de la tarjeta de post (Posts Automáticos) del producto. */
export async function guardarPostOverride(
    producto: string,
    post_override: unknown
): Promise<{ ok: boolean; producto: string; post_override: unknown }> {
    const d = abrirDB()
    await d.productos.update(producto, { post_override } as Partial<ProductoLocal>)
    return { ok: true, producto, post_override }
}

// ============================================================================
// InitDB: en la nube "asegura que las tablas existan" (legado); en local la
// base ya vive en este dispositivo — no hay nada que hacer. El formulario
// de alta llama a esto SIEMPRE antes de crear el producto, así que el
// no-op es lo que desbloquea el "dar de alta" offline.
//
// NUEVO (build nativo): aprovechamos la llamada para PRE-CALENTAR el motor
// SQLite (abrir conexión + validar esquema con PRAGMA user_version). Los
// errores del motor salen en el arranque, no en la primera venta del día.
// ============================================================================
export async function initDB(): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB() // valida licencia y abre la DB por si acaso; nada más
    if (Capacitor.isNativePlatform()) {
        await (d as unknown as DBSQLite).precalentar()
    }
    return { ok: true, mensaje: "La base ya vive en este dispositivo (Modo Local)." }
}

// ============================================================================
// Galería de fotos extra (API del plan Plus, espejo del endpoint
// /inventario/imagenes): en local son dataURLs en la fila del producto.
//  - La principal vive en productos.imagen y NUNCA está en la galería.
//  - Los ids son numéricos (contrato ImagenProducto) y únicos GLOBALES:
//    eliminarImagenExtra busca en todos los productos por id.
// ============================================================================
async function siguienteIdImagenExtra(): Promise<number> {
    const d = abrirDB()
    let max = 0
    for (const p of await d.productos.toArray()) {
        for (const e of p.imagenes_extras || []) max = Math.max(max, e.id)
    }
    return max + 1
}

export async function getImagenesProducto(producto: string): Promise<ImagenProducto[]> {
    const d = abrirDB()
    const p = await d.productos.get(producto)
    if (!p) return []
    return (p.imagenes_extras || [])
        .slice()
        .sort((a, b) => a.orden - b.orden || a.id - b.id)
        .map(e => ({ id: e.id, url: e.url, orden: e.orden }))
}

export async function subirImagenExtra(
    producto: string,
    file: File,
    ordenTarget?: number
): Promise<{ ok: boolean; url: string; orden: number }> {
    const d = abrirDB()
    const p = await d.productos.get(producto)
    if (!p) throw new Error(`El producto "${producto}" no existe.`)
    const extras = p.imagenes_extras || []
    const url = await archivoADataURL(file)
    const id = await siguienteIdImagenExtra()

    // Con ordenTarget: inserta en esa posición (el backend sube y reordena);
    // sin target: va al final de la galería.
    let orden: number
    if (ordenTarget !== undefined) {
        orden = ordenTarget
    } else {
        orden = extras.length ? Math.max(...extras.map(e => e.orden)) + 1 : 2
    }
    const nuevas = extras
        .map(e => (e.orden >= orden ? { ...e, orden: e.orden + 1 } : e))
        .concat([{ id, url, orden }])
        .sort((a, b) => a.orden - b.orden)
        .map((e, i) => ({ ...e, orden: i + 2 }))   // la principal es orden 1
    await d.productos.update(producto, { imagenes_extras: nuevas } as Partial<ProductoLocal>)
    return { ok: true, url, orden }
}

export async function eliminarImagenExtra(imagenId: number): Promise<{ ok: boolean; id: number }> {
    const d = abrirDB()
    const productos = await d.productos.toArray()
    for (const p of productos) {
        const extras = p.imagenes_extras || []
        if (!extras.some(e => e.id === imagenId)) continue
        const nuevas = extras
            .filter(e => e.id !== imagenId)
            .sort((a, b) => a.orden - b.orden)
            .map((e, i) => ({ ...e, orden: i + 2 }))
        await d.productos.update(p.producto, { imagenes_extras: nuevas } as Partial<ProductoLocal>)
        return { ok: true, id: imagenId }
    }
    return { ok: true, id: imagenId }
}

export async function reordenarImagenes(
    producto: string,
    ids: number[]
): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB()
    const p = await d.productos.get(producto)
    if (!p) return { ok: false, mensaje: "Producto no encontrado." }
    const porId = new Map((p.imagenes_extras || []).map(e => [e.id, e]))
    const extras = ids
        .map((id, i) => {
            const e = porId.get(id)
            return e ? { ...e, orden: i + 2 } : null
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
    await d.productos.update(producto, { imagenes_extras: extras } as Partial<ProductoLocal>)
    return { ok: true, mensaje: "Orden guardado." }
}

// ============================================================================
// Config del catálogo (espejo local de catalogo_gestion). El catálogo
// PÚBLICO no existe en local, pero Inventario/POS leen `relacion_imagen`
// (4:5 vs 1:1) de esta config — así el ajuste del POS y el guardado en
// Ajustes siguen funcionando sin nube. Se persiste en perfil.catalogo_config.
// ============================================================================
export async function getConfigCatalogo(): Promise<CatalogoConfig> {
    const d = abrirDB()
    const p = await asegurarPerfil()
    const guardado = (p.catalogo_config || {}) as Partial<CatalogoConfig>
    return {
        id: 1,
        slug: "impresion",     // en local solo existe /catalogo/impresion
        activo: false,         // catálogo público online: solo nube
        tema: "default",
        template: "grid-clasico",
        titulo: p.empresa || "",
        subtitulo: "",
        mostrar_precios: true,
        mostrar_stock: true,
        mostrar_categorias: true,
        ocultar_agotados: true,
        // Campos cambiables con defaults y overlay con lo guardado
        ...Object.fromEntries(Object.entries(guardado).filter(([, v]) => v !== undefined)),
        logo: p.logo || "",
        telefono: p.telefono || undefined,
        instagram: p.instagram || undefined,
        facebook: p.facebook || undefined,
        tiktok: p.tiktok || undefined,
        maps: p.maps || undefined,
    } as unknown as CatalogoConfig
}

/** PATCH parcial de la config: mezcla sobre catalogo_config del perfil. */
export async function actualizarConfigCatalogo(
    data: Record<string, unknown>
): Promise<{ ok: boolean; mensaje: string }> {
    const d = abrirDB()
    await asegurarPerfil()
    const p = await d.perfil.get(PERFIL_FILA_ID)
    const actual = ((p?.catalogo_config || {}) as Record<string, unknown>) || {}
    await d.perfil.update(PERFIL_FILA_ID, {
        catalogo_config: { ...actual, ...data },
    } as Partial<PerfilLocal>)
    return { ok: true, mensaje: "Configuración actualizada." }
}
