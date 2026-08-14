// ==============================================================================
// src/components/personalizacion/SeccionComportamiento.tsx
// Sección "Comportamiento": agrupar por categoría, relación de imágenes,
// permitir descarga de fotos y productos por fila en móvil.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import SeccionHeader from "@/components/ui/SeccionHeader"
import Switch from "@/components/ui/Switch"
import type { PropsSeccionConfig } from "./tipos"

export function SeccionComportamiento({ catalogoConfig, setCatalogoConfig, autoguardar, campoGuardando, renderGuardado }: PropsSeccionConfig) {
    return (
        <>
            <SeccionHeader icono="SlidersHorizontal" titulo="Comportamiento" />
            {/* Agrupar por categoría */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
            }}>
                <div>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Agrupar por categoría</span>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                        Separa los productos por secciones ("Peluches", "Bolsas"...). Desactiva la paginación.
                    </p>
                    {renderGuardado("agrupar_por_categoria")}
                </div>
                <Switch
                    checked={!!catalogoConfig?.agrupar_por_categoria}
                    onChange={() => {
                        const nuevo = !catalogoConfig?.agrupar_por_categoria
                        setCatalogoConfig(prev => prev ? { ...prev, agrupar_por_categoria: nuevo } : prev)
                        autoguardar("agrupar_por_categoria", { agrupar_por_categoria: nuevo })
                    }}
                    disabled={campoGuardando === "agrupar_por_categoria"}
                />
            </div>

            {/* Relación de las imágenes (global) */}
            <div style={{
                padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
            }}>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Relación de las imágenes</span>
                <p style={{ margin: "2px 0 10px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    Se aplica a todas las fotos de producto: catálogo, punto de venta, gestor y al recortarlas.
                </p>
                {renderGuardado("relacion_imagen")}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {([["1:1", "1:1 · Cuadrada"], ["4:5", "4:5 · Instagram"]] as const).map(([valor, etiqueta]) => {
                        const activo = (catalogoConfig?.relacion_imagen || "1:1") === valor
                        return (
                            <button
                                key={valor}
                                onClick={() => {
                                    setCatalogoConfig(prev => prev ? { ...prev, relacion_imagen: valor } : prev)
                                    autoguardar("relacion_imagen", { relacion_imagen: valor })
                                }}
                                disabled={campoGuardando === "relacion_imagen"}
                                style={{
                                    background: activo ? "var(--primary-mid)" : "var(--bg-card)",
                                    color: activo ? "#fff" : "var(--text-main)",
                                    border: "1px solid var(--border-primary)",
                                    borderRadius: 12,
                                    padding: "8px 14px",
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                    cursor: campoGuardando === "relacion_imagen" ? "not-allowed" : "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                {etiqueta}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Permitir descargar fotos */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
            }}>
                <div>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Descargar fotos</span>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                        Permite que tus clientes descarguen las fotos de los productos desde el catálogo.
                    </p>
                    {renderGuardado("permitir_descarga")}
                </div>
                <Switch
                    checked={!!catalogoConfig?.permitir_descarga}
                    onChange={() => {
                        const nuevo = !catalogoConfig?.permitir_descarga
                        setCatalogoConfig(prev => prev ? { ...prev, permitir_descarga: nuevo } : prev)
                        autoguardar("permitir_descarga", { permitir_descarga: nuevo })
                    }}
                    disabled={campoGuardando === "permitir_descarga"}
                />
            </div>

            {/* Productos por fila en móvil */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Productos por fila en móvil
                    </span>
                    {renderGuardado("columnas_movil")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                        { value: 1, label: "1 por fila", desc: "Un producto grande por fila en celulares. La fila compacta muestra 1 a la vez.", icon: "Smartphone" },
                        { value: 2, label: "2 por fila", desc: "Dos productos por fila en celulares (recomendado).", icon: "LayoutGrid" },
                    ].map(op => {
                        const activo = (catalogoConfig?.columnas_movil ?? 2) === op.value
                        return (
                            <button
                                key={op.value}
                                onClick={() => autoguardar("columnas_movil", { columnas_movil: op.value })}
                                disabled={campoGuardando === "columnas_movil"}
                                style={{
                                    display: "flex", alignItems: "center", gap: 14,
                                    padding: "12px 14px", borderRadius: 12,
                                    border: `2px solid ${activo ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                    background: activo ? "var(--primary-soft)" : "var(--bg-card2)",
                                    cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                                    width: "100%",
                                }}
                            >
                                <Icon name={op.icon as any} size={20} color={activo ? "var(--primary-mid)" : "var(--text-muted)"} />
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>{op.label}</span>
                                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>{op.desc}</p>
                                </div>
                                {activo && (
                                    <div style={{ marginLeft: "auto" }}>
                                        <Icon name="CircleCheck" size={18} color="var(--primary-mid)" />
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </>
    )
}
