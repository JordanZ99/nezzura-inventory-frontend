// ==============================================================================
// src/app/posts/[producto]/route.tsx
// Endpoint de render de las tarjetas de producto (Posts Automáticos).
//
// Mismo motor que src/app/catalogo/[slug]/opengraph-image.tsx: Satori a través
// de next/og, runtime edge. La tarjeta es una FUNCIÓN PURA de los query params:
// el frontend construye la URL con los datos del producto + la config resuelta
// (defaults del negocio u override del producto) y aquí solo se dibuja.
//
// GET /posts/{producto}?template=marco&color=default&font=moderna&formato=post
//     &posicion=abajo&mostrar={...}&precio=35&sufijo=c%2Fu&foto=...&negocio=...&logo=...
//
// Plantillas (Fase 1 + Fase 2):
//   - "marco"    (polaroid): la foto va INSET dentro de un marco blanco con
//                sombra; el texto vive en el marco, NUNCA sobre la foto.
//   - "overlay"  (sobre la foto): el texto va sobre la foto con posición
//                configurable (arriba/abajo) y un velo oscuro degradado detrás
//                para legibilidad garantizada.
//   - "tarjeta"  (full-bleed): foto arriba a sangre y bloque de texto debajo
//                sobre el color de acento del negocio.
// Formatos: post 4:5 (1080×1350), historia 9:16 (1080×1920), cuadrado 1:1
// (1200×1200). Fuentes: moderna (Inter), elegante (Playfair Display),
// redondeada (Nunito).
// ==============================================================================

import { ImageResponse } from "next/og"

export const runtime = "edge"

// ── Formatos: dimensiones exactas de cada tarjeta ──
const FORMATOS: Record<string, { width: number; height: number }> = {
    post: { width: 1080, height: 1350 },      // 4:5
    historia: { width: 1080, height: 1920 },  // 9:16
    cuadrado: { width: 1200, height: 1200 },  // 1:1
}

// ── Paletas de color (mismas claves que TEMAS en opengraph-image.tsx, + blanco) ──
// `from`/`to` = gradiente de fondo del canvas; `acento` = color del precio en
// Marco; `sobreOscuro` = color del precio sobre el velo oscuro del Overlay
// (los `acento` son oscuros y se perderían sobre negro); `texto` = color del
// texto sobre el gradiente en Tarjeta (blanco salvo en fondos claros).
interface Paleta { from: string; to: string; acento: string; sobreOscuro: string; texto: string }

const PALETAS: Record<string, Paleta> = {
    default:       { from: "#3a7dbf", to: "#5e87a4", acento: "#2c5f8f", sobreOscuro: "#5ea0e0", texto: "#ffffff" },
    midnightBlack: { from: "#1f2321", to: "#1e6456", acento: "#14b8a6", sobreOscuro: "#14b8a6", texto: "#ffffff" },
    strawberry:    { from: "#f33376", to: "#fa30df", acento: "#d12e6a", sobreOscuro: "#ff5c9d", texto: "#ffffff" },
    cozyYellow:    { from: "#ffd05b", to: "#eb7456", acento: "#d97706", sobreOscuro: "#ffd05b", texto: "#241f12" },
    white:         { from: "#f2f2ef", to: "#e4e2dc", acento: "#3a3a36", sobreOscuro: "#ffffff", texto: "#1f2937" },
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
 * Prepara la foto para Satori: no decodifica WebP/AVIF (las fotos de producto
 * pueden estar en WebP), pero JPEG/PNG sí. Así que:
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
 * Recorta el nombre según la plantilla: el marco está dimensionado para 2
 * líneas como MÁXIMO (44 chars); Overlay/Tarjeta tienen más espacio y toleran
 * 3 líneas (66 chars). Un nombre más largo desbordaría la tarjeta.
 */
function acortarNombre(nombre: string, max = 44): string {
    const limpio = (nombre || "").trim()
    if (limpio.length <= max) return limpio
    return `${limpio.slice(0, max).trimEnd()}…`
}

/** "$35" para enteros, "$35.50" para decimales (mismo estándar toFixed(2) de la app). */
function formatearPrecio(valor: number): string {
    if (!isFinite(valor) || valor <= 0) return ""
    if (Number.isInteger(valor)) return `$${valor}`
    return `$${valor.toFixed(2)}`
}

/**
 * Decide el color del texto sobre un fondo dado (luminancia simple):
 * blanco sobre fondos oscuros, casi-negro sobre fondos claros. Se usa en el
 * pill del precio de la Tarjeta cuando el usuario elige un color secundario.
 */
function contrasteTexto(hex: string): string {
    const h = hex.replace("#", "")
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum > 0.55 ? "#1a1d21" : "#ffffff"
}

// ── Contexto resuelto por request (todo lo que las plantillas necesitan) ──
interface CtxTarjeta {
    W: number
    H: number
    escala: number
    paleta: Paleta
    familiaCss: string
    fontNombre: number
    fontPrecio: number
    fontNegocio: number
    nombre: string
    precioTexto: string
    precioFinal: string
    tieneFoto: boolean
    foto: string
    negocio: string
    logo: string
    mostrar: { nombre?: boolean; precio?: boolean; negocio?: boolean }
    posicion: string
    sello: string        // '' | 'oferta' | 'agotado' | 'nuevo' (Fase 4: sticker en la esquina)
    ctaTexto: string     // texto del botón CTA (Fase 4, §9.4); '' = sin CTA
    colorPrimario: string    // hex o '' = automático por plantilla (NOMBRE + NEGOCIO)
    colorSecundario: string  // hex o '' = automático por plantilla (PRECIO)
}

/** Placeholder elegante "SIN FOTO": panel gris con un "lente" (nunca imagen rota). */
function Placeholder({ escala }: { escala: number }) {
    return (
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
    )
}

/**
 * Sello/sticker de la esquina (Fase 4): OFERTA / AGOTADO / NUEVO.
 * Se dibuja sobre la foto (consistente en las 3 plantillas).
 */
function Sello({ sello, escala }: { sello: string; escala: number }) {
    const estilos: Record<string, { bg: string; label: string }> = {
        oferta: { bg: "#e11d48", label: "OFERTA" },
        agotado: { bg: "#1f2937", label: "AGOTADO" },
        nuevo: { bg: "#059669", label: "NUEVO" },
    }
    const s = estilos[sello]
    if (!s) return null
    return (
        <div
            style={{
                position: "absolute",
                top: Math.round(18 * escala),
                left: Math.round(18 * escala),
                background: s.bg,
                color: "#ffffff",
                fontSize: Math.round(28 * escala),
                fontWeight: 800,
                letterSpacing: 1.5,
                padding: `${Math.round(9 * escala)}px ${Math.round(20 * escala)}px`,
                borderRadius: Math.round(14 * escala),
                boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            }}
        >
            {s.label}
        </div>
    )
}

/** Botón CTA (Fase 4, §9.4): pill con el texto del negocio; '' = no se dibuja. */
function BotonCta({ ctx, fondo, color }: { ctx: CtxTarjeta; fondo: string; color: string }) {
    const { escala, ctaTexto } = ctx
    if (!ctaTexto) return null
    return (
        <div
            style={{
                alignSelf: "flex-start",
                marginTop: Math.round(16 * escala),
                background: fondo,
                color,
                fontSize: Math.round(32 * escala),
                fontWeight: 800,
                letterSpacing: 0.2,
                padding: `${Math.round(12 * escala)}px ${Math.round(26 * escala)}px`,
                borderRadius: Math.round(18 * escala),
                boxShadow: "0 3px 10px rgba(0,0,0,0.18)",
            }}
        >
            {ctaTexto}
        </div>
    )
}

/** Bloque de negocio (logo circular + nombre) — común a las 3 plantillas. */
function BloqueNegocio({ ctx, color }: { ctx: CtxTarjeta; color: string }) {
    const { escala, fontNegocio, negocio, logo } = ctx
    if (!negocio) return null
    return (
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
                    color,
                    letterSpacing: 0.2,
                }}
            >
                {negocio}
            </div>
        </div>
    )
}

// ==============================================================================
// Plantilla "Marco" (polaroid) — Fase 1
// Foto INSET dentro de un marco blanco con sombra; texto en el marco, nunca
// sobre la foto. La foto ocupa el espacio restante del marco tras el texto.
// ==============================================================================
function PlantillaMarco({ ctx }: { ctx: CtxTarjeta }) {
    const { W, H, escala, paleta, familiaCss, fontNombre, fontPrecio, fontNegocio, nombre, precioFinal, precioTexto, tieneFoto, foto, mostrar } = ctx
    const paddingTarjeta = Math.round(W * 0.045)     // margen interno del marco
    const anchoTarjeta = Math.round(W * 0.82)
    const hayCta = Boolean(ctx.ctaTexto)

    const altoTexto = Math.round(
        fontNombre * 1.25 * 2 +          // nombre (hasta 2 líneas)
        fontPrecio * 1.2 +
        fontNegocio * 1.3 +
        16 * escala +                     // gap entre bloques
        8 * escala +
        (hayCta ? 84 * escala : 0)        // botón CTA (Fase 4): alto + margen
    )
    const altoTarjeta = Math.round(H * 0.84)
    const altoFoto = Math.max(200, altoTarjeta - paddingTarjeta * 2 - altoTexto - Math.round(24 * escala))

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `linear-gradient(150deg, ${paleta.from} 0%, ${paleta.to} 100%)`,
                fontFamily: familiaCss,
                padding: Math.round(W * 0.06),
            }}
        >
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
                        position: "relative",
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
                        <Placeholder escala={escala} />
                    )}
                    <Sello sello={ctx.sello} escala={escala} />
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
                                color: ctx.colorPrimario || "#1f2937",
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
                                color: ctx.colorSecundario || paleta.acento,
                                marginTop: Math.round(6 * escala),
                                letterSpacing: -0.5,
                            }}
                        >
                            {precioFinal}
                        </div>
                    )}
                    {mostrar.negocio !== false && (
                        <BloqueNegocio ctx={ctx} color={ctx.colorPrimario || "#6b7280"} />
                    )}
                    <BotonCta ctx={ctx} fondo={paleta.acento} color="#ffffff" />
                </div>
            </div>
        </div>
    )
}

// ==============================================================================
// Plantilla "Overlay" (texto sobre la foto) — Fase 2
// La foto ocupa TODO el canvas; el texto va sobre ella con posición
// configurable (arriba/abajo) y un velo oscuro degradado detrás para que
// siempre se lea. Sin foto → fondo de paleta con el placeholder.
// ==============================================================================
function PlantillaOverlay({ ctx }: { ctx: CtxTarjeta }) {
    const { W, H, escala, paleta, familiaCss, fontNombre, fontPrecio, fontNegocio, nombre, precioFinal, precioTexto, tieneFoto, foto, mostrar, posicion } = ctx
    const arriba = posicion === "arriba"
    const pad = Math.round(W * 0.07)

    // Con foto el texto va sobre el velo oscuro (blanco); sin foto, sobre el
    // gradiente de la paleta (usa los colores de contraste de la paleta).
    // color_primario (si el usuario lo eligió) aplica a NOMBRE + NEGOCIO a la
    // vez; color_secundario al PRECIO.
    const colorNombre = ctx.colorPrimario || (tieneFoto ? "#ffffff" : paleta.texto)
    const colorPrecio = ctx.colorSecundario || (tieneFoto ? paleta.sobreOscuro : paleta.acento)
    const colorNegocio = ctx.colorPrimario || (tieneFoto ? "#e5e7eb" : paleta.texto)

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: arriba ? "flex-start" : "flex-end",
                background: `linear-gradient(150deg, ${paleta.from} 0%, ${paleta.to} 100%)`,
                fontFamily: familiaCss,
            }}
        >
            {/* Foto a sangre (o placeholder centrado si no hay) */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    // Sin foto, transparente: se ve el gradiente de la paleta
                    // (el texto sin foto usa los colores de contraste de la paleta).
                    background: tieneFoto ? "#14171c" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {tieneFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={fotoComoPng(foto, W)}
                        width="100%"
                        height="100%"
                        style={{ objectFit: "cover" }}
                        alt=""
                    />
                ) : (
                    <Placeholder escala={escala} />
                )}
            </div>

            {/* Velo oscuro degradado: se apoya en el lado donde va el texto */}
            {tieneFoto && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        background: arriba
                            ? "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0) 58%)"
                            : "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0) 58%)",
                    }}
                />
            )}

            {/* Sello (OFERTA / AGOTADO / NUEVO) sobre la foto */}
            <Sello sello={ctx.sello} escala={escala} />

            {/* Texto sobre la foto */}
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    padding: pad,
                }}
            >
                {mostrar.nombre !== false && nombre && (
                    <div
                        style={{
                            fontSize: fontNombre,
                            fontWeight: 800,
                            color: colorNombre,
                            lineHeight: 1.12,
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
                            color: colorPrecio,
                            marginTop: Math.round(10 * escala),
                            letterSpacing: -0.5,
                        }}
                    >
                        {precioFinal}
                    </div>
                )}
                {mostrar.negocio !== false && (
                    <BloqueNegocio ctx={ctx} color={colorNegocio} />
                )}
                {/* CTA: blanco con texto oscuro (máximo contraste sobre el velo) */}
                <BotonCta ctx={ctx} fondo="#ffffff" color="#1a1d21" />
            </div>
        </div>
    )
}

// ==============================================================================
// Plantilla "Tarjeta" (full-bleed) — Fase 2
// Foto arriba a sangre completa (~55% del alto) y bloque de texto debajo sobre
// el gradiente de la paleta del negocio. El precio va en un "pill" de alto
// contraste (look de catálogo). Es el opengraph-image.tsx con datos reales.
// ==============================================================================
function PlantillaTarjeta({ ctx }: { ctx: CtxTarjeta }) {
    const { W, H, escala, paleta, familiaCss, fontNombre, fontPrecio, fontNegocio, nombre, precioFinal, precioTexto, tieneFoto, foto, mostrar } = ctx
    const pad = Math.round(W * 0.07)
    const altoFoto = Math.round(H * 0.55)
    const colorTexto = ctx.colorPrimario || paleta.texto

    // Pill del precio: invierte el contraste según el fondo (oscuro sobre
    // claro y viceversa) para que siempre destaque sobre el gradiente.
    // Si el usuario eligió color_secundario, el pill usa ESE color (con texto
    // en contraste automático); el CTA conserva el pill por defecto de la paleta.
    const fondoClaro = paleta.texto === "#ffffff"
    const pillBgDefault = fondoClaro ? "rgba(255,255,255,0.94)" : "rgba(18,18,16,0.9)"
    const pillColorDefault = fondoClaro ? "#1a1d21" : "#ffffff"
    const pillBg = ctx.colorSecundario || pillBgDefault
    const pillColor = ctx.colorSecundario ? contrasteTexto(ctx.colorSecundario) : pillColorDefault

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: `linear-gradient(150deg, ${paleta.from} 0%, ${paleta.to} 100%)`,
                fontFamily: familiaCss,
            }}
        >
            {/* Foto a sangre arriba */}
            <div
                style={{
                    width: "100%",
                    height: altoFoto,
                    flexShrink: 0,
                    overflow: "hidden",
                    background: "#14171c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                }}
            >
                {tieneFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={fotoComoPng(foto, W)}
                        width="100%"
                        height="100%"
                        style={{ objectFit: "cover" }}
                        alt=""
                    />
                ) : (
                    <Placeholder escala={escala} />
                )}
                <Sello sello={ctx.sello} escala={escala} />
            </div>

            {/* Bloque de texto debajo, sobre el color de acento */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: pad,
                }}
            >
                {mostrar.nombre !== false && nombre && (
                    <div
                        style={{
                            fontSize: fontNombre,
                            fontWeight: 800,
                            color: colorTexto,
                            lineHeight: 1.12,
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
                            color: pillColor,
                            background: pillBg,
                            padding: `${Math.round(10 * escala)}px ${Math.round(22 * escala)}px`,
                            borderRadius: Math.round(18 * escala),
                            alignSelf: "flex-start",
                            marginTop: Math.round(12 * escala),
                            letterSpacing: -0.5,
                        }}
                    >
                        {precioFinal}
                    </div>
                )}
                {mostrar.negocio !== false && (
                    <BloqueNegocio ctx={ctx} color={colorTexto} />
                )}
                {/* CTA con el mismo contraste invertido que el pill del precio */}
                <BotonCta ctx={ctx} fondo={pillBgDefault} color={pillColorDefault} />
            </div>
        </div>
    )
}

export async function GET(request: Request, { params }: { params: { producto: string } }) {
    const url = new URL(request.url)
    const q = url.searchParams

    // ── Params (con defaults seguros) ──
    const template = q.get("template") || "marco"
    const color = q.get("color") || "default"
    const font = q.get("font") || "moderna"
    const formato = q.get("formato") || "post"
    const posicion = q.get("posicion") || "abajo"
    let mostrar: { nombre?: boolean; precio?: boolean; negocio?: boolean } = { nombre: true, precio: true, negocio: true }
    try {
        const m = JSON.parse(q.get("mostrar") || "{}")
        if (m && typeof m === "object") mostrar = { ...mostrar, ...m }
    } catch {
        // mostrar inválido → defaults
    }

    // El marco está dimensionado para 2 líneas; Overlay/Tarjeta toleran 3.
    const nombre = acortarNombre(
        q.get("nombre") || decodeURIComponent(params.producto) || "",
        template === "marco" ? 44 : 66
    )
    const precio = Number(q.get("precio") || 0)
    const sufijo = (q.get("sufijo") || "").trim()
    const foto = q.get("foto") || ""
    const negocio = (q.get("negocio") || "").trim()
    const logo = q.get("logo") || ""
    // Fase 4: sello ('' | oferta | agotado | nuevo) + CTA configurable (§9.4)
    const sello = q.get("sello") || ""
    const ctaTexto = (q.get("cta_texto") || "").trim()
    // Colores de texto personalizables ('' o hex inválido = automático por plantilla)
    const esHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s)
    const colorPrimario = esHex(q.get("color_primario") || "") ? q.get("color_primario")! : ""
    const colorSecundario = esHex(q.get("color_secundario") || "") ? q.get("color_secundario")! : ""

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

    const tieneFoto = Boolean(foto && foto !== "No hay foto")
    const precioTexto = formatearPrecio(precio)
    const precioFinal = sufijo ? `${precioTexto} · ${sufijo}` : precioTexto

    const ctx: CtxTarjeta = {
        W, H, escala, paleta, familiaCss: familia.css,
        fontNombre, fontPrecio, fontNegocio,
        nombre, precioTexto, precioFinal, tieneFoto, foto,
        negocio, logo, mostrar, posicion, sello, ctaTexto,
        colorPrimario, colorSecundario,
    }

    // Plantilla desconocida → Marco (nunca una tarjeta rota)
    const contenido =
        template === "overlay" ? <PlantillaOverlay ctx={ctx} /> :
        template === "tarjeta" ? <PlantillaTarjeta ctx={ctx} /> :
        <PlantillaMarco ctx={ctx} />

    // La tarjeta es una función pura de los query params (precio/foto incluidos
    // en la URL): cada URL única es inmutable → cacheable (el doc pide cachear
    // los renders con los mismos params para el debounce del preview).
    const headers = {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
    }

    const imagen = new ImageResponse(contenido, {
        width: W,
        height: H,
        fonts,
    })

    return new Response(imagen.body, { status: 200, headers })
}
