// ==============================================================================
// src/components/estadisticas/TabClientes.tsx
// Tab "Clientes" del panel estadístico (Fase A del sistema de puntos):
//  - KPIs del programa de fidelización: qué tanto influye en las ventas,
//    cuántos puntos se otorgan vs canjean y cuánto queda en circulación.
//  - Cartera: búsqueda + alta de clientes (campos según la config del negocio)
//    + edición + ajuste manual de puntos (dar/quitar) + baja lógica.
// El saldo de puntos SIEMPRE viene del ledger (puntos_movimientos).
// ==============================================================================

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LineChart, BarChart } from "@tremor/react"
import Icon from "@/components/ui/Icon"
import { api } from "@/lib/api"
import type { Cliente, ClienteCampos, ResumenClientes } from "@/types"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"
import { useChartColors } from "@/hooks/useChartColors"
import type { RangoFechas } from "@/lib/api"

const fmtDinero = (n: number) => `$${new Intl.NumberFormat("us").format(Number(n.toFixed(2)))}`
const fmtFecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" }) : "—"
const fmtEntero = (n: number) => new Intl.NumberFormat("us").format(Math.round(n))

interface Props {
    rango: RangoFechas
    todo: boolean
}

interface FormCliente {
    nombre: string
    email: string
    telefono: string
    pin: string
    notas: string
}

const FORM_VACIO: FormCliente = { nombre: "", email: "", telefono: "", pin: "", notas: "" }

export default function TabClientes({ rango, todo }: Props) {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const { mostrarMsg } = useToast()
    const queryClient = useQueryClient()

    const campos: ClienteCampos = tenant?.cliente_campos ?? {
        email: { activo: true, requerido: true },
        telefono: { activo: true, requerido: true },
        pin: { activo: false, requerido: false },
    }
    const valorPunto = tenant?.puntos_valor_punto ?? 1

    // ── Búsqueda (debounce) + filtros de la tabla ──
    const [busqueda, setBusqueda] = useState("")
    const [busquedaDebounced, setBusquedaDebounced] = useState("")
    useEffect(() => {
        const t = setTimeout(() => setBusquedaDebounced(busqueda), 350)
        return () => clearTimeout(t)
    }, [busqueda])
    const [incluirInactivos, setIncluirInactivos] = useState(false)

    // ── Datos (respuestas de la BDD) ──
    // El rango se comparte con la tab "Ventas": cada período se cachea aparte.
    const rangoKey = `${rango.desde ?? ""}|${rango.hasta ?? ""}|${todo ? "todo" : ""}`
    const clientesQuery = useQuery({
        queryKey: ["clientes", tenantId, busquedaDebounced, incluirInactivos],
        queryFn: () => api.getClientes({ q: busquedaDebounced || undefined, incluir_inactivos: incluirInactivos }),
        enabled: Boolean(tenantId),
    })
    const statsQuery = useQuery({
        queryKey: ["stats-clientes", tenantId, rangoKey],
        queryFn: () => api.getStatsClientes({ desde: rango.desde, hasta: rango.hasta, todo }),
        enabled: Boolean(tenantId),
    })
    const clientes: Cliente[] = clientesQuery.data ?? []
    const stats: ResumenClientes | null = statsQuery.data ?? null
    const chartColors = useChartColors()

    function invalidar() {
        if (!tenantId) return
        queryClient.invalidateQueries({ queryKey: ["clientes", tenantId] })
        queryClient.invalidateQueries({ queryKey: ["stats-clientes", tenantId] })
    }

    // ── Modal alta/edición de cliente ──
    const [modalAbierto, setModalAbierto] = useState(false)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [editandoNombre, setEditandoNombre] = useState("")
    const [form, setForm] = useState<FormCliente>(FORM_VACIO)
    const [guardando, setGuardando] = useState(false)

    function abrirNuevo() {
        setEditandoId(null)
        setForm(FORM_VACIO)
        setModalAbierto(true)
    }
    function abrirEdicion(c: Cliente) {
        setEditandoId(c.id)
        setEditandoNombre(c.nombre)
        setForm({
            nombre: c.nombre,
            email: c.email || "",
            telefono: c.telefono || "",
            pin: "",
            notas: c.notas || "",
        })
        setModalAbierto(true)
    }

    const faltantesObligatorios = useMemo(() => {
        const f: string[] = []
        if (!form.nombre.trim()) f.push("nombre")
        if (campos.email.requerido && !form.email.trim()) f.push("correo")
        if (campos.telefono.requerido && !form.telefono.trim()) f.push("número")
        if (campos.pin.requerido && editandoId && !form.pin.trim()) f.push("contraseña")
        return f
    }, [form, campos, editandoId])

    async function guardarCliente() {
        if (faltantesObligatorios.length > 0) {
            mostrarMsg(false, `❌ Campos obligatorios: ${faltantesObligatorios.join(", ")}`)
            return
        }
        setGuardando(true)
        try {
            if (editandoId) {
                await api.actualizarCliente(editandoId, {
                    nombre: form.nombre.trim(),
                    email: form.email.trim(),
                    telefono: form.telefono.trim(),
                    ...(campos.pin.activo ? { pin: form.pin.trim() } : {}),
                    notas: form.notas.trim(),
                })
                mostrarMsg(true, "✅ Cliente actualizado")
            } else {
                await api.crearCliente({
                    nombre: form.nombre.trim(),
                    email: form.email.trim() || undefined,
                    telefono: form.telefono.trim() || undefined,
                    pin: campos.pin.activo && form.pin.trim() ? form.pin.trim() : undefined,
                    notas: form.notas.trim() || undefined,
                })
                mostrarMsg(true, `✅ Cliente "${form.nombre.trim()}" agregado a la cartera`)
            }
            setModalAbierto(false)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al guardar"}`)
        } finally {
            setGuardando(false)
        }
    }

    async function darDeBaja(c: Cliente) {
        if (!confirm(`¿Dar de baja a "${c.nombre}"? Conserva su historial y puntos.`)) return
        try {
            await api.eliminarCliente(c.id)
            mostrarMsg(true, "Cliente dado de baja")
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function reactivar(c: Cliente) {
        try {
            await api.actualizarCliente(c.id, { activo: true })
            mostrarMsg(true, "✅ Cliente reactivado")
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    // ── Modal de ajuste manual de puntos (ledger tipo 'ajuste') ──
    const [modalPuntosId, setModalPuntosId] = useState<string | null>(null)
    const [modalPuntosNombre, setModalPuntosNombre] = useState("")
    const [puntosInput, setPuntosInput] = useState("")
    const [conceptoInput, setConceptoInput] = useState("")
    const [guardandoPuntos, setGuardandoPuntos] = useState(false)
    const detalleQuery = useQuery({
        queryKey: ["cliente-detalle", tenantId, modalPuntosId],
        queryFn: () => api.getCliente(modalPuntosId as string),
        enabled: Boolean(tenantId && modalPuntosId),
    })
    const saldoVigente = detalleQuery.data?.saldo_puntos ?? 0
    const movimientos = detalleQuery.data?.movimientos ?? []
    const puntosNum = parseInt(puntosInput, 10) || 0
    const saldoProyectado = saldoVigente + puntosNum

    function abrirAjustePuntos(c: Cliente) {
        setModalPuntosId(c.id)
        setModalPuntosNombre(c.nombre)
        setPuntosInput("")
        setConceptoInput("")
    }

    async function aplicarAjuste() {
        if (!modalPuntosId) return
        if (!puntosNum) {
            mostrarMsg(false, "❌ Indica cuántos puntos dar o quitar")
            return
        }
        if (!conceptoInput.trim()) {
            mostrarMsg(false, "❌ Describe el motivo del ajuste")
            return
        }
        setGuardandoPuntos(true)
        try {
            const r = await api.ajustarPuntos(modalPuntosId, puntosNum, conceptoInput.trim())
            mostrarMsg(true, `✅ ${r.cliente}: saldo ${r.saldo_anterior} → ${r.saldo_nuevo} pts`)
            setModalPuntosId(null)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error en el ajuste"}`)
        } finally {
            setGuardandoPuntos(false)
        }
    }

    /** Copia la lista de contactos de la cartera filtrada (pesta en Excel o
     *  para pegar en una campaña de WhatsApp): Nombre \t Teléfono/Correo. */
    async function copiarContactos() {
        const conContacto = clientes.filter(c => c.telefono || c.email)
        if (!conContacto.length) {
            mostrarMsg(false, "❌ La lista filtrada no tiene contactos para copiar")
            return
        }
        const texto = conContacto.map(c => `${c.nombre}\t${c.telefono || c.email}`).join("\n")
        try {
            await navigator.clipboard.writeText(texto)
            mostrarMsg(true, `📋 ${conContacto.length} contactos copiados — pégalos donde quieras`)
        } catch {
            mostrarMsg(false, "❌ El navegador bloqueó el portapapeles")
        }
    }

    return (
        <div style={{ marginTop: 0 }}>
            {/* ── KPIs del programa de fidelización ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                <CardKpi
                    label="Clientes en la cartera"
                    valor={`${stats?.clientes_activos ?? 0}`}
                    detalle={`${stats?.clientes_total ?? 0} registrados en total`}
                    borde="rgb(var(--chart-1))"
                />
                <CardKpi
                    label="Nuevos en el período"
                    valor={`${stats?.clientes_nuevos_periodo ?? 0}`}
                    detalle={`${(stats?.pct_recurrentes ?? 0).toFixed(0)}% ya volvió a comprar`}
                    borde="rgb(var(--chart-2))"
                />
                <CardKpi
                    label="Ventas identificadas"
                    valor={`${(stats?.pct_identificadas ?? 0).toFixed(0)}%`}
                    detalle={`${stats?.tickets_identificadas ?? 0} de ${stats?.tickets_total ?? 0} tickets`}
                    borde="rgb(var(--chart-3))"
                />
                <CardKpi
                    label="Ticket con vs sin cliente"
                    valor={`${fmtDinero(stats?.ticket_con_cliente ?? 0)}`}
                    detalle={`Sin cliente: ${fmtDinero(stats?.ticket_sin_cliente ?? 0)}`}
                    borde={(stats?.diferencia_ticket ?? 0) >= 0 ? "var(--success-main)" : "var(--error-main)"}
                />
                <CardKpi
                    label="Puntos otorgados"
                    valor={`${Math.round(stats?.puntos_otorgados ?? 0).toLocaleString("us")}`}
                    detalle={`${(stats?.pct_canjeados ?? 0).toFixed(0)}% se ha canjeado`}
                    borde="rgb(var(--chart-4))"
                />
                <CardKpi
                    label="Puntos en circulación"
                    valor={`${Math.round(stats?.saldo_puntos ?? 0).toLocaleString("us")} pts`}
                    detalle={`Pasivo: ${fmtDinero(stats?.pasivo_monetario ?? 0)} (1 pt = ${fmtDinero(valorPunto)})`}
                    borde="var(--primary-alter)"
                />
            </div>

            {/* ── Barra de herramientas de la cartera ── */}
            <div className="card" style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220 }}>
                    <Icon name="Search" size={16} color="var(--text-muted)" />
                    <input
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre, número o correo…"
                        style={{
                            width: "100%", fontSize: "0.8rem", padding: "8px 12px",
                            borderRadius: 10, border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)", color: "var(--text-main)", outline: "none",
                        }}
                    />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}>
                    <input type="checkbox" checked={incluirInactivos} onChange={e => setIncluirInactivos(e.target.checked)} />
                    Incluir dados de baja
                </label>
                <button className="btn-ghost" onClick={copiarContactos} title="Copia los contactos de la cartera filtrada (para campañas de WhatsApp o pegar en Excel)" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="Contact" size={15} /> Copiar contactos
                </button>
                <button className="btn-primary" onClick={abrirNuevo} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="UserPlus" size={16} /> Añadir cliente
                </button>
            </div>

            {/* ── ¿Está funcionando el programa de puntos? (Fase C) ── */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>El programa de puntos en el tiempo</h3>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        {stats && stats.tickets_total > 0
                            ? `${stats.tickets_identificadas} de ${stats.tickets_total} tickets del período están ligados a un cliente`
                            : "Sin ventas identificadas en el período"}
                    </span>
                </div>
                {(stats?.serie?.length ?? 0) === 0 ? (
                    <p style={{ margin: 0, textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", padding: "12px 0" }}>
                        Sin actividad de clientes en este período.
                    </p>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                        <LineChart
                            className="h-52"
                            data={stats?.serie ?? []}
                            index="periodo"
                            categories={["otorgados", "canjeados"]}
                            colors={[chartColors[0], chartColors[1]]}
                            valueFormatter={v => `${fmtEntero(Number(v))} pts`}
                            yAxisWidth={56}
                            showAnimation={false}
                        />
                        <BarChart
                            className="h-52"
                            data={stats?.serie ?? []}
                            index="periodo"
                            categories={["identificadas", "tickets"]}
                            colors={[chartColors[2], "gray"]}
                            valueFormatter={v => String(Math.round(Number(v)))}
                            yAxisWidth={40}
                            showAnimation={false}
                        />
                    </div>
                )}
            </div>

            {/* ── Sala de honor: top clientes del período (Fase C) ── */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="Trophy" size={16} color="var(--primary-alter)" />
                        Tus mejores clientes del período
                    </h3>
                </div>
                {(stats?.top_clientes?.length ?? 0) === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Sin ventas identificadas en el período — cuando alguien cobre con cliente aparecerá aquí.
                    </p>
                ) : (
                    <div style={{ overflowX: "auto", marginTop: 10 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", minWidth: 560 }}>
                            <thead>
                                <tr style={{ background: "var(--bg-card2)" }}>
                                    {["#", "Cliente", "Compras", "Total gastado", "Saldo", "Última compra"].map(h => (
                                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.66rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(stats?.top_clientes ?? []).map((t, i) => (
                                    <tr key={t.id} style={{ borderTop: "1px solid var(--border-primary)" }}>
                                        <td style={{ padding: "8px 12px", fontWeight: 800, color: i < 3 ? "var(--primary-alter)" : "var(--text-muted)" }}>{i + 1}</td>
                                        <td style={{ padding: "8px 12px", fontWeight: 800 }}>{t.nombre}</td>
                                        <td style={{ padding: "8px 12px" }}>{t.compras}</td>
                                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>{fmtDinero(t.total_gastado)}</td>
                                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>{fmtEntero(t.saldo_puntos)} pts</td>
                                        <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{fmtFecha(t.ultima_compra)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Tabla de la cartera ── */}
            <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 760 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-card2)" }}>
                                {["Cliente", "Contacto", "Puntos", "Compras", "Total gastado", "Ticket promedio", "Última compra", ""].map(h => (
                                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clientesQuery.isPending && (
                                <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Cargando clientes…</td></tr>
                            )}
                            {!clientesQuery.isPending && clientes.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                                        {busquedaDebounced ? "Sin resultados para tu búsqueda." : "Aún no hay clientes. Agrega el primero con el botón «Añadir cliente»."}
                                    </td>
                                </tr>
                            )}
                            {clientes.map(c => (
                                <tr key={c.id} style={{ borderTop: "1px solid var(--border-primary)", opacity: c.activo ? 1 : 0.55 }}>
                                    <td style={{ padding: "10px 14px", fontWeight: 800 }}>
                                        {c.nombre}
                                        {!c.activo && <span style={{ marginLeft: 8, fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)" }}>· dado de baja</span>}
                                    </td>
                                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                                        {c.telefono || "—"}{c.email ? (c.telefono ? ` · ${c.email}` : c.email) : ""}
                                    </td>
                                    <td style={{ padding: "10px 14px", fontWeight: 800, whiteSpace: "nowrap" }}>
                                        {c.saldo_puntos.toLocaleString("us")} pts
                                        {valorPunto !== 1 && <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> (≈{fmtDinero(c.saldo_puntos * valorPunto)})</span>}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>{c.compras}</td>
                                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{fmtDinero(c.total_gastado)}</td>
                                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600 }}>{fmtDinero(c.ticket_promedio)}</td>
                                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtFecha(c.ultima_compra)}</td>
                                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap", textAlign: "right" }}>
                                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                            <button className="btn-ghost" style={{ fontSize: "0.68rem", padding: "5px 10px" }} onClick={() => abrirAjustePuntos(c)} title="Dar o quitar puntos">
                                                <Icon name="Coins" size={13} /> Puntos
                                            </button>
                                            <button className="btn-ghost" style={{ fontSize: "0.68rem", padding: "5px 10px" }} onClick={() => abrirEdicion(c)}>
                                                <Icon name="Pencil" size={13} /> Editar
                                            </button>
                                            {c.activo ? (
                                                <button className="btn-ghost" style={{ fontSize: "0.68rem", padding: "5px 10px", color: "#b71c1c" }} onClick={() => darDeBaja(c)}>
                                                    <Icon name="UserX" size={13} color="#b71c1c" /> Baja
                                                </button>
                                            ) : (
                                                <button className="btn-ghost" style={{ fontSize: "0.68rem", padding: "5px 10px" }} onClick={() => reactivar(c)}>
                                                    <Icon name="UserCheck" size={13} /> Reactivar
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Modal: alta / edición de cliente (campos según la config del negocio) ── */}
            {modalAbierto && (
                <Overlay onClose={() => setModalAbierto(false)}>
                    <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800 }}>
                        {editandoId ? `Editar cliente` : "Añadir cliente"}
                    </h3>
                    <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {editandoId ? `Actualiza los datos de ${editandoNombre}.` : "El nombre es obligatorio; los demás campos según cómo configuraste Mi Negocio."}
                    </p>
                    <Campo label="Nombre" requerido>
                        <input style={inputTabla} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. María López" autoFocus />
                    </Campo>
                    {campos.email.activo && (
                        <Campo label="Correo" requerido={campos.email.requerido}>
                            <input style={inputTabla} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="cliente@correo.com" type="email" />
                        </Campo>
                    )}
                    {campos.telefono.activo && (
                        <Campo label="Número" requerido={campos.telefono.requerido}>
                            <input style={inputTabla} value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="998 123 4567" type="tel" />
                        </Campo>
                    )}
                    {campos.pin.activo && (
                        <Campo label="Contraseña" requerido={campos.pin.requerido}>
                            <input
                                style={inputTabla} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })}
                                placeholder={editandoId ? "Déjalo vacío para conservar la actual" : "Contraseña de identificación en el POS"} type="password"
                            />
                        </Campo>
                    )}
                    <Campo label="Notas" requerido={false}>
                        <input style={inputTabla} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Familia, preferencias…" />
                    </Campo>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                        <button className="btn-ghost" style={btnPlano} onClick={() => setModalAbierto(false)}>Cancelar</button>
                        <button className="btn-primary" style={{ ...btnPlano, border: "none" }} onClick={guardarCliente} disabled={guardando}>
                            <Icon name="Save" size={15} /> {guardando ? "Guardando…" : "Guardar cliente"}
                        </button>
                    </div>
                </Overlay>
            )}

            {/* ── Modal: ajuste manual de puntos + historial del ledger ── */}
            {modalPuntosId && (
                <Overlay onClose={() => setModalPuntosId(null)}>
                    <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800 }}>Puntos de {modalPuntosNombre}</h3>
                    <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Saldo vigente: <strong style={{ color: "var(--text-main)" }}>{saldoVigente.toLocaleString("us")} pts</strong> (≈{fmtDinero(saldoVigente * valorPunto)}). Da (+) o quita (−) puntos; cada cambio queda registrado.
                    </p>
                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                            <Campo label="Puntos (+ dar / − quitar)" requerido>
                                <input
                                    style={{ ...inputTabla, color: puntosNum < 0 ? "#b71c1c" : undefined }}
                                    value={puntosInput} onChange={e => setPuntosInput(e.target.value.replace(/[^0-9-]/g, ""))}
                                    placeholder="Ej. -10" type="number" autoFocus
                                />
                            </Campo>
                        </div>
                        <div style={{ flex: 2 }}>
                            <Campo label="Motivo" requerido>
                                <input style={inputTabla} value={conceptoInput} onChange={e => setConceptoInput(e.target.value)} placeholder="Ej. Promo especial 50%" />
                            </Campo>
                        </div>
                    </div>
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-card2)", border: "1px solid var(--border-primary)", fontSize: "0.8rem", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Saldo quedará en</span>
                        <span style={{ color: saldoProyectado < 0 ? "#b71c1c" : "var(--text-main)" }}>
                            {saldoProyectado.toLocaleString("us")} pts (≈{fmtDinero(saldoProyectado * valorPunto)})
                        </span>
                    </div>
                    {saldoProyectado < 0 && (
                        <p style={{ margin: "8px 0 0", fontSize: "0.75rem", fontWeight: 700, color: "#b71c1c" }}>
                            No puedes quitar más puntos de los que tiene el cliente.
                        </p>
                    )}

                    {/* Historial de movimientos (el saldo siempre se calcula del ledger) */}
                    <div style={{ marginTop: 16 }}>
                        <p style={{ margin: "0 0 8px", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Historial de movimientos</p>
                        <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                            {movimientos.length === 0 && <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>Sin movimientos todavía.</p>}
                            {movimientos.map((m) => (
                                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--bg-card2)", fontSize: "0.75rem" }}>
                                    <div>
                                        <span style={{ fontWeight: 800, color: m.puntos >= 0 ? "var(--success-text)" : "#b71c1c" }}>
                                            {m.puntos >= 0 ? "+" : ""}{m.puntos} pts
                                        </span>
                                        <span style={{ color: "var(--text-muted)", fontWeight: 600, marginLeft: 8 }}>
                                            {m.tipo === "ganados" ? "por venta" : m.tipo === "canjeados" ? "canje" : "ajuste"}{m.concepto ? ` · ${m.concepto}` : ""}
                                        </span>
                                    </div>
                                    <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtFecha(m.fecha)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                        <button className="btn-ghost" style={btnPlano} onClick={() => setModalPuntosId(null)}>Cerrar</button>
                        <button className="btn-primary" style={{ ...btnPlano, border: "none" }} onClick={aplicarAjuste} disabled={guardandoPuntos || saldoProyectado < 0 || !puntosNum}>
                            <Icon name="Coins" size={15} /> {guardandoPuntos ? "Aplicando…" : "Aplicar ajuste"}
                        </button>
                    </div>
                </Overlay>
            )}
        </div>
    )
}

// ── Piezas visuales locales ──────────────────────────────────────────────────

function CardKpi({ label, valor, detalle, borde }: { label: string; valor: string; detalle: string; borde: string }) {
    return (
        <div style={{ padding: "14px 18px", borderLeft: `4px solid ${borde}`, borderRadius: 12, background: "var(--bg-card2)" }}>
            <p style={{ margin: "0 0 4px", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</p>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--text-main)" }}>{valor}</p>
            <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>{detalle}</p>
        </div>
    )
}

function Campo({ label, requerido, children }: { label: string; requerido: boolean; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                {label}{requerido && <span style={{ color: "#b71c1c" }}> *</span>}
            </span>
            {children}
        </div>
    )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 24,
            }}
            onClick={onClose}
        >
            <div
                className="card"
                style={{
                    maxWidth: 480, width: "100%", padding: 24, maxHeight: "88vh", overflowY: "auto",
                    display: "block", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: "1px solid var(--border-light)",
                }}
                onClick={e => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    )
}

const inputTabla = {
    width: "100%",
    fontSize: "0.8rem",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border-primary)",
    background: "var(--bg-card2)",
    color: "var(--text-main)",
    outline: "none",
    fontWeight: 600,
} as const

const btnPlano = {
    padding: "9px 18px", borderRadius: 10, fontWeight: 700, fontSize: "0.8rem",
    cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
    background: "var(--bg-card2)", color: "var(--text-main)", border: "1px solid var(--border-primary)",
} as const
