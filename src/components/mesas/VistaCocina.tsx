// ==============================================================================
// src/components/mesas/VistaCocina.tsx
// Fase 3 — Vista de cocina (READ-ONLY): renglones de TODAS las órdenes
// abiertas agrupados por mesa, con hora de cada pedido. Sin acciones, sin
// roles y sin push todavía — solo consulta. Se mantiene fresca con el
// auto-refresco de la query de useMesas (30s) + botón de Actualizar manual.
// Los renglones pedidos hace menos de 5 min se resaltan (lo nuevo se ve solo).
// ==============================================================================

import Icon from "@/components/ui/Icon"
import { NOMBRE_VENTA_LIBRE } from "@/lib/ventaLibre"
import type { Mesa, ItemMesa } from "@/lib/api"

interface Props {
    mesas: Mesa[]
    cargando: boolean
    actualizando: boolean
    onActualizar: () => void
}

// Umbral para resaltar renglones recientes ("lo nuevo entra por los ojos")
const MS_RENGLON_RECIENTE = 5 * 60 * 1000

const ESTILO_ESTADO: Record<Mesa["estado"], { color: string; bg: string }> = {
    "Libre": { color: "#2e7d32", bg: "#e8f5e9" },
    "Ocupada": { color: "#b45309", bg: "#fef3c7" },
    "Cuenta": { color: "#6d28d9", bg: "#ede9fe" },
}

function horaDe(iso: string | null | undefined): string {
    if (!iso) return ""
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
}

function minutosDesde(iso: string | null | undefined): number {
    if (!iso) return 0
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

function RenglonCocina({ it }: { it: ItemMesa }) {
    const reciente = Date.now() - new Date(it.creado_en).getTime() < MS_RENGLON_RECIENTE
    return (
        <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "7px 10px", borderRadius: 8, marginBottom: 4,
            background: reciente ? "#fff8e1" : "var(--bg-card2)",
            border: reciente ? "1px solid #fcd34d" : "1px solid transparent",
        }}>
            <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--primary-dark)", minWidth: 34 }}>
                {Number(it.cantidad) % 1 === 0 ? Number(it.cantidad) : Number(it.cantidad).toFixed(2)}×
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--text-main)", lineHeight: 1.3 }}>
                    {it.descripcion || it.producto}
                    {it.variacion ? ` · ${it.variacion}` : ""}
                </p>
                {it.notas && (
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#b45309", fontWeight: 600 }}>
                        Nota: {it.notas}
                    </p>
                )}
                {it.producto === NOMBRE_VENTA_LIBRE && (
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        (venta libre)
                    </p>
                )}
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", paddingTop: 2 }}>
                {horaDe(it.creado_en)}
            </span>
        </div>
    )
}

export function VistaCocina({ mesas, cargando, actualizando, onActualizar }: Props) {
    // Solo mesas con orden abierta; las más antiguas primero (prioridad de cocina)
    const abiertas = mesas
        .filter(m => m.estado !== "Libre")
        .sort((a, b) => new Date(a.abierta_en ?? 0).getTime() - new Date(b.abierta_en ?? 0).getTime())

    const totalRenglones = abiertas.reduce((a, m) => a + (m.items?.length ?? 0), 0)

    if (cargando) {
        return (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                Cargando órdenes...
            </div>
        )
    }

    return (
        <div>
            {/* ── Encabezado: resumen + refresco manual ── */}
            <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Icon name="ChefHat" size={20} color="var(--primary-mid)" />
                <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>
                    {abiertas.length === 0
                        ? "Sin órdenes abiertas"
                        : `${abiertas.length} mesa(s) · ${totalRenglones} artículo(s) pendiente(s)`}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Se actualiza solo cada 30 s
                </span>
                <button
                    onClick={onActualizar}
                    disabled={actualizando}
                    title="Actualizar ahora"
                    style={{
                        marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 10, border: "1px solid var(--border-primary)",
                        background: "var(--bg-card2)", color: "var(--text-main)",
                        fontWeight: 700, fontSize: "0.78rem",
                        cursor: actualizando ? "wait" : "pointer", opacity: actualizando ? 0.6 : 1,
                    }}
                >
                    <Icon name="RefreshCw" size={14} /> Actualizar
                </button>
            </div>

            {abiertas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)" }}>
                    <span style={{ fontSize: "3.5rem", display: "block", marginBottom: 12 }}>😌</span>
                    <h2 style={{ fontSize: "1.4rem", color: "var(--primary-dark)", fontWeight: 800, margin: 0 }}>
                        Todo tranquilo
                    </h2>
                    <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", fontWeight: 600, margin: "8px 0 0" }}>
                        No hay órdenes abiertas en este momento.
                    </p>
                </div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 12,
                    alignItems: "start",
                }}>
                    {abiertas.map(mesa => {
                        const estilo = ESTILO_ESTADO[mesa.estado] ?? ESTILO_ESTADO["Ocupada"]
                        const mins = minutosDesde(mesa.abierta_en)
                        return (
                            <div
                                key={mesa.id}
                                className="card fade-up"
                                style={{
                                    padding: 14,
                                    borderTop: `4px solid ${estilo.color}`,
                                    opacity: mesa.estado === "Cuenta" ? 0.75 : 1,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)" }}>
                                        {mesa.nombre}
                                    </p>
                                    <span style={{
                                        fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                                        color: estilo.color, background: estilo.bg, borderRadius: 6, padding: "2px 8px",
                                    }}>
                                        {mesa.estado}
                                    </span>
                                </div>
                                <p style={{
                                    margin: "0 0 10px", fontSize: "0.72rem", fontWeight: 700,
                                    color: mins >= 20 ? "#b71c1c" : "var(--text-muted)",
                                }}>
                                    Abierta {horaDe(mesa.abierta_en)} · hace {mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}
                                </p>
                                {(mesa.items || []).map(it => (
                                    <RenglonCocina key={it.id} it={it} />
                                ))}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
