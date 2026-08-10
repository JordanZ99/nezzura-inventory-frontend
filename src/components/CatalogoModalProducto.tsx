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

interface ProductoPublico {
    producto: string
    descripcion: string
    imagen: string
    precio_venta: number
    stock_total: number
    categoria: string[]
    imagenes?: string[]
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
    // Galería completa: foto principal + extras, sin duplicados ni "No hay foto"
    const galeria = (() => {
        const lista: string[] = []
        const agregar = (u: string) => {
            if (!u || u === "No hay foto") return
            const resuelta = resolverImagen(u)
            if (resuelta && !lista.includes(resuelta)) lista.push(resuelta)
        }
        agregar(producto.imagen)
        ;(producto.imagenes || []).forEach(agregar)
        return lista
    })()

    const [indice, setIndice] = useState(0)
    const touchX = useRef<number | null>(null)

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
    const agotado = producto.stock_total <= 0
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
                            src={resolverImagen(config.logo)}
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

                {/* ── Foto: carrusel con swipe + flechas ── */}
                <div
                    className="cata-modal-carrusel"
                    style={{
                        position: "relative",
                        aspectRatio: "1",
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
                        <img
                            src={fotoActual}
                            alt={producto.producto}
                            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                        />
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
                                ${producto.precio_venta.toFixed(2)}
                            </span>
                        ) : <span />}
                        {config.mostrar_stock && (
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

                    {/* Categorías */}
                    {config.mostrar_categorias && (producto.categoria || []).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(producto.categoria || ["Otros"]).map(c => (
                                <span key={c} style={{
                                    fontSize: "0.68rem", fontWeight: 700,
                                    color: tema.primary,
                                    background: `${tema.primary}14`,
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
