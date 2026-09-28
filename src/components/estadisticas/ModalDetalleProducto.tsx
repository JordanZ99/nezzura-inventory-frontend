// ==============================================================================
// src/components/estadisticas/ModalDetalleProducto.tsx
// Modal de detalle de producto: galería de fotos con flechas/contador/descarga,
// métricas principales, códigos y tabla de ventas del producto. El bloque más
// grande del módulo — extraído a su propio archivo.
// ==============================================================================

import type { Dispatch, SetStateAction } from "react"
import type { Producto, Venta } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import Pill from "@/components/ui/Pill"

interface Props {
    prod: Producto | null
    fotosModal: { url: string; orden: number }[]
    indiceFoto: number
    setIndiceFoto: Dispatch<SetStateAction<number>>
    ventas: Venta[]
    getVentasProducto: (prod: Producto) => { totalVentas: number; totalVendido: number; totalGanancia: number; totalUnidades: number }
    descargarImagen: (url: string, nombre: string) => void
    onClose: () => void
}

export default function ModalDetalleProducto({ prod, fotosModal, indiceFoto, setIndiceFoto, ventas, getVentasProducto, descargarImagen, onClose }: Props) {
    if (!prod) return null
    const stats = getVentasProducto(prod)
    const costoProm = prod.costo_promedio ?? 0
    const precioVenta = prod.precio_venta ?? 0
    const margen = precioVenta > 0 ? ((precioVenta - costoProm) / precioVenta) * 100 : 0
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            padding: 24
        }} onClick={onClose}>
            <div
                className="fade-up"
                onClick={e => e.stopPropagation()}
                style={{
                    background: "var(--bg-card)",
                    borderRadius: 20,
                    maxWidth: 500,
                    width: "100%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-primary)",
                }}
            >
                {/* Header con foto */}
                <div style={{
                    position: "relative",
                    height: 200,
                    background: "var(--gradient-bg-login)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: "20px 20px 0 0"
                }}>
                    {fotosModal.length > 0 ? (
                        <>
                            <img
                                src={fotosModal[indiceFoto].url.startsWith("http") ? fotosModal[indiceFoto].url : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${fotosModal[indiceFoto].url}`}
                                alt={prod.producto}
                                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: 16 }}
                            />
                            {/* Flecha izquierda */}
                            {indiceFoto > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIndiceFoto(i => i - 1) }}
                                    style={{
                                        position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                                        width: 32, height: 32, borderRadius: "50%",
                                        background: "rgba(0,0,0,0.5)", border: "none",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", backdropFilter: "blur(4px)",
                                        transition: "all 0.15s"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.5)" }}
                                >
                                    <Icon name="ChevronLeft" size={18} color="#fff" />
                                </button>
                            )}
                            {/* Flecha derecha */}
                            {indiceFoto < fotosModal.length - 1 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIndiceFoto(i => i + 1) }}
                                    style={{
                                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                        width: 32, height: 32, borderRadius: "50%",
                                        background: "rgba(0,0,0,0.5)", border: "none",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", backdropFilter: "blur(4px)",
                                        transition: "all 0.15s"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.5)" }}
                                >
                                    <Icon name="ChevronRight" size={18} color="#fff" />
                                </button>
                            )}
                            {/* Contador */}
                            {fotosModal.length > 1 && (
                                <div style={{
                                    position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
                                    background: "rgba(0,0,0,0.5)", borderRadius: 10,
                                    padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700,
                                    color: "#fff", backdropFilter: "blur(4px)"
                                }}>
                                    {indiceFoto + 1} / {fotosModal.length}
                                </div>
                            )}
                        </>
                    ) : (
                        <Icon name="Package" size={64} color="var(--text-muted)" />
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            if (fotosModal.length > 0) {
                                descargarImagen(fotosModal[indiceFoto].url, prod.producto)
                            } else if (prod.imagen && prod.imagen !== "No hay foto") {
                                descargarImagen(prod.imagen, prod.producto)
                            }
                        }}
                        title="Descargar imagen"
                        style={{
                            position: "absolute", top: 12, left: 12,
                            width: 32, height: 32,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.4)",
                            border: "none",
                            color: "#fff",
                            fontSize: "1.1rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backdropFilter: "blur(4px)"
                        }}
                    >
                        <Icon name="Download" size={15} color="#fff" />
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            position: "absolute", top: 12, right: 12,
                            width: 32, height: 32,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.4)",
                            border: "none",
                            color: "#fff",
                            fontSize: "1.1rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backdropFilter: "blur(4px)"
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Nombre y categorías */}
                    <div>
                        <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)" }}>
                            {prod.producto}
                        </h2>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(prod.categoria || ["General"]).map(c => (
                                <span key={c} style={{
                                    fontSize: "0.65rem", fontWeight: 700,
                                    background: "var(--primary-bg)",
                                    color: "var(--primary-main)",
                                    borderRadius: 8, padding: "2px 8px"
                                }}>{c}</span>
                            ))}
                        </div>
                    </div>

                    {prod.descripcion && (
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--primary-dark)", lineHeight: 1.5 }}>
                            {prod.descripcion}
                        </p>
                    )}

                    {/* Métricas principales */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                            <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Costo promedio</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: "var(--text-main)" }}>${costoProm.toFixed(2)}</p>
                        </div>
                        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                            <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Precio venta</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: "var(--text-main)" }}>${precioVenta.toFixed(2)}</p>
                        </div>
                        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                            <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Stock Actual</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: prod.stock_total <= 0 ? "#b71c1c" : "var(--text-main)" }}>{prod.stock_total}</p>
                        </div>
                        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                            <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Margen</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: margen > 0 ? "#2e7d32" : "#b71c1c" }}>{margen.toFixed(1)}%</p>
                        </div>
                    </div>

                    {/* Códigos */}
                    {(prod.codigo_interno || prod.codigo_barras || prod.ubicacion) && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                            {prod.codigo_interno && (
                                <div>
                                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Código interno</p>
                                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>{prod.codigo_interno}</p>
                                </div>
                            )}
                            {prod.codigo_barras && (
                                <div>
                                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Código barras</p>
                                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>{prod.codigo_barras}</p>
                                </div>
                            )}
                            {prod.ubicacion && (
                                <div>
                                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Ubicación</p>
                                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>{prod.ubicacion}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Separador */}
                    <div style={{ height: 1, background: "var(--border-light)", margin: "4px 0" }} />

                    {/* Estadísticas de ventas */}
                    <div>
                        <h3 style={{ margin: "0 0 12px", fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                            <Icon name="TrendingUp" size={18} color="var(--primary-mid)" />
                            Rendimiento de Ventas
                        </h3>
                        {stats.totalVentas > 0 ? (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                                    <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, borderLeft: "3px solid var(--primary-mid)" }}>
                                        <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Unidades vendidas</p>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{stats.totalUnidades}</p>
                                    </div>
                                    <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, borderLeft: "3px solid rgb(var(--chart-1))" }}>
                                        <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Total vendido</p>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>${stats.totalVendido.toFixed(2)}</p>
                                    </div>
                                    <div style={{ padding: "12px 16px", background: stats.totalGanancia >= 0 ? "var(--success-bg)" : "var(--error-bg)", borderRadius: 12, borderLeft: `3px solid ${stats.totalGanancia >= 0 ? "var(--success-main)" : "var(--error-main)"}` }}>
                                        <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Ganancia total</p>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: stats.totalGanancia >= 0 ? "var(--success-text)" : "var(--error-text)" }}>${stats.totalGanancia.toFixed(2)}</p>
                                    </div>
                                </div>
                                {/* Tabla de ventas del producto */}
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                                        <thead>
                                            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                                {["Ticket", "Fecha", "Cant.", "Costo", "Total", "Ganancia"].map(h => (
                                                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ventas
                                                .filter(v => v.producto === prod.producto && v.estado !== "Inactivo")
                                                .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                                                .map(v => (
                                                    <tr key={v.n_ticket} style={{ borderBottom: "1px solid var(--border-light)" }}
                                                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card2)"}
                                                        onMouseLeave={e => e.currentTarget.style.background = ""}>
                                                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>#{v.n_ticket || v.id}</td>
                                                        <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{new Date(v.fecha).toLocaleDateString()}</td>
                                                        <td style={{ padding: "6px 10px" }}>{v.cantidad}</td>
                                                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>${(v.costo_unitario || 0).toFixed(2)}</td>
                                                        <td style={{ padding: "6px 10px", fontWeight: 700, color: "var(--primary-dark)" }}>${(v.total_venta || 0).toFixed(2)}</td>
                                                        <td style={{ padding: "6px 10px" }}><Pill color={v.ganancia_bruta >= 0 ? "green" : "red"}>${(v.ganancia_bruta || 0).toFixed(2)}</Pill></td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: "center", padding: "24px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                                <Icon name="ShoppingBag" size={32} color="var(--text-muted)" />
                                <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    Este producto no tiene ventas registradas en el período seleccionado.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
