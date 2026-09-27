// ==============================================================================
// src/components/personalizacion/SeccionApariencia.tsx
// Sección "Apariencia": estilo de la portada (gradiente/imagen) y, en modo
// imagen, los banners (escritorio/móvil vía BannerUploader), el color del
// texto sobre el banner y la visibilidad del título/logo. Además, la imagen/
// textura de FONDO del catálogo (migración 045) con modo, opacidad y color.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import SeccionHeader from "@/components/ui/SeccionHeader"
import Switch from "@/components/ui/Switch"
import { BannerUploader } from "./BannerUploader"
import { FUENTES_CATALOGO, FUENTES_ORDEN } from "@/lib/catalogo-fuentes"
import type { PropsSeccionConfig } from "./tipos"

interface Props extends PropsSeccionConfig {
    bannerInputRef: React.RefObject<HTMLInputElement>
    bannerMovilInputRef: React.RefObject<HTMLInputElement>
    fondoInputRef: React.RefObject<HTMLInputElement>
    subiendoBanner: boolean
    subiendoBannerMovil: boolean
    subiendoFondo: boolean
    handleBannerFile: (e: React.ChangeEvent<HTMLInputElement>, target: "escritorio" | "movil" | "fondo") => void
    quitarBanner: (target: "escritorio" | "movil" | "fondo") => void
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
    fondoInputRef,
    subiendoBanner,
    subiendoBannerMovil,
    subiendoFondo,
    handleBannerFile,
    quitarBanner,
}: Props) {
    return (
        <>
            <SeccionHeader icono="Palette" titulo="Apariencia" />

            {/* ── Tipografía display (migración 044) ── */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tipografía</span>
                    {renderGuardado("fuente")}
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 0 10px", fontWeight: 500 }}>
                    Se aplica a nombres, precios y títulos. Los textos informativos quedan en la fuente neutral.
                </p>
                <select
                    value={catalogoConfig?.fuente || "sistema"}
                    onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, fuente: e.target.value } : null); autoguardar("fuente", { fuente: e.target.value }) }}
                    style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1.5px solid var(--border-primary)",
                        background: "var(--bg-card2)",
                        color: "var(--text-main)",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        outline: "none",
                    }}
                >
                    {FUENTES_ORDEN.map(k => {
                        const f = FUENTES_CATALOGO[k]
                        return (
                            <option key={k} value={k}>{f.label} — {f.desc}</option>
                        )
                    })}
                </select>
            </div>

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

                {/* ── Fondo del catálogo con imagen/textura (migración 045) ──
                    Siempre visible (independiente del estilo de portada): la
                    imagen se dibuja ENCIMA del color de fondo con opacidad
                    variable, para mezclarse con el color elegido. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Fondo del catálogo</span>
                        {renderGuardado("fondo_url")}
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, fontWeight: 500 }}>
                        Textura o imagen opcional detrás de todo el catálogo. Bájale la opacidad para mezclarla con el color de fondo.
                    </p>

                    <BannerUploader
                        target="fondo"
                        inputRef={fondoInputRef}
                        url={catalogoConfig?.fondo_url || ""}
                        subiendo={subiendoFondo}
                        onFile={handleBannerFile}
                        onQuitar={quitarBanner}
                        renderGuardado={renderGuardado}
                        campo="fondo_url"
                        icono="Wallpaper"
                        etiqueta="Imagen de fondo"
                        alturaPreview={40}
                        recomendacion="textura o foto (opcional)"
                    />

                    {/* Controles solo si hay imagen de fondo */}
                    {catalogoConfig?.fondo_url && (
                        <>
                            {/* Modo: foto a pantalla completa vs textura tileada */}
                            <div style={{ display: "flex", gap: 10 }}>
                                {[
                                    { key: "cover", label: "Cubrir todo", icono: "Maximize", desc: "La foto se estira a pantalla completa" },
                                    { key: "repeat", label: "Textura repetida", icono: "Grid3X3", desc: "La imagen se repite como patrón" },
                                ].map(m => (
                                    <button
                                        key={m.key}
                                        onClick={() => { setCatalogoConfig(prev => prev ? { ...prev, fondo_modo: m.key } : null); autoguardar("fondo_modo", { fondo_modo: m.key }) }}
                                        style={{
                                            flex: 1, display: "flex", alignItems: "center", gap: 10,
                                            padding: "10px 12px", borderRadius: 10,
                                            border: `2px solid ${(catalogoConfig?.fondo_modo || "cover") === m.key ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                            background: (catalogoConfig?.fondo_modo || "cover") === m.key ? "var(--primary-soft)" : "var(--bg-card2)",
                                            cursor: "pointer", textAlign: "left",
                                        }}
                                    >
                                        <Icon name={m.icono as any} size={16} color={(catalogoConfig?.fondo_modo || "cover") === m.key ? "var(--primary-mid)" : "var(--text-muted)"} />
                                        <div>
                                            <span style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--text-main)" }}>{m.label}</span>
                                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500 }}>{m.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Opacidad de la imagen (0-100): se mezcla con el color de fondo */}
                            <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>Opacidad de la imagen</span>
                                    <span style={{ fontWeight: 800, fontSize: "0.78rem", color: "var(--primary-mid)", minWidth: 42, textAlign: "right" }}>
                                        {catalogoConfig?.fondo_opacidad ?? 100}%
                                    </span>
                                    {renderGuardado("fondo_opacidad")}
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={catalogoConfig?.fondo_opacidad ?? 100}
                                    onChange={e => {
                                        const v = Number(e.target.value)
                                        setCatalogoConfig(prev => prev ? { ...prev, fondo_opacidad: v } : null)
                                        autoguardarDebounce("fondo_opacidad", () => ({ fondo_opacidad: v }))
                                    }}
                                    style={{ width: "100%", accentColor: "var(--primary-mid)", cursor: "pointer" }}
                                />
                                <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                    Al 0% solo se ve el color de fondo; al 100% la imagen cubre el color.
                                </p>
                            </div>

                            {/* Color de fondo bajo la imagen */}
                            <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>Color de fondo</span>
                                    {renderGuardado("fondo_color")}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <button
                                        onClick={() => { setCatalogoConfig(prev => prev ? { ...prev, fondo_color: "" } : prev); autoguardar("fondo_color", { fondo_color: "" }) }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                                            border: `2px solid ${!catalogoConfig?.fondo_color ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                            background: "var(--bg-card2)", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        <div style={{
                                            width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                                            background: "linear-gradient(135deg, var(--bg-app) 0%, var(--primary-mid) 100%)",
                                            border: "1.5px solid var(--border-primary)",
                                        }} />
                                        Tema
                                    </button>
                                    <label style={{
                                        display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 10, cursor: "pointer",
                                        border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)",
                                    }}>
                                        <input
                                            type="color"
                                            value={catalogoConfig?.fondo_color || "#ffffff"}
                                            onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, fondo_color: e.target.value } : prev); autoguardarDebounce("fondo_color", () => ({ fondo_color: e.target.value })) }}
                                            style={{ width: 22, height: 22, border: "none", background: "none", padding: 0, cursor: "pointer" }}
                                        />
                                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>Otro color</span>
                                    </label>
                                </div>
                                <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                    Color que se ve bajo la imagen cuando le bajas la opacidad. "Tema" usa el color del tema elegido.
                                </p>
                            </div>
                        </>
                    )}
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
