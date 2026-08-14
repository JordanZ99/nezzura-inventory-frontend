import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import type { Lote, Producto } from "@/lib/api"
import type { FormRestock as FormRestockType } from "@/hooks/useInventarioForm"
import Input from "./Input"

interface Props {
    producto: Producto
    restock: FormRestockType
    setRestock: Dispatch<SetStateAction<FormRestockType>>
    guardarRestock: () => Promise<void>
    guardando: boolean
    lotes: Lote[]
    onVolver: () => void
}

/** Formulario de restock del producto seleccionado + tarjeta de sus lotes. */
export default function FormRestock({ producto, restock, setRestock, guardarRestock, guardando, lotes, onVolver }: Props) {
    return (
        <>
        <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <button
                    onClick={onVolver}
                    style={{ background: "var(--bg-card2)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}
                >
                    <Icon name="ArrowLeft" size={18} color="var(--text-main)" /> Volver
                </button>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                    Añadir stock a: <strong style={{ color: "var(--text-main)" }}>{producto.producto}</strong>
                </span>
            </div>

            {/* Resumen del producto */}
            <div style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: "var(--bg-card2)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8
            }}>
                <div>
                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Stock actual</p>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>{producto.stock_total}</p>
                </div>
                <div>
                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Precio venta</p>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)" }}>${producto.precio_venta.toFixed(2)}</p>
                </div>
                <div>
                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Costo promedio</p>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>${(producto.costo_promedio ?? 0).toFixed(2)}</p>
                </div>
                <div>
                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Margen</p>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: producto.precio_venta > (producto.costo_promedio ?? 0) ? "#2e7d32" : "#b71c1c" }}>
                        {producto.precio_venta > 0
                            ? `${(((producto.precio_venta - (producto.costo_promedio ?? 0)) / producto.precio_venta) * 100).toFixed(1)}%`
                            : "—"}
                    </p>
                </div>
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                Costo y precio prellenados según el producto. Ajústalos si este nuevo lote tiene valores diferentes.
            </p>
            {producto.stock_por_variacion && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                        ¿A qué variación llegó el stock? *
                    </label>
                    <select
                        className="input-primary"
                        value={restock.variacion}
                        onChange={e => setRestock(r => ({ ...r, variacion: e.target.value }))}
                        style={{ width: "100%" }}
                    >
                        <option value="">Selecciona la variación...</option>
                        {(producto.variaciones || []).map(v => (
                            <option key={v.id} value={v.nombre}>{v.nombre}</option>
                        ))}
                    </select>
                </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Input label="Cantidad" type="number" min={0} step="0.1" placeholder="1" value={restock.stock} onChange={e => setRestock(r => ({ ...r, stock: e.target.value === "" ? "" : Number(e.target.value) }))} />
                <Input label="Costo" type="number" min={0} step="0.01" placeholder="0.00" value={restock.costo} onChange={e => setRestock(r => ({ ...r, costo: e.target.value === "" ? "" : Number(e.target.value) }))} />
                <Input label="Precio" type="number" min={0} step="0.01" placeholder="0.00" value={restock.precio_venta} onChange={e => setRestock(r => ({ ...r, precio_venta: e.target.value === "" ? "" : Number(e.target.value) }))} />
            </div>
            <Input label="Etiqueta del lote (opcional)" placeholder="Ej: 20cm, Premium, Oferta" value={restock.etiqueta} onChange={e => setRestock(r => ({ ...r, etiqueta: e.target.value }))} />
            <button className="btn-primary" onClick={guardarRestock} disabled={guardando || !restock.producto || !restock.stock || Number(restock.stock) <= 0 || (!!producto.stock_por_variacion && !restock.variacion)}>
                {guardando ? "Procesando..." : "Añadir Stock"}
            </button>
        </div>

        {/* ── Lotes del producto (para saber a cuáles les falta) ── */}
        <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {(() => {
                const lotesProducto = lotes.filter(l => l.producto === producto.producto)
                // Stock activo por variación (para marcar las que quedan sin inventario)
                const stockPorVar: Record<string, number> = {}
                lotesProducto.filter(l => l.estado === "Activo").forEach(l => {
                    if (l.variacion) stockPorVar[l.variacion] = (stockPorVar[l.variacion] || 0) + l.stock_lote
                })
                const faltanStock = (producto.variaciones || [])
                    .filter(v => !((stockPorVar[v.nombre] || 0) > 0))
                    .map(v => v.nombre)
                return (
                    <>
                        <h2 style={{ margin: "0 0 2px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                            <Icon name="Package" size={20} color="var(--primary-mid)" />
                            Lotes de {producto.producto}
                            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "auto" }}>
                                {lotesProducto.length} lote(s)
                            </span>
                        </h2>
                        {lotesProducto.length === 0 ? (
                            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                                No hay lotes registrados para este producto todavía.
                            </p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {lotesProducto.map(lote => {
                                    const sinStock = lote.stock_lote <= 0
                                    const inactivo = lote.estado !== "Activo"
                                    return (
                                        <div key={lote.id_lote} style={{
                                            display: "flex", alignItems: "center", gap: 10,
                                            padding: "10px 12px", borderRadius: 12,
                                            background: "var(--bg-card2)",
                                            opacity: inactivo ? 0.55 : 1,
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                    <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)" }}>
                                                        {lote.variacion || "Base"}
                                                    </span>
                                                    {inactivo && (
                                                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)", background: "var(--bg-card)", borderRadius: 6, padding: "2px 6px" }}>
                                                            Inactivo
                                                        </span>
                                                    )}
                                                    {lote.etiqueta && (
                                                        <span style={{ fontSize: "0.66rem", fontWeight: 600, color: "var(--text-muted)" }}>{lote.etiqueta}</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginTop: 2 }}>
                                                    #{lote.id_lote} · ${lote.precio_venta.toFixed(2)}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: "0.75rem", fontWeight: 800, whiteSpace: "nowrap",
                                                color: sinStock ? "#b71c1c" : "#2e7d32",
                                                background: sinStock ? "#ffeef0" : "#e8f5e9",
                                                borderRadius: 10, padding: "4px 10px",
                                            }}>
                                                {sinStock ? "Sin stock" : `${lote.stock_lote} uds`}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {faltanStock.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)" }}>
                                <Icon name="TriangleAlert" size={14} color="#b71c1c" />
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#b71c1c" }}>
                                    Falta stock en: {faltanStock.join(", ")}
                                </span>
                            </div>
                        )}
                    </>
                )
            })()}
        </div>
        </>
    )
}
