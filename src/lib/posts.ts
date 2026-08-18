// ==============================================================================
// src/lib/posts.ts
// Helpers compartidos de "Posts Automáticos" (tarjetas de producto) entre el
// modal "Crear post" (ModalCrearPost.tsx) y la vista de lote
// (/inventario/posts). La ruta de render edge /posts/[producto] es una función
// pura de los query params — aquí se construye esa URL.
// ==============================================================================

import type { PostConfig, PostOverride, Producto } from "@/lib/api"

/**
 * Geometría de recorte de la foto (fracciones de la imagen natural, 0-1).
 * En zoom out pueden salir de rango (fx/fy negativos, fw/fh > 1) con el área
 * vacía rellena del color de `fondo`. El render re-encuadra la foto con esto,
 * sin subir ningún recorte.
 */
export interface CropFoto {
    fx: number
    fy: number
    fw: number
    fh: number
    fondo: "blanco" | "negro"
}

/** Configuración efectiva de una tarjeta (override del producto || defaults del negocio). */
export interface ConfigResuelta {
    template: string
    font: string
    posicion: string
    mostrar: { nombre: boolean; precio: boolean; negocio: boolean }
    // Colores de texto: '' = automático por plantilla. primario = NOMBRE +
    // NEGOCIO (mismo color); secundario = PRECIO (default azul).
    colorPrimario: string
    colorSecundario: string
}

/**
 * Resuelve la configuración efectiva de la tarjeta: override del producto si
 * existe, con las claves ausentes heredadas de los defaults del negocio.
 */
export function resolverConfig(override: PostOverride | null | undefined, defaults: PostConfig | null): ConfigResuelta {
    const d = defaults
    return {
        template: override?.template || d?.template_default || "marco",
        font: override?.font || d?.font || "moderna",
        posicion: override?.posicion || d?.posicion || "abajo",
        mostrar: {
            nombre: override?.mostrar?.nombre ?? d?.mostrar?.nombre ?? true,
            precio: override?.mostrar?.precio ?? d?.mostrar?.precio ?? true,
            negocio: override?.mostrar?.negocio ?? d?.mostrar?.negocio ?? true,
        },
        colorPrimario: override?.color_primario || d?.color_primario || "",
        colorSecundario: override?.color_secundario || d?.color_secundario || "",
    }
}

/** "$35" para enteros, "$35.50" para decimales (mismo estándar toFixed(2) de la app). */
export function formatearPrecio(valor: number): string {
    if (!isFinite(valor) || valor <= 0) return ""
    if (Number.isInteger(valor)) return `$${valor}`
    return `$${valor.toFixed(2)}`
}

/**
 * Genera los hashtags sugeridos a partir del nombre y las categorías del
 * producto: palabras significativas (sin stopwords ni acentos), capitalizadas,
 * máx. 6. Ej: "Planta de interior" → #Planta #Interior.
 */
export function generarHashtags(nombre: string, categorias: string[]): string {
    const stopwords = new Set(["de", "la", "el", "del", "los", "las", "con", "para", "por", "y", "a", "un", "una", "al", "en", "su", "mi", "tu", "que"])
    const limpiar = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const palabras = new Set<string>()
    ;[
        ...limpiar(nombre).split(/[^a-z0-9]+/),
        ...(categorias || []).flatMap(c => limpiar(c).split(/[^a-z0-9]+/)),
    ]
        .filter(p => p.length > 2 && !stopwords.has(p))
        .forEach(p => palabras.add(p))
    return [...palabras].slice(0, 6).map(p => `#${p.charAt(0).toUpperCase()}${p.slice(1)}`).join(" ")
}

/**
 * Descripción lista para publicar: nombre + precio + negocio + hashtags.
 * Se genera al abrir el modal y es editable.
 */
export function generarDescripcion(producto: Producto, negocio: string): string {
    const precio = formatearPrecio(producto.precio_venta ?? 0)
    const lineas = [
        producto.producto || "",
        precio ? `${precio}${producto.sufijo_precio ? ` · ${producto.sufijo_precio}` : ""}` : "",
        negocio ? negocio : "",
    ].filter(Boolean)
    const hashtags = generarHashtags(producto.producto, producto.categoria)
    return [...lineas, "", hashtags].join("\n")
}

/** Nombre de archivo seguro para la descarga (conserva acentos y ñ). */
export function nombreArchivo(producto: string, formato: string): string {
    const base = producto
        .replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]+/g, "-")
        .replace(/^-+|-+$/g, "") || "producto"
    return `${base}-${formato}.png`
}

/**
 * Construye la URL del render edge /posts/{producto} — la tarjeta es una
 * función pura de estos params, así que cada URL distinta es una tarjeta
 * distinta (cacheable).
 */
export function construirUrlPreview(opts: {
    origin: string
    producto: string
    cfg: ConfigResuelta
    formato: string
    precio: number
    sufijo?: string
    foto?: string
    negocio?: string
    logo?: string
    sello?: string
    /** Overlay: false apaga el velo degradado (panel detrás del texto). Del momento, no se guarda. */
    velo?: boolean
    /** Recorte de la foto (del momento, no se guarda): fracciones de la imagen. */
    fotoCrop?: CropFoto
}): string {
    const params = new URLSearchParams()
    params.set("template", opts.cfg.template)
    params.set("font", opts.cfg.font)
    params.set("posicion", opts.cfg.posicion)
    params.set("mostrar", JSON.stringify(opts.cfg.mostrar))
    params.set("formato", opts.formato)
    params.set("precio", String(opts.precio ?? 0))
    if (opts.sufijo) params.set("sufijo", opts.sufijo)
    if (opts.foto) params.set("foto", opts.foto)
    if (opts.negocio) params.set("negocio", opts.negocio)
    if (opts.logo) params.set("logo", opts.logo)
    if (opts.sello) params.set("sello", opts.sello)
    if (opts.velo === false) params.set("velo", "0")
    if (opts.fotoCrop) {
        params.set("foto_x", String(opts.fotoCrop.fx))
        params.set("foto_y", String(opts.fotoCrop.fy))
        params.set("foto_w", String(opts.fotoCrop.fw))
        params.set("foto_h", String(opts.fotoCrop.fh))
        params.set("foto_fondo", opts.fotoCrop.fondo)
    }
    if (opts.cfg.colorPrimario) params.set("color_primario", opts.cfg.colorPrimario)
    if (opts.cfg.colorSecundario) params.set("color_secundario", opts.cfg.colorSecundario)
    return `${opts.origin}/posts/${encodeURIComponent(opts.producto)}?${params.toString()}`
}

/** Descarga una URL (fetch → blob → <a download>) — para el reposteo en lote. */
export async function descargarUrl(url: string, filename: string): Promise<void> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Error al descargar ${filename}`)
    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
}
