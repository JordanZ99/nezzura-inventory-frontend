import { useState } from "react"
import Icon from "@/components/ui/Icon"
import type { Producto } from "@/lib/api"

/**
 * Alta de ingredientes del compuesto (crear producto): buscador de productos
 * de stock + cantidad (permite fracciones: 0.5, 150, 0.25...).
 * Se persisten en la MISMA transacción que el producto (crear_producto_completo).
 */
export default function AltaMateriales({ inv, lista, disabled = false, onAgregar, onQuitar }: {
    inv: Producto[]
    lista: { material: string; cantidad: number }[]
    disabled?: boolean
    onAgregar: (material: string, cantidad: number) => void
    onQuitar: (i: number) => void
}) {
    const [buscador, setBuscador] = useState("")
    const [seleccionado, setSeleccionado] = useState("")
    const [cantidad, setCantidad] = useState("")
    const q = buscador.trim().toLowerCase()
    const sugerencias = q ? inv.filter(p => p.tipo_producto === "stock" && p.producto.toLowerCase().includes(q)).slice(0, 6) : []
    const puede = seleccionado !== "" && cantidad !== "" && Number(cantidad) > 0

    const agregar = () => {
        if (!puede) return
        onAgregar(seleccionado, Number(cantidad))
        setBuscador(""); setSeleccionado(""); setCantidad("")
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Añadir ingredientes (receta)
            </label>
            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
                Al vender 1 unidad de este compuesto se descuenta la cantidad indicada de cada material (se permiten fracciones: 0.5, 150, 0.25...).
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 4 }}>
                    <input
                        className="input-primary"
                        placeholder="Buscar producto de stock..."
                        value={buscador}
                        disabled={disabled}
                        onChange={e => { setBuscador(e.target.value); setSeleccionado("") }}
                    />
                    {sugerencias.length > 0 && buscador.trim() && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {sugerencias.map(s => (
                                <button
                                    key={s.producto}
                                    type="button"
                                    onClick={() => { setSeleccionado(s.producto); setBuscador(s.producto) }}
                                    style={{
                                        background: s.producto === seleccionado ? "var(--primary-mid)" : "var(--bg-card2)",
                                        color: s.producto === seleccionado ? "#fff" : "var(--text-main)",
                                        border: "none", borderRadius: 10, padding: "5px 10px",
                                        fontSize: "0.7rem", fontWeight: 700, cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 4,
                                    }}
                                >
                                    {s.producto === seleccionado && <Icon name="Check" size={12} />} {s.producto}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    className="input-primary"
                    style={{ width: 90 }}
                    type="number" min="0" step="any"
                    placeholder="Cant."
                    value={cantidad}
                    disabled={disabled}
                    onChange={e => setCantidad(e.target.value)}
                />
                <button
                    onClick={agregar}
                    disabled={disabled || !puede}
                    style={{
                        background: !disabled && puede ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: !disabled && puede ? "#fff" : "var(--text-muted)",
                        border: "none", borderRadius: 10, padding: "8px 14px",
                        fontWeight: 700, fontSize: "0.75rem", cursor: !disabled && puede ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                    }}
                >
                    <Icon name="Plus" size={14} /> Añadir
                </button>
            </div>
            {lista.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {lista.map((m, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card2)", borderRadius: 10, padding: "6px 10px" }}>
                            <span style={{ flex: 1, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>{m.material}</span>
                            <span style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--text-muted)" }}>×{m.cantidad}</span>
                            <button onClick={() => onQuitar(i)} title="Quitar" style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", padding: 4 }}>
                                <Icon name="Trash" size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
