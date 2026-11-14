"use client"
// ==============================================================================
// src/components/ordenes/ListaOrdenes.tsx
// Lista de órdenes de servicio (mig 077): card por orden con estado cambiable
// inline (select), precio informativo, detalle plegable y acciones (editar,
// cobrar, eliminar). El dinero nunca se calcula aquí: llega derivado.
// ==============================================================================

import { useState } from "react"
import Icon from "@/components/ui/Icon"
import { useAccionesOrdenes } from "@/hooks/useOrdenes"
import { ESTADOS_ORDEN, TIPOS_ORDEN, type EstadoOrden, type OrdenServicio } from "@/types"

interface Props {
    ordenes: OrdenServicio[]
    cargando: boolean
    onEditar: (o: OrdenServicio) => void
    onCobrar: (o: OrdenServicio) => void
    onEliminar: (o: OrdenServicio) => void
    mostrarMsg: (ok: boolean, texto: string) => void
}

const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

/** '2026-11-15' → '15 nov' */
function fechaCorta(v: string | null): string {
    if (!v) return "—"
    const [a, m, d] = v.slice(0, 10).split("-").map(Number)
    if (!a || !m || !d) return v
    const mes = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]
    return `${d} ${mes}`
}

const COLOR_ESTADO: Record<EstadoOrden, { bg: string; color: string }> = {
    recibido: { bg: "rgba(3,105,161,0.12)", color: "#0369a1" },
    en_proceso: { bg: "rgba(180,83,9,0.14)", color: "#b45309" },
    esperando: { bg: "rgba(124,58,237,0.12)", color: "#7c3aed" },
    listo: { bg: "rgba(46,125,50,0.14)", color: "#2e7d32" },
    entregado: { bg: "rgba(120,120,120,0.15)", color: "#6b7280" },
    cancelado: { bg: "rgba(198,40,40,0.12)", color: "#c62828" },
}

const ORDEN_COLS: Record<EstadoOrden, string> = {
    recibido: "var(--primary-mid)",
    en_proceso: "#b45309",
    esperando: "#7c3aed",
    listo: "#2e7d32",
    entregado: "#9e9e9e",
    cancelado: "#c62828",
}

export default function ListaOrdenes({ ordenes, cargando, onEditar, onCobrar, onEliminar, mostrarMsg }: Props) {
    const { actualizar } = useAccionesOrdenes()
    const [expandido, setExpandido] = useState<string | null>(null)
    const [cambiando, setCambiando] = useState<string | null>(null)

    if (cargando) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>
                Cargando órdenes...
            </div>
        )
    }
    if (ordenes.length === 0) {
        return (
            <div style={{
                padding: "40px 20px", textAlign: "center", borderRadius: 16,
                background: "var(--bg-card)", color: "var(--text-muted)", fontWeight: 600,
            }}>
                <Icon name="Wrench" size={34} color="var(--primary-light)" />
                <p style={{ margin: "10px 0 0", fontSize: "0.9rem" }}>
                    Sin órdenes todavía. Registra lo que sales a hacer (reparación, instalación, lo que sea) para dejar historia.
                </p>
            </div>
        )
    }

    async function cambiarEstado(orden: OrdenServicio, estado: EstadoOrden) {
        if (estado === orden.estado) return
        try {
            setCambiando(orden.id)
            await actualizar({ id: orden.id, data: { estado } })
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al cambiar el estado")
        } finally {
            setCambiando(null)
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ordenes.map(o => {
                const abierta = !(o.estado === "entregado" || o.estado === "cancelado")
                const est = COLOR_ESTADO[o.estado]
                const expandida = expandido === o.id
                return (
                    <div key={o.id} style={{
                        borderRadius: 14, background: "var(--bg-card)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                        border: `1px solid ${abierta ? "var(--border-light)" : "var(--border-light)"}`,
                        borderLeft: `3px solid ${ORDEN_COLS[o.estado]}`,
                        padding: "14px 16px", opacity: abierta ? 1 : 0.7,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "0.92rem", color: "var(--text-main)" }}>
                                    {o.titulo}
                                </p>
                                <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    {o.cliente_nombre || "Sin cliente"}
                                    <span style={{
                                        marginLeft: 8, padding: "1px 8px", borderRadius: 20,
                                        background: "var(--bg-card2)", fontSize: "0.65rem", letterSpacing: 0.5,
                                    }}>
                                        {TIPOS_ORDEN[o.tipo]}
                                    </span>
                                    <span style={{ marginLeft: 6 }}>· recibida {fechaCorta(o.fecha_recibido)}</span>
                                    {o.estado === "entregado" && o.fecha_entregado ? ` · entregada ${fechaCorta(o.fecha_entregado)}` : ""}
                                </p>
                                {o.equipo && (
                                    <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        {o.equipo}
                                    </p>
                                )}
                            </div>

                            <select
                                value={o.estado}
                                disabled={cambiando === o.id}
                                onChange={e => cambiarEstado(o, e.target.value as EstadoOrden)}
                                title="Cambiar estado"
                                style={{
                                    padding: "6px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                                    background: est.bg, color: est.color,
                                    fontSize: "0.72rem", fontWeight: 800, letterSpacing: 0.3,
                                }}
                            >
                                {(Object.keys(ESTADOS_ORDEN) as EstadoOrden[]).map(e => (
                                    <option key={e} value={e}>{ESTADOS_ORDEN[e]}</option>
                                ))}
                            </select>

                            {o.precio != null && Number(o.precio) > 0 && (
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "0.85rem", color: "var(--text-main)" }}>
                                    {fmt(Number(o.precio))}
                                </p>
                            )}

                            {o.cobro_id && (
                                <span title={`Cobro enlazado: ${o.cobro_concepto || ""}${o.cobro_saldo != null ? ` — saldo ${fmt(o.cobro_saldo)}` : ""}`}
                                    style={{
                                        padding: "4px 10px", borderRadius: 20,
                                        background: (o.cobro_saldo ?? 0) > 0 ? "rgba(229,57,53,0.1)" : "rgba(76,175,80,0.12)",
                                        color: (o.cobro_saldo ?? 0) > 0 ? "#c62828" : "#2e7d32",
                                        fontSize: "0.62rem", fontWeight: 800,
                                    }}>
                                    {o.cobro_saldo != null && o.cobro_saldo > 0 ? `Debe ${fmt(o.cobro_saldo)}` : "Cobrado"}
                                </span>
                            )}

                            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                                <button onClick={() => setExpandido(expandida ? null : o.id)} title="Detalle"
                                    style={estiloBtnIcono}>
                                    <Icon name={expandida ? "ChevronUp" : "ChevronDown"} size={16} />
                                </button>
                                {!o.cobro_id && !o.cuota_id && (
                                    <button onClick={() => onCobrar(o)} title="Convertir en cobro"
                                        disabled={!o.cliente_id}
                                        style={{ ...estiloBtnAbonar, opacity: o.cliente_id ? 1 : 0.4, cursor: o.cliente_id ? "pointer" : "not-allowed" }}>
                                        Cobrar
                                    </button>
                                )}
                                <button onClick={() => onEditar(o)} title="Editar" style={estiloBtnIcono}>
                                    <Icon name="Pencil" size={15} />
                                </button>
                                <button onClick={() => onEliminar(o)} title="Eliminar"
                                    style={{ ...estiloBtnIcono, background: "rgba(229,57,53,0.1)", color: "#b71c1c" }}>
                                    <Icon name="Trash2" size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Detalle desplegado */}
                        {expandida && (
                            <div style={{ marginTop: 12, borderTop: "1px dashed var(--border-primary)", paddingTop: 10 }}>
                                <DetalleTexto titulo="Lo que reportó el cliente" texto={o.detalle_reportado} />
                                <DetalleTexto titulo="Lo que se hizo / encontró" texto={o.solucion} />
                                <DetalleTexto titulo="Notas" texto={o.notas} />
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function DetalleTexto({ titulo, texto }: { titulo: string; texto: string | null }) {
    if (!texto) return null
    return (
        <div style={{ marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--text-label)" }}>
                {titulo}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-main)", whiteSpace: "pre-wrap" }}>
                {texto}
            </p>
        </div>
    )
}

const estiloBtnIcono: React.CSSProperties = {
    border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
    background: "var(--bg-card2)", color: "var(--text-main)",
}

const estiloBtnAbonar: React.CSSProperties = {
    border: "none", borderRadius: 10, padding: "8px 14px",
    background: "var(--primary-mid)", color: "#fff",
    fontSize: "0.75rem", fontWeight: 800,
}
