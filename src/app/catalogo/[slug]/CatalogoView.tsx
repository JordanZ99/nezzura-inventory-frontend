"use client"
// ==============================================================================
// src/app/catalogo/[slug]/CatalogoView.tsx
// Catálogo público de productos — vista para clientes (Client Component).
//
// Esta página NO es parte del gestor. Es una vista pública, elegante y
// minimalista que cualquier persona puede ver mediante un link o QR.
// No requiere autenticación. No carga el contexto de auth, ni Antigravity,
// ni el sidebar, ni los temas del gestor.
//
// El diseño usa los mismos 4 temas predefinidos del gestor pero aplicados
// de forma independiente con CSS inline para no heredar globals.css.
//
// Sistema de templates: el backend devuelve config.template y la página
// renderiza el componente correspondiente (grid-clasico, menu-carta, etc.)
// ==============================================================================

import { useState, useEffect } from "react"
import { fetchCatalogoPublico } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import CatalogoGridClasico from "@/components/CatalogoGridClasico"
import CatalogoMenuCarta from "@/components/CatalogoMenuCarta"

// ── Tipos ──

interface ProductoPublico {
    producto: string
    descripcion: string
    imagen: string
    precio_venta: number
    stock_total: number
    categoria: string[]
}

interface ConfigCatalogo {
    tema: string
    template: string
    titulo: string
    subtitulo: string
    mostrar_precios: boolean
    mostrar_stock: boolean
    mostrar_categorias: boolean
    banner_url?: string
    hero_estilo?: string      // 'gradiente' | 'imagen'
    anuncio_texto?: string
    logo: string
}

interface RespuestaCatalogo {
    config: ConfigCatalogo
    productos: ProductoPublico[]
}

// ── Mapa de temas predefinidos ──
// Cada tema define una paleta de colores completa para el catálogo.
// Los valores coinciden con los temas del gestor (globals.css) pero
// se aplican inline para mantener el catálogo visualmente independiente.

interface PaletaTema {
    bg: string
    bgCard: string
    text: string
    textMuted: string
    primary: string
    primaryDark: string
    border: string
    gradient: string
}

const TEMAS: Record<string, PaletaTema> = {
    default: {
        bg: "#f0f3f8",
        bgCard: "#ffffff",
        text: "#1e293b",
        textMuted: "#64748b",
        primary: "#3a7dbf",
        primaryDark: "#2c5f8f",
        border: "#e2e8f0",
        gradient: "linear-gradient(135deg, #3a7dbf 0%, #5e87a4 100%)",
    },
    midnightBlack: {
        bg: "#0f1419",
        bgCard: "#1a1f24",
        text: "#e2e8f0",
        textMuted: "#94a3b8",
        primary: "#2dd4bf",
        primaryDark: "#14b8a6",
        border: "#2a3038",
        gradient: "linear-gradient(135deg, #1f2321 0%, #1e6456 100%)",
    },
    strawberry: {
        bg: "#fff5f7",
        bgCard: "#ffffff",
        text: "#4a1d2e",
        textMuted: "#9b6b7a",
        primary: "#f33376",
        primaryDark: "#d12e6a",
        border: "#fce4ea",
        gradient: "linear-gradient(135deg, #f33376 0%, #fa30df 100%)",
    },
    cozyYellow: {
        bg: "#fffef5",
        bgCard: "#ffffff",
        text: "#4a3d1a",
        textMuted: "#9b8b5a",
        primary: "#f59e0b",
        primaryDark: "#d97706",
        border: "#fef3c7",
        gradient: "linear-gradient(135deg, #ffd05b 0%, #eb7456 100%)",
    },
}

// ── Mapa de templates ──
// Asocia cada nombre de template con su componente React.
// Si el backend devuelve un template no registrado, usa grid-clasico como fallback.
const TEMPLATES: Record<string, React.FC<{
    productos: ProductoPublico[]
    config: ConfigCatalogo
    tema: PaletaTema
    busqueda: string
}>> = {
    "grid-clasico": CatalogoGridClasico,
    "menu-carta": CatalogoMenuCarta,
}

export default function CatalogoView({ slug }: { slug: string }) {
    const [datos, setDatos] = useState<RespuestaCatalogo | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [busqueda, setBusqueda] = useState("")
    const [catFiltro, setCatFiltro] = useState("Todas")

    // ── Cargar datos del catálogo ──
    useEffect(() => {
        fetchCatalogoPublico<RespuestaCatalogo>(slug)
            .then(d => setDatos(d))
            .catch(() => setError("Este catálogo no está disponible o no ha sido activado."))
            .finally(() => setCargando(false))
    }, [slug])

    // ── Favicon dinámico: usa el logo del tenant ──
    useEffect(() => {
        const logoUrl = datos?.config?.logo
        if (!logoUrl) return

        // Buscar o crear el elemento link del favicon
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
        if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
        }
        link.href = logoUrl
    }, [datos?.config?.logo])

    // ── Loading ──
    if (cargando) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f3f8" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, border: "4px solid #e2e8f0", borderTopColor: "#3a7dbf", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
                    <p style={{ color: "#64748b", fontWeight: 600, fontSize: "0.9rem" }}>Cargando catálogo...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        )
    }

    // ── Error ──
    if (error || !datos) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f3f8" }}>
                <div style={{ textAlign: "center", maxWidth: 400, padding: 40 }}>
                    <Icon name="Store" size={48} color="var(--primary-dark)" />
                    <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1e293b", margin: "0 0 8px" }}>Catálogo no disponible</h1>
                    <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.6 }}>{error || "No se pudo cargar el catálogo."}</p>
                </div>
            </div>
        )
    }

    // ── Aplicar tema ──
    const tema = TEMAS[datos.config.tema] || TEMAS.default
    const { config } = datos

    // ── Resolver template ──
    const TemplateComponent = TEMPLATES[config.template] || TEMPLATES["grid-clasico"]

    // ── Filtrar productos ──
    const categorias = config.mostrar_categorias
        ? ["Todas", ...Array.from(new Set(datos.productos.flatMap(p => p.categoria || ["Otros"]))).sort()]
        : ["Todas"]

    const productosFiltrados = datos.productos.filter(p => {
        const porBusqueda = !busqueda || p.producto.toLowerCase().includes(busqueda.toLowerCase()) || (p.descripcion || "").toLowerCase().includes(busqueda.toLowerCase())
        const porCategoria = catFiltro === "Todas" || (p.categoria || ["Otros"]).includes(catFiltro)
        return porBusqueda && porCategoria
    })

    return (
        <div style={{ minHeight: "100vh", background: tema.bg, color: tema.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {/* ── Barra de anuncios (opcional) ── */}
            {config.anuncio_texto && (
                <div style={{
                    background: tema.primary,
                    color: "#fff",
                    textAlign: "center",
                    padding: "10px 20px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    letterSpacing: 0.3,
                }}>
                    {config.anuncio_texto}
                </div>
            )}

            {/* ── Header / Hero ── */}
            {config.hero_estilo === "imagen" && config.banner_url ? (
                /* Hero con banner como fondo de imagen */
                <header style={{
                    position: "relative",
                    backgroundImage: `url(${config.banner_url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    padding: "84px 24px",
                    textAlign: "center",
                    color: "#fff",
                }}>
                    {/* Overlay oscuro para legibilidad */}
                    <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.55))",
                        zIndex: 0,
                    }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                        <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5, textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
                            {config.titulo || "Catálogo"}
                        </h1>
                        {config.subtitulo && (
                            <p style={{ fontSize: "0.95rem", opacity: 0.9, margin: 0, fontWeight: 500, textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
                                {config.subtitulo}
                            </p>
                        )}
                        <p style={{ fontSize: "0.75rem", opacity: 0.75, margin: "12px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5 }}>
                            {datos.productos.length} productos
                        </p>
                    </div>
                </header>
            ) : (
                /* Modo gradiente: banner arriba (opcional) + header con gradiente */
                <>
                    {config.banner_url && (
                        <div style={{ width: "100%", maxHeight: 280, overflow: "hidden", background: tema.bg }}>
                            <img
                                src={config.banner_url}
                                alt="Banner del catálogo"
                                style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
                                loading="lazy"
                            />
                        </div>
                    )}
                    <header style={{ background: tema.gradient, padding: "48px 24px 40px", textAlign: "center", color: "#fff" }}>
                        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5 }}>
                            {config.titulo || "Catálogo"}
                        </h1>
                        {config.subtitulo && (
                            <p style={{ fontSize: "0.95rem", opacity: 0.85, margin: 0, fontWeight: 500 }}>
                                {config.subtitulo}
                            </p>
                        )}
                        <p style={{ fontSize: "0.75rem", opacity: 0.6, margin: "12px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5 }}>
                            {datos.productos.length} productos
                        </p>
                    </header>
                </>
            )}

            {/* ── Buscador + filtros ── */}
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 0" }}>
                {/* Buscador */}
                <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{
                        width: "100%", padding: "14px 20px", fontSize: "0.95rem",
                        border: `1px solid ${tema.border}`, borderRadius: 14,
                        background: tema.bgCard, color: tema.text,
                        outline: "none", boxSizing: "border-box",
                        transition: "border-color 0.2s",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = tema.primary}
                    onBlur={e => e.currentTarget.style.borderColor = tema.border}
                />

                {/* Filtros de categoría (solo para grid-clasico) */}
                {config.mostrar_categorias && categorias.length > 2 && config.template === "grid-clasico" && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                        {categorias.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCatFiltro(cat)}
                                style={{
                                    padding: "8px 16px", borderRadius: 20,
                                    border: "none", cursor: "pointer",
                                    fontSize: "0.8rem", fontWeight: 700,
                                    background: catFiltro === cat ? tema.primary : tema.bgCard,
                                    color: catFiltro === cat ? "#fff" : tema.textMuted,
                                    transition: "all 0.15s",
                                    boxShadow: catFiltro === cat ? "none" : `0 1px 3px rgba(0,0,0,0.06)`,
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Render del template activo ── */}
            <TemplateComponent
                productos={productosFiltrados}
                config={config}
                tema={tema}
                busqueda={busqueda}
            />

            {/* ── Footer ── */}
            <footer style={{
                textAlign: "center", padding: "24px 20px 40px",
                fontSize: "0.75rem", color: tema.textMuted, fontWeight: 500,
            }}>
                <p style={{ margin: 0 }}>Catálogo digital · Nezzura Digital</p>
            </footer>
        </div>
    )
}
