// ==============================================================================
// src/components/estadisticas/FilaVenta.tsx
// Fila del historial de ventas con sus 3 modos: ver / editando (recálculo en
// vivo de ganancia_bruta desde cantidad, costo total y precio total) / acciones.
// ==============================================================================

import type { Dispatch, SetStateAction } from "react"
import type { Venta } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import Pill from "@/components/ui/Pill"
import type { EditVenta } from "@/hooks/useEstadisticasUI"

interface Props {
    v: Venta
    editando: number | null
    setEditando: Dispatch<SetStateAction<number | null>>
    editVal: EditVenta
    setEditVal: Dispatch<SetStateAction<EditVenta>>
    guardando: boolean
    guardarEdicion: () => void
    setConfirmAnularVentaId: Dispatch<SetStateAction<number | null>>
}

export default function FilaVenta({ v, editando, setEditando, editVal, setEditVal, guardando, guardarEdicion, setConfirmAnularVentaId }: Props) {
    return (
        <tr key={v.n_ticket} style={{ borderBottom: "1px solid var(--border-light)", opacity: v.estado === "Inactivo" ? 0.6 : 1, textDecoration: v.estado === "Inactivo" ? "line-through" : "none" }} className="hover:bg-primary-50/30">
            <td style={{ padding: "12px 16px", fontWeight: 600 }}>#{v.n_ticket || v.id}</td>
            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                {editando === v.id ? (
                    <input type="date" value={editVal.fecha.substring(0, 10)} onChange={e => setEditVal(p => ({ ...p, fecha: e.target.value + "T12:00:00.000Z" }))} className="input-primary" style={{ width: 120, padding: 4, background: "var(--bg-card2)" }} />
                ) : new Date(v.fecha).toLocaleDateString()}
            </td>
            <td style={{ padding: "12px 16px" }}>
                {editando === v.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="number" min="1" value={editVal.cantidad} onChange={e => {
                            const cant = +e.target.value;
                            setEditVal(p => ({
                                ...p,
                                cantidad: cant,
                                total_venta: cant * p.precio_real,
                                ganancia_bruta: (p.precio_real - p.costo_unitario) * cant
                            }))
                        }} className="input-primary" style={{ width: 60, padding: 4, background: "var(--bg-card2)" }} />
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>x {v.producto}</span>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        <Pill color="gray">{v.cantidad}x {v.producto}</Pill>
                    </div>
                )}
            </td>
            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary-dark)" }}>
                {editando === v.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>COSTO TOTAL</span>
                        <input type="number" step="0.01" value={(editVal.costo_unitario * editVal.cantidad) || 0} onChange={e => {
                            const nuevoCostoTotal = +e.target.value;
                            setEditVal(p => ({
                                ...p,
                                costo_unitario: p.cantidad > 0 ? nuevoCostoTotal / p.cantidad : 0,
                                ganancia_bruta: p.total_venta - nuevoCostoTotal
                            }))
                        }} className="input-primary" style={{ width: 80, padding: 4, background: "var(--bg-card2)" }} />
                    </div>
                ) : `$${((v.total_venta || 0) - (v.ganancia_bruta || 0)).toFixed(2)}`}
            </td>
            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary-dark)" }}>
                {editando === v.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>PRECIO TOTAL</span>
                        <input type="number" step="0.01" value={editVal.total_venta} onChange={e => {
                            const nuevoPrecioTotal = +e.target.value;
                            setEditVal(p => ({
                                ...p,
                                precio_real: p.cantidad > 0 ? nuevoPrecioTotal / p.cantidad : 0,
                                total_venta: nuevoPrecioTotal,
                                ganancia_bruta: nuevoPrecioTotal - (p.costo_unitario * p.cantidad)
                            }))
                        }} className="input-primary" style={{ width: 80, padding: 4, background: "var(--bg-card2)" }} />
                    </div>
                ) : `$${(v.total_venta || 0).toFixed(2)}`}
            </td>
            <td style={{ padding: "12px 16px" }}>
                {editando === v.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>GANANCIA</span>
                        <input type="number" step="0.01" value={editVal.ganancia_bruta} disabled className="input-primary" style={{ width: 80, padding: 4 }} />
                    </div>
                ) : <Pill color="green">${(v.ganancia_bruta || 0).toFixed(2)}</Pill>}
            </td>
            <td style={{ padding: "12px 16px" }}>
                {v.estado === "Inactivo" ? (
                    <Pill color="red">Anulada</Pill>
                ) : editando === v.id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={guardarEdicion} disabled={guardando} style={{ color: guardando ? "#999" : "#2e7d32", background: "none", border: "none", fontWeight: 800, cursor: guardando ? "not-allowed" : "pointer" }}>
                            {guardando ?
                                (<Icon name="Hourglass" size={16} color="var(--primary-dark)" />)
                                :
                                (<Icon name="Save" size={16} color="var(--primary-dark)" />)
                            }
                        </button>
                        <button onClick={() => setEditando(null)} style={{ color: "#b71c1c", background: "none", border: "none", fontWeight: 800, cursor: "pointer" }}><Icon name="X" size={16} color="var(--primary-dark)" /></button>
                    </div>
                ) : (
                    <div style={{ display: "flex", gap: 12 }}>
                        <button onClick={() => { setEditando(v.id); setEditVal({ fecha: v.fecha, cantidad: v.cantidad, precio_real: v.precio_real, total_venta: v.total_venta, ganancia_bruta: v.ganancia_bruta, costo_unitario: v.costo_unitario }) }} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>
                            <Icon name="Pencil" size={16} color="var(--primary-dark)" />
                        </button>
                        <button onClick={() => setConfirmAnularVentaId(v.id)} disabled={guardando} style={{ color: guardando ? "#eee" : "#ffcdd2", background: "none", border: "none", cursor: guardando ? "not-allowed" : "pointer", fontSize: "0.9rem" }}>
                            <Icon name="Trash2" size={16} color="var(--primary-dark)" />
                        </button>
                    </div>
                )}
            </td>
        </tr>
    )
}
