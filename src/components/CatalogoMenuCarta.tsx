"use client"
// ==============================================================================
// src/components/CatalogoMenuCarta.tsx
// Template Menú tipo Carta — estilo menú de restaurante/cafetería.
// Agrupa productos por categoría con separadores visuales.
// Ideal para: restaurantes, cafeterías, bares, servicios.
// ==============================================================================

import Icon from "@/components/ui/Icon"

interface ProductoPublico {
    producto: string
    descripcion: string
    imagen: string
    precio_venta: number
    stock_total: number
    categoria: string[]
}

interface ConfigCatalogo {
    tema: string
    template: string
    titulo: string
    subtitulo: string
    mostrar_precios: boolean
    mostrar_stock: boolean
    mostrar_categorias: boolean
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
}

/**
 * Agrupa productos por categoría con fallback para productos sin categoría.
 * Si un producto tiene categoria = null, [] o string vacío, se agrupa
 * bajo la sección "Sin categoría" para que nunca desaparezca del menú.
 */
function agruparPorCategoria(productos: ProductoPublico[]): Record<string, ProductoPublico[]> {
    return productos.reduce((acc, prod) => {
        const cats = Array.isArray(prod.categoria) && prod.categoria.length > 0
            ? prod.categoria
            : ["Sin categoría"]

        cats.forEach(cat => {
            if (!acc[cat]) acc[cat] = []
            acc[cat].push(prod)
        })
        return acc
    }, {} as Record<string, ProductoPublico[]>)
}

/**
 * Icono emoji para cada categoría basado en palabras clave.
 * Si no encuentra coincidencia, devuelve un genérico.
 */
function emojiParaCategoria(categoria: string): string {
    const lower = categoria.toLowerCase()
    if (/(café|cafe|espresso|capuchino|latte|americano|moka)/.test(lower)) return "☕"
    if (/(bebida|refresco|soda|jugo|agua|malteada|frapp|smoothie|té|te|infusión|infusion)/.test(lower)) return "🥤"
    if (/(postre|pastel|pastelería|pasteleria|helado|dulce|galleta|brownie|cheesecake|pay|tarta)/.test(lower)) return "🍰"
    if (/(comida|platillo|entrada|ensalada|sopa|guarnición|guarnicion|pasta|hamburguesa|taco|burrito|pizza)/.test(lower)) return "🍽️"
    if (/(carne|pollo|cerdo|res|pescado|marisco|camarón|camaron|filete|parrilla|asado)/.test(lower)) return "🥩"
    if (/(botana|snack|papas|nachos|totopos)/.test(lower)) return "🥨"
    if (/(cerveza|vino|licor|cóctel|coctel|ron|whisky|vodka)/.test(lower)) return "🍷"
    if (/(desayuno|huevo|hotcake|panqueque|chilaquil|omelette)/.test(lower)) return "🌅"
    return "●"
}

export default function CatalogoMenuCarta({ productos, config, tema }: Props) {
    const agrupados = agruparPorCategoria(productos)

    // Ordenar categorías alfabéticamente, pero "Sin categoría" al final
    const categoriasOrdenadas = Object.keys(agrupados).sort((a, b) => {
        if (a === "Sin categoría") return 1
        if (b === "Sin categoría") return -1
        return a.localeCompare(b, "es", { sensitivity: "base" })
    })

    return (
        <main style={{ maxWidth: 700, margin: "0 auto", padding: "24px 20px 60px" }}>
            {productos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: tema.textMuted }}>
                    <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>No se encontraron productos.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {categoriasOrdenadas.map(categoria => {
                        const items = agrupados[categoria]
                        return (
                            <div key={categoria}>
                                {/* Separador de categoría */}
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    margin: "28px 0 12px",
                                    paddingLeft: 0,
                                }}>
                                    <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>
                                        {emojiParaCategoria(categoria)}
                                    </span>
                                    <h2 style={{
                                        margin: 0,
                                        fontSize: "0.85rem",
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
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    {items.map(p => {
                                        const agotado = p.stock_total <= 0
                                        return (
                                            <div
                                                key={p.producto}
                                                style={{
                                                    display: "flex",
                                                    gap: 14,
                                                    padding: "14px 16px",
                                                    borderRadius: 14,
                                                    background: tema.bgCard,
                                                    border: `1px solid ${tema.border}`,
                                                    transition: "background 0.15s, border-color 0.15s",
                                                    opacity: agotado && config.mostrar_stock ? 0.55 : 1,
                                                    cursor: "default",
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = tema.bg }}
                                                onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard }}
                                            >
                                                {/* Foto pequeña (opcional) */}
                                                {p.imagen && p.imagen !== "No hay foto" && (
                                                    <div style={{
                                                        width: 52, height: 52,
                                                        borderRadius: 10,
                                                        overflow: "hidden",
                                                        flexShrink: 0,
                                                        background: tema.bg,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    }}>
                                                        <img
                                                            src={p.imagen.startsWith("http") ? p.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${p.imagen}`}
                                                            alt={p.producto}
                                                            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
                                                            loading="lazy"
                                                            onError={e => { e.currentTarget.style.display = "none" }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Info */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "flex-start",
                                                        gap: 12,
                                                    }}>
                                                        <h3 style={{
                                                            margin: 0,
                                                            fontSize: "0.95rem",
                                                            fontWeight: 700,
                                                            color: tema.text,
                                                            lineHeight: 1.3,
                                                        }}>
                                                            {p.producto}
                                                            {agotado && config.mostrar_stock && (
                                                                <span style={{
                                                                    fontSize: "0.62rem",
                                                                    fontWeight: 700,
                                                                    color: "#ef4444",
                                                                    marginLeft: 8,
                                                                }}>
                                                                    AGOTADO
                                                                </span>
                                                            )}
                                                        </h3>
                                                        {config.mostrar_precios && (
                                                            <span style={{
                                                                fontSize: "1rem",
                                                                fontWeight: 800,
                                                                color: tema.primaryDark,
                                                                whiteSpace: "nowrap",
                                                            }}>
                                                                ${p.precio_venta.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {p.descripcion && (
                                                        <p style={{
                                                            margin: "4px 0 0",
                                                            fontSize: "0.78rem",
                                                            color: tema.textMuted,
                                                            fontWeight: 500,
                                                            lineHeight: 1.4,
                                                        }}>
                                                            {p.descripcion}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </main>
    )
}
