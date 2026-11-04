"use client"
// ==============================================================================
// src/components/cobros/GestionCuotas.tsx
// Tab "Cuotas" de Cobros: las suscripciones mensuales (a quién, cuánto, qué
// día del mes vence). NO guarda dinero: solo define qué genera el botón
// "Generar mes". Formulario inline de alta/edición, toggle de activa.
// ==============================================================================

import { useState } from "react"
import { useQueries } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import { api } from "@/lib/api"
import { useAccionesCobros, useCuotas } from "@/hooks/useCobros"
import type { CuotaCliente } from "@/types"

interface ClienteOption { id: string; nombre: string }

const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

interface FormCuota {
    cliente_id: string
    concepto: string
    monto: string
    dia_cobro: string
    notas: string
}

const FORM_VACIO: FormCuota = { cliente_id: "", concepto: "", monto: "", dia_cobro: "1", notas: "" }

export default function GestionCuotas({ mostrarMsg }: { mostrarMsg: (ok: boolean, texto: string) => void }) {
    const { cuotas, cargando } = useCuotas(false)
    const { clientesQuery } = useClientesOptions()
    const { crearCuota, actualizarCuota, eliminarCuota } = useAccionesCobros()

    const [form, setForm] = useState<FormCuota>(FORM_VACIO)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [confirmandoEliminar, setConfirmandoEliminar] = useState<CuotaCliente | null>(null)

    const clientes: ClienteOption[] = clientesQuery.data ?? []

    function iniciarAlta() {
        setEditandoId(null)
        setForm(FORM_VACIO)
    }

    function iniciarEdicion(cuota: CuotaCliente) {
        setEditandoId(cuota.id)
        setForm({
            cliente_id: cuota.cliente_id,
            concepto: cuota.concepto,
            monto: String(cuota.monto),
            dia_cobro: String(cuota.dia_cobro),
            notas: cuota.notas || "",
        })
    }

    async function guardar() {
        const monto = Number(form.monto)
        if (!form.cliente_id || !form.concepto.trim() || !(monto > 0)) {
            mostrarMsg(false, "Cliente, concepto y monto mayor a 0 son obligatorios")
            return
        }
        const payload = {
            cliente_id: form.cliente_id,
            concepto: form.concepto.trim(),
            monto,
            dia_cobro: Number(form.dia_cobro) || 1,
            notas: form.notas.trim() || undefined,
        }
        try {
            setGuardando(true)
            if (editandoId) {
                await actualizarCuota({ id: editandoId, data: payload })
                mostrarMsg(true, "Cuota actualizada")
            } else {
                await crearCuota(payload)
                mostrarMsg(true, "Cuota creada — genera el mes para emitir el cobro")
            }
            setForm(FORM_VACIO)
            setEditandoId(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al guardar la cuota")
        } finally {
            setGuardando(false)
        }
    }

    async function alternar(cuota: CuotaCliente) {
        try {
            await actualizarCuota({ id: cuota.id, data: { activo: !cuota.activo } })
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al cambiar la cuota")
        }
    }

    async function eliminar() {
        if (!confirmandoEliminar) return
        try {
            const r = await eliminarCuota(confirmandoEliminar.id)
            mostrarMsg(true, r.mensaje || "Cuota eliminada")
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al eliminar la cuota")
        } finally {
            setConfirmandoEliminar(null)
        }
    }

    return (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Formulario */}
            <div style={{ flex: "1 1 300px", maxWidth: 400, minWidth: 0, borderRadius: 16, background: "var(--bg-card)", padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)" }}>
                        {editandoId ? "Editar cuota" : "Nueva cuota mensual"}
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

                <label style={estilosLabel}>Concepto</label>
                <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}
                    placeholder="Contabilidad mensual" style={estilosInput} />

                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <label style={estilosLabel}>Monto mensual</label>
                        <input type="number" min="0" step="0.01" value={form.monto}
                            onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0.00" style={estilosInput} />
                    </div>
                    <div style={{ width: 110 }}>
                        <label style={estilosLabel}>Día de cobro</label>
                        <input type="number" min="1" max="28" value={form.dia_cobro}
                            onChange={e => setForm({ ...form, dia_cobro: e.target.value })} style={estilosInput} />
                    </div>
                </div>

                <label style={estilosLabel}>Notas (opcional)</label>
                <input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                    placeholder="Detalle del acuerdo" style={estilosInput} />

                <button onClick={guardar} disabled={guardando}
                    style={{
                        width: "100%", marginTop: 6, padding: "12px", border: "none", borderRadius: 12,
                        background: "var(--primary-mid)", color: "#fff", fontWeight: 800, fontSize: "0.85rem",
                        cursor: guardando ? "wait" : "pointer",
                    }}>
                    {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear cuota"}
                </button>
            </div>

            {/* Lista de cuotas */}
            <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                {cargando ? (
                    <p style={{ textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>Cargando cuotas...</p>
                ) : cuotas.length === 0 ? (
                    <div style={{
                        padding: "34px 20px", textAlign: "center", borderRadius: 16,
                        background: "var(--bg-card)", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.9rem",
                    }}>
                        <Icon name="CalendarClock" size={32} color="var(--primary-light)" />
                        <p style={{ margin: "10px 0 0" }}>Aún no tienes cuotas mensuales. Crea la primera y cada mes se genera su cobro con un clic.</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {cuotas.map(cuota => (
                            <div key={cuota.id} style={{
                                borderRadius: 14, background: "var(--bg-card)", padding: "14px 16px",
                                border: "1px solid var(--border-light)",
                                opacity: cuota.activo ? 1 : 0.55,
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                                            {cuota.cliente_nombre}
                                        </p>
                                        <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                            {cuota.concepto} · vence el día {cuota.dia_cobro} de cada mes
                                        </p>
                                    </div>
                                    <p style={{ margin: 0, fontWeight: 800, color: "var(--text-main)" }}>
                                        {fmt(cuota.monto)}/mes
                                    </p>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <button onClick={() => alternar(cuota)} title={cuota.activo ? "Desactivar" : "Activar"}
                                            style={{
                                                border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
                                                background: cuota.activo ? "rgba(76,175,80,0.12)" : "var(--bg-card2)",
                                                color: cuota.activo ? "#2e7d32" : "var(--text-muted)",
                                            }}>
                                            <Icon name={cuota.activo ? "ToggleRight" : "ToggleLeft"} size={18} />
                                        </button>
                                        <button onClick={() => iniciarEdicion(cuota)} title="Editar"
                                            style={{
                                                border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
                                                background: "var(--bg-card2)", color: "var(--text-main)",
                                            }}>
                                            <Icon name="Pencil" size={16} />
                                        </button>
                                        <button onClick={() => setConfirmandoEliminar(cuota)} title="Eliminar"
                                            style={{
                                                border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
                                                background: "rgba(229,57,53,0.1)", color: "#b71c1c",
                                            }}>
                                            <Icon name="Trash2" size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
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
                            ¿Eliminar la cuota de {confirmandoEliminar.cliente_nombre}?
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-main)" }}>
                            Los cobros ya generados se conservan (quedan huérfanos pero sigue su historial y saldo).
                            Las siguientes generaciones ya no la emitirán.
                        </p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button onClick={() => setConfirmandoEliminar(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={eliminar}
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

/** Opciones de clientes para los selects (cartera activa). */
export function useClientesOptions() {
    const clientesQuery = useQueries({
        queries: [
            {
                queryKey: ["cobros", "clientes-select"],
                queryFn: () => api.getClientes(),
                staleTime: 60_000,
            },
        ],
    })[0]
    return { clientesQuery }
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
