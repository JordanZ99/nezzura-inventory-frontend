"use client"
// ==============================================================================
// src/components/inventario/ModalCrearPost.tsx
// Modal "Crear post" (Posts Automáticos — Fases 1, 2 y 3).
//
// - Vista previa EN VIVO: la URL de la tarjeta se regenera sola con debounce
//   (~300ms) al tocar cualquier control; la imagen la renderiza la ruta edge
//   /posts/[producto] (Satori, mismo motor que el opengraph del catálogo).
// - Las 3 plantillas (Marco / Sobre la foto / Tarjeta) + posición del texto
//   (solo Overlay) + 3 formatos (post / historia / cuadrado).
// - Elegir foto de la galería (Plan Plus) para la tarjeta.
// - Configuración en cascada: el modal arranca con el override del producto si
//   existe (productos.post_override) y si no con los defaults del negocio
//   (post_config). "Guardar para este producto" persiste el override;
//   "Usar defaults" lo quita; "Guardar como default" actualiza los defaults
//   del negocio con la configuración actual.
// - "Descargar PNG" baja la tarjeta; "Compartir" abre el share sheet nativo
//   con la imagen + la descripción (con hashtags) copiada al portapapeles;
//   en desktop sin share sheet descarga el PNG como fallback.
// ==============================================================================

import { useCallback, useEffect, useMemo, useState } from "react"
import Icon from "@/components/ui/Icon"
import { api, CatalogoConfig, ImagenProducto, PostConfig, PostOverride, Producto } from "@/lib/api"
import { optimizarImagenCloudinary } from "@/lib/image-utils"
import { ConfigResuelta, construirUrlPreview, generarDescripcion, nombreArchivo, resolverConfig } from "@/lib/posts"

interface Props {
    producto: Producto
    onClose: () => void
    /** Se dispara al guardar/quitar el override para refrescar el inventario en memoria. */
    onOverrideGuardado?: (override: PostOverride | null) => void
}

const OPCIONES_COLOR: { clave: string; nombre: string; color: string }[] = [
    { clave: "default", nombre: "Azul", color: "#3a7dbf" },
    { clave: "midnightBlack", nombre: "Noche", color: "#1e6456" },
    { clave: "strawberry", nombre: "Fresa", color: "#f33376" },
    { clave: "cozyYellow", nombre: "Cálido", color: "#f59e0b" },
    { clave: "white", nombre: "Blanco", color: "#f2f2ef" },
]

// Colores de TEXTO personalizables: primario = nombre + negocio (juntos),
// secundario = precio. Incluye Negro (el default de Marco/Tarjeta era casi
// negro) y un picker libre para el color exacto de la marca.
const OPCIONES_COLOR_TEXTO: { clave: string; nombre: string; color: string }[] = [
    { clave: "#000000", nombre: "Negro", color: "#000000" },
    { clave: "#ffffff", nombre: "Blanco", color: "#ffffff" },
    { clave: "#2c5f8f", nombre: "Azul", color: "#2c5f8f" },
    { clave: "#d12e6a", nombre: "Fresa", color: "#d12e6a" },
    { clave: "#059669", nombre: "Verde", color: "#059669" },
    { clave: "#d97706", nombre: "Ámbar", color: "#d97706" },
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

const OPCIONES_PLANTILLA: { clave: string; nombre: string }[] = [
    { clave: "marco", nombre: "Marco" },
    { clave: "overlay", nombre: "Sobre la foto" },
    { clave: "tarjeta", nombre: "Tarjeta" },
]

const DESCRIPCIONES_PLANTILLA: Record<string, string> = {
    marco: "Marco (polaroid): la foto va dentro del marco y el texto nunca la tapa.",
    overlay: "Sobre la foto: el texto va encima con un velo oscuro degradado para que siempre se lea.",
    tarjeta: "Tarjeta (full-bleed): foto arriba a sangre y el texto debajo, sobre el color del negocio.",
}

const OPCIONES_POSICION: { clave: string; nombre: string }[] = [
    { clave: "arriba", nombre: "Arriba" },
    { clave: "abajo", nombre: "Abajo" },
]

// Sello/sticker de la esquina (Fase 4): decisión del momento, no se guarda.
const OPCIONES_SELLO: { clave: string; nombre: string; color: string }[] = [
    { clave: "", nombre: "Sin sello", color: "" },
    { clave: "oferta", nombre: "Oferta", color: "#e11d48" },
    { clave: "agotado", nombre: "Agotado", color: "#1f2937" },
    { clave: "nuevo", nombre: "Nuevo", color: "#059669" },
]



export default function ModalCrearPost({ producto, onClose, onOverrideGuardado }: Props) {
    const [defaults, setDefaults] = useState<PostConfig | null>(null)
    const [configCatalogo, setConfigCatalogo] = useState<CatalogoConfig | null>(null)
    const [cfg, setCfg] = useState<ConfigResuelta | null>(null)
    const [formato, setFormato] = useState("post")
    const [previewUrl, setPreviewUrl] = useState("")
    const [cargandoPreview, setCargandoPreview] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    // Fase 3 — Compartir: galería (elegir foto), descripción editable, share sheet
    const [galeria, setGaleria] = useState<ImagenProducto[]>([])
    const [fotoElegida, setFotoElegida] = useState(
        producto.imagen && producto.imagen !== "No hay foto" ? producto.imagen : ""
    )
    const [descripcion, setDescripcion] = useState("")
    const [compartiendo, setCompartiendo] = useState(false)
    // Diagnóstico: true si el <img> del preview falló (muestra la URL para reportar)
    const [errorPreview, setErrorPreview] = useState(false)
    // Sello de la tarjeta (Fase 4): decisión del momento (no se guarda)
    const [sello, setSello] = useState("")

    const tieneOverride = Boolean(producto.post_override)

    // Fotos disponibles para la tarjeta: la principal + las de la galería
    // (sin duplicados; la orden 1 de la galería es la principal).
    const fotosDisponibles = useMemo(() => {
        const set = new Set<string>()
        if (producto.imagen && producto.imagen !== "No hay foto") set.add(producto.imagen)
        for (const img of galeria) {
            if (img.url && img.url !== "No hay foto") set.add(img.url)
        }
        return [...set]
    }, [producto.imagen, galeria])

    // Cargar defaults del negocio + config del catálogo (nombre/logo del negocio)
    // CADA llamada es independiente: si un endpoint falla (p. ej. el backend
    // desplegado aún no tiene post_config), la otra igual se aplica y la vista
    // previa se genera (con defaults de fábrica y/o sin el nombre del negocio).
    useEffect(() => {
        let activo = true
        api.getPostConfig()
            .then(pc => { if (activo) { setDefaults(pc); setCfg(resolverConfig(producto.post_override, pc)) } })
            .catch(() => { if (activo) setCfg(resolverConfig(producto.post_override, null)) })
        api.getConfigCatalogo()
            .then(cc => {
                if (!activo) return
                setConfigCatalogo(cc)
                // Descripción lista para publicar (editable después)
                setDescripcion(generarDescripcion(producto, cc?.titulo || ""))
            })
            .catch(() => { /* sin config del catálogo → tarjeta sin nombre del negocio */ })
        return () => { activo = false }
    }, [producto])

    // Galería del producto (Plan Plus): para elegir qué foto va en la tarjeta
    useEffect(() => {
        let activo = true
        api.getImagenesProducto(producto.producto)
            .then(imgs => { if (activo) setGaleria(imgs || []) })
            .catch(() => { /* sin galería → solo la foto principal */ })
        return () => { activo = false }
    }, [producto.producto])

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
        if (!cfg) return
        setCargandoPreview(true)
        const timer = setTimeout(() => {
            setErrorPreview(false)
            setPreviewUrl(construirUrlPreview({
                origin: window.location.origin,
                producto: producto.producto,
                cfg,
                formato,
                precio: producto.precio_venta ?? 0,
                sufijo: producto.sufijo_precio,
                foto: fotoElegida,
                negocio: configCatalogo?.titulo,
                logo: configCatalogo?.logo,
                sello,
            }))
        }, 300)
        return () => clearTimeout(timer)
    }, [cfg, formato, configCatalogo, producto, fotoElegida, sello])

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
                cta: cfg.ctaTexto ? { texto: cfg.ctaTexto } : undefined,
                color_primario: cfg.colorPrimario || undefined,
                color_secundario: cfg.colorSecundario || undefined,
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

    // "Guardar como default" (Fase 2): persiste la config actual como defaults
    // del negocio (post_config). Si el producto tiene override, este sigue
    // ganando en su propia tarjeta; el resto del catálogo usa los nuevos defaults.
    const guardarDefaults = useCallback(async () => {
        if (!cfg) return
        setGuardando(true)
        setMsg(null)
        try {
            const nuevos: PostConfig = {
                tenant_id: defaults?.tenant_id || "",
                template_default: cfg.template,
                color: cfg.color,
                font: cfg.font,
                posicion: cfg.posicion,
                mostrar: cfg.mostrar,
                cta_texto: cfg.ctaTexto || "",
                color_primario: cfg.colorPrimario,
                color_secundario: cfg.colorSecundario,
            }
            await api.actualizarPostConfig({
                template_default: cfg.template,
                color: cfg.color,
                font: cfg.font,
                posicion: cfg.posicion,
                mostrar: cfg.mostrar,
                cta_texto: cfg.ctaTexto || "",
                color_primario: cfg.colorPrimario,
                color_secundario: cfg.colorSecundario,
            })
            setDefaults(nuevos)
            // Re-resuelve: si el producto no tiene override, ahora usa los
            // nuevos defaults (que coinciden con lo que se acaba de ver).
            setCfg(resolverConfig(producto.post_override, nuevos))
            setMsg({
                ok: true,
                texto: tieneOverride
                    ? "Defaults del negocio actualizados (este producto seguirá usando su override)."
                    : "Defaults del negocio actualizados: las tarjetas nuevas usarán esta configuración.",
            })
        } catch (e) {
            setMsg({ ok: false, texto: e instanceof Error ? e.message : "Error al guardar los defaults" })
        } finally {
            setGuardando(false)
        }
    }, [cfg, defaults, producto.post_override, tieneOverride])

    // Copia la descripción (con hashtags) al portapapeles
    const copiarDescripcion = useCallback(async () => {
        if (!descripcion) return
        try {
            await navigator.clipboard.writeText(descripcion)
            setMsg({ ok: true, texto: "Descripción copiada al portapapeles. Lista para pegar en la publicación." })
        } catch {
            setMsg({ ok: false, texto: "No se pudo copiar: selecciona el texto manualmente." })
        }
    }, [descripcion])

    // Compartir (Fase 3): share sheet nativo con la imagen PNG + la descripción.
    // - navegadores con navigator.share({files}) → sheet nativo (móvil/Safari).
    // - el resto (desktop) → descarga el PNG como fallback.
    // En AMBOS casos la descripción se copia al portapapeles en el mismo tap.
    const compartir = useCallback(async () => {
        if (!previewUrl) return
        setCompartiendo(true)
        setMsg(null)
        try {
            const res = await fetch(previewUrl)
            if (!res.ok) throw new Error("No se pudo generar la imagen")
            const blob = await res.blob()
            const archivo = new File([blob], nombreArchivo(producto.producto, formato), { type: "image/png" })

            let copiada = false
            try {
                await navigator.clipboard.writeText(descripcion)
                copiada = true
            } catch { /* el share igual funciona */ }

            // Share sheet nativo (requiere contexto seguro + soporte de files)
            const nav = navigator as unknown as {
                canShare?: (data: { files?: File[] }) => boolean
                share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>
            }
            const datos = { files: [archivo], text: descripcion, title: producto.producto }
            if (nav.share && (!nav.canShare || nav.canShare(datos))) {
                await nav.share(datos)
                setMsg({ ok: true, texto: "Compartido (la descripción quedó copiada en el portapapeles)." })
                return
            }

            // Fallback desktop: descargar el PNG + avisar que la descripción ya está copiada
            const a = document.createElement("a")
            a.href = URL.createObjectURL(blob)
            a.download = nombreArchivo(producto.producto, formato)
            a.click()
            URL.revokeObjectURL(a.href)
            setMsg({
                ok: true,
                texto: copiada
                    ? "Este navegador no tiene share sheet: la tarjeta se descargó y la descripción quedó copiada."
                    : "Este navegador no tiene share sheet: la tarjeta se descargó.",
            })
        } catch (e) {
            setMsg({ ok: false, texto: e instanceof Error ? e.message : "Error al compartir" })
        } finally {
            setCompartiendo(false)
        }
    }, [previewUrl, descripcion, producto, formato])

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
                                {OPCIONES_PLANTILLA.map(p => {
                                    const activo = cfg?.template === p.clave
                                    return (
                                        <button
                                            key={p.clave}
                                            onClick={() => setCfg(s => (s ? { ...s, template: p.clave } : s))}
                                            style={{
                                                padding: "7px 14px", borderRadius: 12, border: "none", cursor: "pointer",
                                                fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap",
                                                background: activo ? "var(--primary-mid)" : "var(--bg-card2)",
                                                color: activo ? "#fff" : "var(--text-main)",
                                                boxShadow: activo ? "0 2px 6px var(--primary-glow)" : "none",
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {p.nombre}
                                        </button>
                                    )
                                })}
                            </div>
                            <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                {DESCRIPCIONES_PLANTILLA[cfg?.template || "marco"]}
                            </p>
                        </div>

                        {/* Posición del texto (solo Overlay) */}
                        {cfg?.template === "overlay" && (
                            <div>
                                <LabelControles>Posición del texto</LabelControles>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {OPCIONES_POSICION.map(p => {
                                        const activo = cfg.posicion === p.clave
                                        return (
                                            <button
                                                key={p.clave}
                                                onClick={() => setCfg(s => (s ? { ...s, posicion: p.clave } : s))}
                                                style={{
                                                    padding: "7px 14px", borderRadius: 12, border: "none", cursor: "pointer",
                                                    fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap",
                                                    background: activo ? "var(--primary-mid)" : "var(--bg-card2)",
                                                    color: activo ? "#fff" : "var(--text-main)",
                                                    boxShadow: activo ? "0 2px 6px var(--primary-glow)" : "none",
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                {p.nombre}
                                            </button>
                                        )
                                    })}
                                </div>
                                <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                    El texto se apoya en el velo oscuro de ese lado de la foto.
                                </p>
                            </div>
                        )}

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

                        {/* Colores de texto: primario (nombre + negocio) y secundario (precio) */}
                        <div>
                            <LabelControles>Color del texto (nombre y negocio)</LabelControles>
                            <SelectorColorTexto
                                valor={cfg?.colorPrimario || ""}
                                onChange={v => setCfg(s => (s ? { ...s, colorPrimario: v } : s))}
                            />
                            <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                Mismo color para el nombre del producto y del negocio. "Por defecto" usa el color automático de la plantilla.
                            </p>
                        </div>
                        <div>
                            <LabelControles>Color del precio</LabelControles>
                            <SelectorColorTexto
                                valor={cfg?.colorSecundario || ""}
                                onChange={v => setCfg(s => (s ? { ...s, colorSecundario: v } : s))}
                            />
                            <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                "Por defecto" usa el acento de la paleta (o blanco sobre la foto en Sobre la foto).
                            </p>
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

                        {/* Sello de la esquina (Fase 4): decisión del momento */}
                        <div>
                            <LabelControles>Sello</LabelControles>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {OPCIONES_SELLO.map(s => {
                                    const activo = sello === s.clave
                                    return (
                                        <button
                                            key={s.clave || "sin-sello"}
                                            onClick={() => setSello(s.clave)}
                                            style={{
                                                padding: "7px 12px", borderRadius: 12, border: "none", cursor: "pointer",
                                                fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
                                                background: activo ? (s.clave ? s.color : "var(--primary-mid)") : "var(--bg-card2)",
                                                color: activo ? "#fff" : "var(--text-main)",
                                                boxShadow: activo ? "0 2px 6px var(--primary-glow)" : "none",
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {s.nombre}
                                        </button>
                                    )
                                })}
                            </div>
                            <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                Sello de la esquina (Oferta / Agotado / Nuevo). No se guarda: es del momento.
                            </p>
                        </div>

                        {/* CTA configurable (Fase 4, §9.4) */}
                        <div>
                            <LabelControles>Botón (CTA)</LabelControles>
                            <input
                                type="text"
                                value={cfg?.ctaTexto || ""}
                                onChange={e => setCfg(s => (s ? { ...s, ctaTexto: e.target.value } : s))}
                                placeholder="Ej. Pedir por WhatsApp"
                                maxLength={40}
                                style={{
                                    width: "100%", boxSizing: "border-box", borderRadius: 10,
                                    padding: "9px 12px", border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)",
                                    fontSize: "0.8rem", fontWeight: 600, fontFamily: "inherit",
                                }}
                            />
                            <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                Texto del botón en la tarjeta (vacío = sin botón). Se guarda en el override o en los defaults.
                            </p>
                        </div>

                        {/* Foto de la tarjeta (galería, Plan Plus) */}
                        {fotosDisponibles.length > 1 && (
                            <div>
                                <LabelControles>Foto de la tarjeta</LabelControles>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {fotosDisponibles.map(url => (
                                        <button
                                            key={url}
                                            title="Usar esta foto en la tarjeta"
                                            onClick={() => setFotoElegida(url)}
                                            style={{
                                                padding: 2,
                                                border: fotoElegida === url ? "3px solid var(--primary-mid)" : "2px solid var(--border-primary)",
                                                borderRadius: 10,
                                                background: "none",
                                                cursor: "pointer",
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={optimizarImagenCloudinary(url, 96)}
                                                alt=""
                                                width={46}
                                                height={46}
                                                style={{ objectFit: "cover", borderRadius: 7, display: "block" }}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                    Elige qué foto va en la tarjeta (la elección no se guarda: es del momento).
                                </p>
                            </div>
                        )}

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
                            {previewUrl && !errorPreview && (
                                // key: al cambiar la URL se remonta el <img> y onLoad/onError se re-disparan
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    key={previewUrl}
                                    src={previewUrl}
                                    alt={`Vista previa del post de ${producto.producto}`}
                                    onLoad={() => { setCargandoPreview(false); setErrorPreview(false) }}
                                    onError={() => { setCargandoPreview(false); setErrorPreview(true) }}
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
                            {errorPreview && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#f87171", padding: 16, textAlign: "center" }}>
                                    <Icon name="TriangleAlert" size={26} color="#f87171" />
                                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 800 }}>
                                        No se pudo generar la vista previa
                                    </p>
                                    <p style={{ margin: 0, fontSize: "0.68rem", color: "#94a3b8", wordBreak: "break-all", maxWidth: "100%" }}>
                                        {previewUrl}
                                    </p>
                                    {previewUrl && (
                                        <a
                                            href={previewUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                fontSize: "0.72rem", fontWeight: 700, color: "#60a5fa",
                                                textDecoration: "underline",
                                            }}
                                        >
                                            Abrir la URL en otra pestaña para diagnosticar
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Descripción para publicar (editable, Fase 3) */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <LabelControles style={{ marginBottom: 0 }}>Descripción para publicar</LabelControles>
                                <button
                                    onClick={copiarDescripcion}
                                    disabled={!descripcion}
                                    title="Copiar la descripción al portapapeles"
                                    style={{
                                        padding: "5px 10px", borderRadius: 8, cursor: descripcion ? "pointer" : "not-allowed",
                                        border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                                        color: "var(--text-main)", fontWeight: 700, fontSize: "0.68rem",
                                        display: "flex", alignItems: "center", gap: 5, opacity: descripcion ? 1 : 0.5,
                                    }}
                                >
                                    <Icon name="Copy" size={13} color="var(--primary-mid)" /> Copiar
                                </button>
                            </div>
                            <textarea
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                rows={5}
                                style={{
                                    width: "100%", boxSizing: "border-box", borderRadius: 10,
                                    padding: "10px 12px", border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)",
                                    fontSize: "0.78rem", lineHeight: 1.5, resize: "vertical",
                                    fontFamily: "inherit",
                                }}
                            />
                            <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: 0 }}>
                                Se genera sola con hashtags sugeridos y se copia al portapapeles al compartir. Edítala si quieres.
                            </p>
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
                                onClick={compartir}
                                disabled={compartiendo || !previewUrl}
                                style={{
                                    padding: "11px 20px", borderRadius: 12, cursor: previewUrl ? "pointer" : "not-allowed",
                                    border: "none", background: "var(--primary-dark)", color: "#fff", fontWeight: 800, fontSize: "0.82rem",
                                    display: "flex", alignItems: "center", gap: 8, opacity: previewUrl ? 1 : 0.5,
                                    transition: "all 0.15s",
                                }}
                            >
                                <Icon name="Share2" size={17} color="#fff" />
                                {compartiendo ? "Compartiendo..." : "Compartir"}
                            </button>
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
                            <button
                                onClick={guardarDefaults}
                                disabled={guardando || !cfg}
                                title="Actualiza los defaults del negocio con la configuración actual"
                                style={{
                                    padding: "11px 20px", borderRadius: 12, cursor: guardando ? "not-allowed" : "pointer",
                                    border: "1px dashed var(--border-primary)", background: "transparent",
                                    color: "var(--text-main)", fontWeight: 700, fontSize: "0.8rem",
                                    display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                                }}
                            >
                                <Icon name="Settings" size={16} color="var(--primary-mid)" />
                                {guardando ? "Guardando..." : "Guardar como default"}
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
                        <a
                            href="/inventario/posts"
                            style={{
                                fontSize: "0.72rem", fontWeight: 700, color: "var(--primary-mid)",
                                display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
                                alignSelf: "flex-start",
                            }}
                        >
                            <Icon name="LayoutGrid" size={15} color="var(--primary-mid)" /> Ver todas las tarjetas del catálogo
                        </a>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } } .modal-post-spin { animation: spin 1s linear infinite; }`}</style>
        </div>
    )
}

/** Etiqueta pequeña de sección de controles. */
function LabelControles({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <label style={{
            fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8,
            ...style,
        }}>
            {children}
        </label>
    )
}

/**
 * Selector de color de TEXTO: "Por defecto" ('' = automático por plantilla) +
 * swatches (Negro, Blanco, marca) + picker libre para el color exacto.
 */
function SelectorColorTexto({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
    const esPreset = OPCIONES_COLOR_TEXTO.some(c => c.clave === valor)
    const customActivo = Boolean(valor) && !esPreset
    return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
                onClick={() => onChange("")}
                title="Color automático por plantilla"
                style={{
                    padding: "6px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontSize: "0.66rem", fontWeight: 800, whiteSpace: "nowrap",
                    background: !valor ? "var(--primary-mid)" : "var(--bg-card2)",
                    color: !valor ? "#fff" : "var(--text-main)",
                    boxShadow: !valor ? "0 2px 6px var(--primary-glow)" : "none",
                    transition: "all 0.15s",
                }}
            >
                Por defecto
            </button>
            {OPCIONES_COLOR_TEXTO.map(c => (
                <button
                    key={c.clave}
                    title={c.nombre}
                    onClick={() => onChange(c.clave)}
                    style={{
                        width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                        background: c.color,
                        border: valor === c.clave ? "3px solid var(--primary-mid)" : "2px solid var(--border-primary)",
                        outline: valor === c.clave ? "2px solid var(--primary-glow)" : "none",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        transition: "all 0.15s",
                    }}
                />
            ))}
            {/* Picker libre: un círculo con el color elegido (o un + si no hay) */}
            <label
                title="Elegir un color personalizado"
                style={{
                    width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                    border: customActivo ? "3px solid var(--primary-mid)" : "2px dashed var(--border-primary)",
                    outline: customActivo ? "2px solid var(--primary-glow)" : "none",
                    background: customActivo ? valor : "var(--bg-card2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", overflow: "hidden", transition: "all 0.15s",
                }}
            >
                {!customActivo && <Icon name="Plus" size={14} color="var(--text-muted)" />}
                <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(valor) ? valor : "#000000"}
                    onChange={e => onChange(e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", border: "none", padding: 0 }}
                />
            </label>
        </div>
    )
}


