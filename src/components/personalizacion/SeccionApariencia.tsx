// ==============================================================================
// src/components/personalizacion/SeccionApariencia.tsx
// Sección "Apariencia": estilo de la portada (gradiente/imagen) y, en modo
// imagen, los banners (escritorio/móvil vía BannerUploader), el color del
// texto sobre el banner y la visibilidad del título/logo.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import SeccionHeader from "@/components/ui/SeccionHeader"
import Switch from "@/components/ui/Switch"
import { BannerUploader } from "./BannerUploader"
import type { PropsSeccionConfig } from "./tipos"

interface Props extends PropsSeccionConfig {
    bannerInputRef: React.RefObject<HTMLInputElement>
    bannerMovilInputRef: React.RefObject<HTMLInputElement>
    subiendoBanner: boolean
    subiendoBannerMovil: boolean
    handleBannerFile: (e: React.ChangeEvent<HTMLInputElement>, target: "escritorio" | "movil") => void
    quitarBanner: (target: "escritorio" | "movil") => void
}

export function SeccionApariencia({
    catalogoConfig,
    setCatalogoConfig,
    autoguardar,
    autoguardarDebounce,
    campoGuardando,
    renderGuardado,
    bannerInputRef,
    bannerMovilInputRef,
    subiendoBanner,
    subiendoBannerMovil,
    handleBannerFile,
    quitarBanner,
}: Props) {
    return (
        <>
            <SeccionHeader icono="Palette" titulo="Apariencia" />
            {/* ── Estilo del hero ── */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Estilo de la portada</span>
                    {renderGuardado("hero_estilo")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                        { key: "gradiente", label: "Gradiente", desc: "Fondo con degradado del tema (recomendado)" },
                        { key: "imagen", label: "Imagen de fondo", desc: "El banner cubre toda la portada con el título encima" },
                    ].map(h => (
                        <button
                            key={h.key}
                            onClick={() => { setCatalogoConfig(prev => prev ? { ...prev, hero_estilo: h.key } : null); autoguardar("hero_estilo", { hero_estilo: h.key }) }}
                            style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "12px 14px", borderRadius: 12,
                                border: `2px solid ${(catalogoConfig?.hero_estilo || "gradiente") === h.key ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                background: (catalogoConfig?.hero_estilo || "gradiente") === h.key ? "var(--primary-soft)" : "var(--bg-card2)",
                                cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                                width: "100%",
                            }}
                        >
                            <Icon name={h.key === "imagen" ? "Image" : "Palette"} size={20} color={(catalogoConfig?.hero_estilo || "gradiente") === h.key ? "var(--primary-mid)" : "var(--text-muted)"} />
                            <div>
                                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>{h.label}</span>
                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>{h.desc}</p>
                            </div>
                            {(catalogoConfig?.hero_estilo || "gradiente") === h.key && (
                                <div style={{ marginLeft: "auto" }}>
                                    <Icon name="CircleCheck" size={18} color="var(--primary-mid)" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Solo modo imagen: color del texto y visibilidad del texto ── */}
                {catalogoConfig?.hero_estilo === "imagen" && (
                    <>
                        {/* ── Banner / Hero ── */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Banner / Imagen de portada</span>
                                {renderGuardado("banner_url")}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {/* ── Banner escritorio (1920 × 373) ── */}
                                <BannerUploader
                                    target="escritorio"
                                    inputRef={bannerInputRef}
                                    url={catalogoConfig?.banner_url || ""}
                                    subiendo={subiendoBanner}
                                    onFile={handleBannerFile}
                                    onQuitar={quitarBanner}
                                    renderGuardado={renderGuardado}
                                    campo="banner_url"
                                    icono="Monitor"
                                    etiqueta="Banner escritorio"
                                    alturaPreview={40}
                                    recomendacion="1920 × 373 px"
                                />

                                {/* ── Banner móvil (750 × 310) ── */}
                                <BannerUploader
                                    target="movil"
                                    inputRef={bannerMovilInputRef}
                                    url={catalogoConfig?.banner_url_movil || ""}
                                    subiendo={subiendoBannerMovil}
                                    onFile={handleBannerFile}
                                    onQuitar={quitarBanner}
                                    renderGuardado={renderGuardado}
                                    campo="banner_url_movil"
                                    icono="Smartphone"
                                    etiqueta="Banner móvil"
                                    alturaPreview={46}
                                    recomendacion="750 × 420 px"
                                />
                            </div>
                        </div>

                        {/* Color del texto sobre el banner */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Color del texto</span>
                                {renderGuardado("banner_texto_color")}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <button
                                    onClick={() => { setCatalogoConfig(prev => prev ? { ...prev, banner_texto_color: "#ffffff" } : prev); autoguardar("banner_texto_color", { banner_texto_color: "#ffffff" }) }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                                        border: `2px solid ${(catalogoConfig?.banner_texto_color || "#ffffff") === "#ffffff" ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                        background: "var(--bg-card2)", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)",
                                        transition: "all 0.15s",
                                    }}
                                >
                                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#ffffff", border: "1.5px solid var(--border-primary)", flexShrink: 0 }} />
                                    Blanco
                                </button>
                                <button
                                    onClick={() => { setCatalogoConfig(prev => prev ? { ...prev, banner_texto_color: "#1e293b" } : prev); autoguardar("banner_texto_color", { banner_texto_color: "#1e293b" }) }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                                        border: `2px solid ${(catalogoConfig?.banner_texto_color || "#ffffff") === "#1e293b" ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                        background: "var(--bg-card2)", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)",
                                        transition: "all 0.15s",
                                    }}
                                >
                                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#1e293b", border: "1.5px solid var(--border-primary)", flexShrink: 0 }} />
                                    Negro
                                </button>
                                <label style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 10, cursor: "pointer",
                                    border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)",
                                }}>
                                    <input
                                        type="color"
                                        value={catalogoConfig?.banner_texto_color || "#ffffff"}
                                        onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, banner_texto_color: e.target.value } : prev); autoguardarDebounce("banner_texto_color", () => ({ banner_texto_color: e.target.value })) }}
                                        style={{ width: 22, height: 22, border: "none", background: "none", padding: 0, cursor: "pointer" }}
                                    />
                                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>Otro color</span>
                                </label>
                            </div>
                        </div>

                        {/* Mostrar título sobre el banner */}
                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
                        }}>
                            <div>
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Mostrar título sobre el banner</span>
                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                    Apágalo para mostrar solo la imagen del banner, sin texto encima.
                                </p>
                                {renderGuardado("banner_mostrar_texto")}
                            </div>
                            <Switch
                                checked={(catalogoConfig?.banner_mostrar_texto ?? true) !== false}
                                onChange={() => {
                                    const nuevo = !(catalogoConfig?.banner_mostrar_texto ?? true)
                                    setCatalogoConfig(prev => prev ? { ...prev, banner_mostrar_texto: nuevo } : prev)
                                    autoguardar("banner_mostrar_texto", { banner_mostrar_texto: nuevo })
                                }}
                                disabled={campoGuardando === "banner_mostrar_texto"}
                            />
                        </div>

                        {/* Mostrar logo sobre el banner */}
                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
                        }}>
                            <div>
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Mostrar logo sobre el banner</span>
                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                    Muestra el logo del negocio encima del título del banner (por defecto activo).
                                </p>
                                {renderGuardado("banner_mostrar_logo")}
                            </div>
                            <Switch
                                checked={(catalogoConfig?.banner_mostrar_logo ?? true) !== false}
                                onChange={() => {
                                    const nuevo = !(catalogoConfig?.banner_mostrar_logo ?? true)
                                    setCatalogoConfig(prev => prev ? { ...prev, banner_mostrar_logo: nuevo } : prev)
                                    autoguardar("banner_mostrar_logo", { banner_mostrar_logo: nuevo })
                                }}
                                disabled={campoGuardando === "banner_mostrar_logo"}
                            />
                        </div>
                    </>
                )}
            </div>
        </>
    )
}
