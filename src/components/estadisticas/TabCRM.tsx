// ==============================================================================
// src/components/estadisticas/TabCRM.tsx
// Tab CRM del panel estadístico (sustituye al tab "Clientes" de la Fase A de
// puntos evolucionándolo; roles exigidos: Personalización + Seguimiento).
//
//  - Segmentos dinámicos arriba (frecuentes, nuevos, inactivos, cumpleañeros):
//    filtro la cartera con los ids que calcula el backend contra compras/puntos.
//  - Ficha 360° del cliente: datos + puntos + ETIQUETAS asignables + TIMELINE
//    de seguimiento (nota | llamada | visita | promo) + acceso a editar/puntos.
//  - Card LTV: tasa de retención observada + LTV proyectado global y por
//    segmento (ticket × frecuencia × horizonte × retención × recencia).
//  - El programa de puntos sigue en la parte superior: KPIs + gráficas + top.
// El saldo de puntos SIEMPRE viene del ledger (puntos_movimientos).
// ==============================================================================

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LineChart, BarChart } from "@tremor/react"
import Icon from "@/components/ui/Icon"
import { api } from "@/lib/api"
import type {
    Cliente, ClienteCampos, ResumenClientes,
    Etiqueta, TipoInteraccion,
} from "@/types"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"
import { useChartColors } from "@/hooks/useChartColors"
import type { RangoFechas } from "@/lib/api"

const fmtDinero = (n: number) => `$${new Intl.NumberFormat("us").format(Number((Number(n) || 0).toFixed(2)))}`
const fmtFecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" }) : "—"
const fmtEntero = (n: number) => new Intl.NumberFormat("us").format(Math.round(Number(n) || 0))

const META_INTERACCION: Record<TipoInteraccion, { label: string; icon: string; color: string }> = {
    nota: { label: "Nota", icon: "FileText", color: "var(--primary-alter)" },
    llamada: { label: "Llamada", icon: "Phone", color: "var(--chart-2, #22c55e)" },
    visita: { label: "Visita", icon: "MapPin", color: "var(--primary-dark)" },
    promo: { label: "Promo", icon: "Megaphone", color: "var(--chart-4, #f59e0b)" },
}

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
    /** YYYY-MM-DD o "" (sin cumpleaños). Se envía tal cual ("" borra en el backend). */
    cumpleanos: string
    /** Canal/campaña de adquisición. */
    origen: string
}

const FORM_VACIO: FormCliente = { nombre: "", email: "", telefono: "", pin: "", notas: "", cumpleanos: "", origen: "" }

export default function TabCRM({ rango, todo }: Props) {
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

    // ── CRM: etiquetas, segmentos dinámicos y LTV (calculated on-demand) ──
    const etiquetasQuery = useQuery({
        queryKey: ["crm-etiquetas", tenantId],
        queryFn: () => api.getEtiquetas(),
        enabled: Boolean(tenantId),
    })
    const segmentosQuery = useQuery({
        queryKey: ["crm-segmentos", tenantId],
        queryFn: () => api.getSegmentos(),
        enabled: Boolean(tenantId),
    })
    const ltvQuery = useQuery({
        queryKey: ["crm-ltv", tenantId],
        queryFn: () => api.getLtv(12),
        enabled: Boolean(tenantId),
    })

    const clientes: Cliente[] = clientesQuery.data ?? []
    const stats: ResumenClientes | null = statsQuery.data ?? null
    const etiquetas: Etiqueta[] = etiquetasQuery.data ?? []
    const segmentos = segmentosQuery.data ?? []
    const ltv = ltvQuery.data ?? null
    const ltvMap = useMemo(
        () => new Map((ltv?.clientes ?? []).map(f => [f.cliente_id, f])),
        [ltv],
    )
    const chartColors = useChartColors()

    function invalidar() {
        if (!tenantId) return
        queryClient.invalidateQueries({ queryKey: ["clientes", tenantId] })
        queryClient.invalidateQueries({ queryKey: ["stats-clientes", tenantId] })
        queryClient.invalidateQueries({ queryKey: ["crm-etiquetas", tenantId] })
        queryClient.invalidateQueries({ queryKey: ["crm-segmentos", tenantId] })
        queryClient.invalidateQueries({ queryKey: ["crm-ltv", tenantId] })
        queryClient.invalidateQueries({ queryKey: ["cliente-detalle", tenantId] })
    }

    // ── Filtro por segmento dinámico (ids censados en el backend) ──
    const [segmentoSel, setSegmentoSel] = useState<string | null>(null)
    const segmentoActual = segmentos.find(s => s.id === segmentoSel)
    const clientesFiltrados = useMemo(
        () => (segmentoActual
            ? clientes.filter(c => segmentoActual.ids.includes(c.id))
            : clientes),
        [clientes, segmentoActual],
    )

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
            cumpleanos: c.cumpleanos || "",
            origen: c.origen || "",
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
                    // CRM: se mandan siempre; "" borra (semántica del backend).
                    cumpleanos: form.cumpleanos,
                    origen: form.origen.trim(),
                })
                mostrarMsg(true, "✅ Cliente actualizado")
            } else {
                await api.crearCliente({
                    nombre: form.nombre.trim(),
                    email: form.email.trim() || undefined,
                    telefono: form.telefono.trim() || undefined,
                    pin: campos.pin.activo && form.pin.trim() ? form.pin.trim() : undefined,
                    notas: form.notas.trim() || undefined,
                    cumpleanos: form.cumpleanos || undefined,
                    origen: form.origen.trim() || undefined,
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

    // ── Ficha 360° del cliente (CRM) ──
    const [fichaId, setFichaId] = useState<string | null>(null)
    const fichaQuery = useQuery({
        queryKey: ["cliente-detalle", tenantId, fichaId],
        queryFn: () => api.getCliente(fichaId as string),
        enabled: Boolean(tenantId && fichaId),
    })
    const ficha = fichaQuery.data ?? null

    const [guardandoFicha, setGuardandoFicha] = useState(false)

    async function setEtiquetasFicha(nuevoSet: string[]) {
        if (!fichaId) return
        setGuardandoFicha(true)
        try {
            await api.setEtiquetasCliente(fichaId, nuevoSet)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al etiquetar"}`)
        } finally {
            setGuardandoFicha(false)
        }
    }

    // Crear etiqueta nueva desde la ficha y asignarla de inmediato.
    const [nuevaEtiquetaNombre, setNuevaEtiquetaNombre] = useState("")
    const [nuevaEtiquetaColor, setNuevaEtiquetaColor] = useState("#6366f1")
    const [guardandoEtiqueta, setGuardandoEtiqueta] = useState(false)

    async function crearEtiquetaDesdeFicha() {
        if (!fichaId || !nuevaEtiquetaNombre.trim()) return
        setGuardandoEtiqueta(true)
        try {
            const r = await api.crearEtiqueta(nuevaEtiquetaNombre.trim(), nuevaEtiquetaColor)
            const vigentes = ficha?.etiquetas.map(e => e.id) ?? []
            await api.setEtiquetasCliente(fichaId, [...vigentes, r.etiqueta.id])
            setNuevaEtiquetaNombre("")
            mostrarMsg(true, `✅ Etiqueta "${r.etiqueta.nombre}" creada y asignada`)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al crear etiqueta"}`)
        } finally {
            setGuardandoEtiqueta(false)
        }
    }

    // ── Timeline de seguimiento ──
    const [tipoInteraccion, setTipoInteraccion] = useState<TipoInteraccion>("nota")
    const [textoInteraccion, setTextoInteraccion] = useState("")
    const [guardandoInteraccion, setGuardandoInteraccion] = useState(false)

    async function registrarInteraccion() {
        if (!fichaId) return
        if (!textoInteraccion.trim()) {
            mostrarMsg(false, "❌ Escribe qué pasó / qué se acordó")
            return
        }
        setGuardandoInteraccion(true)
        try {
            await api.addInteraccion(fichaId, tipoInteraccion, textoInteraccion.trim())
            setTextoInteraccion("")
            mostrarMsg(true, "✅ Interacción registrada")
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al registrar"}`)
        } finally {
            setGuardandoInteraccion(false)
        }
    }

    // ── Modal de ajuste manual de puntos (ledger tipo 'ajuste') ──
    const [modalPuntosId, setModalPuntosId] = useState<string | null>(null)
    const [modalPuntosNombre, setModalPuntosNombre] = useState("")
    const [puntosInput, setPuntosInput] = useState("")
    const [conceptoInput, setConceptoInput] = useState("")
    const [guardandoPuntos, setGuardandoPuntos] = useState(false)
    const puntosDetalleQuery = useQuery({
        queryKey: ["cliente-detalle", tenantId, modalPuntosId],
        queryFn: () => api.getCliente(modalPuntosId as string),
        enabled: Boolean(tenantId && modalPuntosId),
    })
    const saldoVigente = puntosDetalleQuery.data?.saldo_puntos ?? 0
    const movimientos = puntosDetalleQuery.data?.movimientos ?? []
    const puntosNum = parseInt(puntosInput, 10) || 0
    const saldoProyectado = saldoVigente + puntosNum

    function abrirAjustePuntos(id: string, nombre: string) {
        setModalPuntosId(id)
        setModalPuntosNombre(nombre)
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

    /** Copia la lista de contactos de la cartera filtrada (pega en Excel o
     *  en una campaña de WhatsApp): Nombre \t Teléfono/Correo. */
    async function copiarContactos() {
        const conContacto = clientesFiltrados.filter(c => c.telefono || c.email)
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

            {/* ── Buscador y acciones de la cartera ── */}
            <div
                className="card"
                style={{
                    padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 10,
                    alignItems: "center", marginBottom: 12,
                }}
            >
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
                <button className="btn-ghost" onClick={copiarContactos} title="Copia los contactos de la lista filtrada (el segmento activo si hay alguno): campañas de WhatsApp o pegar en Excel" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="Contact" size={15} /> Copiar contactos
                </button>
                <button className="btn-primary" onClick={abrirNuevo} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="UserPlus" size={16} /> Añadir cliente
                </button>
            </div>

            {/* ── CRM: chips de segmentos dinámicos (frecuentes, inactivos...) ── */}
            <div className="card" style={{ padding: "14px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="Tags" size={16} color="var(--primary-alter)" />
                        Segmentos dinámicos
                    </h3>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Censados contra las compras reales — elige uno para filtrar la cartera
                    </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <ChipSegmento
                        activo={segmentoSel === null}
                        onClick={() => setSegmentoSel(null)}
                        label="Todos"
                        conteo={clientes.length}
                        descripcion="Toda la cartera (con los filtros de búsqueda)"
                    />
                    {segmentos.map(s => (
                        <ChipSegmento
                            key={s.id}
                            activo={segmentoSel === s.id}
                            onClick={() => setSegmentoSel(segmentoSel === s.id ? null : s.id)}
                            label={s.nombre}
                            conteo={s.conteo}
                            descripcion={s.descripcion}
                        />
                    ))}
                </div>
            </div>

            {/* ── CRM: LTV proyectado (datos observados) ── */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="TrendingUp" size={16} color="var(--primary-alter)" />
                        Valor de vida del cliente (LTV) · 12 meses
                    </h3>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Proyección con tus datos reales: ticket × frecuencia × retención × recencia
                    </span>
                </div>
                {!ltv ? (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Calculando…</p>
                ) : (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 }}>
                            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-card2)" }}>
                                <p style={{ margin: "0 0 2px", fontSize: "0.64rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>LTV promedio</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{fmtDinero(ltv.global.ltv_promedio_proyectado)}</p>
                            </div>
                            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-card2)" }}>
                                <p style={{ margin: "0 0 2px", fontSize: "0.64rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Retención observada</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{(ltv.global.tasa_retencion * 100).toFixed(0)}%</p>
                                <p style={{ margin: 0, fontSize: "0.64rem", color: "var(--text-muted)", fontWeight: 600 }}>{ltv.global.clientes_recurrentes} de {ltv.global.clientes_con_compras} recompran</p>
                            </div>
                            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-card2)" }}>
                                <p style={{ margin: "0 0 2px", fontSize: "0.64rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Gasto histórico</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{fmtDinero(ltv.global.gasto_total_historico)}</p>
                            </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {ltv.segmentos.filter(s => s.conteo > 0).map(s => (
                                <div
                                    key={s.id}
                                    title={`${s.nombre}: ${s.conteo} clientes · gasto histórico ${fmtDinero(s.gasto_historico)}`}
                                    style={{
                                        padding: "7px 12px", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700,
                                        background: "var(--bg-card2)", border: "1px solid var(--border-primary)",
                                    }}
                                >
                                    {s.nombre} · LTV {fmtDinero(s.ltv_promedio)}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ── ¿Está funcionando el programa de puntos? (Fase A puntos) ── */}
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

            {/* ── Sala de honor: top clientes del período ── */}
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

            {/* ── Tabla de la cartera (con etiquetas y LTV) ── */}
            <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 940 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-card2)" }}>
                                {["Cliente", "Contacto", "Etiquetas", "Puntos", "Compras", "Gasto total", "LTV proy.", "Última compra", ""].map(h => (
                                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clientesQuery.isPending && (
                                <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Cargando clientes…</td></tr>
                            )}
                            {!clientesQuery.isPending && clientesFiltrados.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                                        {segmentoActual ? "No hay clientes en este segmento con los filtros activos."
                                            : busquedaDebounced ? "Sin resultados para tu búsqueda."
                                                : "Aún no hay clientes. Agrega el primero con el botón «Añadir cliente»."}
                                    </td>
                                </tr>
                            )}
                            {clientesFiltrados.map(c => (
                                <tr key={c.id} style={{ borderTop: "1px solid var(--border-primary)", opacity: c.activo ? 1 : 0.55 }}>
                                    <td style={{ padding: "10px 14px", fontWeight: 800 }}>
                                        <button
                                            onClick={() => setFichaId(c.id)}
                                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-main)", fontWeight: 800, fontSize: "0.8rem" }}
                                            title="Abrir ficha del cliente"
                                        >
                                            {c.nombre}
                                        </button>
                                        {!c.activo && <span style={{ marginLeft: 8, fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)" }}>· dado de baja</span>}
                                    </td>
                                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                                        {c.telefono || "—"}{c.email ? (c.telefono ? ` · ${c.email}` : c.email) : ""}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {(c.etiquetas ?? []).map(e => <ChipEtiqueta key={e.id} etiqueta={e} />)}
                                            {(c.etiquetas ?? []).length === 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>—</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px 14px", fontWeight: 800, whiteSpace: "nowrap" }}>
                                        {c.saldo_puntos.toLocaleString("us")} pts
                                        {valorPunto !== 1 && <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> (≈{fmtDinero(c.saldo_puntos * valorPunto)})</span>}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>{c.compras}</td>
                                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{fmtDinero(c.total_gastado)}</td>
                                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--primary-dark)" }}>
                                        {fmtDinero(ltvMap.get(c.id)?.ltv_proyectado ?? 0)}
                                    </td>
                                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtFecha(c.ultima_compra)}</td>
                                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap", textAlign: "right" }}>
                                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                            <button className="btn-ghost" style={{ fontSize: "0.68rem", padding: "5px 10px" }} onClick={() => setFichaId(c.id)} title="Ficha 360°: etiquetas + seguimiento">
                                                <Icon name="Contact" size={13} /> Ficha
                                            </button>
                                            <button className="btn-ghost" style={{ fontSize: "0.68rem", padding: "5px 10px" }} onClick={() => abrirAjustePuntos(c.id, c.nombre)} title="Dar o quitar puntos">
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
                    {/* CRM: cumpleaños (promos) y origen (integración de campaña). */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                            <Campo label="Cumpleaños" requerido={false}>
                                <input
                                    style={inputTabla} value={form.cumpleanos} type="date"
                                    onChange={e => setForm({ ...form, cumpleanos: e.target.value })}
                                />
                            </Campo>
                        </div>
                        <div style={{ flex: 2 }}>
                            <Campo label="Origen / campaña" requerido={false}>
                                <input style={inputTabla} value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} placeholder="Ej. Volante, WhatsApp, Referido…" />
                            </Campo>
                        </div>
                    </div>
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

            {/* ── Modal: ficha 360° (etiquetas + timeline de seguimiento) ── */}
            {fichaId && (
                <Overlay onClose={() => setFichaId(null)} ancho={560}>
                    {fichaQuery.isPending || !ficha ? (
                        <p style={{ margin: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>Cargando ficha…</p>
                    ) : (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>{ficha.nombre}</h3>
                                    <p style={{ margin: "4px 0 0", fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                        {ficha.telefono || "—"}{ficha.email ? ` · ${ficha.email}` : ""}
                                        {!ficha.activo && " · dado de baja"}
                                    </p>
                                </div>
                                <div style={{ textAlign: "right", fontSize: "0.78rem", fontWeight: 700, display: "flex", gap: 16, flexWrap: "wrap" }}>
                                    <div>
                                        <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.6rem", textTransform: "uppercase" }}>Compras</span>
                                        {ficha.compras}
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.6rem", textTransform: "uppercase" }}>Gasto</span>
                                        {fmtDinero(ficha.total_gastado)}
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.6rem", textTransform: "uppercase" }}>Pts</span>
                                        {ficha.saldo_puntos.toLocaleString("us")}
                                    </div>
                                </div>
                            </div>
                            {(ficha.cumpleanos || ficha.origen) && (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                                    {ficha.cumpleanos && <Badge icon="Cake" texto={`Cumpleaños ${fmtFecha(ficha.cumpleanos)}`} color="var(--primary-alter)" />}
                                    {ficha.origen && <Badge icon="Network" texto={ficha.origen} color="var(--primary-alter)" />}
                                </div>
                            )}

                            {/* Etiquetas: catálogo del negocio como toggles + alta al vuelo */}
                            <div style={{ marginTop: 16 }}>
                                <p style={{ margin: "0 0 6px", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Etiquetas</p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {etiquetasQuery.isPending && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Cargando…</span>}
                                    {etiquetas.map(e => {
                                        const asignada = (ficha.etiquetas ?? []).some(x => x.id === e.id)
                                        const idsActuales = (ficha.etiquetas ?? []).map(x => x.id)
                                        const idsNuevos = asignada
                                            ? idsActuales.filter(id => id !== e.id)
                                            : [...idsActuales, e.id]
                                        return (
                                            <button
                                                key={e.id}
                                                onClick={() => setEtiquetasFicha(idsNuevos)}
                                                disabled={guardandoFicha}
                                                title={asignada ? "Quitar del cliente" : "Asignar al cliente"}
                                                style={{
                                                    display: "inline-flex", alignItems: "center", gap: 5,
                                                    padding: "4px 10px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700,
                                                    cursor: "pointer", border: "1px solid var(--border-primary)",
                                                    background: asignada ? "var(--primary-mid)" : "var(--bg-card2)",
                                                    color: asignada ? "#fff" : "var(--text-main)",
                                                    opacity: guardandoFicha ? 0.6 : 1,
                                                }}
                                            >
                                                <span style={{ width: 7, height: 7, borderRadius: 999, background: asignada ? "#fff" : e.color, display: "inline-block" }} />
                                                {e.nombre}
                                                {asignada && <Icon name="Check" size={11} color="#fff" />}
                                            </button>
                                        )
                                    })}
                                    {etiquetas.length === 0 && (
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Crea la primera etiqueta abajo 👇</span>
                                    )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                                    <input
                                        style={{ ...inputTabla, flex: 1, maxWidth: 220 }}
                                        value={nuevaEtiquetaNombre}
                                        onChange={e => setNuevaEtiquetaNombre(e.target.value)}
                                        placeholder="Nueva etiqueta (ej. VIP)"
                                        maxLength={40}
                                    />
                                    <input
                                        type="color" value={nuevaEtiquetaColor}
                                        onChange={e => setNuevaEtiquetaColor(e.target.value)}
                                        style={{ width: 34, height: 30, padding: 0, border: "1px solid var(--border-primary)", borderRadius: 8, background: "var(--bg-card2)", cursor: "pointer" }}
                                        title="Color del chip"
                                    />
                                    <button
                                        className="btn-ghost" style={{ fontSize: "0.7rem", padding: "6px 10px" }}
                                        onClick={crearEtiquetaDesdeFicha} disabled={guardandoEtiqueta || !nuevaEtiquetaNombre.trim()}
                                    >
                                        <Icon name="Plus" size={13} /> Crear y asignar
                                    </button>
                                </div>
                            </div>

                            {/* Timeline de seguimiento: form + historial */}
                            <div style={{ marginTop: 16 }}>
                                <p style={{ margin: "0 0 6px", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Seguimiento</p>
                                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                                    <select
                                        value={tipoInteraccion}
                                        onChange={e => setTipoInteraccion(e.target.value as TipoInteraccion)}
                                        style={{ ...inputTabla, width: "auto", cursor: "pointer" }}
                                    >
                                        {(Object.keys(META_INTERACCION) as TipoInteraccion[]).map(t => (
                                            <option key={t} value={t}>{META_INTERACCION[t].label}</option>
                                        ))}
                                    </select>
                                    <input
                                        style={{ ...inputTabla, flex: 1, minWidth: 180 }}
                                        value={textoInteraccion}
                                        onChange={e => setTextoInteraccion(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") registrarInteraccion() }}
                                        placeholder="¿Qué pasó? ¿Qué se acordó?"
                                    />
                                    <button
                                        className="btn-primary" style={{ fontSize: "0.72rem", padding: "7px 12px", border: "none" }}
                                        onClick={registrarInteraccion} disabled={guardandoInteraccion || !textoInteraccion.trim()}
                                    >
                                        <Icon name="Plus" size={13} /> Registrar
                                    </button>
                                </div>
                                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                                    {(ficha.interacciones ?? []).length === 0 && (
                                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            Sin seguimiento todavía — registra la primera interacción arriba.
                                        </p>
                                    )}
                                    {(ficha.interacciones ?? []).map(i => {
                                        const meta = META_INTERACCION[i.tipo]
                                        return (
                                            <div
                                                key={i.id}
                                                style={{
                                                    display: "flex", gap: 10, padding: "8px 12px", borderRadius: 8,
                                                    background: "var(--bg-card2)", fontSize: "0.76rem", alignItems: "flex-start",
                                                }}
                                            >
                                                <span style={{ marginTop: 1 }}><Icon name={meta.icon as never} size={14} color={meta.color} /></span>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ margin: 0, fontWeight: 700 }}>
                                                        {meta.label}
                                                        {i.creado_por ? <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> · {i.creado_por}</span> : null}
                                                    </p>
                                                    <p style={{ margin: "1px 0 0", color: "var(--text-main)" }}>{i.texto}</p>
                                                </div>
                                                <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: "0.7rem" }}>{fmtFecha(i.fecha)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18, flexWrap: "wrap" }}>
                                <button
                                    className="btn-ghost" style={btnPlano}
                                    onClick={() => {
                                        const c = clientes.find(x => x.id === fichaId)
                                        if (!c) { mostrarMsg(false, "No se encontró el cliente en la cartera actual"); return }
                                        setFichaId(null)
                                        abrirEdicion(c)
                                    }}
                                >
                                    <Icon name="Pencil" size={14} /> Editar datos
                                </button>
                                <button
                                    className="btn-ghost" style={btnPlano}
                                    onClick={() => { abrirAjustePuntos(ficha.id, ficha.nombre); setFichaId(null) }}
                                >
                                    <Icon name="Coins" size={14} /> Puntos
                                </button>
                                <button className="btn-ghost" style={btnPlano} onClick={() => setFichaId(null)}>Cerrar</button>
                            </div>
                        </>
                    )}
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

function ChipSegmento({ activo, onClick, label, conteo, descripcion }: { activo: boolean; onClick: () => void; label: string; conteo: number; descripcion: string }) {
    return (
        <button
            onClick={onClick}
            title={descripcion}
            style={{
                padding: "6px 12px", borderRadius: 999, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
                border: "1px solid var(--border-primary)",
                background: activo ? "var(--primary-mid)" : "var(--bg-card2)",
                color: activo ? "#fff" : "var(--text-main)",
                display: "flex", alignItems: "center", gap: 6,
            }}
        >
            {label}
            <span style={{
                background: activo ? "rgba(255,255,255,0.25)" : "var(--primary-mid)",
                color: activo ? "#fff" : "#fff",
                borderRadius: 999, padding: "1px 7px", fontSize: "0.64rem",
            }}>{conteo}</span>
        </button>
    )
}

function ChipEtiqueta({ etiqueta }: { etiqueta: Etiqueta }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "2px 8px", borderRadius: 999, fontSize: "0.66rem", fontWeight: 700,
            background: "var(--bg-card2)", border: `1px solid ${etiqueta.color}`,
            color: "var(--text-main)",
        }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: etiqueta.color, display: "inline-block" }} />
            {etiqueta.nombre}
        </span>
    )
}

function Badge({ icon, texto, color }: { icon: string; texto: string; color: string }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 9px", borderRadius: 999, fontSize: "0.66rem", fontWeight: 700,
            background: "var(--bg-card2)", border: "1px solid var(--border-primary)",
            color: color,
        }}>
            <Icon name={icon as never} size={11} color={color} /> {texto}
        </span>
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

function Overlay({ children, onClose, ancho = 480 }: { children: React.ReactNode; onClose: () => void; ancho?: number }) {
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
                    maxWidth: ancho, width: "100%", padding: 24, maxHeight: "88vh", overflowY: "auto",
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
