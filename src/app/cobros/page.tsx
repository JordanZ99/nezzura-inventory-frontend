"use client"
// ==============================================================================
// src/app/cobros/page.tsx
// Gestion de Cobros (giro 'servicios', migración 061).
// Orquestador estilo gastos/page.tsx: tabs (Cobros | Cuotas), stats de aging,
// lista con abonos, y modales de alta/edición (extra) + registrar pago.
// ==============================================================================

import { useEffect, useRef, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import PageHeader from "@/components/ui/PageHeader"
import ModalConfirmacion from "@/components/ui/ModalConfirmacion"
import Icon from "@/components/ui/Icon"
import { ToastBanner, useToast } from "@/components/ui/Toast"
import StatsCobros from "@/components/cobros/StatsCobros"
import ListaCobros from "@/components/cobros/ListaCobros"
import GestionCuotas from "@/components/cobros/GestionCuotas"
import { api } from "@/lib/api"
import { periodoActual, useAccionesCobros, useCobrosLista, useCuotas, useResumenCobros } from "@/hooks/useCobros"
import type { Cobro, EntradaPrograma } from "@/types"

interface ClienteOption { id: string; nombre: string }

type Tab = "cobros" | "cuotas"
type ModoExtra = "nuevo" | "editar" | null

interface FormExtra {
    cliente_id: string
    concepto: string
    monto: string
    vencimiento: string
    notas: string
    programa: EntradaPrograma[]
}

interface FormPago {
    monto: string
    metodo: string
    fecha: string
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function Cobros() {
    const { mostrarMsg } = useToast()
    const [tab, setTab] = useState<Tab>("cobros")
    const [periodo, setPeriodo] = useState(periodoActual())
    const [soloPendientes, setSoloPendientes] = useState(false)

    const { resumen, cargando: cargandoResumen } = useResumenCobros()

    // En "Todos" (periodo vacío) se ve la cartera completa, pagados incluidos.
    const { cobros, cargando: cargandoLista } = useCobrosLista({
        periodo: periodo || undefined,
        solo_pendientes: soloPendientes,
    })

    const { clientesQuery } = useClientesOptions()
    const clientes: ClienteOption[] = clientesQuery.data ?? []

    const acciones = useAccionesCobros()

    // Mig 065: al entrar a la tab corre el generador del mes (idempotente, el
    // mismo POST del dashboard) — las cuotas nuevas nacen sin que nadie pulse
    // nada. El toast solo suena si realmente creó cobros. El ref evita
    // duplicar la llamada con el remount de React StrictMode.
    const autoGeneroHecho = useRef(false)
    useEffect(() => {
        if (autoGeneroHecho.current) return
        autoGeneroHecho.current = true
        acciones.generar(periodoActual())
            .then(r => { if (r.creados > 0) mostrarMsg(true, `Se generaron ${r.creados} cobro(s) del mes`) })
            .catch(() => {})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Cuotas activas para el estado vacío inteligente (banner de la mig 065).
    const { cuotas: cuotasActivas } = useCuotas(true)

    // ── Modal: cobro extra (alta/edición) ──
    const [modoExtra, setModoExtra] = useState<ModoExtra>(null)
    const [extraEditando, setExtraEditando] = useState<Cobro | null>(null)
    const [formExtra, setFormExtra] = useState<FormExtra>(FORM_EXTRA_VACIO(hoyISO()))
    const [guardandoExtra, setGuardandoExtra] = useState(false)

    // ── Modal: registrar abono ──
    const [pagoPara, setPagoPara] = useState<Cobro | null>(null)
    const [formPago, setFormPago] = useState<FormPago>({ monto: "", metodo: "transferencia", fecha: hoyISO() })
    const [guardandoPago, setGuardandoPago] = useState(false)

    // ── Modal: eliminar cobro ──
    const [confirmandoEliminar, setConfirmandoEliminar] = useState<Cobro | null>(null)

    function abrirNuevoExtra() {
        setExtraEditando(null)
        setFormExtra(FORM_EXTRA_VACIO(hoyISO()))
        setModoExtra("nuevo")
    }

    function abrirEditarExtra(cobro: Cobro) {
        setExtraEditando(cobro)
        setFormExtra({
            cliente_id: cobro.cliente_id,
            concepto: cobro.concepto,
            monto: String(cobro.monto),
            vencimiento: cobro.vencimiento ? cobro.vencimiento.slice(0, 10) : "",
            notas: cobro.notas || "",
            programa: cobro.programa,
        })
        setModoExtra("editar")
    }

    async function guardarExtra() {
        const monto = Number(formExtra.monto)
        if (!formExtra.cliente_id || !formExtra.concepto.trim() || !(monto > 0)) {
            mostrarMsg(false, "Cliente, concepto y monto mayor a 0 son obligatorios")
            return
        }
        const programaLimpio = formExtra.programa.filter(p => p.etiqueta.trim() && Number(p.monto) > 0 && p.fecha)
        try {
            setGuardandoExtra(true)
            if (modoExtra === "editar" && extraEditando) {
                await acciones.actualizarCobro({
                    id: extraEditando.id,
                    data: {
                        concepto: formExtra.concepto.trim(),
                        monto,
                        vencimiento: formExtra.vencimiento || "",
                        programa: programaLimpio,
                        notas: formExtra.notas.trim(),
                    },
                })
                mostrarMsg(true, "Cobro actualizado")
            } else {
                await acciones.crearExtra({
                    cliente_id: formExtra.cliente_id,
                    concepto: formExtra.concepto.trim(),
                    monto,
                    vencimiento: formExtra.vencimiento || null,
                    programa: programaLimpio.length ? programaLimpio : undefined,
                    notas: formExtra.notas.trim() || undefined,
                })
                mostrarMsg(true, "Cobro extra creado")
            }
            setModoExtra(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al guardar el cobro")
        } finally {
            setGuardandoExtra(false)
        }
    }

    function abrirPago(cobro: Cobro) {
        setPagoPara(cobro)
        setFormPago({ monto: String(cobro.saldo), metodo: "transferencia", fecha: hoyISO() })
    }

    async function guardarPago() {
        if (!pagoPara) return
        const monto = Number(formPago.monto)
        if (!(monto > 0)) {
            mostrarMsg(false, "El abono debe ser mayor a 0")
            return
        }
        try {
            setGuardandoPago(true)
            await acciones.abonar({
                id: pagoPara.id,
                data: {
                    monto,
                    metodo: formPago.metodo as "efectivo" | "transferencia" | "tarjeta" | "otro" | null,
                    fecha: formPago.fecha || undefined,
                },
            })
            mostrarMsg(true, monto >= pagoPara.saldo ? "Cobro liquidado" : "Abono registrado")
            setPagoPara(null)
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al registrar el abono")
        } finally {
            setGuardandoPago(false)
        }
    }

    async function generarMes() {
        if (!periodo) {
            mostrarMsg(false, "Elige el periodo (mes) a generar")
            return
        }
        try {
            const r = await acciones.generar(periodo)
            mostrarMsg(true, r.mensaje || "Generación lista")
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al generar el mes")
        }
    }

    async function eliminarCobro() {
        if (!confirmandoEliminar) return
        try {
            const r = await acciones.eliminarCobro(confirmandoEliminar.id)
            mostrarMsg(true, r.mensaje || "Cobro eliminado")
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error al eliminar el cobro")
        } finally {
            setConfirmandoEliminar(null)
        }
    }

    function alternarFiltroPendientes() {
        setSoloPendientes(v => !v)
    }

    return (
        <div style={{ minHeight: "100vh" }}>
            <PageHeader
                gradiente="var(--gradient-1)"
                agColor="var(--ag-color-1)"
                subtitulo="SERVICIOS · CARTERA POR COBRAR"
                subtituloStyle={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}
                titulo="Cobros"
                icono="Wallet"
                iconoEncerrado
                iconoColor="var(--primary-soft)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
            />

            <div style={{ padding: "0 16px", marginTop: -60, position: "relative", zIndex: 1 }}>
                {/* Tabs (patrón TabsGastos: card blanca flotante sobre el hero) */}
                <div className="card" style={{ display: "flex", padding: 6, gap: 4, marginBottom: 20 }}>
                    {([["cobros", "Cobros"], ["cuotas", "Cuotas mensuales"]] as const).map(([clave, etiqueta]) => (
                        <button key={clave} onClick={() => setTab(clave)}
                            style={{
                                flex: 1, minWidth: 80,
                                padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                                background: tab === clave ? "var(--primary-mid)" : "transparent",
                                color: tab === clave ? "#fff" : "var(--text-muted)",
                                fontSize: "0.85rem", fontWeight: 700, transition: "all 0.2s",
                            }}>
                            {etiqueta}
                        </button>
                    ))}
                </div>

                <ToastBanner />

                {tab === "cobros" && (
                    <>
                        {/* Barra de control del periodo */}
                        <div style={{
                            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
                            background: "var(--bg-card)", borderRadius: 14, padding: "12px 14px", marginBottom: 14,
                            border: "1px solid var(--border-light)",
                        }}>
                            <input
                                type="month"
                                value={periodo}
                                onChange={e => setPeriodo(e.target.value)}
                                style={{
                                    padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.8rem",
                                }}
                            />
                            <button onClick={() => setPeriodo("")}
                                title="Ver la cartera completa (todos los periodos)"
                                style={{
                                    padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                                    background: periodo === "" ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: periodo === "" ? "#fff" : "var(--text-main)",
                                    fontSize: "0.78rem", fontWeight: 800,
                                }}>
                                Todos
                            </button>
                            <div style={{ flex: 1 }} />
                            <button onClick={generarMes}
                                style={{
                                    padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                                    background: "var(--bg-card2)", color: "var(--text-main)",
                                    fontSize: "0.78rem", fontWeight: 800,
                                }}>
                                Generar mes
                            </button>
                            <button onClick={abrirNuevoExtra}
                                style={{
                                    padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                                    background: "var(--primary-mid)", color: "#fff",
                                    fontSize: "0.78rem", fontWeight: 800,
                                }}>
                                + Trabajo extra
                            </button>
                        </div>

                        <StatsCobros
                            resumen={resumen}
                            cargando={cargandoResumen}
                            filtroPendientes={soloPendientes}
                            onToggleFiltroPendientes={alternarFiltroPendientes}
                        />

                        {/* Red de seguridad (mig 065): hay cuotas activas pero
                            la lista del periodo quedó vacía — guía a generar. */}
                        {!cargandoLista && cobros.length === 0 && cuotasActivas.length > 0 && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                                padding: "12px 16px", marginBottom: 14, borderRadius: 14,
                                background: "rgba(249,168,37,0.1)", border: "1px solid rgba(249,168,37,0.35)",
                            }}>
                                <Icon name="Info" size={18} color="#b45309" />
                                <p style={{ margin: 0, flex: "1 1 260px", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-main)" }}>
                                    Tienes {cuotasActivas.length} cuota(s) activa(s) sin cobros para {periodo || "este periodo"} —
                                    emítelos con un clic (idempotente, no duplica nada).
                                </p>
                                <button onClick={generarMes}
                                    style={{
                                        padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                                        background: "var(--primary-mid)", color: "#fff", fontSize: "0.78rem", fontWeight: 800,
                                    }}>
                                    Generar mes
                                </button>
                            </div>
                        )}

                        <ListaCobros
                            cobros={cobros}
                            cargando={cargandoLista}
                            onRegistrarPago={abrirPago}
                            onEditarExtra={abrirEditarExtra}
                            onEliminar={setConfirmandoEliminar}
                        />
                    </>
                )}

                {tab === "cuotas" && (
                    <GestionCuotas mostrarMsg={mostrarMsg} />
                )}
            </div>

            {/* ── Modal: cobro extra (alta/edición) ── */}
            {modoExtra !== null && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20, overflowY: "auto",
                }}>
                    <div className="card" style={{
                        maxWidth: 480, width: "100%", padding: 24, display: "flex", flexDirection: "column",
                        border: "1px solid var(--border-light)", maxHeight: "90vh", overflowY: "auto",
                    }}>
                        <h3 style={{ margin: "0 0 14px", fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>
                            {modoExtra === "editar" ? "Editar trabajo extra" : "Nuevo trabajo extra"}
                        </h3>

                        <label style={estLabel}>Cliente</label>
                        <select value={formExtra.cliente_id} onChange={e => setFormExtra({ ...formExtra, cliente_id: e.target.value })} style={estInput}>
                            <option value="">— Selecciona —</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>

                        <label style={estLabel}>Concepto</label>
                        <input value={formExtra.concepto} onChange={e => setFormExtra({ ...formExtra, concepto: e.target.value })}
                            placeholder="App de inventarios v1, cierre de año..." style={estInput} />

                        <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Monto</label>
                                <input type="number" min="0" step="0.01" value={formExtra.monto}
                                    onChange={e => setFormExtra({ ...formExtra, monto: e.target.value })} style={estInput} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Vence (opcional)</label>
                                <input type="date" value={formExtra.vencimiento}
                                    onChange={e => setFormExtra({ ...formExtra, vencimiento: e.target.value })} style={estInput} />
                            </div>
                        </div>

                        {/* Plan de pagos (opcional) */}
                        <div style={{ marginTop: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <label style={{ ...estLabel, margin: 0 }}>Plan de pagos (opcional)</label>
                                <button
                                    onClick={() => setFormExtra(prev => ({
                                        ...prev,
                                        programa: [...prev.programa, { etiqueta: "", monto: 0, fecha: "" }],
                                    }))}
                                    style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary-mid)", fontWeight: 800, fontSize: "0.75rem" }}>
                                    + Agregar pago
                                </button>
                            </div>
                            {formExtra.programa.length === 0 && (
                                <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    Ej.: Anticipo 50% / Entrega final 50% con sus fechas comprometidas.
                                </p>
                            )}
                            {formExtra.programa.map((p, i) => (
                                <div key={i} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                    <input placeholder="Etiqueta" value={p.etiqueta}
                                        onChange={e => {
                                            const programa = [...formExtra.programa]; programa[i] = { ...programa[i], etiqueta: e.target.value }
                                            setFormExtra({ ...formExtra, programa })
                                        }} style={{ ...estInput, flex: 2 }} />
                                    <input placeholder="$" type="number" min="0" step="0.01" value={p.monto || ""}
                                        onChange={e => {
                                            const programa = [...formExtra.programa]; programa[i] = { ...programa[i], monto: Number(e.target.value) || 0 }
                                            setFormExtra({ ...formExtra, programa })
                                        }} style={{ ...estInput, flex: 1 }} />
                                    <input type="date" value={p.fecha}
                                        onChange={e => {
                                            const programa = [...formExtra.programa]; programa[i] = { ...programa[i], fecha: e.target.value }
                                            setFormExtra({ ...formExtra, programa })
                                        }} style={{ ...estInput, flex: 1.4 }} />
                                    <button title="Quitar"
                                        onClick={() => setFormExtra({ ...formExtra, programa: formExtra.programa.filter((_, j) => j !== i) })}
                                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                                        <Icon name="X" size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <label style={estLabel}>Notas</label>
                        <input value={formExtra.notas} onChange={e => setFormExtra({ ...formExtra, notas: e.target.value })}
                            placeholder="Detalle del acuerdo" style={estInput} />

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                            <button onClick={() => setModoExtra(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={guardarExtra} disabled={guardandoExtra}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "var(--primary-mid)", color: "#fff", fontWeight: 800,
                                    cursor: guardandoExtra ? "wait" : "pointer",
                                }}>
                                {guardandoExtra ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: registrar abono ── */}
            {pagoPara && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20,
                }}>
                    <div className="card" style={{ maxWidth: 400, width: "100%", padding: 24, display: "flex", flexDirection: "column", border: "1px solid var(--border-light)" }}>
                        <h3 style={{ margin: "0 0 4px", fontSize: "1.02rem", fontWeight: 800, color: "var(--text-main)" }}>
                            Abonar a {pagoPara.cliente_nombre}
                        </h3>
                        <p style={{ margin: "0 0 12px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                            {pagoPara.concepto} · saldo {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(pagoPara.saldo)}
                        </p>

                        <label style={estLabel}>Monto del abono</label>
                        <input type="number" min="0" step="0.01" value={formPago.monto}
                            onChange={e => setFormPago({ ...formPago, monto: e.target.value })} style={estInput} />

                        <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Método</label>
                                <select value={formPago.metodo} onChange={e => setFormPago({ ...formPago, metodo: e.target.value })} style={estInput}>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={estLabel}>Fecha</label>
                                <input type="date" value={formPago.fecha} max={hoyISO()}
                                    onChange={e => setFormPago({ ...formPago, fecha: e.target.value })} style={estInput} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                            <button onClick={() => setPagoPara(null)}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                                }}>
                                Cancelar
                            </button>
                            <button onClick={guardarPago} disabled={guardandoPago}
                                style={{
                                    padding: "10px 18px", borderRadius: 10, border: "none",
                                    background: "var(--primary-alter)", color: "#fff", fontWeight: 800,
                                    cursor: guardandoPago ? "wait" : "pointer",
                                }}>
                                {guardandoPago ? "Registrando..." : "Registrar abono"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: eliminar cobro ── */}
            {confirmandoEliminar && (
                <ModalConfirmacion
                    icon="Trash2"
                    iconBg="rgba(229,57,53,0.12)"
                    iconColor="#b71c1c"
                    titulo="¿Eliminar este cobro?"
                    mensaje={`Se eliminará el cobro "${confirmandoEliminar.concepto}" de ${confirmandoEliminar.cliente_nombre} y sus abonos registrados. Úsalo solo si la deuda fue capturada mal.`}
                    btnConfirmar="Eliminar"
                    btnColor="#e53935"
                    onCancelar={() => setConfirmandoEliminar(null)}
                    onConfirmar={eliminarCobro}
                />
            )}
        </div>
    )
}

/** Opciones de clientes para los selects (cartera completa incluida inactiva). */
function useClientesOptions() {
    const clientesQuery = useQueries({ queries: [{ queryKey: ["cobros", "clientes-select"], queryFn: () => api.getClientes(), staleTime: 60_000 }] })[0]
    return { clientesQuery }
}

function FORM_EXTRA_VACIO(hoy: string): FormExtra {
    return { cliente_id: "", concepto: "", monto: "", vencimiento: hoy, notas: "", programa: [] }
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
