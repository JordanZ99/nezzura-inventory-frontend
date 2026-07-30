"use client"
// ==============================================================================
// src/components/CatalogoGridClasico.tsx
// Template Grid Clásico — tarjetas con imagen, nombre, precio y categoría.
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
}

export default function CatalogoGridClasico({ productos, config, tema }: Props) {
    return (
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 60px" }}>
            {productos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: tema.textMuted }}>
                    <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>No se encontraron productos.</p>
                </div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 20,
                }}>
                    {productos.map(p => {
                        const agotado = p.stock_total <= 0
                        return (
                            <div
                                key={p.producto}
                                style={{
                                    background: tema.bgCard,
                                    borderRadius: 16,
                                    overflow: "hidden",
                                    border: `1px solid ${tema.border}`,
                                    transition: "transform 0.2s, box-shadow 0.2s",
                                    display: "flex", flexDirection: "column",
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
                                            src={p.imagen.startsWith("http") ? p.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${p.imagen}`}
                                            alt={p.producto}
                                            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12, borderRadius: 12 }}
                                            loading="lazy"
                                            onError={e => { e.currentTarget.style.display = "none" }}
                                        />
                                    ) : (
                                        <div style={{ opacity: 0.2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Icon name="Package" size={40} color="var(--text-muted)" />
                                        </div>
                                    )}
                                    {/* Badge de stock */}
                                    {config.mostrar_stock && agotado && (
                                        <span style={{
                                            position: "absolute", top: 10, right: 10,
                                            background: "rgba(239,68,68,0.95)", color: "#fff",
                                            fontSize: "0.7rem", fontWeight: 800,
                                            padding: "4px 10px", borderRadius: 12,
                                        }}>
                                            Agotado
                                        </span>
                                    )}
                                    {config.mostrar_stock && !agotado && p.stock_total <= 5 && (
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
                                    {/* Categoría */}
                                    {config.mostrar_categorias && (p.categoria || []).length > 0 && (
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
                                            }}>
                                                ${p.precio_venta.toFixed(2)}
                                            </span>
                                        ) : (
                                            <span />
                                        )}
                                        {config.mostrar_stock && !agotado && (
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
                    })}
                </div>
            )}
        </main>
    )
}
