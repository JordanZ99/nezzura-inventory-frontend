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

import { useState, useEffect, useCallback, Fragment } from "react"
import { fetchCatalogoPublico } from "@/lib/api"
import { optimizarImagenCloudinary } from "@/lib/image-utils"
import { normalizarTema } from "@/lib/temas"
import Icon from "@/components/ui/Icon"
import CatalogoGridClasico from "@/components/CatalogoGridClasico"
import CatalogoMenuCarta from "@/components/CatalogoMenuCarta"
import CatalogoModalProducto from "@/components/CatalogoModalProducto"

// ── Tipos ──

interface ProductoPublico {
    producto: string
    descripcion: string
    imagen: string
    precio_venta: number
    stock_total: number
    categoria: string[]
    imagenes?: string[]
    // Sufijo del precio en el catálogo ("c/u", "por kilo", "por litro", ...); vacío = sin sufijo
    sufijo_precio?: string
    // 'stock' | 'servicio' | 'compuesto' — sin stock: no se agotan nunca
    tipo_producto?: string
    // Variaciones: presentaciones con su PROPIO precio (ej. Sencilla/Doble, S/M/L).
    // Cada variación lleva su propio inventario (las agotadas se muestran como
    // "Agotado" y no se pueden elegir).
    variaciones?: { id: number; nombre: string; precio: number; foto?: string; stock?: number }[]
}

interface ConfigCatalogo {
    tema: string
    template: string
    titulo: string
    subtitulo: string
    mostrar_precios: boolean
    mostrar_stock: boolean
    mostrar_categorias: boolean
    agrupar_por_categoria?: boolean | null
    columnas_movil?: number
    permitir_descarga?: boolean
    ocultar_agotados?: boolean
    relacion_imagen?: string  // '1:1' (default) | '4:5' — relación global de las fotos de producto
    banner_url?: string
    banner_url_movil?: string
    hero_estilo?: string      // 'gradiente' | 'imagen'
    banner_texto_color?: string
    banner_mostrar_texto?: boolean
    banner_mostrar_logo?: boolean
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
    midnightSlate: {
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
    agrupado: boolean
    onAbrirProducto?: (p: ProductoPublico) => void
}>> = {
    "grid-clasico": CatalogoGridClasico,
    "menu-carta": CatalogoMenuCarta,
}

/**
 * Sombra del texto sobre el banner (modo imagen).
 * Si el color elegido es claro → sombra oscura (legibilidad sobre fotos claras);
 * si es oscuro → sombra clara y sutil (no ensucia las fotos oscuras).
 */
function sombraTexto(hex?: string): string {
    if (!hex) return "0 2px 12px rgba(0,0,0,0.4)"
    const c = hex.replace("#", "")
    if (c.length < 6) return "0 2px 12px rgba(0,0,0,0.4)"
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    const luminancia = (r * 299 + g * 587 + b * 114) / 1000
    return luminancia > 150 ? "0 2px 12px rgba(0,0,0,0.35)" : "0 1px 6px rgba(255,255,255,0.45)"
}

/**
 * Rango de páginas visible con truncado inteligente (…).
 * Siempre incluye la primera y la última página.
 */
function rangoPaginas(actual: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const rango: (number | "…")[] = [1]
    if (actual > 3) rango.push("…")
    const desde = Math.max(2, actual - 1)
    const hasta = Math.min(total - 1, actual + 1)
    for (let p = desde; p <= hasta; p++) rango.push(p)
    if (actual < total - 2) rango.push("…")
    rango.push(total)
    return rango
}

export default function CatalogoView({ slug }: { slug: string }) {
    const [datos, setDatos] = useState<RespuestaCatalogo | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [busqueda, setBusqueda] = useState("")
    const [catFiltro, setCatFiltro] = useState("Todas")
    const ITEMS_POR_PAGINA = 24
    const [paginaActual, setPaginaActual] = useState(1)
    const [productoActivo, setProductoActivo] = useState<ProductoPublico | null>(null)
    // Identidad estable para evitar que el efecto del modal (scroll-lock + Escape) se re-ejecute en cada render
    const cerrarProducto = useCallback(() => setProductoActivo(null), [])
    // Detecta móvil (<=899px) para usar la paginación compacta (Anterior/Página/Siguiente)
    const [esMovil, setEsMovil] = useState<boolean>(() =>
        typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches)

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

    // Reiniciar paginación cuando cambian los filtros
    useEffect(() => {
        setPaginaActual(1)
    }, [busqueda, catFiltro])

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 899px)")
        setEsMovil(mq.matches)
        const handler = (e: MediaQueryListEvent) => setEsMovil(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

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
    // normalizarTema mapea el valor legado 'midnightBlack' (filas antiguas de la BD)
    const tema = TEMAS[normalizarTema(datos.config.tema)] || TEMAS.default
    const { config } = datos

    // ── Banner según viewport: en móvil se prefiere banner_url_movil si existe ──
    // Se optimiza en Cloudinary (w_ + f_auto + q_auto) para no descargar el
    // banner a resolución completa: w_1920 en escritorio, w_800 en móvil.
    const bannerUrl = optimizarImagenCloudinary(
        esMovil && config.banner_url_movil ? config.banner_url_movil : config.banner_url,
        esMovil ? 800 : 1920
    )

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

    // ── Agrupación por categoría vs paginación ──
    // Con agrupación activa se muestran TODOS los productos por secciones (sin paginar).
    // NULL = el tenant no ha tocado el toggle: preserva el comportamiento previo por template
    // (menu-carta agrupaba siempre; grid-clasico mostraba lista plana)
    const agrupado = config.agrupar_por_categoria ?? config.template === "menu-carta"
    const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA))
    const paginaSegura = Math.min(paginaActual, totalPaginas)
    const inicio = (paginaSegura - 1) * ITEMS_POR_PAGINA
    const productosVisibles = agrupado
        ? productosFiltrados
        : productosFiltrados.slice(inicio, inicio + ITEMS_POR_PAGINA)

    // ── Helpers de la paginación (compartidos entre móvil y escritorio) ──
    // Estilo idéntico al del Historial de Ventas (estadísticas): padding 6px 14px,
    // radio 8, hover con cambio de fondo y estado deshabilitado atenuado (opacity 0.5).
    const estiloNav: React.CSSProperties = {
        padding: "6px 14px",
        borderRadius: 8,
        border: `1px solid ${tema.border}`,
        background: tema.bgCard,
        fontWeight: 600,
        fontSize: "0.8rem",
        transition: "all 0.15s",
    }
    const renderAnterior = () => (
        <button
            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
            disabled={paginaSegura <= 1}
            style={{
                ...estiloNav,
                background: paginaSegura <= 1 ? tema.border : tema.bgCard,
                color: paginaSegura <= 1 ? tema.textMuted : tema.text,
                cursor: paginaSegura <= 1 ? "not-allowed" : "pointer",
                opacity: paginaSegura <= 1 ? 0.5 : 1,
            }}
            onMouseOver={e => { if (paginaSegura > 1) e.currentTarget.style.background = tema.border }}
            onMouseOut={e => { e.currentTarget.style.background = paginaSegura <= 1 ? tema.border : tema.bgCard }}
        >
            ← Anterior
        </button>
    )
    const renderSiguiente = () => (
        <button
            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
            disabled={paginaSegura >= totalPaginas}
            style={{
                ...estiloNav,
                background: paginaSegura >= totalPaginas ? tema.border : tema.bgCard,
                color: paginaSegura >= totalPaginas ? tema.textMuted : tema.text,
                cursor: paginaSegura >= totalPaginas ? "not-allowed" : "pointer",
                opacity: paginaSegura >= totalPaginas ? 0.5 : 1,
            }}
            onMouseOver={e => { if (paginaSegura < totalPaginas) e.currentTarget.style.background = tema.border }}
            onMouseOut={e => { e.currentTarget.style.background = paginaSegura >= totalPaginas ? tema.border : tema.bgCard }}
        >
            Siguiente →
        </button>
    )

    // Páginas mostradas en móvil: si hay 3 o menos se muestran todas (1 2 3);
    // si hay más, solo primera, actual y última (con … entre los huecos).
    const paginasMovil = totalPaginas <= 3
        ? Array.from({ length: totalPaginas }, (_, i) => i + 1)
        : [...new Set([1, paginaSegura, totalPaginas])].sort((a, b) => a - b)

    const renderPaginaMovil = (p: number, idx: number) => (
        <Fragment key={p}>
            {idx > 0 && paginasMovil[idx - 1] + 1 < p && (
                <span style={{ color: tema.textMuted, fontSize: "0.8rem", padding: "0 4px" }}>…</span>
            )}
            <button
                onClick={() => setPaginaActual(p)}
                style={{
                    padding: "6px 12px", borderRadius: 6,
                    border: p === paginaSegura ? `2px solid ${tema.primary}` : `1px solid ${tema.border}`,
                    background: p === paginaSegura ? `${tema.primary}1A` : tema.bgCard,
                    color: p === paginaSegura ? tema.primary : tema.text,
                    cursor: "pointer",
                    fontWeight: p === paginaSegura ? 800 : 600,
                    fontSize: "0.8rem", transition: "all 0.15s",
                }}
            >
                {p}
            </button>
        </Fragment>
    )

    return (
        <div style={{ minHeight: "100vh", background: tema.bg, color: tema.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {/* ── Header / Hero ── */}
            {config.hero_estilo === "imagen" && bannerUrl ? (
                /* Hero con banner como fondo de imagen.
                   El marco SIEMPRE conserva la relación del crop (1920×373 escritorio /
                   750×420 móvil), con el texto centrado adentro: con o sin título,
                   el banner mide exactamente lo que se recortó (WYSIWYG). */
                <header style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: esMovil ? "750 / 420" : "1920 / 373",
                    boxSizing: "border-box",
                    backgroundImage: `url(${bannerUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "20px",
                    overflow: "hidden",
                    color: config.banner_texto_color || "#fff",
                }}>
                    {/* Logo sobre el banner (opcional, default activo e independiente del toggle de texto).
                        Se superpone sin alterar el alto del contenedor: el marco conserva
                        la relación del crop del banner (WYSIWYG). */}
                    {config.banner_mostrar_logo !== false && config.logo && (
                        <img
                            src={optimizarImagenCloudinary(config.logo, 200)}
                            alt={config.titulo || "Logo del catálogo"}
                            style={{
                                width: esMovil ? 64 : 88,
                                height: esMovil ? 64 : 88,
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "3px solid rgba(255,255,255,0.9)",
                                display: "block",
                                margin: "0 auto 12px",
                                background: "#fff",
                                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                            }}
                        />
                    )}
                    {config.banner_mostrar_texto !== false && (
                        <div>
                            <h1 style={{ fontSize: esMovil ? "1.35rem" : "1.9rem", fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5, textShadow: sombraTexto(config.banner_texto_color) }}>
                                {config.titulo || "Catálogo"}
                            </h1>
                            {config.subtitulo && (
                                <p style={{ fontSize: "0.95rem", opacity: 0.9, margin: 0, fontWeight: 500, textShadow: sombraTexto(config.banner_texto_color) }}>
                                    {config.subtitulo}
                                </p>
                            )}
                            <p style={{ fontSize: "0.75rem", opacity: 0.75, margin: "12px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, textShadow: sombraTexto(config.banner_texto_color) }}>
                                {datos.productos.length} productos
                            </p>
                        </div>
                    )}
                </header>
            ) : (
                /* Modo gradiente: solo header con degradado (el banner es exclusivo del modo imagen) */
                <header style={{ background: tema.gradient, padding: "48px 24px 40px", textAlign: "center", color: "#fff" }}>
                        {config.logo && (
                            /* Logo circular con borde blanco, igual que en el preview del link (WhatsApp) */
                            <img
                                src={optimizarImagenCloudinary(config.logo, 200)}
                                alt={config.titulo || "Logo del catálogo"}
                                style={{
                                    width: 96, height: 96,
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    border: "4px solid rgba(255,255,255,0.92)",
                                    display: "block",
                                    margin: "0 auto 14px",
                                    background: "#fff",
                                    boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
                                }}
                            />
                        )}
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
            )}

            {/* ── Barra de anuncios (opcional, sticky) ──
                Colocada DEBAJO del banner/hero. Con overflow-x: clip en html/body,
                position: sticky se pega al viewport: queda en su sitio hasta que el
                scroll la toca y entonces se fija arriba, volviendo a su lugar al
                hacer scroll hacia arriba. */}
            {config.anuncio_texto && (
                <div style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                    background: tema.primary,
                    color: "#fff",
                    textAlign: "center",
                    padding: "10px 20px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}>
                    {config.anuncio_texto}
                </div>
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

                {/* Filtros de categoría estilo POS: una sola fila scrolleable horizontal (sin flechas) */}
                {config.mostrar_categorias && categorias.length > 2 && config.template === "grid-clasico" && (
                    <div style={{ marginTop: 16 }}>
                        <div
                            className="catalogo-chips"
                            style={{
                                display: "flex",
                                gap: 8,
                                overflowX: "auto",
                                padding: "4px 4px 8px",
                                scrollbarWidth: "none",
                                WebkitOverflowScrolling: "touch",
                            }}
                        >
                            <style>{`.catalogo-chips { -ms-overflow-style: none; scrollbar-width: none; } .catalogo-chips::-webkit-scrollbar { display: none; }`}</style>
                            {categorias.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCatFiltro(cat)}
                                    style={{
                                        padding: "8px 16px", borderRadius: 20,
                                        border: "none", cursor: "pointer",
                                        fontSize: "0.8rem", fontWeight: 700,
                                        whiteSpace: "nowrap",
                                        background: catFiltro === cat ? tema.primary : tema.bgCard,
                                        color: catFiltro === cat ? "#fff" : tema.textMuted,
                                        transition: "all 0.15s",
                                        boxShadow: catFiltro === cat ? `0 2px 8px ${tema.primary}55` : "0 1px 3px rgba(0,0,0,0.06)",
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Render del template activo ── */}
            <TemplateComponent
                productos={productosVisibles}
                config={config}
                tema={tema}
                busqueda={busqueda}
                agrupado={agrupado}
                onAbrirProducto={setProductoActivo}
            />

            {/* ── Paginación (solo en modo plano) ── */}
            {!agrupado && totalPaginas > 1 && (
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 20px 0" }}>
                    {/* Fila 1: contador de productos en su propia línea */}
                    <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: "0.78rem", color: tema.textMuted, fontWeight: 600 }}>
                            Mostrando {productosVisibles.length} de {productosFiltrados.length} productos
                        </span>
                    </div>

                    {/* Fila 2: controles — móvil usa patrón compacto que nunca desborda */}
                    {esMovil ? (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                            {renderAnterior()}
                            {paginasMovil.map(renderPaginaMovil)}
                            {renderSiguiente()}
                        </div>
                    ) : (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            {renderAnterior()}
                            {rangoPaginas(paginaSegura, totalPaginas).map((item, idx) =>
                                item === "…" ? (
                                    <span key={`ellipsis-${idx}`} style={{ padding: "0 4px", color: tema.textMuted, fontSize: "0.8rem" }}>…</span>
                                ) : (
                                    <button
                                        key={item}
                                        onClick={() => setPaginaActual(item)}
                                        style={{
                                            padding: "6px 12px", borderRadius: 6,
                                            border: item === paginaSegura ? `2px solid ${tema.primary}` : `1px solid ${tema.border}`,
                                            background: item === paginaSegura ? `${tema.primary}1A` : tema.bgCard,
                                            color: item === paginaSegura ? tema.primary : tema.text,
                                            cursor: "pointer", fontWeight: item === paginaSegura ? 800 : 600,
                                            fontSize: "0.8rem", transition: "all 0.15s",
                                        }}
                                    >
                                        {item}
                                    </button>
                                )
                            )}
                            {renderSiguiente()}
                        </div>
                    )}
                </div>
            )}

            {/* ── Modal de producto (estilo post de Instagram) ── */}
            {productoActivo && (
                <CatalogoModalProducto
                    key={productoActivo.producto}
                    producto={productoActivo}
                    config={config}
                    tema={tema}
                    onClose={cerrarProducto}
                />
            )}

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
