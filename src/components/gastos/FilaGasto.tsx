// ==============================================================================
// src/components/gastos/FilaGasto.tsx
// Fila de movimientos con sus 3 estados (pendiente / pagado / descartado):
// edición inline (select categoría + descripción + monto) y acciones
// (confirmar pago, descartar, editar, eliminar). Incluye el helper estadoBadge.
// ==============================================================================

import type { Gasto } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import type { AccionesFilaGasto } from "./tipos"

interface Props extends AccionesFilaGasto {
    g: Gasto
}

function estadoBadge(estado?: string) {
    switch (estado) {
        case "pendiente":
            return { label: "Pendiente", bg: "#fef9c3", color: "#ca8a04" }
        case "descartado":
            return { label: "Descartado", bg: "#f3f4f6", color: "#6b7280" }
        default:
            return { label: "Pagado", bg: "#dcfce7", color: "#16a34a" }
    }
}

export default function FilaGasto({
    g,
    editandoId,
    editMonto,
    setEditMonto,
    editCategoria,
    setEditCategoria,
    editDescripcion,
    setEditDescripcion,
    categoriasGasto,
    onGuardarEdicion,
    onCancelarEdicion,
    onConfirmar,
    onIniciarEdicion,
    onSolicitarDescartar,
    onSolicitarEliminar,
}: Props) {
    const esPendiente = g.estado === "pendiente"
    const badge = estadoBadge(g.estado)
    return (
        <tr key={g.id} style={{
            borderBottom: "1px solid var(--bg-card)",
            background: esPendiente ? "var(--bg-warning)" : "transparent",
            borderLeft: esPendiente ? "3px solid #f59e0b" : "3px solid transparent",
            opacity: g.estado === "descartado" ? 0.5 : 1,
            transition: "background 0.15s",
        }} className={esPendiente ? "" : "hover:bg-primary-50/20"}>
            <td style={{ padding: "12px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {(g.fecha || '').split('T')[0].split('-').reverse().join('/') || '—'}
            </td>
            <td style={{ padding: "12px 14px" }}>
                {editandoId === g.id ? (
                    <select className="input-primary" style={{ padding: "4px 8px", fontSize: "0.75rem", fontWeight: 600 }}
                        value={editCategoria} onChange={e => setEditCategoria(e.target.value)}>
                        {categoriasGasto.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                ) : (
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "var(--bg-card2)", color: "var(--primary-text)", padding: "3px 8px", borderRadius: 12 }}>
                        {g.categoria}
                    </span>
                )}
            </td>
            <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                {editandoId === g.id ? (
                    <input type="text" className="input-primary" style={{ padding: "4px 8px", fontSize: "0.85rem", fontWeight: 600, minWidth: 120 }}
                        value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} />
                ) : g.descripcion}
            </td>
            <td style={{ padding: "12px 14px", fontWeight: 800, color: esPendiente ? "#d97706" : "#b71c1c" }}>
                {editandoId === g.id ? (
                    <input type="number" step="0.01" min="0.01" className="input-primary" style={{ width: 100, padding: "4px 8px", fontSize: "0.85rem", fontWeight: 700 }}
                        value={editMonto} onChange={e => setEditMonto(e.target.value)} />
                ) : `-$${g.monto.toFixed(2)}`}
            </td>
            <td style={{ padding: "12px 14px" }}>
                <span style={{
                    fontSize: "0.7rem", fontWeight: 700,
                    background: badge.bg, color: badge.color,
                    padding: "3px 8px", borderRadius: 12,
                    display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                    {esPendiente && <Icon name="Timer" size={12} />}
                    {badge.label}
                </span>
            </td>
            <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                {editandoId === g.id ? (
                    <span style={{ display: "inline-flex", gap: 4 }}>
                        <button onClick={() => onGuardarEdicion(g.id)} title="Guardar cambios"
                            style={{ background: "var(--bg-success)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#16a34a", display: "inline-flex", alignItems: "center" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#bbf7d0"; e.currentTarget.style.color = "#15803d" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-success)"; e.currentTarget.style.color = "#16a34a" }}>
                            <Icon name="Check" size={16} />
                        </button>
                        <button onClick={onCancelarEdicion} title="Cancelar"
                            style={{ background: "transparent", border: "1.5px solid var(--border-primary)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.borderColor = "#fca5a5"; e.currentTarget.style.color = "#b91c1c" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-primary)"; e.currentTarget.style.color = "var(--text-muted)" }}>
                            <Icon name="X" size={16} />
                        </button>
                    </span>
                ) : esPendiente ? (
                    <span style={{ display: "inline-flex", gap: 4 }}>
                        <button onClick={() => onConfirmar(g.id)} title="Confirmar pago"
                            style={{ background: "var(--bg-success)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#16a34a", display: "inline-flex", alignItems: "center" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#bbf7d0"; e.currentTarget.style.color = "#15803d" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-success)"; e.currentTarget.style.color = "#16a34a" }}>
                            <Icon name="Check" size={16} />
                        </button>
                        <button onClick={() => onSolicitarDescartar(g.id)} title="Descartar gasto"
                            style={{ background: "transparent", border: "1.5px solid var(--border-primary)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#9ca3af" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-primary)" }}>
                            <Icon name="X" size={16} />
                        </button>
                    </span>
                ) : (
                    <span style={{ display: "inline-flex", gap: 20, alignItems: "center" }}>
                        <button onClick={() => onIniciarEdicion(g)} title="Editar gasto"
                            style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.35, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRadius: 8, minWidth: 32, minHeight: 32, transition: "opacity 0.15s, background 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.background = "var(--bg-card2)" }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = "0.35"; e.currentTarget.style.background = "transparent" }}>
                            <Icon name="Pencil" size={16} />
                        </button>
                        <button onClick={() => onSolicitarEliminar(g.id)} title="Eliminar gasto"
                            style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.3, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRadius: 8, minWidth: 32, minHeight: 32, transition: "opacity 0.15s, background 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.background = "var(--bg-card2)" }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = "0.3"; e.currentTarget.style.background = "transparent" }}>
                            <Icon name="Trash2" size={16} />
                        </button>
                    </span>
                )}
            </td>
        </tr>
    )
}
