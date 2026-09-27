"use client"
// ==============================================================================
// src/components/CatalogoMenuCarta.tsx
// Template Menú tipo Carta — estilo menú de restaurante/cafetería.
// - agrupado=true (default): separa los productos por categoría con encabezados.
// - agrupado=false: lista plana sin separadores (toggle del tenant desactivado).
// Layout de cada ítem: foto grande a la izquierda (protagonista) y la
// información (nombre · precio con guía punteada, descripción) a la derecha.
// Sin cajas: los ítems se separan con líneas hairline, como una carta física.
// ==============================================================================

import { useEffect, useRef, useState } from "react"
import Icon from "@/components/ui/Icon"
import { agruparPorCategoria, ordenarCategorias } from "@/lib/catalogo-utils"
import { optimizarImagenCuadrada } from "@/lib/image-utils"

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
}

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

export default function CatalogoMenuCarta({ productos, config, tema, agrupado = true, onAbrirProducto }: Props) {
    // ── Nav de categorías por anclas (sticky) ──
    const seccionesRef = useRef<Record<string, HTMLElement | null>>({})
    const [catActiva, setCatActiva] = useState<string | null>(null)

    const agrupados = agruparPorCategoria(productos)
    const categoriasOrdenadas = ordenarCategorias(Object.keys(agrupados))
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

    // ── Fila de producto (compartida entre vista agrupada y plana) ──
    const renderItem = (p: ProductoPublico) => {
        // Servicios y compuestos no tienen inventario propio: nunca se "agotan"
        const esSinStock = p.tipo_producto !== undefined && p.tipo_producto !== "stock"
        const agotado = !esSinStock && p.stock_total <= 0
        return (
            <div
                key={p.producto}
                onClick={() => onAbrirProducto?.(p)}
                style={{
                    display: "flex",
                    gap: 18,
                    padding: "18px 4px",
                    borderBottom: `1px solid ${tema.border}`,
                    transition: "opacity 0.15s",
                    opacity: !esSinStock && agotado && config.mostrar_stock ? 0.55 : 1,
                    cursor: "pointer",
                }}
            >
                {/* Foto protagonista a la izquierda */}
                {p.imagen && p.imagen !== "No hay foto" ? (
                    <div style={{
                        width: 104, height: 104,
                        borderRadius: 14,
                        overflow: "hidden",
                        flexShrink: 0,
                        background: tema.bg,
                    }}>
                        <img
                            src={optimizarImagenCuadrada(p.imagen.startsWith("http") ? p.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${p.imagen}`, 240)}
                            alt={p.producto}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            loading="lazy"
                            onError={e => { e.currentTarget.style.display = "none" }}
                        />
                    </div>
                ) : (
                    <div style={{
                        width: 104, height: 104,
                        borderRadius: 14,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.25,
                    }}>
                        <Icon name="Package" size={40} color={tema.textMuted} />
                    </div>
                )}

                {/* Info a la derecha */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    {/* Nombre · guía punteada · precio */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <h3 style={{
                            margin: 0,
                            fontSize: "1.08rem",
                            fontWeight: 800,
                            color: tema.text,
                            lineHeight: 1.3,
                        }}>
                            {p.producto}
                        </h3>
                        {/* Guía punteada (marca clásica de menú impreso) */}
                        <div style={{
                            flex: 1,
                            minWidth: 24,
                            height: 1.5,
                            background: `repeating-linear-gradient(to right, ${tema.border} 0 5px, transparent 5px 10px)`,
                            transform: "translateY(-3px)",
                        }} />
                        {config.mostrar_precios && (
                            <span style={{
                                fontSize: "0.95rem",
                                fontWeight: 700,
                                color: tema.text,
                                whiteSpace: "nowrap",
                            }}>
                                {(() => {
                                    const min = minPrecioDisponible(p)
                                    return (
                                        <span>
                                            {min.desde && <span style={{ fontSize: "0.66rem", fontWeight: 700, opacity: 0.7, marginRight: 2 }}>desde </span>}
                                            ${min.precio.toFixed(2)}
                                            {p.sufijo_precio && (
                                                <span style={{ fontSize: "0.68rem", fontWeight: 700, opacity: 0.75, marginLeft: 4 }}>
                                                    Por {p.sufijo_precio}
                                                </span>
                                            )}
                                        </span>
                                    )
                                })()}
                            </span>
                        )}
                    </div>

                    {/* Badges: agotado / pocas unidades */}
                    {config.mostrar_stock && !esSinStock && agotado && (
                        <span style={{
                            alignSelf: "flex-start",
                            marginTop: 6,
                            fontSize: "0.62rem",
                            fontWeight: 800,
                            color: "#ef4444",
                        }}>
                            AGOTADO
                        </span>
                    )}

                    {/* Descripción */}
                    {p.descripcion && (
                        <p style={{
                            margin: "5px 0 0",
                            fontSize: "0.82rem",
                            color: tema.textMuted,
                            fontWeight: 500,
                            lineHeight: 1.55,
                            display: "-webkit-box", WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                            {p.descripcion}
                        </p>
                    )}
                </div>
            </div>
        )
    }

    // ── Modo plano: lista sin separadores ──
    if (!agrupado) {
        return (
            <main style={{ maxWidth: 780, margin: "0 auto", padding: "16px 20px 60px" }}>
                {productos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: tema.textMuted }}>
                        <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>No se encontraron productos.</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {productos.map(renderItem)}
                    </div>
                )}
            </main>
        )
    }

    // ── Modo agrupado: secciones por categoría + nav de anclas ──

    return (
        <main style={{ maxWidth: 780, margin: "0 auto", padding: "16px 20px 60px" }}>
            {productos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: tema.textMuted }}>
                    <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>No se encontraron productos.</p>
                </div>
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
                                <style>{`.catalogo-chips { -ms-overflow-style: none; scrollbar-width: none; } .catalogo-chips::-webkit-scrollbar { display: none; }`}</style>
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
                                {/* Separador de categoría (el primero queda pegado al nav) */}
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    margin: idx === 0 ? "16px 0 10px" : "36px 0 12px",
                                    paddingLeft: 0,
                                }}>
                                    <h2 style={{
                                        margin: 0,
                                        fontSize: "0.9rem",
                                        fontWeight: 800,
                                        color: tema.primaryDark,
                                        textTransform: "uppercase",
                                        letterSpacing: 1.2,
                                    }}>
                                        {categoria}
                                    </h2>
                                    <div style={{
                                        flex: 1,
                                        height: 1.5,
                                        background: tema.border,
                                        borderRadius: 1,
                                    }} />
                                </div>

                                {/* Productos de esta categoría */}
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    {items.map(renderItem)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </main>
    )
}
