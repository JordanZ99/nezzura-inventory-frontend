// ==============================================================================
// src/app/posts/[producto]/route.tsx
// Endpoint de render de las tarjetas de producto (Posts Automáticos).
//
// Mismo motor que src/app/catalogo/[slug]/opengraph-image.tsx: Satori a través
// de next/og, runtime edge. La tarjeta es una FUNCIÓN PURA de los query params:
// el frontend construye la URL con los datos del producto + la config resuelta
// (defaults del negocio u override del producto) y aquí solo se dibuja.
//
// GET /posts/{producto}?template=marco&font=moderna&formato=post
//     &posicion=abajo&mostrar={...}&precio=35&sufijo=c%2Fu&foto=...&negocio=...&logo=...
//     &color_primario=...&color_secundario=...&velo=0
//     &foto_x=...&foto_y=...&foto_w=...&foto_h=...&foto_fondo=blanco  (recorte del momento)
//
// Plantillas:
//   - "marco"   (polaroid): la foto va INSET dentro de un marco blanco que
//               ocupa TODO el canvas (full-bleed, esquinas cuadradas — así la
//               imagen queda lista para Instagram/redes). El texto vive en el
//               marco, NUNCA sobre la foto. Sin foto → el área de la foto usa
//               el color secundario (default azul) como fondo.
//   - "overlay" (sobre la foto): la foto a sangre con velo oscuro degradado
//               (posición configurable arriba/abajo). Sin foto → el color
//               secundario (default azul) es el fondo de toda la tarjeta.
//
// Sin paletas de acento: el color del texto lo decide color_primario (nombre +
// negocio) y color_secundario (precio). '' o hex inválido → automático:
//   - primario: Marco casi negro, Overlay blanco (sobre el velo/fondo).
//   - secundario: AZUL por defecto (#2c5f8f); sin foto el fondo es el secundario
//     y el precio usa contraste automático sobre él.
//
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

// ── Colores por defecto (sin paletas) ──
const AZUL_DEFAULT = "#2c5f8f"          // color secundario por defecto (precio + fondo sin foto)
const NEGRO_MARCO = "#1f2937"           // primario por defecto en Marco (casi negro, como siempre)
const GRIS_NEGOCIO = "#6b7280"          // negocio por defecto en Marco (gris)
const BLANCO_OVERLAY = "#ffffff"        // primario por defecto en Overlay (sobre el velo)
const GRIS_NEGOCIO_OVERLAY = "#e5e7eb"  // negocio por defecto en Overlay

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
 * líneas como MÁXIMO (44 chars); Overlay tiene más espacio y tolera 3 líneas
 * (66 chars). Un nombre más largo desbordaría la tarjeta.
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
 * precio cuando el fondo sin foto ES el color secundario.
 */
function contrasteTexto(hex: string): string {
    const h = hex.replace("#", "")
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum > 0.55 ? "#1a1d21" : "#ffffff"
}

/**
 * Estilos del recorte de la foto (del momento): la imagen se dibuja a mayor
 * tamaño dentro del contenedor y se desplaza para que el rectángulo visible
 * coincida con el recorte elegido (Satori no soporta object-position, así que
 * se usa una imagen absoluta sobredimensionada + overflow hidden).
 *
 * fw/fh = fracción visible de la imagen (0-1); fx/fy = esquina del rect en
 * fracciones de la imagen. En zoom out (fw/fh > 1) el área vacía se rellena
 * con el color de `fondo`.
 */
function estilosFotoConCrop(ctx: CtxTarjeta) {
    if (ctx.fotoFw > 0 && ctx.fotoFh > 0) {
        return {
            img: {
                position: "absolute" as const,
                width: `${(1 / ctx.fotoFw) * 100}%`,
                height: `${(1 / ctx.fotoFh) * 100}%`,
                left: `${-(ctx.fotoFx / ctx.fotoFw) * 100}%`,
                top: `${-(ctx.fotoFy / ctx.fotoFh) * 100}%`,
                display: "block",
            },
            bg: ctx.fotoFondo === "negro" ? "#000000" : "#ffffff",
        }
    }
    return { img: {} as const, bg: "" }
}

// ── Contexto resuelto por request (todo lo que las plantillas necesitan) ──
interface CtxTarjeta {
    W: number
    H: number
    escala: number
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
    colorPrimario: string    // hex o '' = automático por plantilla (NOMBRE + NEGOCIO)
    colorSecundario: string  // hex o '' = azul por defecto (PRECIO + fondo sin foto)
    velo: boolean        // Overlay: true = velo degradado sobre la foto (default); false = sin velo (texto directo sobre la foto)
    // Recorte del momento (fracciones de la imagen natural; 0 = sin recorte)
    fotoFx: number
    fotoFy: number
    fotoFw: number
    fotoFh: number
    fotoFondo: string    // 'blanco' | 'negro' — relleno del área vacía en zoom out
}

/**
 * Placeholder elegante "SIN FOTO": se adapta al fondo (lente + texto en el
 * color de contraste del fondo). Sin foto, el fondo es el color secundario.
 */
function Placeholder({ escala, fondo }: { escala: number; fondo: string }) {
    const fg = contrasteTexto(fondo)
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
                    border: `${Math.round(10 * escala)}px solid ${fg}`,
                    opacity: 0.55,
                    background: "transparent",
                }}
            />
            <div
                style={{
                    fontSize: Math.round(22 * escala),
                    fontWeight: 700,
                    color: fg,
                    opacity: 0.85,
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
 * Se dibuja sobre la foto (consistente en las 2 plantillas).
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

/** Bloque de negocio (logo circular + nombre) — común a las 2 plantillas. */
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
// Plantilla "Marco" (polaroid full-bleed)
// El marco blanco ocupa TODO el canvas (esquinas cuadradas: listo para
// Instagram/redes). La foto va INSET dentro del marco y el texto vive en el
// marco, nunca sobre la foto. Sin foto → el área de la foto usa el color
// secundario (default azul) como fondo.
// ==============================================================================
function PlantillaMarco({ ctx }: { ctx: CtxTarjeta }) {
    const { W, H, escala, familiaCss, fontNombre, fontPrecio, fontNegocio, nombre, precioFinal, precioTexto, tieneFoto, foto, mostrar } = ctx
    const paddingTarjeta = Math.round(W * 0.05)     // margen interno (look polaroid)
    const colorPrimario = ctx.colorPrimario || NEGRO_MARCO
    const colorSecundario = ctx.colorSecundario || AZUL_DEFAULT
    const colorNegocio = ctx.colorPrimario || GRIS_NEGOCIO
    const fondoFoto = ctx.colorSecundario || AZUL_DEFAULT   // sin foto → el secundario es el fondo
    const cropEstilos = estilosFotoConCrop(ctx)
    const tieneCropFoto = ctx.fotoFw > 0 && ctx.fotoFh > 0

    const altoTexto = Math.round(
        fontNombre * 1.25 * 2 +          // nombre (hasta 2 líneas)
        fontPrecio * 1.2 +
        fontNegocio * 1.3 +
        16 * escala +                     // gap entre bloques
        8 * escala
    )
    // Foto polaroid REAL: la imagen es CUADRADA (1:1), centrada en el marco
    // con margen blanco alrededor (como una polaroid de verdad).
    const anchoDisponible = W - paddingTarjeta * 2
    const altoDisponible = Math.max(200, H - paddingTarjeta * 2 - altoTexto - Math.round(24 * escala))
    const ladoFoto = Math.min(anchoDisponible, altoDisponible)

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                fontFamily: familiaCss,
                padding: paddingTarjeta,
            }}
        >
            {/* Foto cuadrada centrada (nunca se le superpone texto); sin foto → fondo secundario */}
            <div
                style={{
                    width: ladoFoto,
                    height: ladoFoto,
                    alignSelf: "center",
                    borderRadius: Math.round(18 * escala),
                    overflow: "hidden",
                    background: tieneFoto ? (cropEstilos.bg || "#f1f3f5") : fondoFoto,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                }}
            >
                {tieneFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={fotoComoPng(foto, tieneCropFoto ? Math.round(1000 / ctx.fotoFw) : 1000)}
                        width="100%"
                        height="100%"
                        style={{ objectFit: "cover", ...cropEstilos.img }}
                        alt=""
                    />
                ) : (
                    <Placeholder escala={escala} fondo={fondoFoto} />
                )}
                <Sello sello={ctx.sello} escala={escala} />
            </div>

            {/* ── Texto en el marco (debajo de la foto) ── */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    flex: 1,
                    padding: `${Math.round(24 * escala)}px ${Math.round(6 * escala)}px 0`,
                }}
            >
                {mostrar.nombre !== false && nombre && (
                    <div
                        style={{
                            fontSize: fontNombre,
                            fontWeight: 800,
                            color: colorPrimario,
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
                            color: colorSecundario,
                            marginTop: Math.round(6 * escala),
                            letterSpacing: -0.5,
                        }}
                    >
                        {precioFinal}
                    </div>
                )}
                {mostrar.negocio !== false && (
                    <BloqueNegocio ctx={ctx} color={colorNegocio} />
                )}
            </div>
        </div>
    )
}

// ==============================================================================
// Plantilla "Overlay" (texto sobre la foto)
// La foto ocupa TODO el canvas; el texto va sobre ella con posición
// configurable (arriba/abajo) y un velo oscuro degradado detrás para que
// siempre se lea. Sin foto → el color secundario (default azul) es el fondo
// de toda la tarjeta y el precio usa contraste automático sobre él.
// ==============================================================================
function PlantillaOverlay({ ctx }: { ctx: CtxTarjeta }) {
    const { W, H, escala, familiaCss, fontNombre, fontPrecio, fontNegocio, nombre, precioFinal, precioTexto, tieneFoto, foto, mostrar, posicion } = ctx
    const arriba = posicion === "arriba"
    const pad = Math.round(W * 0.07)
    const cropEstilos = estilosFotoConCrop(ctx)
    const tieneCropFoto = ctx.fotoFw > 0 && ctx.fotoFh > 0
    const colorSecundario = ctx.colorSecundario || AZUL_DEFAULT
    const colorNombre = ctx.colorPrimario || BLANCO_OVERLAY
    const colorNegocio = ctx.colorPrimario || GRIS_NEGOCIO_OVERLAY
    // Precio: el secundario elegido. Sin foto el fondo ES el secundario → el
    // precio usa contraste automático para no perderse sobre su propio color.
    const colorPrecio = tieneFoto ? colorSecundario : contrasteTexto(colorSecundario)

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: arriba ? "flex-start" : "flex-end",
                background: tieneFoto ? "#14171c" : colorSecundario,
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
                    background: tieneFoto ? (cropEstilos.bg || "#14171c") : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {tieneFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={fotoComoPng(foto, tieneCropFoto ? Math.round(W / ctx.fotoFw) : W)}
                        width="100%"
                        height="100%"
                        style={{ objectFit: "cover", ...cropEstilos.img }}
                        alt=""
                    />
                ) : (
                    <Placeholder escala={escala} fondo={colorSecundario} />
                )}
            </div>

            {/* Velo oscuro degradado: se apoya en el lado donde va el texto */}
            {tieneFoto && ctx.velo && (
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
            </div>
        </div>
    )
}

export async function GET(request: Request, { params }: { params: { producto: string } }) {
    const url = new URL(request.url)
    const q = url.searchParams

    // ── Params (con defaults seguros) ──
    const template = q.get("template") || "marco"
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

    // El marco está dimensionado para 2 líneas; Overlay tolera 3.
    const nombre = acortarNombre(
        q.get("nombre") || decodeURIComponent(params.producto) || "",
        template === "marco" ? 44 : 66
    )
    const precio = Number(q.get("precio") || 0)
    const sufijo = (q.get("sufijo") || "").trim()
    const foto = q.get("foto") || ""
    const negocio = (q.get("negocio") || "").trim()
    const logo = q.get("logo") || ""
    // Fase 4: sello ('' | oferta | agotado | nuevo)
    const sello = q.get("sello") || ""
    // Velo del Overlay (del momento): velo=0 lo apaga (el texto va sin fondo sobre la foto)
    const velo = q.get("velo") !== "0"
    // Recorte de la foto (del momento): fracciones 0-1 de la imagen natural
    const num = (s: string | null, def: number) => { const v = Number(s); return Number.isFinite(v) ? v : def }
    const fotoFx = num(q.get("foto_x"), 0)
    const fotoFy = num(q.get("foto_y"), 0)
    const fotoFw = num(q.get("foto_w"), 0)
    const fotoFh = num(q.get("foto_h"), 0)
    const fotoFondo = q.get("foto_fondo") === "negro" ? "negro" : "blanco"
    // Colores de texto personalizables ('' o hex inválido = automático por plantilla)
    const esHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s)
    const colorPrimario = esHex(q.get("color_primario") || "") ? q.get("color_primario")! : ""
    const colorSecundario = esHex(q.get("color_secundario") || "") ? q.get("color_secundario")! : ""

    const dims = FORMATOS[formato] ?? FORMATOS.post
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
        W, H, escala, familiaCss: familia.css,
        fontNombre, fontPrecio, fontNegocio,
        nombre, precioTexto, precioFinal, tieneFoto, foto,
        negocio, logo, mostrar, posicion, sello,
        colorPrimario, colorSecundario, velo,
        fotoFx, fotoFy, fotoFw, fotoFh, fotoFondo,
    }

    // Plantilla desconocida (incl. la vieja "tarjeta") → Marco (nunca rota)
    const contenido =
        template === "overlay" ? <PlantillaOverlay ctx={ctx} /> :
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
