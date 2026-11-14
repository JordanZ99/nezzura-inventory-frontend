"use client"
// ==============================================================================
// src/app/ordenes/page.tsx
// Órdenes de servicio (giro 'servicios', migración 077): el registro del
// TRABAJO — reparaciones, instalaciones, consultoría, mantenimiento o lo que
// salga. Filtros por estado (cola "Abiertas" por default), alta/edición en
// modal, cambio de estado inline en la lista y "Convertir en cobro" (cobro
// puntual o venta a plazos, enlazado por cobro_id).
// ==============================================================================

import { useState } from "react"
import PageHeader from "@/components/ui/PageHeader"
import ModalConfirmacion from "@/components/ui/ModalConfirmacion"
import Icon from "@/components/ui/Icon"
import { ToastBanner, useToast } from "@/components/ui/Toast"
import ListaOrdenes from "@/components/ordenes/ListaOrdenes"
import { cobrosApi } from "@/lib/api/cobros"
import { api } from "@/lib/api"
import { useOrdenes, useAccionesOrdenes } from "@/hooks/useOrdenes"
import { useQueries } from "@tanstack/react-query"
import { ESTADOS_ORDEN, TIPOS_ORDEN, type EstadoOrden, type OrdenServicio, type TipoOrden } from "@/types"

interface ClienteOption { id: string; nombre: string }

type FiltroEstado = "abiertas" | "todas" | EstadoOrden

interface FormOrden {
    titulo: string
    tipo: TipoOrden
    cliente_id: string
    equipo: string
    detalle_reportado: string
    solucion: string
    estado: EstadoOrden
    fecha_recibido: string
    precio: string
    notas: string
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

const FORM_VACIO: FormOrden = {
    titulo: "", tipo: "otro", cliente_id: "", equipo: "",
    detalle_reportado: "", solucion: "", estado: "recibido",
    fecha_recibido: hoyISO(), precio: "", notas: "",
}

// Filtros visibles: la cola de trabajo vivo + cada estado individual.
const FILTROS: FiltroEstado[] = [
    "abiertas", "todas", "recibido", "en_proceso", "esperando", "listo", "entregado", "cancelado",
]

const ETIQUETA_FILTRO: Record<FiltroEstado, string> = {
    abiertas: "Abiertas",
    todas: "Todas",
    ...ESTADOS_ORDEN,
}

export default function Ordenes() {
    const { mostrarMsg } = useToast()
    const { ordenes, cargando } = useOrdenes({})
    const acciones = useAccionesOrdenes()

    const [filtro, setFiltro] = useState<FiltroEstado>("abiertas")
    const { clientesQuery } = useClientesOptions()
    const clientes: ClienteOption[] = clientesQuery.data ?? []

    // ── Modal: alta/edición de orden ──
    const [modoOrden, setModoOrden] = useState<"nuevo" | "editar" | null>(null)
    const [ordenEditando, setOrdenEditando] = useState<OrdenServicio | null>(null)
    const [form, setForm] = useState<FormOrden>(FORM_VACIO)
    const [guardando, setGuardando] = useState(false)

    // ── Modal: convertir en cobro ──
    const [cobrarPara, setCobrarPara] = useState<OrdenServicio | null>(null)
    const [formCobro, setFormCobro] = useState({
        monto: "", modo: "puntual" as "puntual" | "plazos",
        frecuencia: "mensual" as "mensual" | "semanal" | "quincenal", dia: "1",
        precio_total: "",
    })
    const [cobrando, setCobrando] = useState(false)

    // ── Modal: eliminar ──
    const [confirmandoEliminar, setConfirmandoEliminar] = useState<OrdenServicio | null>(null)

    const visibles = filtro === "abiertas"
        ? ordenes.filter(o => o.estado !== "entregado" && o.estado !== "cancelado")
        : filtro === "todas"
            ? ordenes
            : ordenes.filter(o => o.estado === filtro)

    function abrirNueva() {
        setOrdenEditando(null)
        setForm({ ...FORM_VACIO, fecha_recibido: hoyISO() })
        setModoOrden("nuevo")
    }

    function abrirEdicion(o: OrdenServicio) {
        setOrdenEditando(o)
        setForm({
            titulo: o.titulo,
            tipo: o.tipo,
            cliente_id: o.cliente_id || "",
            equipo: o.equipo || "",
            detalle_reportado: o.detalle_reportado || "",
            solucion: o.solucion || "",
            estado: o.estado,
            fecha_recibido: o.fecha_recibido?.slice(0, 10) || hoyISO(),
            precio: o.precio != null ? String(o.precio) : "",
            notas: o.notas || "",
        })
        setModoOrden("editar")
    }

    async function guardarOrden() {
        if (!form.titulo.trim()) {
            mostrarMsg(false, "El título del trabajo es obligatorio")
            return
        }
        const precioTexto = form.precio.trim()
        if (precioTexto && !(Number(precioTexto) >= 0)) {
            mostrarMsg(false, "El precio no puede ser negativo")
            return
        }
        try {
            setGuardando(true)
            if (modoOrden === "editar" && ordenEditando) {
                await acciones.actualizar({
                    id: ordenEditando.id,
                    data: {
                        titulo: form.titulo.trim(),
                        tipo: form.tipo,
                        cliente_id: form.cliente_id || null,
                        equipo: form.equipo.trim() || null,
                        detalle_reportado: form.detalle_reportado.trim() || null,
                        solucion: form.solucion.trim() || null,
                        estado: form.estado,
                        fecha_recibido: form.fecha_recibido || undefined,
                        precio: precioTexto ? Number(precioTexto) : 0,
                        notas: form.notas.trim() || null,
                    },
                })
                mostrarMsg(true, "Orden actualizada")
            } else {
                await acciones.crear({
                    titulo: form.titulo.trim(),
                    tipo: form.tipo,
                    cliente_id: form.cliente_id || null,
                    equipo: form.equipo.trim() || null,
                    detalle_reportado: form.detalle_reportado.trim() || null,
                    solucion: form.solucion.trim() || null,
                    estado: form.estado,
                    fecha_recibido: form.fecha_recibido || undefined,
                    precio: precioTexto ? Number(precioTexto) : undefined,
                    notas: form.notas.trim() || undefined,
                })
                mostrarMsg(true, "Orden creada")
            }
            setModoOrden(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al guardar la orden")
        } finally {
            setGuardando(false)
        }
    }

    async function eliminarOrden() {
        if (!confirmandoEliminar) return
        try {
            const r = await acciones.eliminar(confirmandoEliminar.id)
            mostrarMsg(true, r.mensaje || "Orden eliminada")
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al eliminar la orden")
        } finally {
            setConfirmandoEliminar(null)
        }
    }

    function abrirCobrar(o: OrdenServicio) {
        setCobrarPara(o)
        setFormCobro({ monto: o.precio != null ? String(o.precio) : "", modo: "puntual", frecuencia: "mensual", dia: "1", precio_total: o.precio != null ? String(o.precio) : "" })
    }

    async function guardarCobro() {
        if (!cobrarPara) return
        const monto = Number(formCobro.monto)
        if (!(monto > 0)) {
            mostrarMsg(false, "El monto debe ser mayor a 0")
            return
        }
        if (!cobrarPara.cliente_id) {
            mostrarMsg(false, "La orden necesita cliente para cobrarse")
            return
        }
        try {
            setCobrando(true)
            if (formCobro.modo === "puntual") {
                // Cobro puntual: una deuda con el título de la orden.
                const r = await cobrosApi.crearExtra({
                    cliente_id: cobrarPara.cliente_id,
                    concepto: cobrarPara.titulo,
                    monto,
                    notas: "Generado por la orden de servicio",
                })
                await acciones.actualizar({ id: cobrarPara.id, data: { cobro_id: r.cobro.id } })
                mostrarMsg(true, "Cobro puntual creado y enlazado")
            } else {
                // Venta a plazos: cuota tipo 'venta' (el generador emite los abonos).
                const meta = Number(formCobro.precio_total) || monto
                const dia = Math.min(Math.max(Number(formCobro.dia) || 1, 1), 28)
                const r = await cobrosApi.crearCuota({
                    cliente_id: cobrarPara.cliente_id,
                    concepto: cobrarPara.titulo,
                    monto,
                    frecuencia: formCobro.frecuencia,
                    dia_cobro: dia,
                    dia_semana: null,
                    monto_meta: meta,
                    tipo: "venta",
                    notas: "Generada por la orden de servicio",
                })
                // El primer cobro de la venta nace al generar el periodo; la
                // orden queda enlazada a la CUOTA (la fuente de los cobros).
                await acciones.actualizar({ id: cobrarPara.id, data: { cuota_id: r.cuota.id } })
                mostrarMsg(true, "Venta a plazos creada — genera el mes en Cobros para emitir sus abonos")
            }
            setCobrarPara(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al crear el cobro")
        } finally {
            setCobrando(false)
        }
    }

    return (
        <div style={{ minHeight: "100vh" }}>
            <PageHeader
                gradiente="var(--gradient-1)"
                agColor="var(--ag-color-1)"
                subtitulo="SERVICIOS · TRABAJO EN CAMPO"
                subtituloStyle={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}
                titulo="Órdenes"
                icono="Wrench"
                iconoEncerrado
                iconoColor="var(--primary-soft)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
            />

            <div style={{ padding: "0 16px", marginTop: -60, position: "relative", zIndex: 1, paddingBottom: 40 }}>
                {/* Barra de control: filtros + nueva orden */}
                <div style={{
                    display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
                    background: "var(--bg-card)", borderRadius: 14, padding: "12px 14px", marginBottom: 14,
                    border: "1px solid var(--border-light)",
                }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                        {FILTROS.map(f => (
                            <button key={f} onClick={() => setFiltro(f)}
                                style={{
                                    padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                                    background: filtro === f ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: filtro === f ? "#fff" : "var(--text-main)",
                                    fontSize: "0.72rem", fontWeight: 800,
                                }}>
                                {ETIQUETA_FILTRO[f]}
                            </button>
                        ))}
                    </div>
                    <button onClick={abrirNueva}
                        style={{
                            padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                            background: "var(--primary-mid)", color: "#fff",
                            fontSize: "0.78rem", fontWeight: 800,
                        }}>
                        + Nueva orden
                    </button>
                </div>

                <ToastBanner />

                <ListaOrdenes
                    ordenes={visibles}
                    cargando={cargando}
                    onEditar={abrirEdicion}
                    onCobrar={abrirCobrar}
                    onEliminar={setConfirmandoEliminar}
                    mostrarMsg={mostrarMsg}
                />
            </div>

            {/* ── Modal: orden (alta/edición) ── */}
            {modoOrden !== null && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20, overflowY: "auto",
                }}>
                    <div className="card" style={{
                        maxWidth: 480, width: "100%", padding: 24, display: "flex", flexDirection: "column",
                        border: "1px solid var(--border-light)", maxHeight: "90vh", overflowY: "auto",
                    }}>
                        <h3 style={{ margin: "0 0 14px", fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>
                            {modoOrden === "editar" ? "Editar orden" : "Nueva orden"}
                        </h3>

                        <label style={estLabel}>Título del trabajo</label>
                        <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
                            placeholder="Cambio de pantalla iPhone 11..." style={estInput} />

                        <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Tipo</label>
                                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoOrden })} style={estInput}>
                                    {(Object.keys(TIPOS_ORDEN) as TipoOrden[]).map(t => (
                                        <option key={t} value={t}>{TIPOS_ORDEN[t]}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Cliente (opcional)</label>
                                <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })} style={estInput}>
                                    <option value="">— Sin cliente —</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                        </div>

                        <label style={estLabel}>Sobre qué se trabaja (opcional)</label>
                        <input value={form.equipo} onChange={e => setForm({ ...form, equipo: e.target.value })}
                            placeholder="iPhone 11 · IMEI 123..., dominio, local..." style={estInput} />

                        <label style={estLabel}>Lo que reportó el cliente (opcional)</label>
                        <textarea value={form.detalle_reportado} onChange={e => setForm({ ...form, detalle_reportado: e.target.value })}
                            placeholder="En sus palabras: 'no carga y se apaga solo'" rows={2} style={{ ...estInput, resize: "vertical" }} />

                        <label style={estLabel}>Lo que se hizo / encontró (opcional)</label>
                        <textarea value={form.solucion} onChange={e => setForm({ ...form, solucion: e.target.value })}
                            placeholder="Diagnóstico, cambio de pieza, resultado..." rows={2} style={{ ...estInput, resize: "vertical" }} />

                        <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Precio (opcional)</label>
                                <input type="number" min="0" step="0.01" value={form.precio}
                                    onChange={e => setForm({ ...form, precio: e.target.value })} style={estInput} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Recibida</label>
                                <input type="date" value={form.fecha_recibido}
                                    onChange={e => setForm({ ...form, fecha_recibido: e.target.value })} style={estInput} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Estado</label>
                                <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as EstadoOrden })} style={estInput}>
                                    {(Object.keys(ESTADOS_ORDEN) as EstadoOrden[]).map(e => (
                                        <option key={e} value={e}>{ESTADOS_ORDEN[e]}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Notas</label>
                                <input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={estInput} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                            <button onClick={() => setModoOrden(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={guardarOrden} disabled={guardando}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "var(--primary-mid)", color: "#fff", fontWeight: 800,
                                    cursor: guardando ? "wait" : "pointer",
                                }}>
                                {guardando ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: convertir en cobro ── */}
            {cobrarPara && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20,
                }}>
                    <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24, display: "flex", flexDirection: "column", border: "1px solid var(--border-light)", maxHeight: "90vh", overflowY: "auto" }}>
                        <h3 style={{ margin: "0 0 4px", fontSize: "1.02rem", fontWeight: 800, color: "var(--text-main)" }}>
                            Cobrar "{cobrarPara.titulo}"
                        </h3>
                        <p style={{ margin: "0 0 12px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                            A {cobrarPara.cliente_nombre || "sin cliente"} · el dinero vive en Cobros; aquí queda el enlace.
                        </p>

                        <label style={estLabel}>¿Cómo se cobra?</label>
                        <select value={formCobro.modo} onChange={e => setFormCobro({ ...formCobro, modo: e.target.value as "puntual" | "plazos" })} style={estInput}>
                            <option value="puntual">Cobro puntual (una deuda)</option>
                            <option value="plazos">Venta a plazos (cuota recurrente)</option>
                        </select>

                        {formCobro.modo === "plazos" && (
                            <>
                                <label style={estLabel}>Frecuencia del abono</label>
                                <select value={formCobro.frecuencia}
                                    onChange={e => setFormCobro({ ...formCobro, frecuencia: e.target.value as "mensual" | "semanal" | "quincenal" })}
                                    style={estInput}>
                                    <option value="mensual">Mensual</option>
                                    <option value="semanal">Semanal</option>
                                    <option value="quincenal">Quincenal (día 1 y 15)</option>
                                </select>
                                {formCobro.frecuencia === "mensual" && (
                                    <>
                                        <label style={estLabel}>Día de cobro (1–28)</label>
                                        <input type="number" min="1" max="28" value={formCobro.dia}
                                            onChange={e => setFormCobro({ ...formCobro, dia: e.target.value })} style={estInput} />
                                    </>
                                )}
                                <label style={estLabel}>Precio total de la venta</label>
                                <input type="number" min="0" step="0.01" value={formCobro.precio_total}
                                    onChange={e => setFormCobro({ ...formCobro, precio_total: e.target.value })} style={estInput} />
                            </>
                        )}

                        <label style={estLabel}>{formCobro.modo === "puntual" ? "Monto" : "Abono por periodo"}</label>
                        <input type="number" min="0" step="0.01" value={formCobro.monto}
                            onChange={e => setFormCobro({ ...formCobro, monto: e.target.value })} style={estInput} />

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                            <button onClick={() => setCobrarPara(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={guardarCobro} disabled={cobrando}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "var(--primary-alter)", color: "#fff", fontWeight: 800,
                                    cursor: cobrando ? "wait" : "pointer",
                                }}>
                                {cobrando ? "Creando..." : "Crear cobro"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: eliminar orden ── */}
            {confirmandoEliminar && (
                <ModalConfirmacion
                    icon="Trash2"
                    iconBg="rgba(229,57,53,0.12)"
                    iconColor="#b71c1c"
                    titulo="¿Eliminar esta orden?"
                    mensaje={`Se eliminará la orden "${confirmandoEliminar.titulo}". Si tiene cobro enlazado, el cobro NO se borra (solo pierde el enlace).`}
                    btnConfirmar="Eliminar"
                    btnColor="#e53935"
                    onCancelar={() => setConfirmandoEliminar(null)}
                    onConfirmar={eliminarOrden}
                />
            )}
        </div>
    )
}

/** Opciones de clientes para los selects (cartera completa). */
function useClientesOptions() {
    const clientesQuery = useQueries({ queries: [{ queryKey: ["ordenes", "clientes-select"], queryFn: () => api.getClientes(), staleTime: 60_000 }] })[0]
    return { clientesQuery }
}

const estLabel: React.CSSProperties = {
    display: "block", margin: "12px 0 6px", fontSize: "0.68rem", fontWeight: 700,
    letterSpacing: 1, textTransform: "uppercase", color: "var(--text-label)",
}

const estInput: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
    color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 600,
    boxSizing: "border-box",
}
