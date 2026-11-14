"use client"
// ==============================================================================
// src/components/cobros/GestionPlanes.tsx
// Pestaña "Mis cuentas" de Cobros (mig 075): cuaderno PERSONAL de qué plan del
// gestor tiene cada cliente y si se le está cobrando. NO es un panel admin del
// gestor y NUNCA genera cobros: si el estado es 'cobrando', la cuota vive en
// la pestaña "Cuotas y ventas". Formulario inline + lista con badges.
// ==============================================================================

import { useState } from "react"
import Icon from "@/components/ui/Icon"
import { useAccionesPlanes, usePlanes } from "@/hooks/usePlanes"
import type { EstadoCobroPlan, PlanCliente } from "@/types"

interface ClienteOption { id: string; nombre: string }

const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

const hoyISO = () => new Date().toISOString().slice(0, 10)

/** '2026-11-05' → '5 nov' (solo lectura, sin zona horaria rara). */
function fechaCorta(v: string | null): string {
    if (!v) return "—"
    const [a, m, d] = v.split("-").map(Number)
    if (!a || !m || !d) return v
    const mes = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]
    return `${d} ${mes}`
}

/** Estilo del badge por estado de cobro (verde=dinero, azul=gratis, gris=pausado). */
const ESTILO_ESTADO: Record<EstadoCobroPlan, { texto: string; bg: string; color: string }> = {
    cobrando: { texto: "Cobrando", bg: "rgba(76,175,80,0.12)", color: "#2e7d32" },
    gratis: { texto: "Gratis", bg: "rgba(3,105,161,0.12)", color: "#0369a1" },
    pausado: { texto: "Pausado", bg: "rgba(120,120,120,0.15)", color: "#6b7280" },
}

interface FormPlan {
    cliente_id: string
    plan: string
    estado_cobro: EstadoCobroPlan
    monto_acordado: string
    otorgado: string
    notas: string
}

const FORM_VACIO: FormPlan = {
    cliente_id: "", plan: "", estado_cobro: "cobrando",
    monto_acordado: "", otorgado: hoyISO(), notas: "",
}

type FiltroEstado = "todos" | EstadoCobroPlan

export default function GestionPlanes({ mostrarMsg, clientes }: { mostrarMsg: (ok: boolean, texto: string) => void; clientes: ClienteOption[] }) {
    const [filtro, setFiltro] = useState<FiltroEstado>("todos")
    const { planes, cargando } = usePlanes(filtro === "todos" ? undefined : filtro)
    const { crear, actualizar, eliminar } = useAccionesPlanes()

    const [form, setForm] = useState<FormPlan>(FORM_VACIO)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [confirmandoEliminar, setConfirmandoEliminar] = useState<PlanCliente | null>(null)

    function iniciarAlta() {
        setEditandoId(null)
        setForm(FORM_VACIO)
    }

    function iniciarEdicion(p: PlanCliente) {
        setEditandoId(p.id)
        setForm({
            cliente_id: p.cliente_id,
            plan: p.plan,
            estado_cobro: p.estado_cobro,
            monto_acordado: p.monto_acordado != null ? String(p.monto_acordado) : "",
            otorgado: p.otorgado || hoyISO(),
            notas: p.notas || "",
        })
    }

    async function guardar() {
        if (!form.cliente_id || !form.plan.trim()) {
            mostrarMsg(false, "Cliente y plan son obligatorios")
            return
        }
        const montoTexto = form.monto_acordado.trim()
        if (montoTexto && !(Number(montoTexto) >= 0)) {
            mostrarMsg(false, "El monto acordado no puede ser negativo")
            return
        }
        // En edición el campo limpiado manda 0 (el backend lo quita); lleno
        // manda el valor; en alta, vacío = sin monto.
        const monto = montoTexto ? Number(montoTexto) : (editandoId ? 0 : undefined)
        const payload = {
            cliente_id: form.cliente_id,
            plan: form.plan.trim(),
            estado_cobro: form.estado_cobro,
            monto_acordado: monto,
            otorgado: form.otorgado || undefined,
            notas: form.notas.trim() || undefined,
        }
        try {
            setGuardando(true)
            if (editandoId) {
                await actualizar({ id: editandoId, data: payload })
                mostrarMsg(true, "Anotación actualizada")
            } else {
                await crear(payload)
                mostrarMsg(true, "Anotación creada")
            }
            setForm(FORM_VACIO)
            setEditandoId(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al guardar la anotación")
        } finally {
            setGuardando(false)
        }
    }

    async function eliminarAnotacion() {
        if (!confirmandoEliminar) return
        try {
            const r = await eliminar(confirmandoEliminar.id)
            mostrarMsg(true, r.mensaje || "Anotación eliminada")
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al eliminar la anotación")
        } finally {
            setConfirmandoEliminar(null)
        }
    }

    const visibles = planes

    return (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Formulario */}
            <div style={{ flex: "1 1 300px", maxWidth: 400, minWidth: 0, borderRadius: 16, background: "var(--bg-card)", padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)" }}>
                        {editandoId ? "Editar anotación" : "Nueva anotación"}
                    </h3>
                    {editandoId && (
                        <button onClick={iniciarAlta} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary-mid)", fontWeight: 700, fontSize: "0.75rem" }}>
                            + Nueva
                        </button>
                    )}
                </div>

                <label style={estilosLabel}>Cliente</label>
                <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })} style={estilosInput}>
                    <option value="">— Selecciona —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>

                <label style={estilosLabel}>Plan del gestor</label>
                <input value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}
                    placeholder="local, plus, básico..." style={estilosInput} />

                <label style={estilosLabel}>¿Le estás cobrando?</label>
                <select value={form.estado_cobro}
                    onChange={e => setForm({ ...form, estado_cobro: e.target.value as EstadoCobroPlan })}
                    style={estilosInput}>
                    <option value="cobrando">Sí — le cobro (cuota aparte)</option>
                    <option value="gratis">No — de momento no le cobro nada</option>
                    <option value="pausado">Pausado — acuerdo congelado</option>
                </select>

                {form.estado_cobro !== "gratis" && (
                    <>
                        <label style={estilosLabel}>Monto acordado (opcional)</label>
                        <input type="number" min="0" step="0.01" value={form.monto_acordado}
                            onChange={e => setForm({ ...form, monto_acordado: e.target.value })}
                            placeholder="Ej. 99 — solo informativo" style={estilosInput} />
                    </>
                )}

                <label style={estilosLabel}>Desde cuándo lo tiene</label>
                <input type="date" value={form.otorgado}
                    onChange={e => setForm({ ...form, otorgado: e.target.value })} style={estilosInput} />

                <label style={estilosLabel}>Notas (opcional)</label>
                <input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                    placeholder="Detalle del acuerdo" style={estilosInput} />

                <p style={{ margin: "10px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Este registro es solo tu control personal: no genera cobros. Para cobrarle, crea la cuota en la pestaña "Cuotas y ventas".
                </p>

                <button onClick={guardar} disabled={guardando}
                    style={{
                        width: "100%", marginTop: 6, padding: "12px", border: "none", borderRadius: 12,
                        background: "var(--primary-mid)", color: "#fff", fontWeight: 800, fontSize: "0.85rem",
                        cursor: guardando ? "wait" : "pointer",
                    }}>
                    {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear anotación"}
                </button>
            </div>

            {/* Lista con filtro por estado */}
            <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                    {(["todos", "cobrando", "gratis", "pausado"] as FiltroEstado[]).map(f => (
                        <button key={f} onClick={() => setFiltro(f)}
                            style={{
                                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                                background: filtro === f ? "var(--primary-mid)" : "var(--bg-card2)",
                                color: filtro === f ? "#fff" : "var(--text-main)",
                                fontSize: "0.72rem", fontWeight: 800,
                            }}>
                            {f === "todos" ? "Todos" : ESTILO_ESTADO[f].texto}
                        </button>
                    ))}
                </div>

                {cargando ? (
                    <p style={{ textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>Cargando cuentas...</p>
                ) : visibles.length === 0 ? (
                    <div style={{
                        padding: "34px 20px", textAlign: "center", borderRadius: 16,
                        background: "var(--bg-card)", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.9rem",
                    }}>
                        <Icon name="NotebookPen" size={32} color="var(--primary-light)" />
                        <p style={{ margin: "10px 0 0" }}>
                            {filtro === "todos"
                                ? "Aún no anotas cuentas. Registra a quién le diste un plan del gestor (y si le cobras o no)."
                                : `No hay cuentas con estado "${ESTILO_ESTADO[filtro].texto}".`}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {visibles.map(p => {
                            const est = ESTILO_ESTADO[p.estado_cobro]
                            const vieja = p.otorgado ? (Date.now() - new Date(`${p.otorgado}T00:00:00`).getTime()) / 86400000 : 0
                            return (
                                <div key={p.id} style={{
                                    borderRadius: 14, background: "var(--bg-card)", padding: "14px 16px",
                                    border: "1px solid var(--border-light)",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                                                {p.cliente_nombre}
                                            </p>
                                            <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                                Plan {p.plan} · desde {fechaCorta(p.otorgado)}
                                                {vieja > 60 ? ` (${Math.floor(vieja / 30)} meses)` : ""}
                                            </p>
                                            {p.notas && (
                                                <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                    {p.notas}
                                                </p>
                                            )}
                                        </div>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: "0.85rem", color: "var(--text-main)" }}>
                                            {p.monto_acordado != null ? fmt(p.monto_acordado) : ""}
                                        </p>
                                        <span style={{
                                            padding: "4px 12px", borderRadius: 20,
                                            background: est.bg, color: est.color,
                                            fontSize: "0.68rem", fontWeight: 800, letterSpacing: 0.4,
                                        }}>
                                            {est.texto}
                                        </span>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button onClick={() => iniciarEdicion(p)} title="Editar"
                                                style={{
                                                    border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
                                                    background: "var(--bg-card2)", color: "var(--text-main)",
                                                }}>
                                                <Icon name="Pencil" size={16} />
                                            </button>
                                            <button onClick={() => setConfirmandoEliminar(p)} title="Eliminar"
                                                style={{
                                                    border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
                                                    background: "rgba(229,57,53,0.1)", color: "#b71c1c",
                                                }}>
                                                <Icon name="Trash2" size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Confirmación de eliminar */}
            {confirmandoEliminar && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", padding: 24,
                }}>
                    <div className="card" style={{ maxWidth: 430, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                            ¿Borrar la anotación del plan {confirmandoEliminar.plan} de {confirmandoEliminar.cliente_nombre}?
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-main)" }}>
                            Solo se borra del cuaderno. Si le tienes cuota o cobros, esos no se tocan.
                        </p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button onClick={() => setConfirmandoEliminar(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={eliminarAnotacion}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "#e53935", color: "#fff", fontWeight: 800, cursor: "pointer",
                                }}>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const estilosLabel: React.CSSProperties = {
    display: "block", margin: "12px 0 6px", fontSize: "0.68rem", fontWeight: 700,
    letterSpacing: 1, textTransform: "uppercase", color: "var(--text-label)",
}

const estilosInput: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
    color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 600,
    boxSizing: "border-box",
}
