"use client"
// ==============================================================================
// src/app/inventario/posts/page.tsx
// Vista de lote (Fase 4): TODAS las tarjetas del catálogo en un grid, listas
// para repostear. Cada producto usa su override si existe y si no los defaults
// del negocio (misma cascada que el modal "Crear post").
//
// - Selector de formato (post/historia/cuadrado) y sello (oferta/agotado/nuevo)
//   aplicados a toda la vista.
// - Descargar individual (PNG) o "Descargar todas" (secuencial con delay para
//   que el navegador no bloquee las descargas automáticas).
// ==============================================================================

import { useCallback, useEffect, useMemo, useState } from "react"
import Icon from "@/components/ui/Icon"
import PageHeader from "@/components/ui/PageHeader"
import { api, CatalogoConfig, PostConfig, Producto } from "@/lib/api"
import { construirUrlPreview, descargarUrl, nombreArchivo, resolverConfig } from "@/lib/posts"

const OPCIONES_FORMATO: { clave: string; nombre: string; detalle: string }[] = [
    { clave: "post", nombre: "Post 4:5", detalle: "1080×1350" },
    { clave: "historia", nombre: "Historia 9:16", detalle: "1080×1920" },
    { clave: "cuadrado", nombre: "Cuadrado 1:1", detalle: "1200×1200" },
]

const OPCIONES_SELLO: { clave: string; nombre: string; color: string }[] = [
    { clave: "", nombre: "Sin sello", color: "" },
    { clave: "oferta", nombre: "Oferta", color: "#e11d48" },
    { clave: "agotado", nombre: "Agotado", color: "#1f2937" },
    { clave: "nuevo", nombre: "Nuevo", color: "#059669" },
]

export default function PostsLote() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [defaults, setDefaults] = useState<PostConfig | null>(null)
    const [configCatalogo, setConfigCatalogo] = useState<CatalogoConfig | null>(null)
    const [formato, setFormato] = useState("cuadrado") // el más compacto para el grid
    const [sello, setSello] = useState("")
    const [cargando, setCargando] = useState(true)
    const [descargando, setDescargando] = useState<string | null>(null) // "todas" o nombre del producto
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

    // Cargar inventario + defaults del negocio + config del catálogo
    useEffect(() => {
        let activo = true
        Promise.all([api.getInventario(), api.getPostConfig(), api.getConfigCatalogo()])
            .then(([inv, pc, cc]) => {
                if (!activo) return
                setProductos(inv || [])
                setDefaults(pc)
                setConfigCatalogo(cc)
            })
            .catch(() => { if (activo) setMsg({ ok: false, texto: "No se pudo cargar el catálogo. Intenta de nuevo." }) })
            .finally(() => { if (activo) setCargando(false) })
        return () => { activo = false }
    }, [])

    // URLs de cada tarjeta (la cascada: override del producto || defaults del negocio)
    const urls = useMemo(() => {
        const mapa: Record<string, string> = {}
        if (!configCatalogo || !productos.length) return mapa
        for (const p of productos) {
            const cfg = resolverConfig(p.post_override, defaults)
            mapa[p.producto] = construirUrlPreview({
                origin: window.location.origin,
                producto: p.producto,
                cfg,
                formato,
                precio: p.precio_venta ?? 0,
                sufijo: p.sufijo_precio,
                foto: p.imagen && p.imagen !== "No hay foto" ? p.imagen : undefined,
                negocio: configCatalogo.titulo,
                logo: configCatalogo.logo,
                sello,
            })
        }
        return mapa
    }, [productos, defaults, configCatalogo, formato, sello])

    const descargarUno = useCallback(async (p: Producto) => {
        const url = urls[p.producto]
        if (!url) return
        setDescargando(p.producto)
        setMsg(null)
        try {
            await descargarUrl(url, nombreArchivo(p.producto, formato))
            setMsg({ ok: true, texto: `${p.producto}: tarjeta descargada.` })
        } catch {
            setMsg({ ok: false, texto: `No se pudo descargar ${p.producto}.` })
        } finally {
            setDescargando(null)
        }
    }, [urls, formato])

    // Descarga secuencial con delay: evita que el navegador bloquee el lote
    const descargarTodas = useCallback(async () => {
        setDescargando("todas")
        setMsg(null)
        let ok = 0
        let err = 0
        for (const p of productos) {
            const url = urls[p.producto]
            if (!url) continue
            try {
                await descargarUrl(url, nombreArchivo(p.producto, formato))
                ok++
                await new Promise(r => setTimeout(r, 400))
            } catch {
                err++
            }
        }
        setDescargando(null)
        setMsg({
            ok: err === 0,
            texto: err === 0
                ? `${ok} tarjetas descargadas.`
                : `${ok} descargadas, ${err} fallaron (el navegador puede bloquear varias descargas: hazlas de a poco).`,
        })
    }, [productos, urls, formato])

    return (
        <div style={{ minHeight: "100vh" }}>
            <PageHeader
                gradiente="var(--gradient-2)"
                agColor="var(--ag-color-2)"
                subtitulo="POSTS AUTOMÁTICOS"
                subtituloStyle={{ color: "var(--text-label)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}
                titulo="Todas las tarjetas"
                icono="Images"
                iconoColor="var(--primary-dark)"
                tituloClase=""
                tituloStyle={{ color: "var(--primary-dark)", fontSize: "1.7rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "12px" }}
            />

            <div style={{ padding: "0 24px", marginTop: -60, overflowX: "hidden" }}>
                <div className="card fade-up" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    {/* Fila superior: volver + acciones */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <a
                            href="/inventario"
                            style={{
                                fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)",
                                display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
                            }}
                        >
                            <Icon name="ArrowLeft" size={15} color="var(--text-muted)" /> Volver al inventario
                        </a>
                        <button
                            onClick={descargarTodas}
                            disabled={descargando !== null || !productos.length}
                            style={{
                                padding: "10px 18px", borderRadius: 12, border: "none", cursor: descargando === null ? "pointer" : "not-allowed",
                                background: "var(--gradient-1)", color: "#fff", fontWeight: 800, fontSize: "0.82rem",
                                display: "flex", alignItems: "center", gap: 8, opacity: descargando === null ? 1 : 0.6,
                                transition: "all 0.15s",
                            }}
                        >
                            <Icon name="Download" size={17} color="#fff" />
                            {descargando === "todas" ? "Descargando todas..." : `Descargar todas (${productos.length})`}
                        </button>
                    </div>

                    {/* Controles de la vista (formato + sello, aplicados a todas) */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <div>
                            <p style={{ fontSize: "0.66rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px" }}>Formato</p>
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
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {f.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: "0.66rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px" }}>Sello</p>
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
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {s.nombre}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {msg && (
                        <p style={{
                            margin: 0, padding: "8px 12px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700,
                            borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`,
                            background: msg.ok ? "#e8f5e9" : "#ffebee",
                            color: msg.ok ? "#2e7d32" : "#b71c1c",
                        }}>
                            {msg.texto}
                        </p>
                    )}
                </div>

                {cargando ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 60, color: "var(--text-muted)", fontWeight: 700, gap: 10, alignItems: "center" }}>
                        <Icon name="Loader" size={24} color="var(--text-muted)" className="modal-post-spin" /> Cargando tarjetas...
                    </div>
                ) : productos.length === 0 ? (
                    <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.9rem" }}>
                        No hay productos en el inventario.
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                        {productos.map(p => {
                            const url = urls[p.producto]
                            return (
                                <div key={p.producto} className="card fade-up" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{
                                        background: "#191c20",
                                        borderRadius: 10,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        minHeight: 240, overflow: "hidden",
                                        position: "relative",
                                    }}>
                                        {url && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={url}
                                                alt={`Tarjeta de ${p.producto}`}
                                                loading="lazy"
                                                style={{
                                                    maxHeight: 320,
                                                    maxWidth: "100%",
                                                    width: "auto",
                                                    display: "block",
                                                    borderRadius: 8,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.producto}>
                                        {p.producto}
                                    </p>
                                    <button
                                        onClick={() => descargarUno(p)}
                                        disabled={descargando !== null || !url}
                                        style={{
                                            padding: "8px 12px", borderRadius: 10, border: "none", cursor: descargando === null ? "pointer" : "not-allowed",
                                            background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.74rem",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                            opacity: descargando === null ? 1 : 0.6, transition: "all 0.15s",
                                        }}
                                    >
                                        <Icon name="Download" size={14} color="var(--primary-mid)" />
                                        {descargando === p.producto ? "Descargando..." : "Descargar PNG"}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
                <div style={{ height: 30 }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } } .modal-post-spin { animation: spin 1s linear infinite; }`}</style>
        </div>
    )
}
