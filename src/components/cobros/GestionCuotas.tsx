"use client"
// ==============================================================================
// src/components/cobros/GestionCuotas.tsx
// Tab "Cuotas y ventas" de Cobros: dos tipos (mig 076):
//   - CUOTA recurrente (063): MENSUAL (vence día 1..28), SEMANAL (cada día de
//     la semana elegido) y QUINCENAL (fijo: día 1 y 15). NO guarda dinero:
//     solo define qué genera el botón "Generar mes".
//   - VENTA A PLAZOS (076): artículo vendido — concepto = el artículo,
//     monto = abono por periodo, PRECIO TOTAL (meta) obligatorio y costo
//     opcional → ganancia derivada. El generador corta al cubrir el precio.
// Formulario inline de alta/edición, toggle de activa, lista separada.
// ==============================================================================

import { useState } from "react"
import { useQueries } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import { api } from "@/lib/api"
import { useAccionesCobros, useCuotas } from "@/hooks/useCobros"
import type { CuotaCliente, FrecuenciaCuota, TipoCuota } from "@/types"

interface ClienteOption { id: string; nombre: string }

const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

const DIAS_NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

interface FormCuota {
    tipo: TipoCuota
    cliente_id: string
    concepto: string
    monto: string
    frecuencia: FrecuenciaCuota
    dia_cobro: string
    dia_semana: string
    monto_meta: string
    costo: string
    notas: string
}

const FORM_VACIO: FormCuota = {
    tipo: "cuota", cliente_id: "", concepto: "", monto: "",
    frecuencia: "mensual", dia_cobro: "1", dia_semana: "0",
    monto_meta: "", costo: "", notas: "",
}

/** Texto corto de la recurrencia (misma lógica visual que el backend). */
function textoRecurrencia(frecuencia: string | undefined, cuota: { dia_cobro: number; dia_semana: number | null }): string {
    if (frecuencia === "semanal") {
        const ds = cuota.dia_semana ?? 0
        return `cada ${DIAS_NOMBRES[ds] ?? "Lunes"}`
    }
    if (frecuencia === "quincenal") return "los días 1 y 15 de cada mes"
    return `vence el día ${cuota.dia_cobro} de cada mes`
}

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
            tipo: cuota.tipo || "cuota",
            cliente_id: cuota.cliente_id,
            concepto: cuota.concepto,
            monto: String(cuota.monto),
            frecuencia: cuota.frecuencia || "mensual",
            dia_cobro: String(cuota.dia_cobro || 1),
            dia_semana: String(cuota.dia_semana ?? 0),
            monto_meta: cuota.monto_meta != null ? String(cuota.monto_meta) : "",
            costo: cuota.costo != null ? String(cuota.costo) : "",
            notas: cuota.notas || "",
        })
    }

    async function guardar() {
        const monto = Number(form.monto)
        if (!form.cliente_id || !form.concepto.trim() || !(monto > 0)) {
            mostrarMsg(false, "Cliente, concepto y monto mayor a 0 son obligatorios")
            return
        }
        // Precio total: en VENTA es obligatorio; en cuota, opcional (infinita).
        const metaTexto = form.monto_meta.trim()
        const costoTexto = form.costo.trim()
        if (metaTexto && !(Number(metaTexto) > 0)) {
            mostrarMsg(false, "El total debe ser mayor a 0 (o déjalo vacío)")
            return
        }
        if (form.tipo === "venta" && !(Number(metaTexto) > 0)) {
            mostrarMsg(false, "Una venta a plazos necesita el precio total")
            return
        }
        if (costoTexto && !(Number(costoTexto) >= 0)) {
            mostrarMsg(false, "El costo no puede ser negativo")
            return
        }
        const frecuencia = form.frecuencia
        // dia_cobro/dia_semana según frecuencia (el backend valida el par).
        const dia_cobro = frecuencia === "mensual" ? (Number(form.dia_cobro) || 1) : 1
        const dia_semana = frecuencia === "semanal" ? Number(form.dia_semana) || 0 : null
        // Meta total: vacío = sin meta. En edición, el campo limpiado manda 0
        // (el backend la quita); lleno manda el valor.
        const monto_meta = metaTexto ? Number(metaTexto) : (editandoId ? 0 : undefined)
        // Costo (solo venta): vacío = sin costo. En edición, limpiado manda 0.
        const costo = form.tipo === "venta"
            ? (costoTexto ? Number(costoTexto) : (editandoId ? 0 : undefined))
            : undefined
        const payload = {
            cliente_id: form.cliente_id,
            concepto: form.concepto.trim(),
            monto,
            frecuencia,
            dia_cobro,
            dia_semana,
            monto_meta,
            tipo: form.tipo,
            costo,
            notas: form.notas.trim() || undefined,
        }
        try {
            setGuardando(true)
            if (editandoId) {
                await actualizarCuota({ id: editandoId, data: payload })
                mostrarMsg(true, form.tipo === "venta" ? "Venta actualizada" : "Cuota actualizada")
            } else {
                await crearCuota(payload)
                mostrarMsg(true, form.tipo === "venta"
                    ? "Venta a plazos creada — genera el mes para emitir sus abonos"
                    : "Cuota creada — genera el mes para emitir sus cobros")
            }
            setForm(FORM_VACIO)
            setEditandoId(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al guardar")
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
            mostrarMsg(true, r.mensaje || "Eliminada")
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al eliminar")
        } finally {
            setConfirmandoEliminar(null)
        }
    }

    const ventas = cuotas.filter(c => (c.tipo || "cuota") === "venta")
    const cuotasPuras = cuotas.filter(c => (c.tipo || "cuota") === "cuota")

    return (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Formulario */}
            <div style={{ flex: "1 1 300px", maxWidth: 400, minWidth: 0, borderRadius: 16, background: "var(--bg-card)", padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)" }}>
                        {editandoId ? (form.tipo === "venta" ? "Editar venta" : "Editar cuota") : "Nueva"}
                    </h3>
                    {editandoId && (
                        <button onClick={iniciarAlta} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary-mid)", fontWeight: 700, fontSize: "0.75rem" }}>
                            + Nueva
                        </button>
                    )}
                </div>

                <label style={estilosLabel}>Tipo</label>
                <select value={form.tipo} disabled={Boolean(editandoId)}
                    onChange={e => setForm({ ...form, tipo: e.target.value as TipoCuota })} style={estilosInput}>
                    <option value="cuota">Cuota recurrente (servicio)</option>
                    <option value="venta">Venta a plazos (artículo)</option>
                </select>

                <label style={estilosLabel}>Cliente</label>
                <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })} style={estilosInput}>
                    <option value="">— Selecciona —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>

                <label style={estilosLabel}>{form.tipo === "venta" ? "Artículo vendido" : "Concepto"}</label>
                <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}
                    placeholder={form.tipo === "venta" ? "Laptop HP 15..." : "Contabilidad mensual"} style={estilosInput} />

                <label style={estilosLabel}>Frecuencia</label>
                <select
                    value={form.frecuencia}
                    onChange={e => setForm({ ...form, frecuencia: e.target.value as FrecuenciaCuota })}
                    style={estilosInput}
                >
                    <option value="mensual">Mensual</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal (día 1 y 15)</option>
                </select>

                <label style={estilosLabel}>
                    {form.tipo === "venta"
                        ? (form.frecuencia === "mensual" ? "Abono mensual" : form.frecuencia === "semanal" ? "Abono semanal" : "Abono quincenal")
                        : (form.frecuencia === "mensual" ? "Monto mensual" : "Monto por cobro")}
                </label>
                <input type="number" min="0" step="0.01" value={form.monto}
                    onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0.00" style={estilosInput} />

                {form.frecuencia === "mensual" && (
                    <>
                        <label style={estilosLabel}>Día de cobro</label>
                        <input type="number" min="1" max="28" value={form.dia_cobro}
                            onChange={e => setForm({ ...form, dia_cobro: e.target.value })} style={estilosInput} />
                    </>
                )}
                {form.frecuencia === "semanal" && (
                    <>
                        <label style={estilosLabel}>Día de la semana</label>
                        <select value={form.dia_semana}
                            onChange={e => setForm({ ...form, dia_semana: e.target.value })} style={estilosInput}>
                            {DIAS_NOMBRES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                    </>
                )}
                {form.frecuencia === "quincenal" && (
                    <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Se generan 2 cobros cada mes: el día 1 y el día 15.
                    </p>
                )}

                <label style={estilosLabel}>
                    {form.tipo === "venta" ? "Precio total de la venta" : "Meta total de la cuenta (opcional)"}
                </label>
                <input type="number" min="0" step="0.01" value={form.monto_meta}
                    onChange={e => setForm({ ...form, monto_meta: e.target.value })}
                    placeholder={form.tipo === "venta" ? "Ej. 7000 — lo que pagará en total" : "Ej. 7000 — sin límite si va vacío"}
                    style={estilosInput} />
                <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {form.tipo === "venta"
                        ? "El generador deja de emitir abonos al cubrir el precio y el último sale ajustado al restante."
                        : "Con meta, el generador deja de emitir al alcanzar el total y el último cobro sale ajustado al restante."}
                </p>

                {form.tipo === "venta" && (
                    <>
                        <label style={estilosLabel}>¿Cuánto te costó? (opcional)</label>
                        <input type="number" min="0" step="0.01" value={form.costo}
                            onChange={e => setForm({ ...form, costo: e.target.value })}
                            placeholder="Ej. 5200 — para ver tu ganancia" style={estilosInput} />
                    </>
                )}

                <label style={estilosLabel}>Notas (opcional)</label>
                <input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                    placeholder="Detalle del acuerdo" style={estilosInput} />

                <button onClick={guardar} disabled={guardando}
                    style={{
                        width: "100%", marginTop: 6, padding: "12px", border: "none", borderRadius: 12,
                        background: "var(--primary-mid)", color: "#fff", fontWeight: 800, fontSize: "0.85rem",
                        cursor: guardando ? "wait" : "pointer",
                    }}>
                    {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : form.tipo === "venta" ? "Crear venta" : "Crear cuota"}
                </button>
            </div>

            {/* Listas: ventas a plazos arriba, cuotas después */}
            <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                {cargando ? (
                    <p style={{ textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>Cargando...</p>
                ) : cuotas.length === 0 ? (
                    <div style={{
                        padding: "34px 20px", textAlign: "center", borderRadius: 16,
                        background: "var(--bg-card)", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.9rem",
                    }}>
                        <Icon name="CalendarClock" size={32} color="var(--primary-light)" />
                        <p style={{ margin: "10px 0 0" }}>Aún no tienes cuotas ni ventas. Crea la primera y con "Generar mes" se emiten sus cobros.</p>
                    </div>
                ) : (
                    <>
                        {ventas.length > 0 && (
                            <>
                                <h4 style={{ margin: "0 0 10px", fontSize: "0.72rem", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-label)" }}>
                                    Ventas a plazos
                                </h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                                    {ventas.map(cuota => (
                                        <TarjetaCuota key={cuota.id} cuota={cuota}
                                            onAlternar={alternar} onEditar={iniciarEdicion} onEliminar={setConfirmandoEliminar} />
                                    ))}
                                </div>
                            </>
                        )}
                        {cuotasPuras.length > 0 && (
                            <>
                                <h4 style={{ margin: "0 0 10px", fontSize: "0.72rem", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-label)" }}>
                                    Cuotas recurrentes
                                </h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {cuotasPuras.map(cuota => (
                                        <TarjetaCuota key={cuota.id} cuota={cuota}
                                            onAlternar={alternar} onEditar={iniciarEdicion} onEliminar={setConfirmandoEliminar} />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
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
                            ¿Eliminar la {confirmandoEliminar.tipo === "venta" ? "venta" : "cuota"} de {confirmandoEliminar.cliente_nombre}?
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-main)" }}>
                            Los cobros ya generados se conservan (quedan huérfanos pero sigue su historial y saldo).
                            Las siguientes generaciones ya no los emitirán.
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

/** Tarjeta compartida de cuota o venta (progreso de meta incluido). */
function TarjetaCuota({ cuota: cuota, onAlternar, onEditar, onEliminar }: {
    cuota: CuotaCliente
    onAlternar: (c: CuotaCliente) => void
    onEditar: (c: CuotaCliente) => void
    onEliminar: (c: CuotaCliente) => void
}) {
    const esVenta = (cuota.tipo || "cuota") === "venta"
    return (
        <div style={{
            borderRadius: 14, background: "var(--bg-card)", padding: "14px 16px",
            border: "1px solid var(--border-light)",
            opacity: cuota.activo ? 1 : 0.55,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                        {cuota.cliente_nombre}
                        {esVenta && (
                            <span style={{
                                marginLeft: 8, padding: "1px 8px", borderRadius: 20,
                                background: "rgba(180,83,9,0.12)", color: "#b45309",
                                fontSize: "0.62rem", fontWeight: 800, letterSpacing: 0.4,
                            }}>
                                VENTA
                            </span>
                        )}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        {cuota.concepto} · {textoRecurrencia(cuota.frecuencia, cuota)}
                    </p>
                    {esVenta && cuota.costo != null && Number(cuota.costo) > 0 && cuota.monto_meta != null && (
                        <p style={{ margin: "4px 0 0", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)" }}>
                            Costo {fmt(Number(cuota.costo))} · Ganancia{" "}
                            <span style={{ color: cuota.ganancia != null && cuota.ganancia >= 0 ? "#2e7d32" : "#c62828" }}>
                                {cuota.ganancia != null ? fmt(cuota.ganancia) : "—"}
                            </span>
                        </p>
                    )}
                    {cuota.monto_meta != null && Number(cuota.monto_meta) > 0 && (
                        <div style={{ marginTop: 6 }}>
                            <div style={{ height: 5, borderRadius: 4, background: "var(--bg-card2)", overflow: "hidden" }}>
                                <div style={{
                                    height: "100%",
                                    width: `${Math.min(100, Math.max(0, (Number(cuota.abonado_meta) / Number(cuota.monto_meta)) * 100))}%`,
                                    background: Number(cuota.abonado_meta) >= Number(cuota.monto_meta) ? "#2e7d32" : "var(--primary-mid)",
                                    borderRadius: 4,
                                }} />
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: "0.7rem", fontWeight: 700 }}>
                                {Number(cuota.abonado_meta) >= Number(cuota.monto_meta) ? (
                                    <span style={{ color: "#2e7d32" }}>
                                        {esVenta ? "Pagada: " : "Liquidada: "}
                                        {fmt(Number(cuota.abonado_meta))} de {fmt(Number(cuota.monto_meta))}
                                    </span>
                                ) : (
                                    <span style={{ color: "var(--text-muted)" }}>
                                        Abonado {fmt(Number(cuota.abonado_meta))} de {fmt(Number(cuota.monto_meta))}
                                        {Number(cuota.programado_meta) >= Number(cuota.monto_meta)
                                            ? " · plan ya emitido completo"
                                            : ""}
                                    </span>
                                )}
                            </p>
                        </div>
                    )}
                </div>
                <p style={{ margin: 0, fontWeight: 800, color: "var(--text-main)" }}>
                    {fmt(cuota.monto)}{cuota.frecuencia === "semanal" ? "/semana" : cuota.frecuencia === "quincenal" ? "/quincena" : "/mes"}
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={() => onAlternar(cuota)} title={cuota.activo ? "Desactivar" : "Activar"}
                        style={{
                            border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
                            background: cuota.activo ? "rgba(76,175,80,0.12)" : "var(--bg-card2)",
                            color: cuota.activo ? "#2e7d32" : "var(--text-muted)",
                        }}>
                        <Icon name={cuota.activo ? "ToggleRight" : "ToggleLeft"} size={18} />
                    </button>
                    <button onClick={() => onEditar(cuota)} title="Editar"
                        style={{
                            border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
                            background: "var(--bg-card2)", color: "var(--text-main)",
                        }}>
                        <Icon name="Pencil" size={16} />
                    </button>
                    <button onClick={() => onEliminar(cuota)} title="Eliminar"
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
