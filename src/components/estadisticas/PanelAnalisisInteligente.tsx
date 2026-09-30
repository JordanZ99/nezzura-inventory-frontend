"use client"
// ==============================================================================
// src/components/estadisticas/PanelAnalisisInteligente.tsx
// Tarjetas del Análisis Inteligente: los hallazgos del backend ya ordenados
// por severidad. No calcula nada, solo presenta el contrato (§4 del plan).
// Vive FUERA de #report-container para que el botón no se imprima con el
// futuro PDF del reporte, pero las tarjetas sí pueden entrar como contenido.
// ==============================================================================

import type { ComponentProps } from "react"
import Icon from "@/components/ui/Icon"
import type { AnalisisInteligente as Analisis, Hallazgo, Severidad } from "@/types"

type IconoNombre = ComponentProps<typeof Icon>["name"]

const ESTILO: Record<Severidad, { barra: string; fondo: string; texto: string; icono: IconoNombre }> = {
    rojo: {
        barra: "var(--error-main)",
        fondo: "var(--error-bg)",
        texto: "var(--error-text)",
        icono: "TriangleAlert",
    },
    amarillo: {
        barra: "rgb(var(--chart-3))",
        fondo: "color-mix(in srgb, var(--chart-3) 12%, var(--bg-card2))",
        texto: "var(--text-main)",
        icono: "CircleAlert",
    },
    verde: {
        barra: "var(--success-main)",
        fondo: "var(--success-bg)",
        texto: "var(--success-text)",
        icono: "CircleCheck",
    },
}

function dinero(valor: number): string {
    return `$${Number(valor || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
}

function TarjetaHallazgo({ h }: { h: Hallazgo }) {
    const e = ESTILO[h.severidad] ?? ESTILO.verde
    return (
        <div style={{
            display: "flex", gap: 12, padding: "14px 16px", borderRadius: 12,
            background: e.fondo, borderLeft: `4px solid ${e.barra}`,
        }}>
            <Icon name={e.icono} size={20} color={e.barra} />
            <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: "var(--text-main)" }}>
                    {h.titulo}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {h.detalle}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "0.8rem", fontWeight: 600, color: e.texto, lineHeight: 1.5 }}>
                    → {h.recomendacion}
                </p>
            </div>
        </div>
    )
}

interface Props {
    datos: Analisis | null
    cargando: boolean
    error: string | null
    esPlus: boolean
    onCerrar: () => void
}

export default function PanelAnalisisInteligente({ datos, cargando, error, esPlus, onCerrar }: Props) {
    // ── Gate Plus: tarjeta de upsell en lugar del 403 crudo ──
    if (!esPlus) {
        return (
            <div className="card fade-up" style={{ padding: "20px 24px", marginBottom: 20, borderLeft: "4px solid var(--primary-mid)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <Icon name="Lock" size={22} color="var(--primary-mid)" />
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: "0.95rem", color: "var(--text-main)" }}>
                            Análisis Inteligente · exclusivo del plan Plus
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Reporte automático de tu negocio: qué está rotando, qué dinero está dormido en el inventario
                            y qué conviene revisar antes del corte de caja.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (cargando) {
        return (
            <div className="card fade-up" style={{ padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                <style>{`@keyframes anSpin { to { transform: rotate(360deg) } }`}</style>
                <div style={{
                    width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--border-primary)",
                    borderTopColor: "var(--primary-mid)", animation: "anSpin 0.8s linear infinite",
                }} />
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>Analizando tu negocio…</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="card fade-up" style={{ padding: "16px 20px", marginBottom: 20, borderLeft: "4px solid var(--error-main)" }}>
                <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--error-text)" }}>
                    No se pudo generar el análisis: {error}
                </p>
            </div>
        )
    }

    if (!datos) return null

    const m = datos.metricas
    const rojo = datos.hallazgos.filter(h => h.severidad === "rojo").length

    return (
        <div className="card fade-up" style={{ padding: "20px 24px", marginBottom: 20 }}>
            {/* ── Header: período analizado + cerrar ── */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <Icon name="Sparkles" size={22} color="var(--primary-mid)" />
                <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>
                            Análisis Inteligente
                        </p>
                        {datos.cold_start ? (
                            <span style={{
                                fontSize: "0.68rem", fontWeight: 800, padding: "3px 8px", borderRadius: 999,
                                background: "var(--bg-card2)", color: "var(--text-muted)",
                                textTransform: "uppercase", letterSpacing: 0.4,
                            }}>
                                {datos.mensaje}
                            </span>
                        ) : (
                            <span style={{
                                fontSize: "0.68rem", fontWeight: 800, padding: "3px 8px", borderRadius: 999,
                                background: rojo > 0 ? "var(--error-bg)" : "var(--success-bg)",
                                color: rojo > 0 ? "var(--error-text)" : "var(--success-text)",
                                textTransform: "uppercase", letterSpacing: 0.4,
                            }}>
                                {datos.hallazgos.length === 0
                                    ? "Sin hallazgos"
                                    : `${datos.hallazgos.length} hallazgo${datos.hallazgos.length === 1 ? "" : "s"}`}
                            </span>
                        )}
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Período {datos.rango_analizado.desde} → {datos.rango_analizado.hasta} · zona {datos.zona_horaria} · generado {new Date(datos.generado_en).toLocaleString("es-MX")}
                    </p>
                </div>
                <button
                    onClick={onCerrar}
                    aria-label="Cerrar análisis"
                    style={{
                        background: "transparent", border: "1px solid var(--border-primary)", borderRadius: 10,
                        padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center",
                    }}
                >
                    <Icon name="X" size={16} color="var(--text-muted)" />
                </button>
            </div>

            {/* ── Resumen numérico ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
                {[
                    { etiqueta: "Margen bruto", valor: `${m.margen_bruto_pct}%`, color: "rgb(var(--chart-1))" },
                    { etiqueta: "Utilidad neta", valor: dinero(m.utilidad_neta), color: m.utilidad_neta >= 0 ? "var(--success-main)" : "var(--error-main)" },
                    { etiqueta: "Mejor día", valor: m.mejor_dia.dia || "—", color: "rgb(var(--chart-2))" },
                    { etiqueta: "Stock muerto (costo)", valor: dinero(m.valor_stock_muerto_costo), color: "rgb(var(--chart-4))" },
                ].map(k => (
                    <div key={k.etiqueta} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-card2)", borderLeft: `3px solid ${k.color}` }}>
                        <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{k.etiqueta}</p>
                        <p style={{ margin: "3px 0 0", fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>{k.valor}</p>
                    </div>
                ))}
            </div>

            {/* ── Hallazgos ── */}
            {datos.cold_start ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Cuando tengas un par de semanas de ventas registradas, este panel te dirá qué producto se está agotando,
                    qué dinero está dormido en el inventario y qué días conviene empujar.
                </p>
            ) : datos.hallazgos.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "var(--success-bg)" }}>
                    <Icon name="CircleCheck" size={18} color="var(--success-main)" />
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--success-text)" }}>
                        Nada urgente: tu rotación, márgenes y gastos están dentro de lo esperado para este período.
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {datos.hallazgos.map(h => <TarjetaHallazgo key={h.tipo + h.titulo} h={h} />)}
                </div>
            )}

            <p style={{ margin: "14px 0 0", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                Análisis generado localmente con las reglas del sistema · tus datos no salen del servidor
            </p>
        </div>
    )
}
