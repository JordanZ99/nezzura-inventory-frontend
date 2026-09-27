"use client"
// ==============================================================================
// src/components/CatalogoModalProducto.tsx
// Modal de detalle de producto estilo "post de Instagram".
// - Header con logo + nombre del negocio + botón cerrar
// - Carrusel de fotos (principal + extras) con flechas, swipe táctil y dots
// - Contador "1 / N" sobre la foto
// - Precio, categorías, stock y descripción completa
// Respeta las opciones del catálogo: mostrar_precios, mostrar_stock, mostrar_categorias.
// ==============================================================================

import { useEffect, useRef, useState } from "react"
import Icon from "@/components/ui/Icon"
import { optimizarImagenCloudinary } from "@/lib/image-utils"

// Familias tipográficas del diseño SF (solo para el modo Menú Carta)
const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = "ui-monospace, 'Cascadia Mono', 'Courier New', monospace"

interface ProductoPublico {
    producto: string
    descripcion: string
    imagen: string
    precio_venta: number
    stock_total: number
    categoria: string[]
    imagenes?: string[]
    // Sufijo del precio en el catálogo ("c/u", "por kilo", "por litro", ...); vacío = sin sufijo
    sufijo_precio?: string
    // 'stock' | 'servicio' — los servicios no tienen inventario (no se agotan)
    tipo_producto?: string
    // Variaciones: presentaciones con su PROPIO precio (ej. Sencilla/Doble, S/M/L)
    // foto?: URL propia de la variación — encabeza la galería al seleccionarla
    variaciones?: { id: number; nombre: string; precio: number; foto?: string; stock?: number }[]
}

interface ConfigCatalogo {
    tema: string
    template: string
    titulo: string
    subtitulo: string
    mostrar_precios: boolean
    mostrar_stock: boolean
    mostrar_categorias: boolean
    permitir_descarga?: boolean
    relacion_imagen?: string  // '1:1' (default) | '4:5' — relación global de las fotos
    logo: string
}

interface PaletaTema {
    bg: string
    bgCard: string
    text: string
    textMuted: string
    primary: string
    primaryDark: string
    border: string
    gradient: string
}

interface Props {
    producto: ProductoPublico
    config: ConfigCatalogo
    tema: PaletaTema
    onClose: () => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

function resolverImagen(url: string): string {
    if (!url) return ""
    return url.startsWith("http") ? url : `${API_URL}/${url}`
}

/**
 * Descarga una imagen como archivo (fetch → blob → a[download]).
 * Fallback: abre la imagen en otra pestaña si el fetch falla.
 */
async function descargarImagen(url: string, nombre: string) {
    try {
        const res = await fetch(url)
        if (!res.ok) throw new Error("HTTP " + res.status)
        const blob = await res.blob()
        // Extensión según el tipo del blob (o la URL como fallback)
        let ext = ""
        if (blob.type === "image/png") ext = ".png"
        else if (blob.type === "image/webp") ext = ".webp"
        else if (blob.type === "image/jpeg") ext = ".jpg"
        else {
            try {
                const m = new URL(url).pathname.match(/\.([a-zA-Z0-9]+)$/)
                if (m) ext = "." + m[1].toLowerCase()
            } catch { /* URL inválida */ }
        }
        if (!ext) ext = ".jpg"
        const objUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = objUrl
        a.download = `${nombre}${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(objUrl), 3000)
    } catch {
        // Fallback: abrir la imagen para guardarla manualmente
        window.open(url, "_blank")
    }
}

export default function CatalogoModalProducto({ producto, config, tema, onClose }: Props) {
    const variaciones = producto.variaciones || []
    // Si el producto tiene variaciones, las agotadas no se pueden elegir (se
    // muestran deshabilitadas con su badge "Agotado").
    const stockPorVar = variaciones.length > 0
    // Estilo AliExpress: NINGUNA variación seleccionada por defecto. Se ven las
    // fotos base primero; al elegir una variación, el precio cambia y el
    // carrusel salta a la foto de esa variación (si tiene).
    const [variacionSel, setVariacionSel] = useState("")
    const variacionActual = variaciones.find(v => v.nombre === variacionSel) || null
    // Precio sin selección: "desde $X" (mínimo) si hay precios distintos;
    // si todas cuestan lo mismo, se muestra el precio sin prefijo.
    // Con stock por variación, el mínimo considera solo las disponibles
    // (misma semántica que minPrecioDisponible del grid).
    const preciosMin = (stockPorVar ? variaciones.filter(v => (v.stock ?? 0) > 0) : variaciones).map(v => v.precio)
    const hayPreciosDistintos = new Set(preciosMin).size > 1
    const precioMinimo = preciosMin.length > 0 ? Math.min(...preciosMin) : producto.precio_venta
    const precioMostrado = variacionActual ? variacionActual.precio : precioMinimo
    const sufijoMostrado = variacionActual ? "" : producto.sufijo_precio

    // Galería estilo AliExpress: fotos BASE primero (portada + extras), después
    // las fotos de TODAS las variaciones (deduplicadas, sin "No hay foto").
    const galeria = (() => {
        const lista: string[] = []
        const agregar = (u: string) => {
            if (!u || u === "No hay foto") return
            const resuelta = resolverImagen(u)
            if (resuelta && !lista.includes(resuelta)) lista.push(resuelta)
        }
        agregar(producto.imagen)
        ;(producto.imagenes || []).forEach(agregar)
        variaciones.forEach(v => agregar(v.foto ?? ""))
        return lista
    })()

    const [indice, setIndice] = useState(0)
    const touchX = useRef<number | null>(null)
    // Controla el swap: primero se ve la w_600 (ya en caché desde el grid) y
    // cuando la w_1200 termina de cargar, la reemplaza al instante (sin fundido).
    const [imagenLista, setImagenLista] = useState(false)

    // Al cambiar de variación, saltar a la foto de esa variación (estilo
    // AliExpress). Si la variación no tiene foto, el carrusel se queda donde está.
    useEffect(() => {
        const v = variaciones.find(x => x.nombre === variacionSel)
        if (!v?.foto) return
        const idx = galeria.indexOf(resolverImagen(v.foto))
        if (idx >= 0) setIndice(idx)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variacionSel])

    // Bloquear el scroll de la página (body + html) mientras el modal está abierto
    // y cerrar con la tecla Escape
    useEffect(() => {
        const prevBody = document.body.style.overflow
        const prevHtml = document.documentElement.style.overflow
        document.body.style.overflow = "hidden"
        document.documentElement.style.overflow = "hidden"
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => {
            document.body.style.overflow = prevBody
            document.documentElement.style.overflow = prevHtml
            window.removeEventListener("keydown", onKey)
        }
    }, [onClose])

    const anterior = () => setIndice(i => Math.max(0, i - 1))
    const siguiente = () => setIndice(i => Math.min(galeria.length - 1, i + 1))

    const indiceSeguro = galeria.length > 0 ? Math.min(indice, galeria.length - 1) : 0
    const fotoActual = galeria.length > 0 ? galeria[indiceSeguro] : ""
    // Versión optimizada SOLO para mostrar (ahorra bandwidth): la descarga
    // sigue usando fotoActual (URL original en máxima calidad).
    const fotoActualOptimizada = optimizarImagenCloudinary(fotoActual, 1200)
    // Primer stage: la misma w_600 del grid (ya en caché del navegador → instantáneo)
    const fotoRapida = optimizarImagenCloudinary(fotoActual, 600)

    // Al cambiar de foto (producto o swipe), volver al estado "cargando"
    // para que el swap se repita con cada imagen nueva.
    useEffect(() => {
        setImagenLista(false)
    }, [fotoActualOptimizada])    // Servicios y compuestos no tienen inventario propio: nunca se "agotan"
    const esSinStock = producto.tipo_producto !== undefined && producto.tipo_producto !== "stock"
    const agotado = !esSinStock && producto.stock_total <= 0
    // Nombre base para los archivos descargados + descarga de todas las fotos
    const nombreBase = (producto.producto || "foto").replace(/[^a-zA-Z0-9áéíóúñÑ\s-]/g, "").trim() || "foto"
    const descargarTodas = () => {
        galeria.forEach((url, i) => {
            setTimeout(() => descargarImagen(url, i === 0 ? nombreBase : `${nombreBase} (${i + 1})`), i * 400)
        })
    }

    const estiloFlecha: React.CSSProperties = {
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        width: 34, height: 34,
        borderRadius: "50%",
        border: "none",
        background: "rgba(0,0,0,0.45)",
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s",
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODO MENÚ CARTA — port del DishModal de Santa Fé:
    // foto grande a la izquierda (55%, badge de categoría abajo), info a la
    // derecha (desc, dashed, precio serif grande, variaciones, tags, footer).
    // ══════════════════════════════════════════════════════════════════════
    if (config.template === "menu-carta") {
        return (
            <div
                style={{
                    position: "fixed", inset: 0, zIndex: 10000,
                    display: "flex", alignItems: "flex-start", justifyContent: "center",
                    background: "rgba(0,0,0,0.8)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                    padding: 12, overflowX: "hidden",
                }}
                onClick={onClose}
            >
                <style>{`@keyframes cataPop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } } .cata-modal-carrusel::-webkit-scrollbar { display: none; }`}</style>

                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: tema.bg,
                        borderRadius: 16,
                        border: `1px solid ${tema.border}`,
                        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
                        maxWidth: 960,
                        width: "100%",
                        margin: "auto",
                        maxHeight: "88vh",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        animation: "cataPop 0.22s ease-out",
                    }}
                >
                    <div className="sfmc-form-split">
                    <style>{`.sfmc-form-split { display: flex; flex-direction: column; } @media (min-width: 640px) { .sfmc-form-split { flex-direction: row; max-height: 85vh; } .sfmc-form-info { width: 45%; } }`}</style>

                    {/* IZQUIERDA: foto protagonista (con swipe para cambiar de foto) */}
                    <div
                        className="sfmc-modal-foto"
                        style={{
                            position: "relative",
                            overflow: "hidden",
                            background: tema.bgCard,
                            flexShrink: 0,
                            touchAction: "pan-y",
                        }}
                        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
                        onTouchEnd={e => {
                            if (touchX.current === null) return
                            const dx = e.changedTouches[0].clientX - touchX.current
                            touchX.current = null
                            if (Math.abs(dx) > 40) (dx < 0 ? siguiente() : anterior())
                        }}
                    >
                        {fotoActual ? (
                            <div style={{ position: "absolute", inset: 0 }}>
                                <img
                                    src={fotoRapida}
                                    alt=""
                                    aria-hidden
                                    style={{
                                        position: "absolute", inset: 0,
                                        width: "100%", height: "100%",
                                        objectFit: "cover",
                                        display: imagenLista ? "none" : "block",
                                    }}
                                />
                                <img
                                    src={fotoActualOptimizada}
                                    alt={producto.producto}
                                    onLoad={() => setImagenLista(true)}
                                    style={{
                                        position: "absolute", inset: 0,
                                        width: "100%", height: "100%",
                                        objectFit: "cover",
                                        display: imagenLista ? "block" : "none",
                                    }}
                                />
                            </div>
                        ) : (
                            <div style={{
                                width: "100%", height: "100%",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: 0.2,
                            }}>
                                <Icon name="Utensils" size={56} color={tema.textMuted} />
                            </div>
                        )}
                        {/* Gradiente inferior (port SF) */}
                        <div style={{
                            position: "absolute", inset: 0, pointerEvents: "none",
                            background: `linear-gradient(to top, ${tema.bg}33, transparent)`,
                        }} />

                        {/* Cerrar (sobre la foto, como SF) */}
                        <button
                            onClick={onClose}
                            aria-label="Cerrar"
                            style={{
                                position: "absolute", top: 8, right: 8, zIndex: 10,
                                width: 34, height: 34, borderRadius: "50%",
                                border: "none", background: "rgba(0,0,0,0.6)",
                                color: "rgba(255,255,255,0.85)", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.8)" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.6)" }}
                        >
                            <Icon name="X" size={18} />
                        </button>

                        {/* Descargar foto (si el tenant lo permite) */}
                        {config.permitir_descarga && fotoActual && (
                            <button
                                onClick={e => { e.stopPropagation(); descargarImagen(fotoActual, nombreBase) }}
                                aria-label="Descargar foto"
                                title="Descargar foto"
                                style={{
                                    position: "absolute", top: 8, left: 8, zIndex: 10,
                                    width: 34, height: 34, borderRadius: "50%",
                                    border: "none", background: "rgba(0,0,0,0.45)",
                                    color: "#fff", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.45)" }}
                            >
                                <Icon name="Download" size={16} />
                            </button>
                        )}

                        {/* Flechas del carrusel (solo si hay más de una foto) */}
                        {galeria.length > 1 && indiceSeguro > 0 && (
                            <button
                                onClick={e => { e.stopPropagation(); anterior() }}
                                aria-label="Foto anterior"
                                style={{ ...estiloFlecha, left: 10 }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.45)" }}
                            >
                                <Icon name="ChevronLeft" size={18} />
                            </button>
                        )}
                        {galeria.length > 1 && indiceSeguro < galeria.length - 1 && (
                            <button
                                onClick={e => { e.stopPropagation(); siguiente() }}
                                aria-label="Foto siguiente"
                                style={{ ...estiloFlecha, right: 10 }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.45)" }}
                            >
                                <Icon name="ChevronRight" size={18} />
                            </button>
                        )}

                        {/* Badge de sección (bottom-left, port SF) */}
                        <span style={{
                            position: "absolute", bottom: 12, left: 12,
                            background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.7)",
                            backdropFilter: "blur(4px)",
                            fontSize: "0.62rem", fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: 1,
                            padding: "4px 12px", borderRadius: 999,
                        }}>
                            {(producto.categoria && producto.categoria[0]) || config.titulo || "Catálogo"}
                        </span>

                        {/* Contador de fotos */}
                        {galeria.length > 1 && (
                            <span style={{
                                position: "absolute", top: 12, left: 54,
                                background: "rgba(0,0,0,0.5)", color: "#fff",
                                fontSize: "0.66rem", fontWeight: 700,
                                padding: "3px 10px", borderRadius: 12,
                            }}>
                                {indiceSeguro + 1} / {galeria.length}
                            </span>
                        )}
                    </div>

                    {/* DERECHA: info */}
                    <div
                        className="sfmc-form-info"
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            background: tema.bg,
                        }}
                    >
                        {/* Header: icono + nombre */}
                        <div style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "16px 20px",
                            borderBottom: `1px solid ${tema.border}`,
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: "50%",
                                background: `color-mix(in srgb, ${tema.primary} 10%, transparent)`,
                                color: tema.primary,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                            }}>
                                <Icon name="UtensilsCrossed" size={16} color={tema.primary} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{
                                    margin: 0, fontSize: "0.9rem", fontWeight: 700,
                                    letterSpacing: 0.3, color: tema.text,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                    {producto.producto}
                                </p>
                                {sufijoMostrado && (
                                    <p style={{ margin: 0, fontSize: "0.72rem", color: tema.textMuted }}>
                                        Por {sufijoMostrado}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Contenido deslizable */}
                        <div className="cata-modal-carrusel" style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                            {/* Variaciones (selector, igual que en el modo IG): primero el
                                selector para que el precio de abajo refleje la elección */}
                            {variaciones.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                                    {variaciones.map(v => {
                                        const activa = v.nombre === variacionSel
                                        const agotada = stockPorVar && (v.stock ?? 0) <= 0
                                        return (
                                            <button
                                                key={v.id}
                                                disabled={agotada}
                                                onClick={() => setVariacionSel(v.nombre)}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 8,
                                                    padding: "7px 14px",
                                                    borderRadius: 999,
                                                    border: `1.5px solid ${activa ? tema.primary : tema.border}`,
                                                    background: activa ? `color-mix(in srgb, ${tema.primary} 10%, transparent)` : tema.bgCard,
                                                    color: agotada ? tema.textMuted : tema.text,
                                                    fontWeight: 700,
                                                    fontSize: "0.78rem",
                                                    cursor: agotada ? "not-allowed" : "pointer",
                                                    opacity: agotada ? 0.55 : 1,
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                {v.nombre}
                                                {stockPorVar && !agotada && (
                                                    <span style={{ fontSize: "0.66rem", fontWeight: 600, opacity: 0.75 }}>{v.stock} uds</span>
                                                )}
                                                {agotada
                                                    ? <span style={{ color: "#ef4444", fontWeight: 800, fontSize: "0.7rem" }}>Agotado</span>
                                                    : (config.mostrar_precios && <span style={{ color: tema.primaryDark, fontWeight: 800 }}>${v.precio.toFixed(2)}</span>)}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {producto.descripcion && (
                                <p style={{
                                    margin: 0, fontSize: "0.9rem",
                                    lineHeight: 1.7, fontWeight: 500,
                                    whiteSpace: "pre-wrap",
                                    color: `color-mix(in srgb, ${tema.text} 70%, transparent)`,
                                }}>
                                    {producto.descripcion}
                                </p>
                            )}

                            {/* Divisor dashed (port SF) */}
                            <div style={{ margin: "16px 0", borderTop: `1px dashed color-mix(in srgb, ${tema.text} 22%, transparent)` }} />

                            {/* Precio grande (port SF) */}
                            {config.mostrar_precios && (
                                <div>
                                    <p style={{
                                        margin: 0,
                                        fontFamily: MONO,
                                        fontSize: "0.56rem",
                                        letterSpacing: "0.25em",
                                        textTransform: "uppercase",
                                        color: `color-mix(in srgb, ${tema.text} 35%, transparent)`,
                                    }}>
                                        Precio
                                    </p>
                                    <p style={{
                                        margin: "4px 0 0",
                                        fontFamily: SERIF,
                                        fontSize: "1.9rem",
                                        fontWeight: 600,
                                        lineHeight: 1,
                                        fontVariantNumeric: "tabular-nums",
                                        color: tema.primaryDark,
                                    }}>
                                        {variaciones.length > 0 && !variacionActual && hayPreciosDistintos && (
                                            <span style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.65, marginRight: 4 }}>desde </span>
                                        )}
                                        ${precioMostrado.toFixed(2)}
                                    </p>
                                </div>
                            )}

                            {/* Tags (port SF): categorías + nombre del negocio */}
                            {config.mostrar_categorias && (producto.categoria || []).length > 0 && (
                                <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {(producto.categoria || ["Otros"]).map(c => (
                                        <span key={c} style={{
                                            borderRadius: 999,
                                            border: `1px solid ${tema.border}`,
                                            background: `color-mix(in srgb, ${tema.text} 4%, transparent)`,
                                            color: `color-mix(in srgb, ${tema.text} 50%, transparent)`,
                                            padding: "4px 12px", fontSize: "0.68rem", fontWeight: 600,
                                        }}>{c}</span>
                                    ))}
                                    <span style={{
                                        borderRadius: 999,
                                        border: `1px solid color-mix(in srgb, ${tema.primary} 20%, transparent)`,
                                        background: `color-mix(in srgb, ${tema.primary} 4%, transparent)`,
                                        color: `color-mix(in srgb, ${tema.primary} 70%, transparent)`,
                                        padding: "4px 12px", fontSize: "0.68rem", fontWeight: 600,
                                    }}>{config.titulo || "Catálogo"}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer: stock */}
                        <div style={{
                            borderTop: `1px solid ${tema.border}`,
                            padding: "14px 20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                        }}>
                            {config.mostrar_stock && !esSinStock ? (
                                <span style={{
                                    fontSize: "0.72rem", fontWeight: 700,
                                    color: agotado ? "#ef4444" : tema.textMuted,
                                    background: agotado ? "rgba(239,68,68,0.12)" : tema.bgCard,
                                    padding: "5px 14px", borderRadius: 999,
                                }}>
                                    {agotado ? "Agotado" : `${producto.stock_total} en stock`}
                                </span>
                            ) : <span />}
                            {/* Descargar todas las fotos (si el tenant lo permite) */}
                            {config.permitir_descarga && galeria.length > 1 && (
                                <button
                                    onClick={descargarTodas}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 6,
                                        padding: "7px 14px", borderRadius: 999,
                                        border: `1px solid ${tema.border}`,
                                        background: tema.bgCard, color: tema.textMuted,
                                        fontWeight: 700, fontSize: "0.72rem", cursor: "pointer",
                                        transition: "background 0.15s",
                                    }}
                                >
                                    <Icon name="Download" size={13} />
                                    Descargar todas ({galeria.length})
                                </button>
                            )}
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                padding: 16,
            }}
            onClick={onClose}
        >
            <style>{`@keyframes cataPop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } } .cata-modal-carrusel::-webkit-scrollbar { display: none; }`}</style>

            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: tema.bgCard,
                    borderRadius: 20,
                    maxWidth: 480,
                    width: "100%",
                    maxHeight: "92vh",
                    overflowY: "auto",
                    scrollbarWidth: "none",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
                    border: `1px solid ${tema.border}`,
                    animation: "cataPop 0.22s ease-out",
                }}
            >
                {/* ── Header estilo post: logo + negocio + cerrar ── */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px",
                    borderBottom: `1px solid ${tema.border}`,
                }}>
                    {config.logo ? (
                        <img
                            src={optimizarImagenCloudinary(resolverImagen(config.logo), 100)}
                            alt=""
                            style={{
                                width: 34, height: 34, borderRadius: "50%",
                                objectFit: "cover",
                                border: `1px solid ${tema.border}`,
                                background: "#fff",
                            }}
                        />
                    ) : (
                        <div style={{
                            width: 34, height: 34, borderRadius: "50%",
                            background: tema.gradient,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            <Icon name="Store" size={16} color="#fff" />
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            margin: 0, fontWeight: 800, fontSize: "0.85rem",
                            color: tema.text,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                            {config.titulo || "Catálogo"}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        style={{
                            width: 32, height: 32, borderRadius: "50%",
                            border: "none", background: tema.bg,
                            color: tema.textMuted, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "background 0.15s", flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = tema.border }}
                        onMouseLeave={e => { e.currentTarget.style.background = tema.bg }}
                    >
                        <Icon name="X" size={18} />
                    </button>
                </div>

                {/* ── Foto: carrusel con swipe + flechas (relación global 1:1 o 4:5) ── */}
                <div
                    className="cata-modal-carrusel"
                    style={{
                        position: "relative",
                        aspectRatio: config.relacion_imagen === "4:5" ? "4 / 5" : "1",
                        background: "#000",
                        overflow: "hidden",
                        touchAction: "pan-y",
                    }}
                    onTouchStart={e => { touchX.current = e.touches[0].clientX }}
                    onTouchEnd={e => {
                        if (touchX.current === null) return
                        const dx = e.changedTouches[0].clientX - touchX.current
                        touchX.current = null
                        if (Math.abs(dx) > 40) (dx < 0 ? siguiente() : anterior())
                    }}
                >
                    {fotoActual ? (
                        <div style={{ position: "absolute", inset: 0 }}>
                            {/* Primer stage: w_600 (la misma del grid, en caché) → instantáneo.
                                Se reemplaza al instante (sin fundido) cuando la w_1200 está lista. */}
                            <img
                                src={fotoRapida}
                                alt=""
                                aria-hidden
                                style={{
                                    position: "absolute", inset: 0,
                                    width: "100%", height: "100%",
                                    objectFit: "contain",
                                    display: imagenLista ? "none" : "block",
                                }}
                            />
                            {/* Segundo stage: w_1200 de calidad. Se mantiene oculta (display none) para
                                descargar en segundo plano; al terminar, reemplaza a la w_600 al
                                instante. Si falla, la w_600 sigue visible (no se revela una imagen rota). */}
                            <img
                                src={fotoActualOptimizada}
                                alt={producto.producto}
                                onLoad={() => setImagenLista(true)}
                                style={{
                                    position: "absolute", inset: 0,
                                    width: "100%", height: "100%",
                                    objectFit: "contain",
                                    display: imagenLista ? "block" : "none",
                                }}
                            />
                        </div>
                    ) : (
                        <div style={{
                            width: "100%", height: "100%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: tema.bg,
                        }}>
                            <Icon name="Package" size={56} color={tema.textMuted} />
                        </div>
                    )}

                    {/* Flechas (solo si hay más de una foto) */}
                    {galeria.length > 1 && (
                        <>
                            {indiceSeguro > 0 && (
                                <button
                                    onClick={e => { e.stopPropagation(); anterior() }}
                                    aria-label="Foto anterior"
                                    style={{ ...estiloFlecha, left: 10 }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.45)" }}
                                >
                                    <Icon name="ChevronLeft" size={20} />
                                </button>
                            )}
                            {indiceSeguro < galeria.length - 1 && (
                                <button
                                    onClick={e => { e.stopPropagation(); siguiente() }}
                                    aria-label="Foto siguiente"
                                    style={{ ...estiloFlecha, right: 10 }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.45)" }}
                                >
                                    <Icon name="ChevronRight" size={20} />
                                </button>
                            )}
                        </>
                    )}

                    {/* Contador */}
                    {galeria.length > 1 && (
                        <span style={{
                            position: "absolute", top: 10, right: 10,
                            background: "rgba(0,0,0,0.5)", color: "#fff",
                            fontSize: "0.7rem", fontWeight: 700,
                            padding: "3px 10px", borderRadius: 12,
                        }}>
                            {indiceSeguro + 1} / {galeria.length}
                        </span>
                    )}

                    {/* Descargar foto actual (solo si el tenant lo permite) */}
                    {config.permitir_descarga && fotoActual && (
                        <button
                            onClick={e => { e.stopPropagation(); descargarImagen(fotoActual, nombreBase) }}
                            aria-label="Descargar foto"
                            title="Descargar foto"
                            style={{
                                position: "absolute", top: 10, left: 10,
                                width: 34, height: 34, borderRadius: "50%",
                                border: "none", background: "rgba(0,0,0,0.45)",
                                color: "#fff", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.45)" }}
                        >
                            <Icon name="Download" size={18} />
                        </button>
                    )}
                </div>

                {/* Dots de posición */}
                {galeria.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "10px 0 0" }}>
                        {galeria.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setIndice(i)}
                                aria-label={`Foto ${i + 1}`}
                                style={{
                                    width: indiceSeguro === i ? 18 : 7,
                                    height: 7, borderRadius: 4,
                                    border: "none", padding: 0, cursor: "pointer",
                                    background: indiceSeguro === i ? tema.primary : tema.border,
                                    transition: "all 0.2s",
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Descargar todas las fotos (solo si el tenant lo permite) */}
                {config.permitir_descarga && galeria.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                        <button
                            onClick={descargarTodas}
                            style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "6px 14px", borderRadius: 10,
                                border: `1px solid ${tema.border}`,
                                background: tema.bg, color: tema.primaryDark,
                                fontWeight: 700, fontSize: "0.75rem", cursor: "pointer",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = tema.border }}
                            onMouseLeave={e => { e.currentTarget.style.background = tema.bg }}
                        >
                            <Icon name="Download" size={14} />
                            Descargar todas ({galeria.length})
                        </button>
                    </div>
                )}

                {/* ── Cuerpo del post ── */}
                <div style={{ padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Nombre (grande, sin negritas) */}
                    <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 500, color: tema.text, lineHeight: 1.25 }}>
                        {producto.producto}
                    </h3>

                    {/* Precio + stock */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        {config.mostrar_precios ? (
                            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: tema.primaryDark, lineHeight: 1 }}>
                                {variaciones.length > 0 && !variacionActual && hayPreciosDistintos && (
                                    <span style={{ fontSize: "0.85rem", fontWeight: 700, opacity: 0.7, marginRight: 4 }}>desde </span>
                                )}
                                ${precioMostrado.toFixed(2)}
                                {sufijoMostrado && (
                                    <span style={{ fontSize: "1rem", fontWeight: 700, opacity: 0.75, marginLeft: 6 }}>
                                        Por {sufijoMostrado}
                                    </span>
                                )}
                            </span>
                        ) : <span />}
                        {config.mostrar_stock && !esSinStock && (
                            <span style={{
                                fontSize: "0.72rem", fontWeight: 700,
                                color: agotado ? "#ef4444" : tema.textMuted,
                                background: agotado ? "rgba(239,68,68,0.12)" : tema.bg,
                                padding: "4px 12px", borderRadius: 12,
                            }}>
                                {agotado ? "Agotado" : `${producto.stock_total} en stock`}
                            </span>
                        )}
                    </div>

                    {/* Selector de variación (siempre visible si el producto tiene,
                        incluso con precios ocultos — Fase 6) */}
                    {variaciones.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {variaciones.map(v => {
                                const activa = v.nombre === variacionSel
                                const agotada = stockPorVar && (v.stock ?? 0) <= 0
                                return (
                                    <button
                                        key={v.id}
                                        disabled={agotada}
                                        onClick={() => setVariacionSel(v.nombre)}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            padding: "7px 14px",
                                            borderRadius: 20,
                                            border: `1.5px solid ${activa ? tema.primary : tema.border}`,
                                            background: activa ? `color-mix(in srgb, ${tema.primary} 10%, transparent)` : tema.bg,
                                            color: agotada ? tema.textMuted : tema.text,
                                            fontWeight: 700,
                                            fontSize: "0.78rem",
                                            cursor: agotada ? "not-allowed" : "pointer",
                                            opacity: agotada ? 0.55 : 1,
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {v.nombre}
                                        {stockPorVar && !agotada && (
                                            <span style={{ fontSize: "0.66rem", fontWeight: 600, opacity: 0.75 }}>{v.stock} uds</span>
                                        )}
                                        {agotada
                                            ? <span style={{ color: "#ef4444", fontWeight: 800, fontSize: "0.7rem" }}>Agotado</span>
                                            : (config.mostrar_precios && <span style={{ color: tema.primaryDark, fontWeight: 800 }}>${v.precio.toFixed(2)}</span>)}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Categorías */}
                    {config.mostrar_categorias && (producto.categoria || []).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(producto.categoria || ["Otros"]).map(c => (
                                <span key={c} style={{
                                    fontSize: "0.68rem", fontWeight: 700,
                                    color: tema.primary,
                                    background: `color-mix(in srgb, ${tema.primary} 8%, transparent)`,
                                    borderRadius: 8, padding: "3px 10px",
                                }}>
                                    {c}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Divisor estilo post */}
                    <div style={{ height: 1, background: tema.border, margin: "2px 0" }} />

                    {/* Descripción completa */}
                    {producto.descripcion && (
                        <p style={{
                            margin: 0, fontSize: "0.88rem",
                            color: tema.textMuted, lineHeight: 1.55, fontWeight: 500,
                            whiteSpace: "pre-wrap",
                        }}>
                            {producto.descripcion}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
