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
// El diseño usa los mismos temas del gestor A TRAVÉS de sus variables CSS:
// el tema del tenant se aplica como atributo data-theme en <html> y todos los
// colores se leen de var(--...) definidas en globals.css. Editar un tema del
// gestor (globals.css) actualiza el catálogo público automáticamente.
//
// Sistema de templates: el backend devuelve config.template y la página
// renderiza el componente correspondiente (grid-clasico, menu-carta, etc.)
// ==============================================================================

import { useState, useEffect, useCallback, useRef, Fragment } from "react"
import { fetchCatalogoPublico } from "@/lib/api"
import { optimizarImagenCloudinary } from "@/lib/image-utils"
import { normalizarFuente } from "@/lib/catalogo-fuentes"
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
    // Fuente display (migración 044): 'serif' default; claves en lib/catalogo-fuentes.ts
    fuente?: string
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
    // Fondo del catálogo con imagen (migración 045): '' = usa el color del tema
    fondo_url?: string
    fondo_modo?: string      // 'cover' (foto completa) | 'repeat' (textura tileada)
    fondo_opacidad?: number  // 0-100: opacidad de la imagen sobre el color de fondo
    fondo_color?: string     // hex #RRGGBB bajo la imagen; '' = color del tema
    logo: string
}

interface RespuestaCatalogo {
    config: ConfigCatalogo
    productos: ProductoPublico[]
    // Orden manual de las categorías (drag & drop en Personalización): {nombre: posición}
    orden_categorias?: Record<string, number>
    // Datos de contacto del negocio (migración 043) — solo lo que el tenant llenó
    contacto?: ContactoNegocio
}

interface ContactoNegocio {
    telefono: string
    correo: string
    instagram: string
    facebook: string
    tiktok: string
    sitio_web: string
    maps: string
}

// ── Paleta ligada a las variables CSS de globals.css ──
// Cada propiedad es una referencia var(--...): el valor real lo decide el
// tema activo ([data-theme] en <html>, aplicado según config.tema más abajo).
// Así el catálogo y el gestor comparten la MISMA fuente de verdad (globals.css).

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

const TEMA_VARIABLES: PaletaTema = {
    bg: "var(--bg-app)",
    bgCard: "var(--bg-card)",
    text: "var(--text-main)",
    textMuted: "var(--text-muted)",
    primary: "var(--primary-mid)",
    primaryDark: "var(--primary-dark)",
    border: "var(--border-primary)",
    gradient: "var(--gradient-1)",
}

/**
 * Capa decorativa del FONDO con imagen (migración 045) + FADE-IN suave.
 *
 * Predecarga la URL antes de pintarla: la capa arranca en opacidad 0 y, cuando
 * el navegador tiene los bits completos (Image.decode()), transiciona al nivel
 * de opacidad elegido por el tenant. Así el fondo "aparece" en vez de saltar
 * — siempre queda el color por debajo (background del contenedor raíz) y si la
 * imagen falla simplemente no aparece: nadie percibe un error.
 *
 * zIndex -1 pinta ARRIBA del color de fondo del contenedor y DEBAJO de todo el
 * contenido (cabecera, tarjetas, pie). Textura → capa desplazable con el scroll
 * (el patrón fluye con la página); foto 'cover' → fija al viewport sin estirarse
 * por toda la altura del catálogo. pointer-events none: es decorativa.
 */
function CapaFondoCatalogo({ url, textura, opacidad }: { url: string; textura: boolean; opacidad: number }) {
    const [lista, setLista] = useState(false)
    useEffect(() => {
        setLista(false)
        if (!url) return
        let activo = true
        const img = new Image()
        img.src = url
        if (typeof img.decode === "function") {
            img.decode().then(() => { if (activo) setLista(true) }).catch(() => { /* falló la carga: el color queda en paz */ })
        } else {
            img.onload = () => { if (activo) setLista(true) }
        }
        return () => { activo = false }
    }, [url])
    if (!url) return null
    return (
        <div aria-hidden="true" style={{
            position: textura ? "absolute" : "fixed",
            inset: 0,
            zIndex: -1,
            pointerEvents: "none",
            backgroundImage: `url(${url})`,
            backgroundRepeat: textura ? "repeat" : "no-repeat",
            backgroundSize: textura ? "auto" : "cover",
            backgroundPosition: "center",
            opacity: lista ? opacidad : 0,
            transition: "opacity 0.45s ease",
        }} />
    )
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
    ordenCategorias?: Record<string, number>
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

/**
 * Íconos de marcas (lucide-react ya no incluye Instagram/Facebook): SVG inline
 * estándar, aceptan color para heredar el tema del footer.
 */
function IconoRedSocial({ red, size = 19, color }: { red: "instagram" | "facebook"; size?: number; color: string }) {
    if (red === "instagram") {
        return (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
                <circle cx="12" cy="12" r="4.2" />
                <circle cx="17.4" cy="6.6" r="1.1" fill={color} stroke="none" />
            </svg>
        )
    }
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    )
}

/**
 * Links del footer de contacto (migración 043).
 * Acepta que el dueño escriba @usuario, nombre, plus code o link completo:
 * - Redes: si trae http lo usamos tal cual; si no, construimos el perfil.
 * - Teléfono: se normaliza a dígitos para wa.me (WhatsApp).
 * - Maps: si trae http va directo; si no, búsqueda de Google Maps con el
 *   plus code + nombre del negocio.
 */
function construirLinksContacto(c: ContactoNegocio) {
    const esHttp = (v: string) => /^https?:\/\//i.test(v)
    const limpiarArroba = (v: string) => v.replace(/^@/, "").trim()

    const whatsapp = (() => {
        const digits = (c.telefono || "").replace(/[^\d]/g, "")
        return digits.length >= 8 ? `https://wa.me/${digits}` : ""
    })()

    const instagram = c.instagram
        ? (esHttp(c.instagram) ? c.instagram : `https://instagram.com/${limpiarArroba(c.instagram)}`)
        : ""
    const facebook = c.facebook
        ? (esHttp(c.facebook) ? c.facebook : `https://facebook.com/${c.facebook.replace(/^\/+/, "").trim()}`)
        : ""
    const tiktok = c.tiktok
        ? (esHttp(c.tiktok) ? c.tiktok : `https://tiktok.com/@${c.tiktok.replace(/^@/, "").trim()}`)
        : ""
    const web = c.sitio_web
        ? (esHttp(c.sitio_web) ? c.sitio_web : `https://${c.sitio_web.trim()}`)
        : ""
    const maps = c.maps
        ? (esHttp(c.maps) ? c.maps : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.maps)}`)
        : ""
    const correo = c.correo ? `mailto:${c.correo.trim()}` : ""

    return { whatsapp, instagram, facebook, tiktok, web, maps, correo }
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

    // ── Aplicar el tema del tenant al <html> ──
    // globals.css define los colores de cada tema bajo [data-theme="..."];
    // al poner el atributo con el tema del catálogo, todas las var(--...) de
    // TEMA_VARIABLES resuelven a ese tema. Al desmontar se restaura el tema
    // previo del visitante (el que dejó el script inline del layout).
    const temaPrevio = useRef<string | null>(null)
    useEffect(() => {
        if (!datos) return
        if (temaPrevio.current === null) {
            temaPrevio.current = document.documentElement.getAttribute("data-theme")
        }
        document.documentElement.setAttribute("data-theme", normalizarTema(datos.config.tema))
        return () => {
            if (temaPrevio.current !== null) {
                document.documentElement.setAttribute("data-theme", temaPrevio.current)
            }
        }
    }, [datos])

    // ── Fuente display (migración 044) ──
    // Publica la familia elegida en la variable --font-display (la consumen los
    // templates y el hero); si la fuente es de Google Fonts, inyecta su CSS una
    // sola vez. 'sistema' usa inherit (la sans neutra del catálogo).
    useEffect(() => {
        if (!datos) return
        const f = normalizarFuente(datos.config.fuente)
        document.documentElement.style.setProperty("--font-display", f.stack)
        // Compensación óptica: mismas tallas en px, percepción uniforme entre fuentes
        document.documentElement.style.setProperty("--fd-scale", String(f.escala ?? 1))
        if (f.googleCss) {
            const id = "catalogo-fuente-css"
            let link = document.getElementById(id) as HTMLLinkElement | null
            if (!link) {
                link = document.createElement("link")
                link.id = id
                link.rel = "stylesheet"
                document.head.appendChild(link)
            }
            link.href = f.googleCss
        }
    }, [datos?.config.fuente])

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
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-app)" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, border: "4px solid var(--border-primary)", borderTopColor: "var(--primary-mid)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
                    <p style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.9rem" }}>Cargando catálogo...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        )
    }

    // ── Error ──
    if (error || !datos) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-app)" }}>
                <div style={{ textAlign: "center", maxWidth: 400, padding: 40 }}>
                    <Icon name="Store" size={48} color="var(--primary-dark)" />
                    <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-main)", margin: "0 0 8px" }}>Catálogo no disponible</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>{error || "No se pudo cargar el catálogo."}</p>
                </div>
            </div>
        )
    }

    // ── Aplicar tema ──
    // La paleta es única (referencias var(--...)); el tema del tenant ya fue
    // aplicado como data-theme en <html> por el efecto de arriba.
    const tema = TEMA_VARIABLES
    const { config } = datos

    // ── Banner según viewport: en móvil se prefiere banner_url_movil si existe ──
    // Se optimiza en Cloudinary (w_ + f_auto + q_auto) para no descargar el
    // banner a resolución completa: w_1920 en escritorio, w_800 en móvil.
    const bannerUrl = optimizarImagenCloudinary(
        esMovil && config.banner_url_movil ? config.banner_url_movil : config.banner_url,
        esMovil ? 800 : 1920
    )

    // ── Fondo del catálogo con imagen/textura (migración 045) ──
    // La imagen se dibuja ENCIMA del color de fondo (fondo_color o el del tema)
    // con la opacidad elegida: al bajarla se mezcla con el color. El modo
    // 'repeat' tilea la imagen como patrón (textura), 'cover' la estira.
    const fondoUrl = config.fondo_url
        ? optimizarImagenCloudinary(config.fondo_url, config.fondo_modo === "repeat" ? 640 : 1600)
        : ""
    const fondoEsTextura = (config.fondo_modo || "cover") === "repeat"
    const fondoOpacidad = Math.max(0, Math.min(100, config.fondo_opacidad ?? 100)) / 100
    const fondoColor = config.fondo_color || ""

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
                    background: p === paginaSegura ? `color-mix(in srgb, ${tema.primary} 10%, transparent)` : tema.bgCard,
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
        <div style={{ minHeight: "100vh", background: fondoColor || tema.bg, color: tema.text, fontFamily: "system-ui, -apple-system, sans-serif", position: "relative", isolation: "isolate" }}>
            {/* ── FONDO con imagen (migración 045, con fade-in suave) ── */}
            {fondoUrl && (
                <CapaFondoCatalogo url={fondoUrl} textura={fondoEsTextura} opacidad={fondoOpacidad} />
            )}
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
                            <h1 style={{ fontSize: esMovil ? "calc(1.35rem * var(--fd-scale, 1))" : "calc(1.9rem * var(--fd-scale, 1))", fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5, fontFamily: "var(--font-display, inherit)", textShadow: sombraTexto(config.banner_texto_color) }}>
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
                <header style={{ background: tema.gradient, padding: config.template === "menu-carta" ? "32px 24px 28px" : "48px 24px 40px", textAlign: "center", color: "var(--on-primary)" }}>
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
                        <h1 style={{ fontSize: "calc(1.8rem * var(--fd-scale, 1))", fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5, fontFamily: "var(--font-display, inherit)" }}>
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
                    color: "var(--on-primary)",
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
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: config.template === "menu-carta" ? "16px 20px 0" : "24px 20px 0" }}>
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
                                        color: catFiltro === cat ? "var(--on-primary)" : tema.textMuted,
                                        transition: "all 0.15s",
                                        boxShadow: catFiltro === cat ? `0 2px 8px color-mix(in srgb, ${tema.primary} 33%, transparent)` : "0 1px 3px rgba(0,0,0,0.06)",
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
                ordenCategorias={datos.orden_categorias}
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
                                            background: item === paginaSegura ? `color-mix(in srgb, ${tema.primary} 10%, transparent)` : tema.bgCard,
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
                    listaNavegable={productosVisibles}
                    onNavegar={setProductoActivo}
                />
            )}

            {/* ── Footer ── */}
            <footer style={{
                textAlign: "center", padding: "24px 20px 40px",
                fontSize: "0.75rem", color: tema.textMuted, fontWeight: 500,
            }}>
                {/* Datos de contacto del negocio (migración 043): solo campos llenos.
                    Sereno: logotipo + nombre en serif display, íconos redondos y
                    dentro de un divisor superior. Sin nada lleno, se ve idéntico a antes. */}
                {(() => {
                    const contacto = datos.contacto || { telefono: "", correo: "", instagram: "", facebook: "", tiktok: "", sitio_web: "", maps: "" }
                    const L = construirLinksContacto(contacto)
                    const hayDatos = Boolean(L.whatsapp || L.correo || L.instagram || L.facebook || L.tiktok || L.web || L.maps)
                    if (!hayDatos) return null
                    const iconoLingote: React.CSSProperties = {
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 42, height: 42, borderRadius: "50%",
                        background: tema.bgCard,
                        border: `1px solid ${tema.border}`,
                        color: tema.text,
                        cursor: "pointer", transition: "all 0.15s",
                        textDecoration: "none",
                    }
                    return (
                        <div style={{ borderTop: `1px solid ${tema.border}`, maxWidth: 780, margin: "0 auto", padding: "0 20px" }}>
                            <div style={{ paddingTop: 26 }}>
                                {config.logo && (
                                    <img
                                        src={optimizarImagenCloudinary(config.logo, 120)}
                                        alt=""
                                        style={{
                                            width: 52, height: 52, borderRadius: "50%",
                                            objectFit: "cover",
                                            border: `2px solid ${tema.border}`,
                                            background: "#fff",
                                            margin: "0 auto 10px", display: "block",
                                        }}
                                    />
                                )}
                                {config.titulo && (
                                    <p style={{
                                        margin: "0 0 14px",
                                        fontFamily: "var(--font-display, inherit)",
                                        fontSize: "1.15rem", fontWeight: 600,
                                        color: tema.text,
                                    }}>
                                        {config.titulo}
                                    </p>
                                )}

                                {/* Íconos de redes/web/maps */}
                                <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                                    {L.whatsapp && (
                                        <a href={L.whatsapp} target="_blank" rel="noopener noreferrer" style={iconoLingote} aria-label="WhatsApp"
                                            onMouseEnter={e => { e.currentTarget.style.background = tema.bg; e.currentTarget.style.borderColor = tema.textMuted }}
                                            onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard; e.currentTarget.style.borderColor = tema.border }}>
                                            <Icon name="MessageCircle" size={19} color={tema.text} />
                                        </a>
                                    )}
                                    {L.instagram && (
                                        <a href={L.instagram} target="_blank" rel="noopener noreferrer" style={iconoLingote} aria-label="Instagram"
                                            onMouseEnter={e => { e.currentTarget.style.background = tema.bg; e.currentTarget.style.borderColor = tema.textMuted }}
                                            onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard; e.currentTarget.style.borderColor = tema.border }}>
                                            <IconoRedSocial red="instagram" size={19} color={tema.text} />
                                        </a>
                                    )}
                                    {L.facebook && (
                                        <a href={L.facebook} target="_blank" rel="noopener noreferrer" style={iconoLingote} aria-label="Facebook"
                                            onMouseEnter={e => { e.currentTarget.style.background = tema.bg; e.currentTarget.style.borderColor = tema.textMuted }}
                                            onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard; e.currentTarget.style.borderColor = tema.border }}>
                                            <IconoRedSocial red="facebook" size={19} color={tema.text} />
                                        </a>
                                    )}
                                    {L.tiktok && (
                                        <a href={L.tiktok} target="_blank" rel="noopener noreferrer" style={iconoLingote} aria-label="TikTok"
                                            onMouseEnter={e => { e.currentTarget.style.background = tema.bg; e.currentTarget.style.borderColor = tema.textMuted }}
                                            onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard; e.currentTarget.style.borderColor = tema.border }}>
                                            <Icon name="Music2" size={19} color={tema.text} />
                                        </a>
                                    )}
                                    {L.web && (
                                        <a href={L.web} target="_blank" rel="noopener noreferrer" style={iconoLingote} aria-label="Sitio web"
                                            onMouseEnter={e => { e.currentTarget.style.background = tema.bg; e.currentTarget.style.borderColor = tema.textMuted }}
                                            onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard; e.currentTarget.style.borderColor = tema.border }}>
                                            <Icon name="Globe" size={19} color={tema.text} />
                                        </a>
                                    )}
                                    {L.maps && (
                                        <a href={L.maps} target="_blank" rel="noopener noreferrer" style={iconoLingote} aria-label="Ubicación"
                                            onMouseEnter={e => { e.currentTarget.style.background = tema.bg; e.currentTarget.style.borderColor = tema.textMuted }}
                                            onMouseLeave={e => { e.currentTarget.style.background = tema.bgCard; e.currentTarget.style.borderColor = tema.border }}>
                                            <Icon name="MapPin" size={19} color={tema.text} />
                                        </a>
                                    )}
                                </div>

                                {/* Contacto directo en texto */}
                                <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
                                    {L.whatsapp && (
                                        <a href={L.whatsapp} target="_blank" rel="noopener noreferrer" style={{ color: tema.textMuted, fontWeight: 600, fontSize: "0.8rem", textDecoration: "none" }}>
                                            {contacto.telefono}
                                        </a>
                                    )}
                                    {L.correo && (
                                        <a href={L.correo} style={{ color: tema.textMuted, fontWeight: 600, fontSize: "0.8rem", textDecoration: "none" }}>
                                            {contacto.correo}
                                        </a>
                                    )}
                                    {/* Dirección: texto del alias si existe Maps, no whatsapp */}
                                    {L.maps && !contacto.maps.startsWith("http") && (
                                        <span style={{ color: tema.textMuted, fontWeight: 500, fontSize: "0.78rem", opacity: 0.8 }}>
                                            {contacto.maps}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })()}
                <p style={{ margin: "18px 0 0" }}>Catálogo digital · Nezzura Digital</p>
            </footer>
        </div>
    )
}
