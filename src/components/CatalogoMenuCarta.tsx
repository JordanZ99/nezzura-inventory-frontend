"use client"
// ==============================================================================
// src/components/CatalogoMenuCarta.tsx
// Template Menú tipo Carta — port del diseño Santa Fé (AsaderoLayout).
// - Cards en grid 1/2/3 columnas con foto 4:3 (mismas proporciones/tamaños
//   de SF), nombre serif, separador dashed y precio destacado.
// - agrupado=true (default): secciones por categoría con encabezado bordeado.
// - agrupado=false: lista plana (grid sin encabezados).
// - Nav sticky de categorías por anclas (salta a la sección, marca la activa).
// ==============================================================================

import { useEffect, useRef, useState } from "react"
import Icon from "@/components/ui/Icon"
import { agruparPorCategoria, ordenarCategorias } from "@/lib/catalogo-utils"
import { optimizarImagenRecorte } from "@/lib/image-utils"

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
    variaciones?: { id: number; nombre: string; precio: number; stock?: number }[]
}

interface ConfigCatalogo {
    tema: string
    template: string
    titulo: string
    subtitulo: string
    mostrar_precios: boolean
    mostrar_stock: boolean
    mostrar_categorias: boolean
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
    gradient: string
}

interface Props {
    productos: ProductoPublico[]
    config: ConfigCatalogo
    tema: PaletaTema
    busqueda: string
    agrupado?: boolean
    onAbrirProducto?: (p: ProductoPublico) => void
    // Orden manual de categorías (drag & drop desde Personalización)
    ordenCategorias?: Record<string, number>
}

/** Familias tipográficas del diseño SF: serif para nombres/precios, mono para labels */
const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = "ui-monospace, 'Cascadia Mono', 'Courier New', monospace"

/**
 * Precio mínimo de las variaciones DISPONIBLES: si el producto tiene
 * variaciones, las agotadas no cuentan para el "desde $X". Si todas están
 * agotadas, cae al precio del producto.
 */
function minPrecioDisponible(p: { variaciones?: { precio: number; stock?: number }[]; precio_venta: number }): { desde: boolean; precio: number } {
    const vars = p.variaciones || []
    const disponibles = vars.length > 0 ? vars.filter(v => (v.stock ?? 0) > 0) : vars
    if (disponibles.length > 0) return { desde: true, precio: Math.min(...disponibles.map(v => v.precio)) }
    return { desde: false, precio: p.precio_venta }
}

export default function CatalogoMenuCarta({ productos, config, tema, agrupado = true, onAbrirProducto, ordenCategorias }: Props) {
    // ── Nav de categorías por anclas (sticky) ──
    const seccionesRef = useRef<Record<string, HTMLElement | null>>({})
    const [catActiva, setCatActiva] = useState<string | null>(null)

    const agrupados = agruparPorCategoria(productos)
    const categoriasOrdenadas = ordenarCategorias(Object.keys(agrupados), ordenCategorias)
    const conChips = agrupado && categoriasOrdenadas.length > 1

    // La barra de anuncios (sticky top:0, ~40px) desplaza el punto donde pegan los chips
    const topSticky = conChips && config.anuncio_texto ? 40 : 0
    const offsetAnclas = topSticky + 56

    // Sección activa: la última cuyo header quedó por encima del área de los chips
    useEffect(() => {
        if (!conChips) return
        const onScroll = () => {
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
    }, [conChips, categoriasOrdenadas, offsetAnclas])

    const saltarA = (cat: string) => {
        const el = seccionesRef.current[cat]
        setCatActiva(cat)
        if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - offsetAnclas
            window.scrollTo({ top, behavior: "smooth" })
        }
    }

    // ── Card de platillo (port SF DishCard) ──
    const renderCard = (p: ProductoPublico) => {
        // Servicios y compuestos no tienen inventario propio: nunca se "agotan"
        const esSinStock = p.tipo_producto !== undefined && p.tipo_producto !== "stock"
        const agotado = !esSinStock && p.stock_total <= 0
        const url = p.imagen.startsWith("http") ? p.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${p.imagen}`
        const min = minPrecioDisponible(p)
        return (
            <article
                key={p.producto}
                className="sfmc-card"
                onClick={() => onAbrirProducto?.(p)}
                style={{
                    borderRadius: 16,
                    border: `1px solid ${tema.border}`,
                    background: tema.bgCard,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                }}
            >
                {/* Foto 4:3 con zoom suave al hover y gradiente inferior (como SF) */}
                <div
                    className="sfmc-foto"
                    style={{
                        position: "relative",
                        aspectRatio: "4 / 3",
                        overflow: "hidden",
                        background: tema.bg,
                    }}
                >
                    {p.imagen && p.imagen !== "No hay foto" ? (
                        <img
                            src={optimizarImagenRecorte(url, 800, 600)}
                            alt={p.producto}
                            loading="lazy"
                            onError={e => { e.currentTarget.style.display = "none" }}
                        />
                    ) : (
                        <div style={{
                            width: "100%", height: "100%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            opacity: 0.2,
                        }}>
                            <Icon name="Utensils" size={40} color={tema.textMuted} />
                        </div>
                    )}
                    <div style={{
                        position: "absolute", inset: 0, pointerEvents: "none",
                        background: "linear-gradient(to top, rgba(0,0,0,0.32), transparent)",
                    }} />
                    {config.mostrar_stock && !esSinStock && agotado && (
                        <span style={{
                            position: "absolute", top: 10, right: 10,
                            background: "rgba(239,68,68,0.95)", color: "#fff",
                            fontSize: "0.7rem", fontWeight: 800,
                            padding: "4px 10px", borderRadius: 12,
                        }}>Agotado</span>
                    )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16 }}>
                    <h4 style={{
                        margin: 0,
                        fontFamily: SERIF,
                        fontSize: "1.125rem",
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: tema.text,
                    }}>
                        {p.producto}
                    </h4>
                    {p.descripcion && (
                        <p style={{
                            margin: "8px 0 0",
                            fontSize: "0.875rem",
                            lineHeight: 1.6,
                            color: `color-mix(in srgb, ${tema.text} 55%, transparent)`,
                            flex: 1,
                        }}>
                            {p.descripcion}
                        </p>
                    )}

                    {/* Separación dashed + precio grande (port SF) */}
                    <div style={{
                        marginTop: 16,
                        borderTop: `1px dashed color-mix(in srgb, ${tema.text} 22%, transparent)`,
                        paddingTop: 14,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: 8,
                    }}>
                        <div>
                            <p style={{
                                margin: 0,
                                fontFamily: MONO,
                                fontSize: "0.56rem",
                                letterSpacing: "0.25em",
                                textTransform: "uppercase",
                                color: `color-mix(in srgb, ${tema.text} 35%, transparent)`,
                            }}>
                                {p.sufijo_precio ? `Por ${p.sufijo_precio}` : "Precio"}
                            </p>
                            {config.mostrar_precios && (
                                <p style={{
                                    margin: "2px 0 0",
                                    fontFamily: SERIF,
                                    fontSize: "1.5rem",
                                    fontWeight: 600,
                                    lineHeight: 1,
                                    fontVariantNumeric: "tabular-nums",
                                    color: tema.primaryDark,
                                }}>
                                    {min.desde && <span style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.65, marginRight: 3 }}>desde </span>}
                                    ${min.precio.toFixed(2)}
                                </p>
                            )}
                        </div>
                        {config.mostrar_stock && !esSinStock && !agotado && (
                            <span style={{
                                fontSize: "0.62rem", fontWeight: 600,
                                flexShrink: 0,
                                color: `color-mix(in srgb, ${tema.text} 40%, transparent)`,
                                padding: "3px 8px", borderRadius: 10,
                                border: `1px solid ${tema.border}`,
                            }}>
                                {p.stock_total} en stock
                            </span>
                        )}
                    </div>
                </div>
            </article>
        )
    }

    return (
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px 60px" }}>
            {/* Layout de cards portado de SF: 1 col móvil, 2 sm, 3 lg */}
            <style>{`
.sfmc-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 640px) { .sfmc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .sfmc-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.sfmc-card { color: inherit; text-decoration: none; transition: transform 0.3s ease, box-shadow 0.3s ease; will-change: transform; }
.sfmc-card:hover { transform: translateY(-4px); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); }
.sfmc-foto img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease-out; }
.sfmc-card:hover .sfmc-foto img { transform: scale(1.04); }
.sfmc-modal-foto { aspect-ratio: 1 / 1; }
@media (min-width: 640px) { .sfmc-modal-foto { width: 55%; } }
.catalogo-chips { -ms-overflow-style: none; scrollbar-width: none; }
.catalogo-chips::-webkit-scrollbar { display: none; }
`}</style>

            {productos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: tema.textMuted }}>
                    <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>No se encontraron productos.</p>
                </div>
            ) : !agrupado ? (
                /* Modo plano: grid sin encabezados */
                <div className="sfmc-grid">{productos.map(renderCard)}</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    {/* Nav sticky de categorías: salta a la sección (no filtra la carta) */}
                    {conChips && (
                        <div style={{
                            position: "sticky",
                            top: topSticky,
                            zIndex: 40,
                            background: tema.bg,
                            margin: "0 -20px",
                            padding: "10px 20px 8px",
                            borderBottom: `1px solid ${tema.border}`,
                        }}>
                            <div
                                className="catalogo-chips"
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    overflowX: "auto",
                                    scrollbarWidth: "none",
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
                                        }}
                                    >
                                        {cat}
                                        <span style={{ opacity: 0.65, marginLeft: 6, fontSize: "0.7rem", fontWeight: 600 }}>
                                            {agrupados[cat].length}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {categoriasOrdenadas.map((categoria, idx) => {
                        const items = agrupados[categoria]
                        return (
                            <div key={categoria} ref={el => { seccionesRef.current[categoria] = el }}>
                                {/* Header de sección estilo SF: título serif + contador + línea */}
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    borderBottom: `1px solid ${tema.border}`,
                                    paddingBottom: 14,
                                    margin: idx === 0 ? "16px 0 16px" : "36px 0 16px",
                                }}>
                                    <h2 style={{
                                        margin: 0,
                                        fontFamily: SERIF,
                                        fontSize: "1.55rem",
                                        fontWeight: 600,
                                        letterSpacing: "-0.01em",
                                        color: tema.text,
                                        textTransform: "none",
                                    }}>
                                        {categoria}
                                    </h2>
                                    <span style={{
                                        fontSize: "0.68rem",
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.2em",
                                        color: `color-mix(in srgb, ${tema.text} 30%, transparent)`,
                                        whiteSpace: "nowrap",
                                    }}>
                                        {items.length} {items.length === 1 ? "opción" : "opciones"}
                                    </span>
                                </div>

                                {/* Cards de esta categoría */}
                                <div className="sfmc-grid">
                                    {items.map(renderCard)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </main>
    )
}
