// ==============================================================================
// src/app/posts/[producto]/route.tsx
// Endpoint de render de las tarjetas de producto (Posts Automáticos — Fase 1).
//
// Mismo motor que src/app/catalogo/[slug]/opengraph-image.tsx: Satori a través
// de next/og, runtime edge. La tarjeta es una FUNCIÓN PURA de los query params:
// el frontend construye la URL con los datos del producto + la config resuelta
// (defaults del negocio u override del producto) y aquí solo se dibuja.
//
// GET /posts/{producto}?template=marco&color=default&font=moderna&formato=post
//     &mostrar={...}&precio=35&sufijo=c%2Fu&foto=...&negocio=...&logo=...
//
// Plantilla Fase 1: "Marco" (polaroid) — la foto va INSET dentro de un marco
// blanco con sombra; el nombre, el precio y el negocio viven en el marco,
// NUNCA sobre la foto. Formatos: post 4:5 (1080×1350), historia 9:16
// (1080×1920), cuadrado 1:1 (1200×1200). Fuentes: moderna (Inter),
// elegante (Playfair Display), redondeada (Nunito).
// ==============================================================================

import { ImageResponse } from "next/og"

export const runtime = "edge"

// ── Formatos: dimensiones exactas de cada tarjeta ──
// (El alto de la foto se deriva del resto del marco: el canvas menos el
// bloque de texto — ver altoFoto abajo.)
const FORMATOS: Record<string, { width: number; height: number }> = {
    post: { width: 1080, height: 1350 },      // 4:5
    historia: { width: 1080, height: 1920 },  // 9:16
    cuadrado: { width: 1200, height: 1200 },  // 1:1
}

// ── Paletas de color (mismas claves que TEMAS en opengraph-image.tsx, + blanco) ──
// `from`/`to` = gradiente de fondo del canvas; `acento` = color del precio.
const PALETAS: Record<string, { from: string; to: string; acento: string }> = {
    default: { from: "#3a7dbf", to: "#5e87a4", acento: "#2c5f8f" },
    midnightBlack: { from: "#1f2321", to: "#1e6456", acento: "#14b8a6" },
    strawberry: { from: "#f33376", to: "#fa30df", acento: "#d12e6a" },
    cozyYellow: { from: "#ffd05b", to: "#eb7456", acento: "#d97706" },
    white: { from: "#f2f2ef", to: "#e4e2dc", acento: "#3a3a36" },
}

// ── Fuentes: familia CSS → archivos TTF empaquetados junto a la ruta ──
// Satori necesita los TTF; `new URL(..., import.meta.url)` los empaqueta con la
// ruta (patrón oficial de next/og en edge) y se cachean en memoria del worker.
const FAMILIAS: Record<string, { css: string; archivos: { archivo: string; peso: number }[] }> = {
    moderna: {
        css: "Inter",
        archivos: [
            { archivo: "Inter-400.ttf", peso: 400 },
            { archivo: "Inter-700.ttf", peso: 700 },
            { archivo: "Inter-800.ttf", peso: 800 },
        ],
    },
    elegante: {
        css: "Playfair Display",
        archivos: [
            { archivo: "Playfair-400.ttf", peso: 400 },
            { archivo: "Playfair-700.ttf", peso: 700 },
        ],
    },
    redondeada: {
        css: "Nunito",
        archivos: [
            { archivo: "Nunito-400.ttf", peso: 400 },
            { archivo: "Nunito-700.ttf", peso: 700 },
            { archivo: "Nunito-800.ttf", peso: 800 },
        ],
    },
}

// Rutas LITERALES a los TTF: webpack las reconoce como assets (una ruta
// dinámica tipo `../fonts/${x}` NO se procesa y rompe el bundle edge).
const RUTAS_FUENTES: Record<string, URL> = {
    "Inter-400.ttf": new URL("../fonts/Inter-400.ttf", import.meta.url),
    "Inter-700.ttf": new URL("../fonts/Inter-700.ttf", import.meta.url),
    "Inter-800.ttf": new URL("../fonts/Inter-800.ttf", import.meta.url),
    "Playfair-400.ttf": new URL("../fonts/Playfair-400.ttf", import.meta.url),
    "Playfair-700.ttf": new URL("../fonts/Playfair-700.ttf", import.meta.url),
    "Nunito-400.ttf": new URL("../fonts/Nunito-400.ttf", import.meta.url),
    "Nunito-700.ttf": new URL("../fonts/Nunito-700.ttf", import.meta.url),
    "Nunito-800.ttf": new URL("../fonts/Nunito-800.ttf", import.meta.url),
}

// Cache en memoria del worker edge: la ruta se llama con debounce (cada cambio
// de control genera una URL distinta), así que no re-leemos los TTF por request.
const _cacheFuentes = new Map<string, ArrayBuffer>()

/** Decodifica un data URL base64 sin fetch (los assets pequeños pueden quedar inline). */
function _decodificarDataUrl(href: string): ArrayBuffer {
    const base64 = href.slice(href.indexOf(",") + 1)
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes.buffer as ArrayBuffer
}

async function cargarFuente(archivo: string): Promise<ArrayBuffer> {
    if (!_cacheFuentes.has(archivo)) {
        const url = RUTAS_FUENTES[archivo]
        const href = url.toString()
        const data: ArrayBuffer = href.startsWith("data:")
            ? _decodificarDataUrl(href)
            : await (await fetch(url)).arrayBuffer()
        _cacheFuentes.set(archivo, data)
    }
    return _cacheFuentes.get(archivo)!
}

/**
 * Prepara la foto para Satori: solo decodifica WebP/AVIF no (las fotos de
 * producto pueden estar en WebP), pero JPEG/PNG sí. Así que:
 *   - jpg/jpeg/png      → solo redimensionar (w_ + q_auto), sin convertir.
 *   - webp/avif/f_auto  → forzar PNG al vuelo (f_png o cambiar extensión).
 * Solo aplica a URLs de Cloudinary (mismo patrón que logoComoPng en
 * opengraph-image.tsx).
 */
function fotoComoPng(url: string, ancho: number): string {
    try {
        const u = new URL(url)
        if (!u.hostname.includes("res.cloudinary.com")) return url
        const marker = "/image/upload/"
        const idx = u.pathname.indexOf(marker)
        if (idx === -1) return url
        const despues = u.pathname.slice(idx + marker.length)
        const primerSeg = despues.split("/")[0]
        const tieneTransform = /f_auto|q_auto|\bw_\d|\bc_|\be_/i.test(primerSeg)
        const ext = (u.pathname.match(/\.(jpe?g|png|webp|avif)$/i) || [])[0]?.toLowerCase()
        const hayFauto = /f_auto/i.test(u.pathname)

        if (tieneTransform) {
            // No duplicar cadenas: solo quitar f_auto y forzar PNG si la foto
            // PODRÍA ser webp (extensión webp/avif o f_auto presente).
            u.pathname = u.pathname.replace(/f_auto,?|,f_auto/g, "")
            if (hayFauto || ext === ".webp" || ext === ".avif") {
                u.pathname = u.pathname.replace(/\.(jpe?g|webp|avif)$/i, ".png")
            }
            return u.toString()
        }

        if (ext === ".webp" || ext === ".avif" || hayFauto || !ext) {
            // Posible webp (o desconocida): entregar como PNG
            u.pathname = `${u.pathname.slice(0, idx + marker.length)}w_${ancho},q_auto,f_png/${despues}`
        } else {
            // jpg/png: solo redimensionar (Satori sí decodifica estos)
            u.pathname = `${u.pathname.slice(0, idx + marker.length)}w_${ancho},q_auto/${despues}`
        }
        return u.toString()
    } catch {
        return url
    }
}

/**
 * Recorta el nombre a 2 líneas como MÁXIMO: el bloque de texto del marco está
 * dimensionado para eso; un nombre más largo desbordaría la tarjeta.
 * (a 64px, ~23 caracteres por línea en el ancho del marco → 44 chars ≈ 2 líneas)
 */
function acortarNombre(nombre: string, max = 44): string {
    const limpio = (nombre || "").trim()
    if (limpio.length <= max) return limpio
    return `${limpio.slice(0, max).trimEnd()}…`
}

/** "$35" para enteros, "$35.50" para el resto (sin ceros sobrantes). */
function formatearPrecio(valor: number): string {
    if (!isFinite(valor) || valor <= 0) return ""
    if (Number.isInteger(valor)) return `$${valor}`
    return `$${valor.toFixed(2).replace(/0$/, "")}`
}

export async function GET(request: Request, { params }: { params: { producto: string } }) {
    const url = new URL(request.url)
    const q = url.searchParams

    // ── Params (con defaults seguros) ──
    const template = q.get("template") || "marco"
    const color = q.get("color") || "default"
    const font = q.get("font") || "moderna"
    const formato = q.get("formato") || "post"
    let mostrar: { nombre?: boolean; precio?: boolean; negocio?: boolean } = { nombre: true, precio: true, negocio: true }
    try {
        const m = JSON.parse(q.get("mostrar") || "{}")
        if (m && typeof m === "object") mostrar = { ...mostrar, ...m }
    } catch {
        // mostrar inválido → defaults
    }

    const nombre = acortarNombre(q.get("nombre") || decodeURIComponent(params.producto) || "")
    const precio = Number(q.get("precio") || 0)
    const sufijo = (q.get("sufijo") || "").trim()
    const foto = q.get("foto") || ""
    const negocio = (q.get("negocio") || "").trim()
    const logo = q.get("logo") || ""

    // Fase 1: solo la plantilla Marco está implementada. Overlay/Tarjeta (Fase 2)
    // caen al Marco para no entregar una tarjeta rota.
    const dims = FORMATOS[formato] ?? FORMATOS.post
    const paleta = PALETAS[color] ?? PALETAS.default
    const familia = FAMILIAS[font] ?? FAMILIAS.moderna

    // ── Cargar las fuentes de la familia elegida ──
    const fonts = await Promise.all(
        familia.archivos.map(async a => ({
            name: familia.css,
            data: await cargarFuente(a.archivo),
            weight: a.peso as 400 | 700 | 800,
            style: "normal" as const,
        }))
    )

    const { width: W, height: H } = dims

    // ── Escala: tamaños de texto proporcionales al canvas ──
    const escala = W / 1080
    const fontNombre = Math.round(64 * escala)      // ~64px en 1080
    const fontPrecio = Math.round(56 * escala)
    const fontNegocio = Math.round(32 * escala)
    const paddingTarjeta = Math.round(W * 0.045)     // margen interno del marco
    const anchoTarjeta = Math.round(W * 0.82)

    // La foto ocupa el espacio restante del marco tras el bloque de texto
    const altoTexto = Math.round(
        fontNombre * 1.25 * 2 +          // nombre (hasta 2 líneas)
        fontPrecio * 1.2 +
        fontNegocio * 1.3 +
        16 * escala +                     // gap entre bloques
        8 * escala
    )
    const altoTarjeta = Math.round(H * 0.84)
    const altoFoto = Math.max(200, altoTarjeta - paddingTarjeta * 2 - altoTexto - Math.round(24 * escala))

    const tieneFoto = foto && foto !== "No hay foto"
    const precioTexto = formatearPrecio(precio)
    const precioFinal = sufijo ? `${precioTexto} · ${sufijo}` : precioTexto

    // La tarjeta es una función pura de los query params (precio/foto incluidos
    // en la URL): cada URL única es inmutable → cacheable (el doc pide cachear
    // los renders con los mismos params para el debounce del preview).
    const headers = {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
    }

    const imagen = new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(150deg, ${paleta.from} 0%, ${paleta.to} 100%)`,
                    fontFamily: familia.css,
                    padding: Math.round(W * 0.06),
                }}
            >
                {/* ── Marco polaroid ── */}
                <div
                    style={{
                        width: anchoTarjeta,
                        height: altoTarjeta,
                        display: "flex",
                        flexDirection: "column",
                        background: "#ffffff",
                        borderRadius: Math.round(34 * escala),
                        padding: paddingTarjeta,
                        boxShadow: `0 ${Math.round(36 * escala)}px ${Math.round(80 * escala)}px rgba(0,0,0,0.35)`,
                    }}
                >
                    {/* Foto inset (nunca se le superpone texto) */}
                    <div
                        style={{
                            width: "100%",
                            height: altoFoto,
                            borderRadius: Math.round(18 * escala),
                            overflow: "hidden",
                            background: "#f1f3f5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {tieneFoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={fotoComoPng(foto, 1000)}
                                width="100%"
                                height="100%"
                                style={{ objectFit: "cover" }}
                                alt=""
                            />
                        ) : (
                            /* Placeholder elegante: panel gris con un "lente" */
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: Math.round(14 * escala),
                                }}
                            >
                                <div
                                    style={{
                                        width: Math.round(120 * escala),
                                        height: Math.round(120 * escala),
                                        borderRadius: 999,
                                        border: `${Math.round(10 * escala)}px solid #d7dade`,
                                        background: "#e7eaee",
                                    }}
                                />
                                <div
                                    style={{
                                        fontSize: Math.round(22 * escala),
                                        fontWeight: 700,
                                        color: "#9aa1a9",
                                        letterSpacing: 1,
                                    }}
                                >
                                    SIN FOTO
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Texto en el marco (debajo de la foto) ── */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            flex: 1,
                            padding: `${Math.round(24 * escala)}px ${Math.round(6 * escala)}px 0`,
                        }}
                    >
                        {mostrar.nombre !== false && nombre && (
                            <div
                                style={{
                                    fontSize: fontNombre,
                                    fontWeight: 800,
                                    color: "#1f2937",
                                    lineHeight: 1.15,
                                    letterSpacing: -0.5,
                                }}
                            >
                                {nombre}
                            </div>
                        )}
                        {mostrar.precio !== false && precioTexto && (
                            <div
                                style={{
                                    fontSize: fontPrecio,
                                    fontWeight: 800,
                                    color: paleta.acento,
                                    marginTop: Math.round(6 * escala),
                                    letterSpacing: -0.5,
                                }}
                            >
                                {precioFinal}
                            </div>
                        )}
                        {mostrar.negocio !== false && negocio && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: Math.round(10 * escala),
                                    marginTop: Math.round(14 * escala),
                                }}
                            >
                                {logo && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={fotoComoPng(logo, 120)}
                                        width={Math.round(44 * escala)}
                                        height={Math.round(44 * escala)}
                                        style={{ borderRadius: 999, objectFit: "cover" }}
                                        alt=""
                                    />
                                )}
                                <div
                                    style={{
                                        fontSize: fontNegocio,
                                        fontWeight: 700,
                                        color: "#6b7280",
                                        letterSpacing: 0.2,
                                    }}
                                >
                                    {negocio}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        ),
        {
            width: W,
            height: H,
            fonts,
        }
    )

    return new Response(imagen.body, { status: 200, headers })
}
