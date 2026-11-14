"use client"
// ==============================================================================
// src/components/cobros/ListaCobros.tsx
// Lista de cobros con saldo, estado derivado y abonos desplegables.
// Los cobros de la MISMA cuota/venta (mig 076: ej. los 5 abonos semanales de
// la laptop) se AGRUPAN en una tarjeta con saldo consolidado y N abonos
// desplegados — la lista deja de llenarse de filas idénticas.
// El dinero/saldo NUNCA se calcula aquí: llega derivado del backend.
// ==============================================================================

import { useState } from "react"
import Icon from "@/components/ui/Icon"
import { useAccionesCobros } from "@/hooks/useCobros"
import type { Cobro, PagoCobro } from "@/types"

interface Props {
    cobros: Cobro[]
    cargando: boolean
    onRegistrarPago: (cobro: Cobro) => void
    onEditarExtra: (cobro: Cobro) => void
    onEliminar: (cobro: Cobro) => void
    /** Eliminar TODA la cuenta (los N cobros de la misma cuota/venta). */
    onEliminarGrupo: (cobros: Cobro[]) => void
    /** Mig 081: corregir un abono en su posición (✏️). */
    onEditarAbono: (cobro: Cobro, indice: number) => void
    /** Mig 081: reenviar el recibo de un abono por WhatsApp (💬). */
    onEnviarRecibo: (cobro: Cobro, abono: PagoCobro) => void
    /** Mig 079: materializar los moratorios derivados de un cobro. */
    onCargarMoratorios: (cobro: Cobro) => void
}

const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

const ESTILO_ESTADO: Record<Cobro["estado"], { texto: string; bg: string; color: string }> = {
    pagado: { texto: "Pagado", bg: "rgba(76,175,80,0.12)", color: "#2e7d32" },
    parcial: { texto: "Parcial", bg: "rgba(249,168,37,0.15)", color: "#b45309" },
    pendiente: { texto: "Pendiente", bg: "rgba(229,57,53,0.1)", color: "#c62828" },
}

/** '2026-11-15' → '15 nov' (sin peleas de zona horaria). */
function fechaCorta(v: string | null): string {
    if (!v) return "—"
    const [a, m, d] = v.slice(0, 10).split("-").map(Number)
    if (!a || !m || !d) return v
    const mes = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]
    return `${d} ${mes}`
}

export default function ListaCobros({ cobros, cargando, onRegistrarPago, onEditarExtra, onEliminar, onEliminarGrupo, onEditarAbono, onEnviarRecibo, onCargarMoratorios }: Props) {
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
                    Sin cobros todavía. Genera el mes (si ya tienes cuotas) o registra un cobro puntual.
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

    // ── Agrupación (076): cobros hermanos de la misma cuota → una tarjeta.
    // Orden estable: primero individuales, después grupos (ambos por vencimiento).
    const cuentaPorCuota = new Map<string, number>()
    for (const c of cobros) {
        if (c.cuota_id) cuentaPorCuota.set(c.cuota_id, (cuentaPorCuota.get(c.cuota_id) || 0) + 1)
    }
    type Item = { tipo: "solo"; cobro: Cobro } | { tipo: "grupo"; clave: string; cobros: Cobro[] }
    const items: Item[] = []
    const vistos = new Set<string>()
    for (const c of cobros) {
        if (c.cuota_id && (cuentaPorCuota.get(c.cuota_id) || 0) > 1) {
            if (vistos.has(c.cuota_id)) continue
            vistos.add(c.cuota_id)
            items.push({
                tipo: "grupo",
                clave: c.cuota_id,
                cobros: cobros.filter(x => x.cuota_id === c.cuota_id),
            })
        } else {
            items.push({ tipo: "solo", cobro: c })
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map(item => {
                if (item.tipo === "solo") {
                    const cobro = item.cobro
                    const est = ESTILO_ESTADO[cobro.estado]
                    const abierto = expandido === cobro.id
                    return (
                        <div key={cobro.id} style={estiloCard(cobro.vencido)}>
                            {/* Línea principal */}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                    <p style={estiloNombre}>{cobro.cliente_nombre}</p>
                                    <p style={estiloConcepto}>
                                        {cobro.concepto}
                                        <span style={estiloChip}>
                                            {cobro.origen === "cuota" ? `Cuota ${cobro.periodo}` : "Extra"}
                                        </span>
                                        {cobro.origen === "extra" && (
                                            <button onClick={() => onEditarExtra(cobro)}
                                                style={{ marginLeft: 6, border: "none", background: "none", cursor: "pointer", color: "var(--primary-mid)", padding: 0 }}>
                                                <Icon name="Pencil" size={13} />
                                            </button>
                                        )}
                                    </p>
                                </div>

                                <div style={{ textAlign: "right" }}>
                                    <p style={estiloMonto}>{fmt(cobro.monto)}</p>
                                    <p style={{
                                        ...estiloSaldo,
                                        color: cobro.saldo > 0 ? "var(--text-muted)" : "var(--primary-alter)",
                                    }}>
                                        Saldo: {fmt(cobro.saldo)}
                                    </p>
                                </div>

                                <span style={estiloBadge(est)}>{est.texto}</span>

                                {cobro.vencido && (
                                    <span style={estiloVencido}>{cobro.dias_vencido} día(s) vencido</span>
                                )}

                                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                                    <button onClick={() => setExpandido(abierto ? null : cobro.id)} title="Abonos"
                                        style={estiloBtnIcono}>
                                        <Icon name={abierto ? "ChevronUp" : "ChevronDown"} size={16} />
                                    </button>
                                    {cobro.estado !== "pagado" && (
                                        <button onClick={() => onRegistrarPago(cobro)} style={estiloBtnAbonar}>
                                            Abonar
                                        </button>
                                    )}
                                    <button onClick={() => onEliminar(cobro)} title="Eliminar cobro"
                                        style={estiloBtnPeligro}>
                                        <Icon name="Trash2" size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Abonos desplegados */}
                            {abierto && (
                                <DetalleCobro cobro={cobro} onQuitar={setQuitarIndice}
                                    onEditarAbono={onEditarAbono} onEnviarRecibo={onEnviarRecibo}
                                    onCargarMoratorios={onCargarMoratorios} />
                            )}
                        </div>
                    )
                }

                // ── Grupo: N cobros de la misma cuota/venta ──
                const grupo = item.cobros
                const totalMonto = grupo.reduce((s, c) => s + c.monto, 0)
                const totalSaldo = grupo.reduce((s, c) => s + c.saldo, 0)
                const todoPagado = grupo.every(c => c.estado === "pagado")
                const pendientes = grupo.filter(c => c.estado !== "pagado")
                const abiertos = expandido === item.clave
                const referencia = grupo[0]
                return (
                    <div key={item.clave} style={estiloCard(totalSaldo > 0 && pendientes.some(c => c.vencido))}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                <p style={estiloNombre}>
                                    {referencia.cliente_nombre}
                                </p>
                                <p style={estiloConcepto}>
                                    {referencia.concepto}
                                    <span style={{
                                        ...estiloChip,
                                        background: "rgba(180,83,9,0.1)", color: "#b45309",
                                    }}>
                                        Cuenta · {grupo.length} cobro(s)
                                    </span>
                                </p>
                            </div>

                            <div style={{ textAlign: "right" }}>
                                <p style={estiloMonto}>{fmt(totalMonto)}</p>
                                <p style={{
                                    ...estiloSaldo,
                                    color: totalSaldo > 0 ? "var(--text-muted)" : "var(--primary-alter)",
                                }}>
                                    Saldo: {fmt(totalSaldo)}
                                </p>
                            </div>

                            <span style={estiloBadge(ESTILO_ESTADO[todoPagado ? "pagado" : "pendiente"])}>
                                {todoPagado ? "Todo pagado" : `${pendientes.length} pendiente(s)`}
                            </span>

                            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                                {!todoPagado && (
                                    <button onClick={() => onRegistrarPago(pendientes[0])} title="Abonar a la cuenta (se reparte si pagas de más)"
                                        style={estiloBtnAbonar}>
                                        Abonar
                                    </button>
                                )}
                                <button onClick={() => setExpandido(abiertos ? null : item.clave)} title="Ver cobros"
                                    style={estiloBtnIcono}>
                                    <Icon name={abiertos ? "ChevronUp" : "ChevronDown"} size={16} />
                                </button>
                                <button onClick={() => onEliminarGrupo(grupo)} title="Eliminar cuenta completa"
                                    style={estiloBtnPeligro}>
                                    <Icon name="Trash2" size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Cobros del grupo desplegados */}
                        {abiertos && (
                            <div style={{ marginTop: 12, borderTop: "1px dashed var(--border-primary)", paddingTop: 10 }}>
                                {referencia.notas && (
                                    <p style={{ margin: "0 0 8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        {referencia.notas}
                                    </p>
                                )}
                                {grupo.map(cobro => {
                                    const est = ESTILO_ESTADO[cobro.estado]
                                    return (
                                        <div key={cobro.id} style={{
                                            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                                            padding: "6px 0", borderTop: "1px solid var(--border-light)",
                                        }}>
                                            <span style={estiloFechaGrupo}>{fechaCorta(cobro.vencimiento)}</span>
                                            <span style={{
                                                ...estiloChip,
                                                background: est.bg, color: est.color,
                                            }}>
                                                {est.texto}
                                            </span>
                                            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>
                                                {fmt(cobro.pagado)} de {fmt(cobro.monto)}
                                                {cobro.vencido ? ` · ${cobro.dias_vencido} día(s) vencido` : ""}
                                            </span>
                                            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                                <button onClick={() => setExpandido(cobro.id)} title="Abonos de este cobro"
                                                    style={{ ...estiloBtnIcono, padding: "6px 8px" }}>
                                                    <Icon name={expandido === cobro.id ? "ChevronUp" : "ChevronDown"} size={13} />
                                                </button>
                                                {cobro.estado !== "pagado" && (
                                                    <button onClick={() => onRegistrarPago(cobro)}
                                                        style={{ ...estiloBtnAbonar, padding: "6px 12px", fontSize: "0.7rem" }}>
                                                        Abonar
                                                    </button>
                                                )}
                                                <button onClick={() => onEliminar(cobro)} title="Eliminar este cobro"
                                                    style={{ ...estiloBtnPeligro, padding: "6px 8px" }}>
                                                    <Icon name="Trash2" size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                                {/* Abonos del cobro expandido dentro del grupo */}
                                {grupo.filter(c => expandido === c.id).map(cobro => (
                                    <div key={`detalle-${cobro.id}`} style={{ padding: "8px 0 4px 46px" }}>
                                        <DetalleCobro cobro={cobro} onQuitar={setQuitarIndice} compacto
                                            onEditarAbono={onEditarAbono} onEnviarRecibo={onEnviarRecibo}
                                            onCargarMoratorios={onCargarMoratorios} />
                                    </div>
                                ))}
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

/** Detalle desplegable de UN cobro: plan de pagos, notas y abonos con
 * acciones (✏️ editar / 🗑️ quitar / 💬 recibo por WhatsApp). */
function DetalleCobro({ cobro, onQuitar, compacto = false, onEditarAbono, onEnviarRecibo, onCargarMoratorios }: {
    cobro: Cobro
    onQuitar: (v: { id: string; indice: number } | null) => void
    compacto?: boolean
    onEditarAbono?: (cobro: Cobro, indice: number) => void
    onEnviarRecibo?: (cobro: Cobro, abono: PagoCobro) => void
    onCargarMoratorios?: (cobro: Cobro) => void
}) {
    const mora = cobro.moratorios ?? 0
    return (
        <div style={compacto ? { marginTop: 0 } : { marginTop: 12, borderTop: "1px dashed var(--border-primary)", paddingTop: 10 }}>
            {mora > 0 && cobro.vencido && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                    marginBottom: 8, padding: "6px 10px", borderRadius: 10,
                    background: "rgba(229,57,53,0.07)", border: "1px solid rgba(229,57,53,0.25)",
                }}>
                    <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "#c62828" }}>
                        Moratorios al día: {fmt(mora)} → Total {fmt(cobro.total_con_moratorios ?? cobro.saldo)}
                    </p>
                    {onCargarMoratorios && (
                        <button onClick={() => onCargarMoratorios(cobro)}
                            style={{
                                marginLeft: "auto", padding: "5px 12px", borderRadius: 8, border: "none",
                                background: "#c62828", color: "#fff", fontSize: "0.68rem", fontWeight: 800, cursor: "pointer",
                            }}>
                            Cargar moratorios
                        </button>
                    )}
                </div>
            )}
            {cobro.programa.length > 0 && (
                <p style={{ margin: "0 0 8px", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-label)" }}>
                    Plan de pagos: {cobro.programa.map(p => `${p.etiqueta} ${fmt(p.monto)} (${p.fecha})`).join(" · ")}
                </p>
            )}
            {cobro.notas && !compacto && (
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
                        <div key={indice} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Icon name="Check" size={14} color="var(--primary-alter)" />
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}>
                                {fmt(abono.monto)}
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                {abono.fecha}{abono.metodo ? ` · ${abono.metodo}` : ""}
                            </span>
                            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                                {onEnviarRecibo && cobro.cliente_telefono && (
                                    <button onClick={() => onEnviarRecibo(cobro, abono)} title="Enviar recibo por WhatsApp"
                                        style={{ border: "none", background: "none", cursor: "pointer", color: "#128C7E", padding: 0 }}>
                                        <Icon name="MessageCircle" size={14} />
                                    </button>
                                )}
                                {onEditarAbono && (
                                    <button onClick={() => onEditarAbono(cobro, indice)} title="Editar abono (monto/fecha/método)"
                                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary-mid)", padding: 0 }}>
                                        <Icon name="Pencil" size={13} />
                                    </button>
                                )}
                                <button onClick={() => onQuitar({ id: cobro.id, indice })}
                                    title="Quitar abono (corrección)"
                                    style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}>
                                    <Icon name="Trash2" size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

function estiloCard(vencido: boolean): React.CSSProperties {
    return {
        borderRadius: 14,
        background: "var(--bg-card)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        border: vencido ? "1px solid rgba(229,57,53,0.35)" : "1px solid var(--border-light)",
        padding: "14px 16px",
    }
}

const estiloNombre: React.CSSProperties = {
    margin: 0, fontWeight: 800, fontSize: "0.92rem", color: "var(--text-main)",
}

const estiloConcepto: React.CSSProperties = {
    margin: "3px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600,
}

const estiloChip: React.CSSProperties = {
    marginLeft: 8, padding: "1px 8px", borderRadius: 20,
    background: "var(--bg-card2)", fontSize: "0.65rem", letterSpacing: 0.5,
}

const estiloMonto: React.CSSProperties = {
    margin: 0, fontWeight: 800, fontSize: "0.95rem", color: "var(--text-main)",
}

const estiloSaldo: React.CSSProperties = {
    margin: "3px 0 0", fontSize: "0.72rem", fontWeight: 700,
}

function estiloBadge(est: { bg: string; color: string }): React.CSSProperties {
    return {
        padding: "4px 12px", borderRadius: 20,
        background: est.bg, color: est.color,
        fontSize: "0.68rem", fontWeight: 800, letterSpacing: 0.4,
    }
}

const estiloVencido: React.CSSProperties = {
    padding: "4px 10px", borderRadius: 20,
    background: "rgba(229,57,53,0.12)", color: "#b71c1c",
    fontSize: "0.65rem", fontWeight: 800,
}

const estiloBtnIcono: React.CSSProperties = {
    border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
    background: "var(--bg-card2)", color: "var(--text-main)",
}

const estiloBtnPeligro: React.CSSProperties = {
    border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer",
    background: "rgba(229,57,53,0.1)", color: "#b71c1c",
}

const estiloBtnAbonar: React.CSSProperties = {
    border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer",
    background: "var(--primary-mid)", color: "#fff",
    fontSize: "0.75rem", fontWeight: 800,
}

const estiloFechaGrupo: React.CSSProperties = {
    minWidth: 56, padding: "3px 8px", borderRadius: 8,
    background: "var(--bg-card2)", fontWeight: 800, fontSize: "0.7rem",
    color: "var(--text-main)", textAlign: "center", whiteSpace: "nowrap",
}
