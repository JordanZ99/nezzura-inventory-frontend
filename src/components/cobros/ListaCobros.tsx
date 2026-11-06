"use client"
// ==============================================================================
// src/components/cobros/ListaCobros.tsx
// Lista de cobros con saldo, estado derivado y abonos desplegables.
// Acciones: registrar abono, quitar el último abono, editar (extra) y eliminar.
// El dinero/saldo NUNCA se calcula aquí: llega derivado del backend.
// ==============================================================================

import { useState } from "react"
import Icon from "@/components/ui/Icon"
import { useAccionesCobros } from "@/hooks/useCobros"
import type { Cobro } from "@/types"

interface Props {
    cobros: Cobro[]
    cargando: boolean
    onRegistrarPago: (cobro: Cobro) => void
    onEditarExtra: (cobro: Cobro) => void
    onEliminar: (cobro: Cobro) => void
}

const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

// Mig 065: fecha de vencimiento VISIBLE en cada fila ('vence dom 8 nov' /
// 'venció dom 1 nov') — con cobros recurrentes (varias filas iguales del
// mismo cliente) la fecha es lo que las distingue a simple vista.
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

function textoVencimiento(iso: string | null): string {
    if (!iso) return ""
    const fecha = new Date(`${iso.slice(0, 10)}T12:00:00`)
    if (isNaN(fecha.getTime())) return iso.slice(0, 10)
    return `${DIAS_CORTOS[fecha.getDay()]} ${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`
}

const ESTILO_ESTADO: Record<Cobro["estado"], { texto: string; bg: string; color: string }> = {
    pagado: { texto: "Pagado", bg: "rgba(76,175,80,0.12)", color: "#2e7d32" },
    parcial: { texto: "Parcial", bg: "rgba(249,168,37,0.15)", color: "#b45309" },
    pendiente: { texto: "Pendiente", bg: "rgba(229,57,53,0.1)", color: "#c62828" },
}

export default function ListaCobros({ cobros, cargando, onRegistrarPago, onEditarExtra, onEliminar }: Props) {
    const { quitarAbono } = useAccionesCobros()
    const [expandido, setExpandido] = useState<string | null>(null)
    const [quitarIndice, setQuitarIndice] = useState<{ id: string; indice: number } | null>(null)
    const [quitando, setQuitando] = useState(false)

    if (cargando) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>
                Cargando cobros...
            </div>
        )
    }
    if (cobros.length === 0) {
        return (
            <div style={{
                padding: "40px 20px", textAlign: "center", borderRadius: 16,
                background: "var(--bg-card)", color: "var(--text-muted)", fontWeight: 600,
            }}>
                <Icon name="Wallet" size={34} color="var(--primary-light)" />
                <p style={{ margin: "10px 0 0", fontSize: "0.9rem" }}>
                    Sin cobros todavía. Genera el mes (si ya tienes cuotas) o registra un trabajo extra.
                </p>
            </div>
        )
    }

    async function confirmarQuitarAbono() {
        if (!quitarIndice) return
        try {
            setQuitando(true)
            await quitarAbono({ id: quitarIndice.id, indice: quitarIndice.indice })
        } finally {
            setQuitando(false)
            setQuitarIndice(null)
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cobros.map(cobro => {
                const est = ESTILO_ESTADO[cobro.estado]
                const abierto = expandido === cobro.id
                return (
                    <div key={cobro.id} style={{
                        borderRadius: 14,
                        background: "var(--bg-card)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                        border: cobro.vencido ? "1px solid rgba(229,57,53,0.35)" : "1px solid var(--border-light)",
                        padding: "14px 16px",
                    }}>
                        {/* Línea principal */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "0.92rem", color: "var(--text-main)" }}>
                                    {cobro.cliente_nombre}
                                </p>
                                <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    {cobro.concepto}
                                    <span style={{
                                        marginLeft: 8, padding: "1px 8px", borderRadius: 20,
                                        background: "var(--bg-card2)", fontSize: "0.65rem", letterSpacing: 0.5,
                                    }}>
                                        {cobro.origen === "cuota" ? `Cuota ${cobro.periodo}` : "Extra"}
                                    </span>
                                    {cobro.vencimiento && (
                                        <span style={{
                                            marginLeft: 6, padding: "1px 8px", borderRadius: 20, fontWeight: 700,
                                            background: cobro.vencido ? "rgba(229,57,53,0.1)" : "var(--bg-card2)",
                                            color: cobro.vencido ? "#b71c1c" : "var(--text-main)",
                                            fontSize: "0.65rem",
                                        }} title={cobro.vencimiento.slice(0, 10)}>
                                            {cobro.vencido ? `venció ${textoVencimiento(cobro.vencimiento)}` : `vence ${textoVencimiento(cobro.vencimiento)}`}
                                        </span>
                                    )}
                                    {cobro.origen === "extra" && (
                                        <button onClick={() => onEditarExtra(cobro)}
                                            style={{ marginLeft: 6, border: "none", background: "none", cursor: "pointer", color: "var(--primary-mid)", padding: 0 }}>
                                            <Icon name="Pencil" size={13} />
                                        </button>
                                    )}
                                </p>
                            </div>

                            <div style={{ textAlign: "right" }}>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "0.95rem", color: "var(--text-main)" }}>
                                    {fmt(cobro.monto)}
                                </p>
                                <p style={{ margin: "3px 0 0", fontSize: "0.72rem", fontWeight: 700, color: cobro.saldo > 0 ? "var(--text-muted)" : "var(--primary-alter)" }}>
                                    Saldo: {fmt(cobro.saldo)}
                                </p>
                            </div>

                            <span style={{
                                padding: "4px 12px", borderRadius: 20,
                                background: est.bg, color: est.color,
                                fontSize: "0.68rem", fontWeight: 800, letterSpacing: 0.4,
                            }}>
                                {est.texto}
                            </span>

                            {cobro.vencido && (
                                <span style={{
                                    padding: "4px 10px", borderRadius: 20,
                                    background: "rgba(229,57,53,0.12)", color: "#b71c1c",
                                    fontSize: "0.65rem", fontWeight: 800,
                                }}>
                                    {cobro.dias_vencido} día(s) vencido
                                </span>
                            )}

                            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                                <button onClick={() => setExpandido(abierto ? null : cobro.id)} title="Abonos"
                                    style={{
                                        border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
                                        background: "var(--bg-card2)", color: "var(--text-main)",
                                    }}>
                                    <Icon name={abierto ? "ChevronUp" : "ChevronDown"} size={16} />
                                </button>
                                {cobro.estado !== "pagado" && (
                                    <button onClick={() => onRegistrarPago(cobro)}
                                        style={{
                                            border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                                            background: "var(--primary-mid)", color: "#fff",
                                            fontSize: "0.75rem", fontWeight: 800,
                                        }}>
                                        Abonar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Abonos desplegados */}
                        {abierto && (
                            <div style={{ marginTop: 12, borderTop: "1px dashed var(--border-primary)", paddingTop: 10 }}>
                                {cobro.programa.length > 0 && (
                                    <p style={{ margin: "0 0 8px", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-label)" }}>
                                        Plan de pagos: {cobro.programa.map(p => `${p.etiqueta} ${fmt(p.monto)} (${p.fecha})`).join(" · ")}
                                    </p>
                                )}
                                {cobro.notas && (
                                    <p style={{ margin: "0 0 8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        {cobro.notas}
                                    </p>
                                )}
                                {cobro.pagos.length === 0 ? (
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                        Sin abonos registrados.
                                    </p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {cobro.pagos.map((abono, indice) => (
                                            <div key={indice} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <Icon name="Check" size={14} color="var(--primary-alter)" />
                                                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}>
                                                    {fmt(abono.monto)}
                                                </span>
                                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                    {abono.fecha}{abono.metodo ? ` · ${abono.metodo}` : ""}
                                                </span>
                                                <button onClick={() => setQuitarIndice({ id: cobro.id, indice })}
                                                    title="Quitar abono (corrección)"
                                                    style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}>
                                                    <Icon name="Trash2" size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Confirmación de quitar abono */}
            {quitarIndice !== null && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", padding: 24,
                }}>
                    <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                            ¿Quitar este abono?
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-main)" }}>
                            El saldo del cobro volverá a reflejar el monto pendiente. Úsalo para corregir abonos mal capturados.
                        </p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button onClick={() => setQuitarIndice(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={confirmarQuitarAbono} disabled={quitando}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "#e53935", color: "#fff", fontWeight: 800, cursor: quitando ? "wait" : "pointer",
                                }}>
                                {quitando ? "Quitando..." : "Quitar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
