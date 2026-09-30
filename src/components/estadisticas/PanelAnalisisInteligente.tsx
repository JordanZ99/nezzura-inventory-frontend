"use client"
// ==============================================================================
// src/components/estadisticas/PanelAnalisisInteligente.tsx
// Hallazgos del Análisis Inteligente agrupados por lo que hay que hacer, no por
// severidad técnica. El backend ya entrega títulos = conclusión y una etiqueta
// de ventana por tarjeta; aquí solo se agrupan y se priorizan.
//
// Decisión de diseño: 3 hallazgos visibles y el resto tras "ver todos". Once
// tarjetas en pantalla son un muro; lo urgente sale igual, lo informational se
// abre a un clic.
// ==============================================================================

import { useState, type ComponentProps } from "react"
import Link from "next/link"
import Icon from "@/components/ui/Icon"
import type { AnalisisInteligente as Analisis, Hallazgo, Severidad } from "@/types"

type IconoNombre = ComponentProps<typeof Icon>["name"]

/** Cuántos hallazgos se ven sin pedirle más al usuario. */
const VISIBLES_POR_DEFECTO = 3

const GRUPO: Record<Severidad, {
    titulo: string
    subtitulo: string
    barra: string
    fondo: string
    texto: string
    icono: IconoNombre
}> = {
    rojo: {
        titulo: "Urgente",
        subtitulo: "Te están costando dinero ahora",
        barra: "var(--error-main)",
        fondo: "var(--error-bg)",
        texto: "var(--error-text)",
        icono: "TriangleAlert",
    },
    amarillo: {
        titulo: "Para revisar",
        subtitulo: "Vale la pena revisarlo esta semana",
        barra: "rgb(var(--chart-3))",
        fondo: "color-mix(in srgb, var(--chart-3) 12%, var(--bg-card2))",
        texto: "var(--text-main)",
        icono: "CircleAlert",
    },
    verde: {
        titulo: "Información",
        subtitulo: "Lo que está funcionando",
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
    const e = GRUPO[h.severidad] ?? GRUPO.verde
    return (
        <div style={{
            display: "flex", gap: 12, padding: "14px 16px", borderRadius: 12,
            background: e.fondo, borderLeft: `4px solid ${e.barra}`,
        }}>
            <Icon name={e.icono} size={20} color={e.barra} />
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                        {h.titulo}
                    </p>
                    {h.ventana && (
                        <span style={{
                            fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)",
                            background: "var(--bg-card)", padding: "2px 7px", borderRadius: 999,
                            whiteSpace: "nowrap",
                        }}>
                            {h.ventana}
                        </span>
                    )}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {h.detalle}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "0.8rem", fontWeight: 600, color: e.texto, lineHeight: 1.5 }}>
                    → {h.recomendacion}
                </p>
                {h.accion && (
                    <Link
                        href={h.accion.href}
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                            padding: "6px 12px", borderRadius: 9, fontSize: "0.76rem", fontWeight: 800,
                            background: "var(--bg-card)", color: "var(--text-main)",
                            border: "1px solid var(--border-primary)", textDecoration: "none",
                        }}
                    >
                        <Icon name="ArrowRight" size={14} color="var(--text-muted)" />
                        {h.accion.texto}
                    </Link>
                )}
            </div>
        </div>
    )
}

function Bloque({
    severidad, hallazgos, mostrar,
}: {
    severidad: Severidad
    hallazgos: Hallazgo[]
    mostrar: boolean
}) {
    if (hallazgos.length === 0) return null
    const e = GRUPO[severidad]
    const visibles = mostrar ? hallazgos : hallazgos.slice(0, VISIBLES_POR_DEFECTO)
    const ocultos = hallazgos.length - visibles.length
    return (
        <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.barra, display: "block" }} />
                <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                    {e.titulo}
                </p>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {e.subtitulo}
                </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visibles.map(h => <TarjetaHallazgo key={h.tipo + h.titulo} h={h} />)}
            </div>
            {ocultos > 0 && (
                <p style={{ margin: "8px 0 0", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)" }}>
                    + {ocultos} más en este grupo
                </p>
            )}
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
    const [verTodos, setVerTodos] = useState(false)

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
    const porGrupo: Record<Severidad, Hallazgo[]> = { rojo: [], amarillo: [], verde: [] }
    for (const h of datos.hallazgos) porGrupo[h.severidad]?.push(h)
    const totalOcultos = datos.hallazgos.length - Math.min(
        VISIBLES_POR_DEFECTO, porGrupo.rojo.length
    ) - Math.min(VISIBLES_POR_DEFECTO, porGrupo.amarillo.length) - Math.min(VISIBLES_POR_DEFECTO, porGrupo.verde.length)

    return (
        <div className="card fade-up" style={{ padding: "20px 24px", marginBottom: 20 }}>
            {/* ── Header ── */}
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
                        ) : datos.hallazgos.length === 0 ? (
                            <span style={{
                                fontSize: "0.68rem", fontWeight: 800, padding: "3px 8px", borderRadius: 999,
                                background: "var(--success-bg)", color: "var(--success-text)",
                                textTransform: "uppercase", letterSpacing: 0.4,
                            }}>
                                Todo en orden
                            </span>
                        ) : porGrupo.rojo.length > 0 ? (
                            <span style={{
                                fontSize: "0.68rem", fontWeight: 800, padding: "3px 8px", borderRadius: 999,
                                background: "var(--error-bg)", color: "var(--error-text)",
                                textTransform: "uppercase", letterSpacing: 0.4,
                            }}>
                                {porGrupo.rojo.length} urgente{porGrupo.rojo.length > 1 ? "s" : ""}
                            </span>
                        ) : null}
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Ventas y gastos: {datos.rango_analizado.desde} → {datos.rango_analizado.hasta} · zona {datos.zona_horaria} · cada tarjeta indica su propia ventana
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

            {/* ── Solo las cifras que el panel de arriba NO muestra ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
                {[
                    { etiqueta: "Tu día más fuerte", valor: m.mejor_dia.dia || "—", color: "rgb(var(--chart-2))" },
                    { etiqueta: "Dinero parado (90 d)", valor: dinero(m.valor_stock_muerto_costo), color: "rgb(var(--chart-4))" },
                    { etiqueta: "Cierre estimado del mes", valor: dinero(m.proyeccion_mes_actual), color: "rgb(var(--chart-1))" },
                ].map(k => (
                    <div key={k.etiqueta} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-card2)", borderLeft: `3px solid ${k.color}` }}>
                        <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{k.etiqueta}</p>
                        <p style={{ margin: "3px 0 0", fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>{k.valor}</p>
                    </div>
                ))}
            </div>

            {/* ── Hallazgos agrupados por acción ── */}
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
                <>
                    <Bloque severidad="rojo" hallazgos={porGrupo.rojo} mostrar={verTodos} />
                    <Bloque severidad="amarillo" hallazgos={porGrupo.amarillo} mostrar={verTodos} />
                    <Bloque severidad="verde" hallazgos={porGrupo.verde} mostrar={verTodos} />
                    {totalOcultos > 0 && (
                        <button
                            onClick={() => setVerTodos(v => !v)}
                            style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                                borderRadius: 10, border: "1px solid var(--border-primary)",
                                background: "var(--bg-card2)", color: "var(--text-main)",
                                fontSize: "0.78rem", fontWeight: 800, cursor: "pointer",
                            }}
                        >
                            <Icon name={verTodos ? "ChevronUp" : "ChevronDown"} size={15} color="var(--text-muted)" />
                            {verTodos ? "Ver solo lo urgente" : `Ver todos los hallazgos (${datos.hallazgos.length})`}
                        </button>
                    )}
                </>
            )}

            <p style={{ margin: "14px 0 0", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                Análisis generado localmente con las reglas del sistema · tus datos no salen del servidor
            </p>
        </div>
    )
}
