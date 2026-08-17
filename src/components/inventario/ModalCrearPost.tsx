"use client"
// ==============================================================================
// src/components/inventario/ModalCrearPost.tsx
// Modal "Crear post" (Posts Automáticos — Fase 1, plantilla Marco).
//
// - Vista previa EN VIVO: la URL de la tarjeta se regenera sola con debounce
//   (~300ms) al tocar cualquier control; la imagen la renderiza la ruta edge
//   /posts/[producto] (Satori, mismo motor que el opengraph del catálogo).
// - Configuración en cascada: el modal arranca con el override del producto si
//   existe (productos.post_override) y si no con los defaults del negocio
//   (post_config). "Guardar para este producto" persiste el override;
//   "Usar defaults" lo quita (el producto vuelve a los defaults del negocio).
// - "Descargar PNG" baja la tarjeta en el formato elegido.
// ==============================================================================

import { useCallback, useEffect, useMemo, useState } from "react"
import Icon from "@/components/ui/Icon"
import { api, CatalogoConfig, PostConfig, PostOverride, Producto } from "@/lib/api"

interface Props {
    producto: Producto
    onClose: () => void
    /** Se dispara al guardar/quitar el override para refrescar el inventario en memoria. */
    onOverrideGuardado?: (override: PostOverride | null) => void
}

interface ConfigResuelta {
    template: string
    color: string
    font: string
    posicion: string
    mostrar: { nombre: boolean; precio: boolean; negocio: boolean }
}

const OPCIONES_COLOR: { clave: string; nombre: string; color: string }[] = [
    { clave: "default", nombre: "Azul", color: "#3a7dbf" },
    { clave: "midnightBlack", nombre: "Noche", color: "#1e6456" },
    { clave: "strawberry", nombre: "Fresa", color: "#f33376" },
    { clave: "cozyYellow", nombre: "Cálido", color: "#f59e0b" },
    { clave: "white", nombre: "Blanco", color: "#f2f2ef" },
]

const OPCIONES_FUENTE: { clave: string; nombre: string; css: string }[] = [
    { clave: "moderna", nombre: "Moderna", css: "Inter, sans-serif" },
    { clave: "elegante", nombre: "Elegante", css: "'Playfair Display', serif" },
    { clave: "redondeada", nombre: "Redondeada", css: "Nunito, sans-serif" },
]

const OPCIONES_FORMATO: { clave: string; nombre: string; detalle: string }[] = [
    { clave: "post", nombre: "Post 4:5", detalle: "1080×1350" },
    { clave: "historia", nombre: "Historia 9:16", detalle: "1080×1920" },
    { clave: "cuadrado", nombre: "Cuadrado 1:1", detalle: "1200×1200" },
]

const MOSTRAR_OPCIONES: { clave: "nombre" | "precio" | "negocio"; nombre: string }[] = [
    { clave: "nombre", nombre: "Nombre del producto" },
    { clave: "precio", nombre: "Precio" },
    { clave: "negocio", nombre: "Nombre del negocio" },
]

/**
 * Resuelve la configuración efectiva de la tarjeta: override del producto si
 * existe, con las claves ausentes heredadas de los defaults del negocio.
 */
function resolverConfig(override: PostOverride | null | undefined, defaults: PostConfig | null): ConfigResuelta {
    const d = defaults
    return {
        template: override?.template || d?.template_default || "marco",
        color: override?.color || d?.color || "default",
        font: override?.font || d?.font || "moderna",
        posicion: override?.posicion || d?.posicion || "abajo",
        mostrar: {
            nombre: override?.mostrar?.nombre ?? d?.mostrar?.nombre ?? true,
            precio: override?.mostrar?.precio ?? d?.mostrar?.precio ?? true,
            negocio: override?.mostrar?.negocio ?? d?.mostrar?.negocio ?? true,
        },
    }
}

/** Nombre de archivo seguro para la descarga (conserva acentos y ñ). */
function nombreArchivo(producto: string, formato: string): string {
    const base = producto
        .replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]+/g, "-")
        .replace(/^-+|-+$/g, "") || "producto"
    return `${base}-${formato}.png`
}

export default function ModalCrearPost({ producto, onClose, onOverrideGuardado }: Props) {
    const [defaults, setDefaults] = useState<PostConfig | null>(null)
    const [configCatalogo, setConfigCatalogo] = useState<CatalogoConfig | null>(null)
    const [cfg, setCfg] = useState<ConfigResuelta | null>(null)
    const [formato, setFormato] = useState("post")
    const [previewUrl, setPreviewUrl] = useState("")
    const [cargandoPreview, setCargandoPreview] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

    const tieneOverride = Boolean(producto.post_override)

    // Cargar defaults del negocio + config del catálogo (nombre/logo del negocio)
    useEffect(() => {
        let activo = true
        Promise.all([api.getPostConfig(), api.getConfigCatalogo()])
            .then(([pc, cc]) => {
                if (!activo) return
                setDefaults(pc)
                setConfigCatalogo(cc)
                setCfg(resolverConfig(producto.post_override, pc))
            })
            .catch(() => {
                if (activo) setCfg(resolverConfig(producto.post_override, null))
            })
        return () => { activo = false }
    }, [producto])

    // Escape cierra el modal + bloquea el scroll del body (patrón del catálogo)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            window.removeEventListener("keydown", onKey)
            document.body.style.overflow = prev
        }
    }, [onClose])

    // ── Vista previa con debounce (~300ms): la URL cambia al tocar controles ──
    useEffect(() => {
        if (!cfg || !configCatalogo) return
        setCargandoPreview(true)
        const timer = setTimeout(() => {
            const params = new URLSearchParams()
            params.set("template", cfg.template)
            params.set("color", cfg.color)
            params.set("font", cfg.font)
            params.set("posicion", cfg.posicion)
            params.set("mostrar", JSON.stringify(cfg.mostrar))
            params.set("formato", formato)
            params.set("precio", String(producto.precio_venta ?? 0))
            if (producto.sufijo_precio) params.set("sufijo", producto.sufijo_precio)
            if (producto.imagen && producto.imagen !== "No hay foto") params.set("foto", producto.imagen)
            if (configCatalogo?.titulo) params.set("negocio", configCatalogo.titulo)
            if (configCatalogo?.logo) params.set("logo", configCatalogo.logo)
            setPreviewUrl(`${window.location.origin}/posts/${encodeURIComponent(producto.producto)}?${params.toString()}`)
        }, 300)
        return () => clearTimeout(timer)
    }, [cfg, formato, configCatalogo, producto])

    // ¿Hay cambios sin guardar respecto a lo persistido (override o defaults)?
    const hayCambios = useMemo(() => {
        if (!cfg) return false
        const base = resolverConfig(producto.post_override, defaults)
        return JSON.stringify(base) !== JSON.stringify(cfg)
    }, [cfg, producto.post_override, defaults])

    const guardarOverride = useCallback(async () => {
        if (!cfg) return
        setGuardando(true)
        setMsg(null)
        try {
            const ov: PostOverride = {
                template: cfg.template,
                color: cfg.color,
                font: cfg.font,
                posicion: cfg.posicion,
                mostrar: cfg.mostrar,
            }
            await api.guardarPostOverride(producto.producto, ov)
            setMsg({ ok: true, texto: "Override guardado: este producto usará esta tarjeta." })
            onOverrideGuardado?.(ov)
        } catch (e) {
            setMsg({ ok: false, texto: e instanceof Error ? e.message : "Error al guardar el override" })
        } finally {
            setGuardando(false)
        }
    }, [cfg, producto.producto, onOverrideGuardado])

    const quitarOverride = useCallback(async () => {
        setGuardando(true)
        setMsg(null)
        try {
            await api.guardarPostOverride(producto.producto, null)
            setMsg({ ok: true, texto: "Override quitado: vuelve a usar los defaults del negocio." })
            if (defaults) setCfg(resolverConfig(null, defaults))
            onOverrideGuardado?.(null)
        } catch (e) {
            setMsg({ ok: false, texto: e instanceof Error ? e.message : "Error al quitar el override" })
        } finally {
            setGuardando(false)
        }
    }, [producto.producto, defaults, onOverrideGuardado])

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
                padding: 20,
            }}
            onClick={onClose}
        >
            <div
                className="fade-up"
                onClick={e => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: 980,
                    maxHeight: "92vh",
                    overflowY: "auto",
                    padding: 24,
                    borderRadius: 20,
                    background: "var(--bg-card)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
                    border: "1px solid var(--border-primary)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                }}
            >
                {/* ── Header ── */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: "var(--gradient-1)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                        <Icon name="ImagePlus" size={24} color="var(--primary-soft)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>
                            Crear post
                        </h3>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {producto.producto} · ${(producto.precio_venta ?? 0).toFixed(2)}{producto.sufijo_precio ? ` · ${producto.sufijo_precio}` : ""}
                        </p>
                    </div>
                    {/* Badge de configuración en cascada */}
                    <span style={{
                        fontSize: "0.66rem", fontWeight: 800, whiteSpace: "nowrap",
                        padding: "4px 10px", borderRadius: 12,
                        background: tieneOverride ? "rgba(156,39,176,0.12)" : "var(--bg-card2)",
                        color: tieneOverride ? "#9c27b0" : "var(--text-muted)",
                        border: `1px solid ${tieneOverride ? "rgba(156,39,176,0.3)" : "var(--border-light)"}`,
                    }}>
                        {tieneOverride ? "Override de este producto" : "Usando defaults del negocio"}
                    </span>
                    <button
                        onClick={onClose}
                        title="Cerrar"
                        style={{ background: "var(--bg-card2)", border: "none", borderRadius: 10, padding: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <Icon name="X" size={18} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Mensaje de feedback */}
                {msg && (
                    <div style={{
                        padding: "10px 14px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700,
                        borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`,
                        background: msg.ok ? "#e8f5e9" : "#ffebee",
                        color: msg.ok ? "#2e7d32" : "#b71c1c",
                    }}>
                        {msg.texto}
                    </div>
                )}

                <div style={{ display: "flex", gap: 20, flexDirection: "column" }} className="lg:flex-row">
                    {/* ── Controles ── */}
                    <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Plantilla */}
                        <div>
                            <LabelControles>Plantilla</LabelControles>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <Chip activo>Marco</Chip>
                                <Chip deshabilitado>Overlay <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>(Fase 2)</span></Chip>
                                <Chip deshabilitado>Tarjeta <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>(Fase 2)</span></Chip>
                            </div>
                            <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                Marco (polaroid): la foto va dentro del marco y el texto nunca la tapa.
                            </p>
                        </div>

                        {/* Color */}
                        <div>
                            <LabelControles>Color de acento</LabelControles>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                {OPCIONES_COLOR.map(c => (
                                    <button
                                        key={c.clave}
                                        title={c.nombre}
                                        onClick={() => setCfg(p => p ? { ...p, color: c.clave } : p)}
                                        style={{
                                            width: 34, height: 34, borderRadius: "50%", cursor: "pointer",
                                            background: c.color,
                                            border: cfg?.color === c.clave ? "3px solid var(--primary-mid)" : "2px solid var(--border-primary)",
                                            outline: cfg?.color === c.clave ? "2px solid var(--primary-glow)" : "none",
                                            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                                            transition: "all 0.15s",
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Fuente */}
                        <div>
                            <LabelControles>Fuente</LabelControles>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {OPCIONES_FUENTE.map(f => (
                                    <button
                                        key={f.clave}
                                        onClick={() => setCfg(p => p ? { ...p, font: f.clave } : p)}
                                        style={{
                                            padding: "7px 14px", borderRadius: 12, border: "none", cursor: "pointer",
                                            fontSize: "0.78rem", fontWeight: 700, fontFamily: f.css,
                                            background: cfg?.font === f.clave ? "var(--primary-mid)" : "var(--bg-card2)",
                                            color: cfg?.font === f.clave ? "#fff" : "var(--text-main)",
                                            boxShadow: cfg?.font === f.clave ? "0 2px 6px var(--primary-glow)" : "none",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {f.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Qué mostrar */}
                        <div>
                            <LabelControles>Mostrar en la tarjeta</LabelControles>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {MOSTRAR_OPCIONES.map(op => {
                                    const activo = cfg?.mostrar[op.clave] ?? true
                                    return (
                                        <label key={op.clave} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)" }}>
                                            <input
                                                type="checkbox"
                                                checked={activo}
                                                onChange={e => setCfg(p => p ? ({ ...p, mostrar: { ...p.mostrar, [op.clave]: e.target.checked } }) : p)}
                                                style={{ width: 16, height: 16, accentColor: "var(--primary-mid)", cursor: "pointer" }}
                                            />
                                            {op.nombre}
                                        </label>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Formato (decisión del momento: no se guarda) */}
                        <div>
                            <LabelControles>Formato</LabelControles>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {OPCIONES_FORMATO.map(f => (
                                    <button
                                        key={f.clave}
                                        onClick={() => setFormato(f.clave)}
                                        title={f.detalle}
                                        style={{
                                            padding: "7px 12px", borderRadius: 12, border: "none", cursor: "pointer",
                                            fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
                                            background: formato === f.clave ? "var(--primary-mid)" : "var(--bg-card2)",
                                            color: formato === f.clave ? "#fff" : "var(--text-main)",
                                            boxShadow: formato === f.clave ? "0 2px 6px var(--primary-glow)" : "none",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {f.nombre} <span style={{ opacity: 0.75, fontSize: "0.6rem" }}>{f.detalle}</span>
                                    </button>
                                ))}
                            </div>
                            <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                El formato se elige cada vez: no se guarda en el override.
                            </p>
                        </div>

                        {hayCambios && !tieneOverride && (
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary-dark)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                                <Icon name="Info" size={14} /> Cambios sin guardar: usa "Guardar para este producto" o se pierden.
                            </p>
                        )}
                    </div>

                    {/* ── Vista previa + acciones ── */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                        <div style={{
                            flex: 1,
                            minHeight: 380,
                            borderRadius: 16,
                            background: "#191c20",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: 16,
                            position: "relative",
                            overflow: "hidden",
                        }}>
                            {cargandoPreview && (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(25,28,32,0.55)", zIndex: 2 }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#cbd5e1", fontSize: "0.75rem", fontWeight: 700 }}>
                                        <Icon name="Loader" size={26} color="#cbd5e1" className="modal-post-spin" />
                                        Generando vista previa...
                                    </div>
                                </div>
                            )}
                            {previewUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={previewUrl}
                                    alt={`Vista previa del post de ${producto.producto}`}
                                    onLoad={() => setCargandoPreview(false)}
                                    onError={() => setCargandoPreview(false)}
                                    style={{
                                        maxHeight: "52vh",
                                        maxWidth: "100%",
                                        width: "auto",
                                        borderRadius: 10,
                                        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                                        display: "block",
                                    }}
                                />
                            )}
                        </div>

                        {/* Acciones */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <a
                                href={previewUrl || undefined}
                                download={nombreArchivo(producto.producto, formato)}
                                style={{
                                    padding: "11px 20px", borderRadius: 12, border: "none", cursor: previewUrl ? "pointer" : "not-allowed",
                                    background: "var(--gradient-1)", color: "#fff", fontWeight: 800, fontSize: "0.82rem",
                                    display: "flex", alignItems: "center", gap: 8, textDecoration: "none", opacity: previewUrl ? 1 : 0.5,
                                    transition: "all 0.15s",
                                }}
                            >
                                <Icon name="Download" size={18} color="#fff" /> Descargar PNG
                            </a>
                            <button
                                onClick={guardarOverride}
                                disabled={guardando || !cfg}
                                style={{
                                    padding: "11px 20px", borderRadius: 12, cursor: guardando ? "not-allowed" : "pointer",
                                    border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                                    color: "var(--text-main)", fontWeight: 700, fontSize: "0.82rem",
                                    display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                                }}
                            >
                                <Icon name="Save" size={18} color="var(--primary-mid)" />
                                {guardando ? "Guardando..." : "Guardar para este producto"}
                            </button>
                            {tieneOverride && (
                                <button
                                    onClick={quitarOverride}
                                    disabled={guardando}
                                    style={{
                                        padding: "11px 20px", borderRadius: 12, cursor: guardando ? "not-allowed" : "pointer",
                                        border: "none", background: "transparent", color: "var(--text-muted)",
                                        fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6,
                                    }}
                                >
                                    <Icon name="Trash2" size={16} color="var(--text-muted)" /> Usar defaults
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: 0 }}>
                            El PNG se genera en el navegador al instante (sin subir nada). Listo para publicar en Instagram, Facebook o WhatsApp.
                        </p>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } } .modal-post-spin { animation: spin 1s linear infinite; }`}</style>
        </div>
    )
}

/** Etiqueta pequeña de sección de controles. */
function LabelControles({ children }: { children: React.ReactNode }) {
    return (
        <label style={{
            fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8,
        }}>
            {children}
        </label>
    )
}

/** Chip de selección (activo / deshabilitado). */
function Chip({ children, activo, deshabilitado }: { children: React.ReactNode; activo?: boolean; deshabilitado?: boolean }) {
    return (
        <span style={{
            padding: "7px 14px", borderRadius: 12, fontSize: "0.78rem", fontWeight: 700,
            background: activo ? "var(--primary-mid)" : deshabilitado ? "var(--bg-card2)" : "var(--bg-card2)",
            color: activo ? "#fff" : deshabilitado ? "var(--text-muted)" : "var(--text-main)",
            border: activo ? "none" : "1px dashed var(--border-primary)",
            opacity: deshabilitado ? 0.75 : 1,
            display: "inline-flex", alignItems: "center", gap: 4,
        }}>
            {children}
        </span>
    )
}
