"use client"
// ==============================================================================
// src/components/CatalogoMenu.tsx
// Template Menú — carta SIN imágenes: secciones divididas por categoría,
// platillos con nombre, descripción y precio (así como una carta impresa).
// - Sin fotos, sin badges de stock (salvo "Agotado" si mostrar_stock).
// - Renglón estilo carta: nombre + línea punteada + precio.
// - Nav sticky de categorías por anclas (igual que Grid Card).
// ==============================================================================

import { useEffect, useRef, useState } from "react"
import { agruparPorCategoria, ordenarCategorias, minPrecioDisponible } from "@/lib/catalogo-utils"

interface ProductoPublico {
    producto: string
    descripcion: string
    imagen: string
    precio_venta: number
    // Rango de precios de los lotes con stock (backend): undefined = un solo precio
    precio_min?: number
    precio_max?: number
    stock_total: number
    categoria: string[]
    // Sufijo del precio en el catálogo ("c/u", "por kilo", "por litro", ...); vacío = sin sufijo
    sufijo_precio?: string
    // 'stock' | 'servicio' — los servicios no tienen inventario (no se agotan)
    tipo_producto?: string
    // Variaciones: presentaciones con su PROPIO precio (ej. Sencilla/Doble, S/M/L)
    variaciones?: { id: number; nombre: string; precio: number; stock?: number }[]
}

interface ConfigCatalogo {
    template: string
    titulo: string
    subtitulo: string
    mostrar_precios: boolean
    mostrar_stock: boolean
    mostrar_categorias?: boolean
    // Texto de la barra de anuncios sticky (puede venir vacío; desplaza los chips)
    anuncio_texto?: string
}

interface PaletaTema {
    bg: string
    bgCard: string
    text: string
    textMuted: string
    primary: string
    primaryDark: string
    border: string
}

interface Props {
    productos: ProductoPublico[]
    config: ConfigCatalogo
    tema: PaletaTema
    // Contrato con CatalogoView (los otros templates los usan; el menú no)
    busqueda?: string
    agrupado?: boolean
    onAbrirProducto?: (p: ProductoPublico) => void
    // Orden manual de categorías (drag & drop desde Personalización)
    ordenCategorias?: Record<string, number>
}

/** Familias tipográficas del catálogo: display = var(--font-display); mono para labels */
const SERIF = "var(--font-display, Georgia, serif)"
const MONO = "ui-monospace, 'Cascadia Mono', 'Courier New', monospace"

export default function CatalogoMenu({ productos, config, tema, agrupado = true, onAbrirProducto, ordenCategorias }: Props) {
    // ── Nav de categorías por anclas (sticky) ──
    const seccionesRef = useRef<Record<string, HTMLElement | null>>({})
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const [catActiva, setCatActiva] = useState<string | null>(null)
    const [pegada, setPegada] = useState(false)

    const agrupados = agruparPorCategoria(productos)
    const categoriasOrdenadas = ordenarCategorias(Object.keys(agrupados), ordenCategorias)
    const conChips = agrupado && config.mostrar_categorias !== false && categoriasOrdenadas.length > 1

    // La barra de anuncios (sticky top:0, ~40px) desplaza el punto donde pegan los chips
    const topSticky = conChips && config.anuncio_texto ? 40 : 0
    const offsetAnclas = topSticky + 56

    // Sección activa y estado sticky: detecta cuándo la barra empieza a seguir al viewport
    useEffect(() => {
        if (!conChips) return
        const onScroll = () => {
            if (sentinelRef.current) {
                const estaPegada = sentinelRef.current.getBoundingClientRect().top <= topSticky
                setPegada(prev => prev !== estaPegada ? estaPegada : prev)
            }
            let activa: string | null = null
            for (const cat of categoriasOrdenadas) {
                const el = seccionesRef.current[cat]
                if (el && el.getBoundingClientRect().top <= offsetAnclas + 20) activa = cat
            }
            setCatActiva(activa)
        }
        window.addEventListener("scroll", onScroll, { passive: true })
        onScroll()
        return () => window.removeEventListener("scroll", onScroll)
    }, [conChips, categoriasOrdenadas, offsetAnclas, topSticky])

    const saltarA = (cat: string) => {
        const el = seccionesRef.current[cat]
        setCatActiva(cat)
        if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - offsetAnclas
            window.scrollTo({ top, behavior: "smooth" })
        }
    }

    // Renglón de platillo estilo carta
    const renderRenglon = (p: ProductoPublico) => {
        // Servicios y compuestos no tienen inventario propio: nunca se "agotan"
        const esSinStock = p.tipo_producto !== undefined && p.tipo_producto !== "stock"
        const agotado = !esSinStock && p.stock_total <= 0
        const min = minPrecioDisponible(p)
        return (
            <button
                key={p.producto}
                onClick={() => onAbrirProducto?.(p)}
                style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 12px 14px",
                    margin: 0,
                    border: "none",
                    borderRadius: 10,
                    background: "transparent",
                    cursor: "pointer",
                    color: "inherit",
                    transition: "background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, ${tema.text} 5%, transparent)` }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
            >
                {/* Renglón: nombre .... precio */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, width: "100%" }}>
                    <span style={{
                        fontFamily: SERIF,
                        fontSize: "calc(1.05rem * var(--fd-scale, 1))",
                        fontWeight: 600,
                        lineHeight: 1.35,
                        color: tema.text,
                    }}>
                        {p.producto}
                        {config.mostrar_stock && agotado && (
                            <span style={{
                                marginLeft: 8,
                                fontSize: "0.62rem", fontWeight: 800, fontFamily: "inherit",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                verticalAlign: "middle",
                                color: "#ef4444",
                            }}>Agotado</span>
                        )}
                    </span>
                    <span style={{
                        flex: 1,
                        minWidth: 24,
                        borderBottom: `2px dotted color-mix(in srgb, ${tema.text} 30%, transparent)`,
                        transform: "translateY(-4px)",
                    }} />
                    {config.mostrar_precios && (
                        <span style={{
                            fontFamily: SERIF,
                            fontSize: "calc(1.05rem * var(--fd-scale, 1))",
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                            color: tema.primaryDark,
                            whiteSpace: "nowrap",
                        }}>
                            {min.desde && <span style={{ fontSize: "0.66rem", fontWeight: 600, opacity: 0.65, marginRight: 3 }}>desde </span>}
                            {(!min.desde && p.precio_min !== undefined && p.precio_max !== undefined && p.precio_max > p.precio_min)
                                ? <>${p.precio_min.toFixed(2)} – ${p.precio_max.toFixed(2)}</>
                                : `$${min.precio.toFixed(2)}`}
                        </span>
                    )}
                </div>
                {/* Debajo: sufijo del precio + descripción */}
                {config.mostrar_precios && p.sufijo_precio && (
                    <p style={{
                        margin: "2px 0 0",
                        fontFamily: MONO,
                        fontSize: "0.58rem",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: `color-mix(in srgb, ${tema.text} 35%, transparent)`,
                    }}>
                        Por {p.sufijo_precio}
                    </p>
                )}
                {p.descripcion && (
                    <p style={{
                        margin: "2px 0 0",
                        fontSize: "0.85rem",
                        lineHeight: 1.55,
                        color: `color-mix(in srgb, ${tema.text} 55%, transparent)`,
                    }}>
                        {p.descripcion}
                    </p>
                )}
            </button>
        )
    }

    return (
        <>
            <style>{`
.cmn-lista { border-bottom: 1px solid ${tema.border}; }
.cmn-chips { -ms-overflow-style: none; scrollbar-width: none; }
.cmn-chips::-webkit-scrollbar { display: none; }
`}</style>

            {/* Centinela para detectar cuándo la barra empieza a seguir al viewport */}
            {productos.length > 0 && conChips && (
                <div ref={sentinelRef} style={{ height: 1, marginTop: -1, pointerEvents: "none", visibility: "hidden" }} />
            )}

            {/* Nav sticky de categorías a ancho completo del viewport */}
            {productos.length > 0 && conChips && (
                <div style={{
                    position: "sticky",
                    top: topSticky,
                    zIndex: 40,
                    width: "100%",
                    backgroundColor: pegada ? tema.bg : "transparent",
                    borderBottom: `1px solid ${pegada ? tema.border : "transparent"}`,
                    boxShadow: pegada ? "0 4px 16px rgba(0,0,0,0.08)" : "none",
                    transition: "background-color 1s ease, border-color 1s ease, box-shadow 1s ease",
                }}>
                    <div
                        className="cmn-chips"
                        style={{
                            display: "flex",
                            gap: 8,
                            overflowX: "auto",
                            padding: "10px 20px 8px",
                            scrollbarWidth: "none",
                            boxSizing: "border-box",
                        }}
                    >
                        {categoriasOrdenadas.map(cat => (
                            <button
                                key={cat}
                                onClick={() => saltarA(cat)}
                                style={{
                                    padding: "8px 16px", borderRadius: 20,
                                    border: "none", cursor: "pointer",
                                    fontSize: "0.8rem", fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    background: catActiva === cat ? tema.primary : tema.bgCard,
                                    color: catActiva === cat ? "var(--on-primary)" : tema.textMuted,
                                    transition: "all 0.15s",
                                    flexShrink: 0,
                                    fontFamily: SERIF,
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <main style={{ maxWidth: 680, margin: "0 auto", padding: "16px 20px 60px" }}>
                {productos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: tema.textMuted }}>
                        <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>No se encontraron platillos.</p>
                    </div>
                ) : !agrupado ? (
                    /* Modo plano: renglones sin encabezados de sección */
                    <div className="cmn-lista">
                        {productos.map(renderRenglon)}
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {categoriasOrdenadas.map((categoria, idx) => {
                            const items = agrupados[categoria]
                            return (
                                <section key={categoria} ref={el => { seccionesRef.current[categoria] = el }}>
                                    {/* Header de sección estilo carta: línea / TÍTULO / línea */}
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 14,
                                        margin: idx === 0 ? "20px 0 10px" : "34px 0 10px",
                                    }}>
                                        <span style={{
                                            height: 1, flex: 1,
                                            background: `color-mix(in srgb, ${tema.text} 25%, transparent)`,
                                        }} />
                                        <h2 style={{
                                            margin: 0,
                                            fontFamily: SERIF,
                                            fontSize: "calc(1.3rem * var(--fd-scale, 1))",
                                            fontWeight: 600,
                                            letterSpacing: "0.12em",
                                            textTransform: "uppercase",
                                            color: tema.text,
                                            whiteSpace: "nowrap",
                                        }}>
                                            {categoria}
                                        </h2>
                                        <span style={{
                                            height: 1, flex: 1,
                                            background: `color-mix(in srgb, ${tema.text} 25%, transparent)`,
                                        }} />
                                    </div>
                                    {/* Renglones de platillos */}
                                    <div className="cmn-lista">
                                        {items.map(renderRenglon)}
                                    </div>
                                </section>
                            )
                        })}
                    </div>
                )}
            </main>
        </>
    )
}
