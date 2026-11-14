// ==============================================================================
// src/lib/local/repos/catalogo.ts
// Carga de datos para el CATÁLOGO IMPRIMIBLE en Modo Local: nada de red,
// todo lee IndexedDB (perfil de identidad + categorías visibles + productos
// visibles con su precio consolidado, igual que getInventario).
// ==============================================================================

import { abrirDB, ahoraISO } from "../db"
import { getInventario } from "./inventario"
import type { CatalogoPublicadoLocal, PerfilLocal } from "../db"
import type { Producto } from "@/types"
import {
    publicarDeltaCatalogo, publicarFotoCatalogo,
} from "@/lib/api/catalogo"

export interface CategoriaCatalogo {
    nombre: string
    orden: number
}

export interface CargaCatalogo {
    // Identidad del negocio (perfil local; logo/foto = dataURL)
    empresa: string
    logo: string
    telefono: string
    correo: string
    instagram: string
    facebook: string
    tiktok: string
    sitio_web: string
    maps: string
    // Categorías visibles para catálogo, ya ordenadas (drag & drop)
    categorias: CategoriaCatalogo[]
    // Productos visibles (estado Activo, visible_en_catalogo ≠ false,
    // y con al menos una categoría visible; sin categorías van a "Otros")
    productos: Producto[]
}

export async function getCargaCatalogo(): Promise<CargaCatalogo> {
    const d = abrirDB()
    const [perfil, inventario] = await Promise.all([
        d.perfil.get(1),
        getInventario(),
    ])

    // Categorías visibles ordenadas (orden numérico; faltantes al final)
    const catFilas = await d.categorias.toArray()
    const visibles = catFilas
        .filter(c => c.visible_en_catalogo !== false)
        .sort((a, b) =>
            ((a.orden ?? 999) - (b.orden ?? 999)) || a.nombre.localeCompare(b.nombre))
    const nombresVisibles = new Set(visibles.map(c => c.nombre))

    // Productos del catálogo (mismo criterio del catálogo público: quien
    // NO marcó visible_en_catalogo sale del listado impreso)
    const productos = inventario
        .filter(p =>
            p.visible_en_catalogo !== false &&
            (!p.categoria?.length || p.categoria.some(c => nombresVisibles.has(c))))
        .sort((a, b) => a.producto.localeCompare(b.producto))

    return {
        empresa: perfil?.empresa || "",
        logo: perfil?.logo || "",
        telefono: perfil?.telefono || "",
        correo: perfil?.correo || "",
        instagram: perfil?.instagram || "",
        facebook: perfil?.facebook || "",
        tiktok: perfil?.tiktok || "",
        sitio_web: perfil?.sitio_web || "",
        maps: perfil?.maps || "",
        categorias: visibles.map(c => ({ nombre: c.nombre, orden: c.orden ?? 999 })),
        productos,
    }
}

// ============================================================================
// Publish de catálogo ONLINE (el gancho del plan local)
//
// Delta por filas contra el snapshot local (tabla catalogo_publicado):
//   * clave '__config__'          → config pública (titulo, logo, contacto…)
//   * clave 'producto'            → UN producto con sus variaciones anidadas
//     (la variación ES parte de la fila del producto: el catálogo público las
//     lee anidadas y así 1 producto cambiado = 1 fila subida).
//
// El hash va sobre el contenido SIN las URLs de foto; foto_hash (aparte)
// cubre las fotos (dataURL locales). Si foto_hash no cambia, se reutiliza la
// URL de Cloudinary ya publicada — la foto NO se vuelve a subir. Si cambia,
// se re-suben las fotos de esa fila y la fila lleva las URLs nuevas.
//
// NUNCA van al payload público: costo_promedio, costo_unitario, costo de
// lotes, costo_servicio ni ningún otro dato interno del negocio.
// ============================================================================

/** djb2 (determinista, rápido, 8 hex) — suficiente para detectar cambios. */
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

/** Todas las fotos "propias" de una fila publicada (para foto_hash). */
function urlsDeFotos(data: Record<string, unknown>): string[] {
    const fotos: string[] = [
        String(data.imagen ?? ""),
        ...((data.imagenes as string[]) ?? []),
        ...(((data.variaciones as Record<string, unknown>[]) ?? []).map(v => String(v.foto ?? ""))),
    ]
    return fotos
}

/** dataURL → Blob (para el multipart al endpoint /foto). */
async function dataUrlABlob(dataUrl: string): Promise<Blob> {
    const r = await fetch(dataUrl)
    return r.blob()
}

/** Config pública del snapshot: defaults del catálogo local + overlay de lo
 * que el dueño cambió en perfil.catalogo_config + identidad del perfil. */
async function filaConfigPublica(
    perfil: PerfilLocal | undefined,
    ordenCategorias: { nombre: string; orden: number }[],
    guardada: CatalogoPublicadoLocal | undefined,
): Promise<CatalogoPublicadoLocal> {
    const guardadoCfg = ((perfil?.catalogo_config || {}) as Record<string, unknown>) || {}

    // Posible logo pendiente de subir (perfil.logo es dataURL en local):
    // el hash de la config cubre el logo → si cambió, se sube y la fila
    // guardada reutiliza la URL de Cloudinary resultante.
    const data: Record<string, unknown> = {
        titulo: perfil?.empresa || "",
        subtitulo: "",
        tema: "default",
        template: "grid-clasico",
        mostrar_precios: true,
        mostrar_stock: true,
        mostrar_categorias: true,
        ocultar_agotados: true,
        ...Object.fromEntries(Object.entries(guardadoCfg).filter(([, v]) => v !== undefined)),
        logo: perfil?.logo || "",
        contacto: {
            telefono: perfil?.telefono || "",
            correo: perfil?.correo || "",
            instagram: perfil?.instagram || "",
            facebook: perfil?.facebook || "",
            tiktok: perfil?.tiktok || "",
            sitio_web: perfil?.sitio_web || "",
            maps: perfil?.maps || "",
        },
        orden_categorias: Object.fromEntries(ordenCategorias.map(c => [c.nombre, c.orden])),
    }

    // Reutilización de logo ya publicado (foto_hash de la config = hash del logo).
    const fotoHash = hashTexto(String(data.logo))
    if (guardada?.foto_hash === fotoHash && guardada.data) {
        data.logo = (guardada.data.logo as string) || ""
    }

    // El hash de la config excluye el logo (va en foto_hash) y campos de control.
    const { logo: _logo, contacto: _c, orden_categorias: _o, ...hashable } = data
    const hash = hashObjeto({ ...hashable, contacto: _c, orden_categorias: _o })

    return {
        clave: "__config__",
        hash,
        foto_hash: fotoHash,
        data,
        orden: -1,
        slug: guardada?.slug,
        publicado_en: guardada?.publicado_en,
    }
}

/** Fila pública de UN producto (variaciones anidadas). Devuelve la fila nueva
 * y la lista de dataURLs que habría que subir (vacía si reutilizó URLs). */
function filaProductoPublica(
    p: Producto,
    guardada: CatalogoPublicadoLocal | undefined,
): { fila: CatalogoPublicadoLocal; fotosPendientes: string[] } {
    const variaciones = (p.variaciones ?? []).map(v => ({
        id: v.id,
        nombre: v.nombre,
        precio: v.precio,
        foto: v.foto || "",
        tamano_cm: v.tamano_cm ?? null,
        stock: v.stock ?? 0,
    }))
    const imagenes = [p.imagen || "", ...(p as unknown as { imagenes_extras?: { url: string }[] }).imagenes_extras?.map(e => e.url) ?? []]

    const data: Record<string, unknown> = {
        producto: p.producto,
        descripcion: p.descripcion || "",
        imagen: p.imagen || "",
        sufijo_precio: p.sufijo_precio || "",
        tamano_cm: p.tamano_cm ?? null,
        tipo_producto: p.tipo_producto || "stock",
        precio_venta: p.precio_venta,
        precio_min: p.precio_min ?? p.precio_venta,
        precio_max: p.precio_max ?? p.precio_venta,
        stock_total: p.stock_total,
        categoria: p.categoria || ["General"],
        imagenes,
        variaciones,
    }

    // Hash del contenido PÚBLICO sin las URLs de foto (foto_hash aparte):
    // precio/stock cambian → sube la fila; solo cambia la foto → sube la foto.
    const sinFotos = {
        ...data,
        imagen: "",
        imagenes: [],
        variaciones: variaciones.map(v => ({ ...v, foto: "" })),
    }
    const hash = hashObjeto(sinFotos)
    const fotoHash = hashTexto(JSON.stringify(urlsDeFotos(data)))

    let fotosPendientes: string[] = []
    if (guardada?.foto_hash === fotoHash && guardada.data) {
        // Fotos intactas: reutiliza las URLs de Cloudinary ya publicadas.
        const g = guardada.data as typeof data
        data.imagen = g.imagen || ""
        data.imagenes = (g.imagenes as string[]) || []
        data.variaciones = (g.variaciones as typeof variaciones) || variaciones.map(v => ({ ...v, foto: "" }))
    } else {
        fotosPendientes = urlsDeFotos(data).filter(u => ES_DATAURL.test(u))
    }

    return {
        fila: {
            clave: p.producto,
            hash,
            foto_hash: fotoHash,
            data,
            orden: 0,
            publicado_en: guardada?.publicado_en,
        },
        fotosPendientes,
    }
}

export interface EstadoPublicacion {
    /** ISO local del último publish; null = nunca publicado */
    publicado_en: string | null
    /** slug del catálogo público (link "Ver catálogo") */
    slug: string | null
    filas: number
}

/** Estado del snapshot local (para la tarjeta de publish). */
export async function getEstadoPublicacion(): Promise<EstadoPublicacion> {
    const d = abrirDB()
    const filas = await d.catalogo_publicado.toArray()
    const config = filas.find(f => f.clave === "__config__")
    return {
        publicado_en: config?.publicado_en ?? null,
        slug: config?.slug ?? null,
        filas: filas.filter(f => f.clave !== "__config__").length,
    }
}

export interface DeltaPendiente {
    /** filas a subir/actualizar (contenido o fotos cambiaron) */
    cambios: number
    /** filas a borrar de la nube (producto eliminado u oculto) */
    borrados: number
}

/** Cuánto delta hay pendiente SIN publicar (solo compara hashes en local). */
export async function calcularDelta(): Promise<DeltaPendiente> {
    const d = abrirDB()
    const [perfil, inventario] = await Promise.all([d.perfil.get(1), getInventario()])

    // Mismo criterio que el catálogo impreso (visibles con categoría visible).
    const catFilas = await d.categorias.toArray()
    const nombresVisibles = new Set(
        catFilas.filter(c => c.visible_en_catalogo !== false).map(c => c.nombre),
    )
    const productos = inventario.filter(
        p => p.visible_en_catalogo !== false &&
             (!p.categoria?.length || p.categoria.some(c => nombresVisibles.has(c))),
    )

    const guardadas = await d.catalogo_publicado.toArray()
    const porClave = new Map(guardadas.map(f => [f.clave, f]))

    let cambios = 0
    for (const p of productos) {
        const { fila } = filaProductoPublica(p, porClave.get(p.producto))
        const g = porClave.get(p.producto)
        if (!g || g.hash !== fila.hash || g.foto_hash !== fila.foto_hash) cambios++
    }
    const filaCfg = await filaConfigPublica(
        perfil ?? undefined,
        catFilas.filter(c => c.visible_en_catalogo !== false)
            .sort((a, b) => ((a.orden ?? 999) - (b.orden ?? 999)) || a.nombre.localeCompare(b.nombre))
            .map(c => ({ nombre: c.nombre, orden: c.orden ?? 999 })),
        porClave.get("__config__"),
    )
    const gCfg = porClave.get("__config__")
    if (!gCfg || gCfg.hash !== filaCfg.hash || gCfg.foto_hash !== filaCfg.foto_hash) cambios++

    // Borrados: filas guardadas cuyo producto ya no está visible.
    const clavesActuales = new Set([filaCfg.clave, ...productos.map(p => p.producto)])
    const borrados = guardadas.filter(f => !clavesActuales.has(f.clave)).length

    return { cambios, borrados }
}

export interface ProgresoPublish {
    fase: "calculando" | "fotos" | "delta" | "listo" | "error"
    fotosTotal: number
    fotosSubidas: number
    mensaje?: string
}

export interface ResultadoPublish {
    slug: string
    aplicadas: number
    fotos: number
}

/**
 * Publica (delta) el catálogo local a la nube: fotos nuevas → Cloudinary,
 * filas nuevas/cambiadas → /catalogo-publicado/delta, borrados → data:null.
 * Al confirmar reescribe el espejo local con las URLs finales: el próximo
 * publish solo sube lo que vuelva a cambiar.
 */
export async function publicarCatalogo(
    onProgreso?: (p: ProgresoPublish) => void,
): Promise<ResultadoPublish> {
    const d = abrirDB()
    const reportar = (p: ProgresoPublish) => onProgreso?.(p)
    try {
        reportar({ fase: "calculando", fotosTotal: 0, fotosSubidas: 0 })

        // ── 1. Construir el estado deseado ──
        const [perfil, inventario] = await Promise.all([d.perfil.get(1), getInventario()])
        const catFilas = await d.categorias.toArray()
        const visibles = catFilas
            .filter(c => c.visible_en_catalogo !== false)
            .sort((a, b) => ((a.orden ?? 999) - (b.orden ?? 999)) || a.nombre.localeCompare(b.nombre))
        const nombresVisibles = new Set(visibles.map(c => c.nombre))
        const productos = inventario
            .filter(
                p => p.visible_en_catalogo !== false &&
                     (!p.categoria?.length || p.categoria.some(c => nombresVisibles.has(c))),
            )
            .sort((a, b) => a.producto.localeCompare(b.producto))

        const guardadas = await d.catalogo_publicado.toArray()
        const porClave = new Map(guardadas.map(f => [f.clave, f]))

        const filaCfg = await filaConfigPublica(
            perfil ?? undefined,
            visibles.map(c => ({ nombre: c.nombre, orden: c.orden ?? 999 })),
            porClave.get("__config__"),
        )

        // ── 2. Delta: filas que cambiaron + borrados ──
        const filasSubir: CatalogoPublicadoLocal[] = []
        const fotosABorrar: { clave: string; hash: string; data: null; orden: number }[] = []

        if (!porClave.get("__config__") || porClave.get("__config__")!.hash !== filaCfg.hash ||
            porClave.get("__config__")!.foto_hash !== filaCfg.foto_hash) {
            filasSubir.push(filaCfg)
        }
        for (const p of productos) {
            const { fila } = filaProductoPublica(p, porClave.get(p.producto))
            const g = porClave.get(p.producto)
            if (!g || g.hash !== fila.hash || g.foto_hash !== fila.foto_hash) {
                filasSubir.push({ ...fila, orden: filasSubir.length + 1 })
            }
        }
        const clavesActuales = new Set([filaCfg.clave, ...productos.map(p => p.producto)])
        for (const g of guardadas) {
            if (!clavesActuales.has(g.clave)) fotosABorrar.push({ clave: g.clave, hash: "", data: null, orden: 0 })
        }

        if (!filasSubir.length && !fotosABorrar.length) {
            const slug = porClave.get("__config__")?.slug || ""
            reportar({ fase: "listo", fotosTotal: 0, fotosSubidas: 0 })
            return { slug, aplicadas: 0, fotos: 0 }
        }

        // ── 3. Fotos nuevas → Cloudinary (solo filas con foto_hash distinto) ──
        // El logo de la config comparte el mismo flujo.
        let fotosTotal = 0
        let fotosSubidas = 0
        for (const fila of filasSubir) {
            const data = fila.data as Record<string, unknown>
            const g = porClave.get(fila.clave)
            if (g?.foto_hash === fila.foto_hash) continue // reutilizó URLs
            const fotos = urlsDeFotos(data)
            const pendientes = fotos.filter(u => ES_DATAURL.test(u))
            fotosTotal += pendientes.length
            for (const dataUrl of pendientes) {
                const blob = await dataUrlABlob(dataUrl)
                const nombreFoto = fila.clave === "__config__" ? "logo" : fila.clave
                const r = await publicarFotoCatalogo(nombreFoto, blob)
                // Reemplaza dataURL por URL de Cloudinary EN todos los campos
                // donde aparezca (imagen, imagenes[], variaciones[].foto).
                const reemplazar = (v: string) => (v === dataUrl ? r.ruta : v)
                data.imagen = reemplazar(String(data.imagen ?? ""))
                data.imagenes = ((data.imagenes as string[]) ?? []).map(reemplazar)
                data.variaciones = ((data.variaciones as Record<string, unknown>[]) ?? []).map(v => ({
                    ...v, foto: reemplazar(String(v.foto ?? "")),
                }))
                fotosSubidas++
                reportar({ fase: "fotos", fotosTotal, fotosSubidas })
            }
        }

        // ── 4. Delta de filas → backend (licencia, no sesión Supabase) ──
        reportar({ fase: "delta", fotosTotal, fotosSubidas })
        const respuesta = await publicarDeltaCatalogo([
            ...filasSubir.map(f => ({
                clave: f.clave,
                hash: f.hash,
                data: f.data,
                orden: f.orden,
            })),
            ...fotosABorrar,
        ])
        if (!respuesta.ok) throw new Error("El backend rechazó el delta del catálogo.")

        // ── 5. Reescribe el espejo local (URLs finales + marca de tiempo) ──
        const ahora = ahoraISO()
        await d.transaction("rw", d.catalogo_publicado, async () => {
            for (const f of fotosABorrar) {
                await d.catalogo_publicado.delete(f.clave)
            }
            for (const f of filasSubir) {
                const previa = porClave.get(f.clave)
                await d.catalogo_publicado.put({
                    clave: f.clave,
                    hash: f.hash,
                    foto_hash: f.foto_hash,
                    data: f.data,
                    orden: f.clave === "__config__" ? -1 : 0,
                    slug: respuesta.slug || previa?.slug,
                    publicado_en: ahora,
                })
            }
        })

        reportar({ fase: "listo", fotosTotal, fotosSubidas })
        return {
            slug: respuesta.slug || porClave.get("__config__")?.slug || "",
            aplicadas: respuesta.aplicadas,
            fotos: fotosSubidas,
        }
    } catch (e) {
        reportar({ fase: "error", fotosTotal: 0, fotosSubidas: 0, mensaje: e instanceof Error ? e.message : String(e) })
        throw e
    }
}
