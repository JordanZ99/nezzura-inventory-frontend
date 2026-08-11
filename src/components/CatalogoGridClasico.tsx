"use client"
// ==============================================================================
// src/components/CatalogoGridClasico.tsx
// Template Grid Clásico — tarjetas con imagen, nombre, precio y categoría.
// Soporta dos modos:
//   - Plano (agrupado=false): grid de tarjetas, paginado por el padre.
//   - Agrupado (agrupado=true): secciones por categoría con encabezados.
//     Cada categoría arranca como UNA fila deslizable (carrusel) con flechas
//     ← → (y swipe en móvil); un acordeón "Ver todos (N)" expande la categoría
//     al grid completo y "Ver menos" la vuelve a colapsar.
// ==============================================================================

import { useState, useRef, useCallback, useEffect } from "react"
import Icon from "@/components/ui/Icon"
import { agruparPorCategoria, ordenarCategorias } from "@/lib/catalogo-utils"
import { optimizarImagenCloudinary } from "@/lib/image-utils"

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
    variaciones?: { id: number; nombre: string; precio: number }[]
}

interface ConfigCatalogo {
    tema: string
    template: string
    titulo: string
    subtitulo: string
    mostrar_precios: boolean
    mostrar_stock: boolean
    mostrar_categorias: boolean
    columnas_movil?: number
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
    agrupado?: boolean
    onAbrirProducto?: (p: ProductoPublico) => void
}

export default function CatalogoGridClasico({ productos, config, tema, agrupado = false, onAbrirProducto }: Props) {
    // ── Estado del modo agrupado ──
    const [expandidas, setExpandidas] = useState<Set<string>>(() => new Set())
    const [esMovil, setEsMovil] = useState<boolean>(() =>
        typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches)
    const [desborda, setDesborda] = useState<Record<string, boolean>>({})
    const filasRef = useRef<Record<string, HTMLDivElement | null>>({})

    // Mide si cada fila de categoría desborda su contenedor (necesita carrusel).
    // Si todo cabe en la fila, se muestra simple (sin flechas ni acordeón).
    const medirFilas = useCallback(() => {
        const nuevo: Record<string, boolean> = {}
        Object.keys(filasRef.current).forEach(cat => {
            const el = filasRef.current[cat]
            if (el) nuevo[cat] = el.scrollWidth > el.clientWidth + 4
        })
        setDesborda(prev => {
            const igual = Object.keys(nuevo).length === Object.keys(prev).length &&
                Object.keys(nuevo).every(k => nuevo[k] === prev[k])
            return igual ? prev : nuevo
        })
    }, [])

    // Detecta si la vista es móvil (<=899px) para aplicar las columnas configuradas
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 899px)")
        setEsMovil(mq.matches)
        const handler = (e: MediaQueryListEvent) => setEsMovil(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    useEffect(() => {
        medirFilas()
        window.addEventListener("resize", medirFilas)
        return () => window.removeEventListener("resize", medirFilas)
    }, [medirFilas, productos, esMovil])

    // Desplaza la fila de una categoría en la dirección indicada
    const scrollFila = (cat: string, dir: number) => {
        const el = filasRef.current[cat]
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" })
    }

    const toggleCategoria = (cat: string) => {
        setExpandidas(prev => {
            const nuevo = new Set(prev)
            if (nuevo.has(cat)) nuevo.delete(cat)
            else nuevo.add(cat)
            return nuevo
        })
    }

    // ── Tarjeta de producto (compartida entre todos los modos) ──
    const renderTarjeta = (p: ProductoPublico, enSeccion: boolean) => {
        // Servicios y compuestos no tienen inventario propio: nunca se "agotan"
        const esSinStock = p.tipo_producto !== undefined && p.tipo_producto !== "stock"
        const agotado = !esSinStock && p.stock_total <= 0
        return (
            <div
                key={p.producto}
                onClick={() => onAbrirProducto?.(p)}
                style={{
                    background: tema.bgCard,
                    borderRadius: 16,
                    overflow: "hidden",
                    border: `1px solid ${tema.border}`,
                    transition: "transform 0.2s, box-shadow 0.2s",
                    display: "flex", flexDirection: "column",
                    height: "100%",
                    cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.08)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}
            >
                {/* Imagen del producto */}
                <div style={{
                    aspectRatio: "1", background: tema.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", overflow: "hidden",
                    borderRadius: 12,
                }}>
                    {p.imagen && p.imagen !== "No hay foto" ? (
                        <img
                            src={optimizarImagenCloudinary(p.imagen.startsWith("http") ? p.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${p.imagen}`, 600)}
                            alt={p.producto}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            loading="lazy"
                            onError={e => { e.currentTarget.style.display = "none" }}
                        />
                    ) : (
                        <div style={{ opacity: 0.2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name="Package" size={40} color="var(--text-muted)" />
                        </div>
                    )}
                    {/* Badge de stock (los servicios no se agotan) */}
                    {config.mostrar_stock && !esSinStock && agotado && (
                        <span style={{
                            position: "absolute", top: 10, right: 10,
                            background: "rgba(239,68,68,0.95)", color: "#fff",
                            fontSize: "0.7rem", fontWeight: 800,
                            padding: "4px 10px", borderRadius: 12,
                        }}>
                            Agotado
                        </span>
                    )}
                    {config.mostrar_stock && !esSinStock && !agotado && p.stock_total <= 5 && (
                        <span style={{
                            position: "absolute", top: 10, right: 10,
                            background: "rgba(245,158,11,0.95)", color: "#fff",
                            fontSize: "0.7rem", fontWeight: 800,
                            padding: "4px 10px", borderRadius: 12,
                        }}>
                            ¡Últimas {p.stock_total}!
                        </span>
                    )}
                </div>

                {/* Info del producto */}
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    {/* Categoría (se omite dentro de una sección: ya hay encabezado) */}
                    {config.mostrar_categorias && !enSeccion && (p.categoria || []).length > 0 && (
                        <span style={{
                            fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                            color: tema.primary, letterSpacing: 0.8,
                        }}>
                            {(p.categoria || ["Otros"]).join(", ")}
                        </span>
                    )}
                    {/* Nombre */}
                    <h3 style={{
                        fontSize: "0.95rem", fontWeight: 700, margin: 0,
                        color: tema.text, lineHeight: 1.3,
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                        {p.producto}
                    </h3>
                    {/* Descripción */}
                    {p.descripcion && (
                        <p style={{
                            fontSize: "0.78rem", color: tema.textMuted, margin: 0,
                            lineHeight: 1.4, fontWeight: 500,
                            display: "-webkit-box", WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                            {p.descripcion}
                        </p>
                    )}
                    {/* Precio + stock */}
                    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8 }}>
                        {config.mostrar_precios ? (
                            <span style={{
                                fontSize: "1.15rem", fontWeight: 800,
                                color: tema.primaryDark,
                                whiteSpace: "nowrap",
                            }}>
                                {(p.variaciones || []).length > 0 ? (
                                    <span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 700, opacity: 0.7, marginRight: 2 }}>desde </span>
                                        ${Math.min(...(p.variaciones || []).map(v => v.precio)).toFixed(2)}
                                    </span>
                                ) : (
                                    <span>
                                        ${p.precio_venta.toFixed(2)}
                                        {p.sufijo_precio && (
                                            <span style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.75, marginLeft: 4 }}>
                                                {p.sufijo_precio}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </span>
                        ) : (
                            <span />
                        )}
                        {config.mostrar_stock && !esSinStock && !agotado && (
                            <span style={{
                                fontSize: "0.7rem", fontWeight: 600,
                                color: tema.textMuted,
                                background: tema.bg, padding: "3px 8px", borderRadius: 8,
                            }}>
                                {p.stock_total} en stock
                            </span>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ── Columnas en móvil (configurable por el tenant: 1 o 2) ──
    // Escritorio: siempre 4 por fila.
    const columnasMovil = config.columnas_movil === 1 ? 1 : 2
    const anchoTarjetaCarrusel = !esMovil
        ? "calc((100% - 60px) / 4)"
        : columnasMovil === 1
            ? "100%"
            : "calc((100% - 20px) / 2)"
    const columnasGrid = !esMovil
        ? "repeat(auto-fill, minmax(220px, 1fr))"
        : columnasMovil === 1
            ? "1fr"
            : "repeat(2, minmax(0, 1fr))"

    // ── Modo agrupado: fila deslizable por categoría + acordeón ──
    if (agrupado) {
        const agrupados = agruparPorCategoria(productos)
        const categorias = ordenarCategorias(Object.keys(agrupados))

        const estiloFlecha: React.CSSProperties = {
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            width: 36, height: 36,
            borderRadius: "50%",
            background: tema.bgCard,
            border: `1px solid ${tema.border}`,
            color: tema.text,
            cursor: "pointer",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            transition: "all 0.15s",
        }

        const estiloAcordeon: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            borderRadius: 20,
            border: `1px solid ${tema.border}`,
            background: tema.bgCard,
            color: tema.primaryDark,
            fontWeight: 700,
            fontSize: "0.78rem",
            cursor: "pointer",
            transition: "all 0.15s",
        }

        return (
            <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 60px" }}>
                <style>{`.fila-categoria { -ms-overflow-style: none; scrollbar-width: none; } .fila-categoria::-webkit-scrollbar { display: none; }`}</style>
                {productos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: tema.textMuted }}>
                        <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>No se encontraron productos.</p>
                    </div>
                ) : (
                    categorias.map(cat => {
                        const items = agrupados[cat]
                        const expandida = expandidas.has(cat)
                        const esCarrusel = desborda[cat] === true
                        return (
                            <section key={cat}>
                                {/* Encabezado de categoría */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "60px 0 20px" }}>
                                    <h2 style={{
                                        margin: 0,
                                        fontSize: "1.05rem",
                                        fontWeight: 800,
                                        color: tema.primaryDark,
                                        textTransform: "uppercase",
                                        letterSpacing: 1.2,
                                    }}>
                                        {cat}
                                    </h2>
                                    <div style={{ flex: 1, height: 1.5, background: tema.border, borderRadius: 1 }} />
                                </div>

                                {expandida ? (
                                    /* ── Expandida: todos los productos en grid ── */
                                    <>
                                        <div style={{
                                            display: "grid",
                                            gridTemplateColumns: columnasGrid,
                                            gap: 20,
                                        }}>
                                            {items.map(p => renderTarjeta(p, true))}
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
                                            <button
                                                onClick={() => toggleCategoria(cat)}
                                                style={estiloAcordeon}
                                                onMouseEnter={e => { e.currentTarget.style.background = tema.bg }}
                                                onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard }}
                                            >
                                                <Icon name="ChevronUp" size={16} />
                                                Ver menos
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    /* ── Colapsada: una fila deslizable ── */
                                    <>
                                        <div style={{ position: "relative" }}>
                                            {esCarrusel && (
                                                <button
                                                    onClick={() => scrollFila(cat, -1)}
                                                    aria-label={`Ver anteriores de ${cat}`}
                                                    style={{ ...estiloFlecha, left: -8 }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = tema.bg }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard }}
                                                >
                                                    <Icon name="ChevronLeft" size={20} />
                                                </button>
                                            )}
                                            <div
                                                ref={el => { filasRef.current[cat] = el }}
                                                className="fila-categoria"
                                                style={{
                                                    display: "flex",
                                                    gap: 20,
                                                    overflowX: "auto",
                                                    scrollSnapType: "x mandatory",
                                                    paddingBottom: 8,
                                                }}
                                            >
                                                {items.map(p => (
                                                    <div key={p.producto} style={{ flex: `0 0 ${anchoTarjetaCarrusel}`, minWidth: esMovil ? 0 : 180, scrollSnapAlign: "start" }}>
                                                        {renderTarjeta(p, true)}
                                                    </div>
                                                ))}
                                            </div>
                                            {esCarrusel && (
                                                <button
                                                    onClick={() => scrollFila(cat, 1)}
                                                    aria-label={`Ver siguientes de ${cat}`}
                                                    style={{ ...estiloFlecha, right: -8 }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = tema.bg }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard }}
                                                >
                                                    <Icon name="ChevronRight" size={20} />
                                                </button>
                                            )}
                                        </div>
                                        {esCarrusel && (
                                            <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                                                <button
                                                    onClick={() => toggleCategoria(cat)}
                                                    style={estiloAcordeon}
                                                    onMouseEnter={e => { e.currentTarget.style.background = tema.bg }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard }}
                                                >
                                                    <Icon name="ChevronDown" size={16} />
                                                    Ver todos ({items.length})
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>
                        )
                    })
                )}
            </main>
        )
    }

    // ── Modo plano (paginado por el padre) ──
    return (
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 60px" }}>
            {productos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: tema.textMuted }}>
                    <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>No se encontraron productos.</p>
                </div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: columnasGrid,
                    gap: 20,
                }}>
                    {productos.map(p => renderTarjeta(p, false))}
                </div>
            )}
        </main>
    )
}
