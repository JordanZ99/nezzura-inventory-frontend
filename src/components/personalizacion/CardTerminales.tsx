// ==============================================================================
// src/components/personalizacion/CardTerminales.tsx
// Tarjeta "Terminales y comisiones" (tab Mi Negocio, Fase B): alta/edición/
// baja de terminales bancarias con su tarifa real (débito, crédito, cuota
// fija). La comisión se calcula al cobrar con la tarifa de la terminal usada.
// ==============================================================================

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import { api, type Terminal } from "@/lib/api"
import { inventarioQueryKeys } from "@/lib/inventarioQueries"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"

const inputStyle = {
    width: "100%",
    fontSize: "0.75rem",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid var(--border-primary)",
    background: "var(--bg-card2)",
    color: "var(--text-main)",
    outline: "none",
    fontWeight: 600,
} as const

interface FormTerminal {
    nombre: string
    banco: string
    comision_debito_pct: string
    comision_credito_pct: string
    comision_fija: string
}

const FORM_VACIO: FormTerminal = { nombre: "", banco: "", comision_debito_pct: "", comision_credito_pct: "", comision_fija: "" }

function formDeTerminal(t: Terminal): FormTerminal {
    return {
        nombre: t.nombre,
        banco: t.banco || "",
        comision_debito_pct: String(t.comision_debito_pct),
        comision_credito_pct: String(t.comision_credito_pct),
        comision_fija: String(t.comision_fija),
    }
}

export function CardTerminales() {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const { mostrarMsg } = useToast()
    const queryClient = useQueryClient()

    const terminalesQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.terminales(tenantId) : ["terminales", "sin-tenant"],
        queryFn: api.getTerminales,
        enabled: Boolean(tenantId),
    })
    const terminales = terminalesQuery.data ?? []

    const [form, setForm] = useState<FormTerminal>(FORM_VACIO)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [formEdicion, setFormEdicion] = useState<FormTerminal>(FORM_VACIO)
    const [ocupado, setOcupado] = useState(false)

    function invalidar() {
        if (tenantId) queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.terminales(tenantId) })
    }

    async function guardarNuevo() {
        if (!form.nombre.trim()) {
            mostrarMsg(false, "❌ El nombre de la terminal es obligatorio")
            return
        }
        setOcupado(true)
        try {
            await api.crearTerminal({
                nombre: form.nombre.trim(),
                banco: form.banco.trim() || undefined,
                comision_debito_pct: Number(form.comision_debito_pct) || 0,
                comision_credito_pct: Number(form.comision_credito_pct) || 0,
                comision_fija: Number(form.comision_fija) || 0,
            })
            mostrarMsg(true, `✅ Terminal "${form.nombre.trim()}" agregada`)
            setForm(FORM_VACIO)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        } finally { setOcupado(false) }
    }

    async function guardarEdicion(id: string) {
        setOcupado(true)
        try {
            await api.actualizarTerminal(id, {
                nombre: formEdicion.nombre.trim(),
                banco: formEdicion.banco.trim(),
                comision_debito_pct: Number(formEdicion.comision_debito_pct) || 0,
                comision_credito_pct: Number(formEdicion.comision_credito_pct) || 0,
                comision_fija: Number(formEdicion.comision_fija) || 0,
            })
            mostrarMsg(true, "✅ Terminal actualizada")
            setEditandoId(null)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        } finally { setOcupado(false) }
    }

    async function eliminar(t: Terminal) {
        if (!confirm(`¿Eliminar la terminal "${t.nombre}"? Los tickets ya cobrados conservan su historial.`)) return
        try {
            await api.eliminarTerminal(t.id)
            mostrarMsg(true, "Terminal eliminada")
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    function filaInputs(f: FormTerminal, setF: (v: FormTerminal) => void, compacto = false) {
        const ancho = compacto ? 62 : "100%"
        return (
            <>
                <input placeholder="Nombre" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} style={{ ...inputStyle, width: compacto ? 110 : "100%" }} />
                <input placeholder="Banco" value={f.banco} onChange={e => setF({ ...f, banco: e.target.value })} style={{ ...inputStyle, width: compacto ? 90 : "100%" }} />
                <input placeholder="% débito" type="number" min="0" step="0.1" value={f.comision_debito_pct} onChange={e => setF({ ...f, comision_debito_pct: e.target.value })} style={{ ...inputStyle, width: ancho }} />
                <input placeholder="% crédito" type="number" min="0" step="0.1" value={f.comision_credito_pct} onChange={e => setF({ ...f, comision_credito_pct: e.target.value })} style={{ ...inputStyle, width: ancho }} />
                <input placeholder="Fija $" type="number" min="0" step="0.5" value={f.comision_fija} onChange={e => setF({ ...f, comision_fija: e.target.value })} style={{ ...inputStyle, width: ancho }} />
            </>
        )
    }

    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 320px", maxWidth: 520 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Terminales y Comisiones</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>
                Registra tus terminales bancarias con su tarifa real. Al cobrar con tarjeta, la comisión se calcula y verás el depósito esperado.
            </p>

            {/* Lista de terminales */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {terminales.length === 0 && (
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Sin terminales configuradas. Agrega la primera abajo.
                    </p>
                )}
                {terminales.map(t => (
                    <div key={t.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)" }}>
                        {editandoId === t.id ? (
                            <>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {filaInputs(formEdicion, setFormEdicion, true)}
                                </div>
                                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                                    <button onClick={() => guardarEdicion(t.id)} disabled={ocupado} className="btn-primary" style={{ fontSize: "0.7rem", padding: "5px 12px" }}>
                                        <Icon name="Save" size={13} /> Guardar
                                    </button>
                                    <button onClick={() => setEditandoId(null)} className="btn-ghost" style={{ fontSize: "0.7rem", padding: "5px 12px" }}>
                                        Cancelar
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <div>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.85rem", color: t.activo ? "var(--text-main)" : "var(--text-muted)" }}>
                                        {t.nombre}{!t.activo && " (inactiva)"}
                                        {t.banco && <span style={{ fontWeight: 600, color: "var(--text-muted)" }}> · {t.banco}</span>}
                                    </p>
                                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                        Débito {t.comision_debito_pct}% · Crédito {t.comision_credito_pct}%
                                        {t.comision_fija > 0 && ` · +$${t.comision_fija} fija`}
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={() => { setEditandoId(t.id); setFormEdicion(formDeTerminal(t)) }} title="Editar" style={{ background: "none", border: "none", cursor: "pointer" }}>
                                        <Icon name="Pencil" size={15} color="var(--primary-dark)" />
                                    </button>
                                    <button onClick={() => eliminar(t)} title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer" }}>
                                        <Icon name="Trash2" size={15} color="#b71c1c" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Alta de terminal */}
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Agregar terminal</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {filaInputs(form, setForm)}
            </div>
            <button onClick={guardarNuevo} disabled={ocupado} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="Plus" size={15} /> Agregar terminal
            </button>
        </div>
    )
}
