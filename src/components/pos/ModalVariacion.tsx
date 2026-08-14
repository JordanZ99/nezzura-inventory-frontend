// ==============================================================================
// src/components/pos/ModalVariacion.tsx
// Modal de selección de variación: se abre al agregar un producto con
// presentaciones (cada una con su precio propio). Las agotadas NO bloquean:
// el vendedor puede añadirlas y la advertencia de stock aparece al cobrar.
// ==============================================================================

import type { Producto } from "@/lib/api"

interface Props {
    prod: Producto
    onSeleccionar: (prod: Producto, nombre: string, precio: number) => void
    onCancelar: () => void
}

export function ModalVariacion({ prod, onSeleccionar, onCancelar }: Props) {
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
        }}>
            <div className="fade-up" style={{
                background: "var(--bg-card)",
                borderRadius: 20,
                padding: "28px 24px 24px",
                maxWidth: 400,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                border: "1px solid var(--border-primary)",
            }}>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                    {prod.producto}
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Elige la variación (cada una tiene su propio precio):
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(prod.variaciones || []).map(v => {
                        const stockPorVar = !!prod?.stock_por_variacion
                        const agotada = stockPorVar && (v.stock ?? 0) <= 0
                        return (
                            <button
                                key={v.id}
                                // Agotada NO bloquea: el vendedor puede añadirla igual (ej.
                                // cuando el conteo físico no cuadra y quiere vender ya). Al
                                // cobrar, la advertencia de stock insuficiente pide confirmar
                                // y el backend descuenta a negativo, igual que los normales.
                                onClick={() => onSeleccionar(prod, v.nombre, v.precio)}
                                style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    border: "1px solid var(--border-primary)",
                                    background: agotada ? "var(--bg-card)" : "var(--bg-card2)",
                                    color: "var(--text-main)",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: "0.9rem",
                                    transition: "background 0.15s, transform 0.15s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card3)"; e.currentTarget.style.transform = "translateY(-1px)" }}
                                onMouseLeave={e => { e.currentTarget.style.background = agotada ? "var(--bg-card)" : "var(--bg-card2)"; e.currentTarget.style.transform = "none" }}
                            >
                                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {v.nombre}
                                    {stockPorVar && !agotada && (
                                        <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)" }}>{v.stock} uds</span>
                                    )}
                                    {stockPorVar && agotada && (
                                        <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#ad4955ff", border: "1px solid #ad4955ff", borderRadius: 6, padding: "1px 6px" }}>Agotado</span>
                                    )}
                                </span>
                                <span style={{ color: "var(--primary-dark)", fontWeight: 800 }}>${v.precio.toFixed(2)}</span>
                            </button>
                        )
                    })}
                </div>
                <button
                    className="btn-ghost"
                    onClick={onCancelar}
                    style={{ marginTop: 14, width: "100%" }}
                >
                    Cancelar
                </button>
            </div>
        </div>
    )
}
