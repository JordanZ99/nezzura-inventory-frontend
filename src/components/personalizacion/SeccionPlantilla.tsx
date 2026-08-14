// ==============================================================================
// src/components/personalizacion/SeccionPlantilla.tsx
// Sección "Plantilla": plantilla visual (grid clásico / menú carta) y tema de
// colores del catálogo público.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import SeccionHeader from "@/components/ui/SeccionHeader"
import type { PropsSeccionConfig } from "./tipos"

const TEMPLATES_OPTS = [
    { value: "grid-clasico", label: "Grid Clásico", icon: "LayoutGrid", desc: "Tarjetas con imagen, nombre y precio. Ideal para tiendas." },
    { value: "menu-carta", label: "Menú Carta", icon: "NotebookText", desc: "Lista agrupada por categorías. Ideal para restaurantes." },
]

const TEMAS_OPTS = [
    { key: "default", label: "Steel Slate", colors: ["#3a7dbf", "#5e87a4"] },
    { key: "midnightBlack", label: "Midnight Black", colors: ["#1f2321", "#1e6456"] },
    { key: "strawberry", label: "Strawberry Pink", colors: ["#f33376", "#fa30df"] },
    { key: "cozyYellow", label: "Cozy Yellow", colors: ["#ffd05b", "#eb7456"] },
]

export function SeccionPlantilla({ catalogoConfig, setCatalogoConfig, autoguardar, renderGuardado }: PropsSeccionConfig) {
    return (
        <>
            <SeccionHeader icono="LayoutTemplate" titulo="Plantilla" />

            {/* Selector de Template */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Plantilla Visual</span>
                    {renderGuardado("template")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {TEMPLATES_OPTS.map(t => (
                        <button
                            key={t.value}
                            onClick={() => { setCatalogoConfig(prev => prev ? { ...prev, template: t.value } : null); autoguardar("template", { template: t.value }) }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                padding: "14px 16px",
                                borderRadius: 12,
                                border: `2px solid ${catalogoConfig?.template === t.value ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                background: catalogoConfig?.template === t.value ? "var(--primary-soft)" : "var(--bg-card2)",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.2s",
                                width: "100%",
                            }}
                        >
                            <Icon name={t.icon as any} size={24} color={catalogoConfig?.template === t.value ? "var(--primary-mid)" : "var(--text-muted)"} />
                            <div>
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>{t.label}</span>
                                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{t.desc}</p>
                            </div>
                            {catalogoConfig?.template === t.value && (
                                <div style={{ marginLeft: "auto" }}>
                                    <Icon name="CircleCheck" size={20} color="var(--primary-mid)" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tema de colores */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tema de Colores</span>
                    {renderGuardado("tema")}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {TEMAS_OPTS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => { setCatalogoConfig(prev => prev ? { ...prev, tema: t.key } : null); autoguardar("tema", { tema: t.key }) }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 14px",
                                borderRadius: 10,
                                border: `2px solid ${catalogoConfig?.tema === t.key ? "var(--primary-mid)" : "transparent"}`,
                                background: "var(--bg-card2)",
                                cursor: "pointer",
                                transition: "all 0.15s",
                            }}
                        >
                            <div style={{
                                width: 22, height: 22,
                                borderRadius: "50%",
                                background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`,
                                border: "2px solid rgba(255,255,255,0.5)",
                                flexShrink: 0,
                            }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    )
}
