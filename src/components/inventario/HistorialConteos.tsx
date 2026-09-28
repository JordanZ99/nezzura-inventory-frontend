// ==============================================================================
// src/components/inventario/HistorialConteos.tsx
// Historial de conteos cerrados: cards con el resumen del cierre y, al abrir
// una, el detalle renglón por renglón (esperado vs contado vs vivo y la
// resolución aplicada). El detalle se pide a la API solo al expandir.
// ==============================================================================

import { useEffect, useState } from "react"
import Icon from "@/components/ui/Icon"
import { api, type Conteo, type ConteoItem, type ResolucionConteo } from "@/lib/api"

const ETIQUETA_RESOLUCION: Record<ResolucionConteo, string> = {
    merma: "Merma",
    venta: "Venta declarada",
    error_sistema: "Corrección",
    entrada_no_registrada: "Ingreso hallado",
    cuadrado: "Cuadró",
    sin_contar: "Sin contar",
}

const TONO_RESOLUCION: Record<ResolucionConteo, { color: string; fondo: string }> = {
    merma: { color: "var(--error-text)", fondo: "var(--error-bg)" },
    venta: { color: "var(--primary-dark)", fondo: "var(--primary-bg)" },
    error_sistema: { color: "#b45309", fondo: "#fef3c7" },
    entrada_no_registrada: { color: "var(--success-text)", fondo: "var(--success-bg)" },
    cuadrado: { color: "var(--success-text)", fondo: "var(--success-bg)" },
    sin_contar: { color: "var(--text-muted)", fondo: "var(--bg-card2)" },
}

interface Props {
    historial: Conteo[]
    cargando: boolean
}

function ChipResumen({ etiqueta, tono }: { etiqueta: string; tono?: { color: string; fondo: string } }) {
    return (
        <span style={{
            fontSize: "0.68rem", fontWeight: 700, borderRadius: 6, padding: "3px 7px",
            color: tono?.color ?? "var(--text-main)", background: tono?.fondo ?? "var(--bg-card2)",
            whiteSpace: "nowrap",
        }}>
            {etiqueta}
        </span>
    )
}

export default function HistorialConteos({ historial, cargando }: Props) {
    const [abiertoId, setAbiertoId] = useState<string | null>(null)
    const [detalle, setDetalle] = useState<{ conteo: Conteo; items: ConteoItem[] } | null>(null)
    const [cargandoDetalle, setCargandoDetalle] = useState(false)

    useEffect(() => {
        if (!abiertoId) { setDetalle(null); return }
        let vigente = true
        setCargandoDetalle(true)
        api.getConteo(abiertoId)
            .then(r => { if (vigente) setDetalle({ conteo: r.conteo, items: r.items }) })
            .catch(() => { if (vigente) setDetalle(null) })
            .finally(() => { if (vigente) setCargandoDetalle(false) })
        return () => { vigente = false }
    }, [abiertoId])

    if (cargando) {
        return <p style={{ margin: "8px 0", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Cargando historial…</p>
    }

    if (historial.length === 0) {
        return (
            <p style={{ margin: "8px 0", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Todavía no has cerrado ningún conteo.
            </p>
        )
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {historial.map(c => {
                const r = c.resumen
                const expandido = abiertoId === c.id
                return (
                    <div key={c.id} className="card fade-up" style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "0.85rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                                <Icon name="ClipboardList" size={15} color="var(--primary-alter)" />
                                {c.cerrado_at ? new Date(c.cerrado_at).toLocaleDateString() : "—"}
                                {r?.n_ticket ? <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.75rem" }}>· ticket #{r.n_ticket}</span> : null}
                            </p>
                            <button
                                onClick={() => setAbiertoId(expandido ? null : c.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: "0.72rem", color: "var(--primary-dark)" }}
                            >
                                {expandido ? "Ocultar" : "Detalle"} <Icon name={expandido ? "ChevronUp" : "ChevronDown"} size={14} color="var(--primary-dark)" />
                            </button>
                        </div>
                        {r && (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                <ChipResumen etiqueta={`✓ ${r.cuadrados} cuadraron`} tono={TONO_RESOLUCION.cuadrado} />
                                {r.mermas > 0 && <ChipResumen etiqueta={`− ${r.mermas} merma${r.mermas > 1 ? "s" : ""} · $${Number(r.merma_costo).toFixed(2)}`} tono={TONO_RESOLUCION.merma} />}
                                {r.ventas > 0 && <ChipResumen etiqueta={`${r.ventas} vendido${r.ventas > 1 ? "s" : ""} · $${Number(r.venta_total).toFixed(2)}`} tono={TONO_RESOLUCION.venta} />}
                                {r.entradas > 0 && <ChipResumen etiqueta={`+ ${r.entradas} ingreso${r.entradas > 1 ? "s" : ""}`} tono={TONO_RESOLUCION.entrada_no_registrada} />}
                                {r.ajustes > 0 && <ChipResumen etiqueta={`${r.ajustes} corrección${r.ajustes > 1 ? "es" : ""}`} tono={TONO_RESOLUCION.error_sistema} />}
                                {r.sin_contar > 0 && <ChipResumen etiqueta={`${r.sin_contar} sin contar`} />}
                            </div>
                        )}

                        {/* Detalle expandido: veredicto renglón por renglón */}
                        {expandido && (
                            <div style={{ marginTop: 10, maxHeight: 320, overflowY: "auto", borderTop: "1px solid var(--border-light)", paddingTop: 8 }}>
                                {cargandoDetalle ? (
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Cargando detalle…</p>
                                ) : detalle && abiertoId === detalle.conteo.id ? (
                                    detalle.items
                                        .filter(it => it.resolucion && it.resolucion !== "cuadrado" && it.resolucion !== "sin_contar")
                                        .length === 0 ? (
                                            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                                Todo cuadró — ningún renglón necesitó resolución.
                                            </p>
                                        ) : (
                                            detalle.items
                                                .filter(it => it.resolucion && it.resolucion !== "cuadrado" && it.resolucion !== "sin_contar")
                                                .map(it => {
                                                    const tono = TONO_RESOLUCION[it.resolucion as ResolucionConteo] ?? TONO_RESOLUCION.sin_contar
                                                    return (
                                                        <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
                                                            <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                                                                {it.producto}{it.variacion ? <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> · {it.variacion}</span> : null}
                                                            </p>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                                                    {it.vivo ?? "?"} → {it.contado ?? "—"}
                                                                </span>
                                                                <span style={{ fontSize: "0.66rem", fontWeight: 800, borderRadius: 6, padding: "2px 6px", color: tono.color, background: tono.fondo, whiteSpace: "nowrap" }}>
                                                                    {ETIQUETA_RESOLUCION[it.resolucion as ResolucionConteo]}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                        )
                                ) : (
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>No se pudo cargar el detalle.</p>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
