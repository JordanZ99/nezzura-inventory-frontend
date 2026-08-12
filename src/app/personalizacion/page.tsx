"use client"

import { useState, useEffect, useRef } from "react"
import { api, Producto, type Categoria } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useTenant } from "@/contexts/TenantContext"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import { usePathname, useRouter } from "next/navigation"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import type { CatalogoConfig } from "@/lib/api"
import { comprimirBanner } from "@/lib/image-utils"
import ImageCropperModal from "@/components/ui/ImageCropperModal"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

type Tab = "cuenta" | "catalogo"

/**
 * Mapa que traduce las claves de tema guardadas en localStorage
 * a nombres mostrables en la interfaz.
 * - default      → "Steel Slate" (tema por defecto, gris-azulado)
 * - midnightBlack → "Midnight Black"
 * - strawberry   → "Strawberry Pink"
 * - cozyYellow   → "Cozy Yellow"
 */
const NOMBRES_TEMA: Record<string, string> = {
    default: "Steel Slate",
    midnightBlack: "Midnight Black",
    strawberry: "Strawberry Pink",
    cozyYellow: "Cozy Yellow",
}

export default function Personalizacion() {
    const { tenant, cargando: cargandoTenant, actualizar } = useTenant()

    const [cargando, setCargando] = useState(true)
    const [tab, setTab] = useState<Tab>("cuenta")
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const [productos, setProductos] = useState<Producto[]>([])

    // Estados para el formulario de identidad del negocio
    const [empresa, setEmpresa] = useState("")
    const [logoUrl, setLogoUrl] = useState("")
    // Último logo persistido en la DB (para borrar el anterior de Cloudinary al reemplazarlo)
    const [logoOriginal, setLogoOriginal] = useState("")
    const [guardando, setGuardando] = useState(false)
    // Modo de precio sugerido del Punto de Venta ('antiguo' | 'maximo' | 'reciente')
    const [modoPrecio, setModoPrecio] = useState("antiguo")
    const [guardandoModo, setGuardandoModo] = useState(false)
    const [subiendoLogo, setSubiendoLogo] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const inputFileRef = useRef<HTMLInputElement>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)
    const bannerMovilInputRef = useRef<HTMLInputElement>(null)
    const [subiendoBanner, setSubiendoBanner] = useState(false)
    const [subiendoBannerMovil, setSubiendoBannerMovil] = useState(false)
    // Crop del banner: imagen seleccionada esperando recorte (escritorio o móvil)
    const [bannerCrop, setBannerCrop] = useState<{ url: string; target: "escritorio" | "movil" } | null>(null)
    const router = useRouter()

    // Estados para la configuración del catálogo público
    const [catalogoConfig, setCatalogoConfig] = useState<CatalogoConfig | null>(null)
    const [cargandoCatalogo, setCargandoCatalogo] = useState(false)
    const configCargadaRef = useRef(false)
    const [linkCopiado, setLinkCopiado] = useState(false)
    const [qrDescargado, setQrDescargado] = useState(false)
    const qrCanvasRef = useRef<HTMLCanvasElement>(null)

    // Estados para visibilidad de categorías en el catálogo
    const [categoriasCatalogo, setCategoriasCatalogo] = useState<Categoria[]>([])
    const [cargandoCategorias, setCargandoCategorias] = useState(false)
    const [categoriaToggling, setCategoriaToggling] = useState<string | null>(null)

    // Estado para mostrar el nombre del tema actual en el Hero
    const [temaActual, setTemaActual] = useState<string>("Steel Slate")

    /**
     * Cambia el tema visual de la aplicación: actualiza el atributo
     * data-theme en el elemento <html>, persiste la elección en
     * localStorage y actualiza el nombre visible en el Hero.
     *
     * @param claveTema - Clave del tema ('default', 'midnightBlack', etc.)
     */
    function cambiarTema(claveTema: string) {
        // Aplicamos el tema al documento
        document.documentElement.setAttribute('data-theme', claveTema)
        // Lo persistimos para que sobreviva a recargas de página
        localStorage.setItem('tema', claveTema)
        // Actualizamos el nombre mostrado en el Hero
        setTemaActual(NOMBRES_TEMA[claveTema] || claveTema)
    }

    // Al montar el componente, leemos el tema guardado para mostrarlo
    useEffect(() => {
        const temaGuardado = localStorage.getItem('tema') || 'default'
        setTemaActual(NOMBRES_TEMA[temaGuardado] || 'Steel Slate')
    }, [])

    async function handleLogout() {
        await supabase.auth.signOut()
        router.replace("/login")
    }

    // Sincronizar formulario con los datos cargados desde el contexto
    useEffect(() => {
        if (tenant) {
            setEmpresa(tenant.empresa || "")
            setLogoUrl(tenant.logo || "")
            setLogoOriginal(tenant.logo || "")
        }
    }, [tenant])

    // Cargar el modo de precio sugerido del Punto de Venta
    useEffect(() => {
        api.getPerfil()
            .then(p => setModoPrecio(p.modo_precio_sugerido || "antiguo"))
            .catch(() => {})
    }, [])

    async function cambiarModoPrecio(modo: string) {
        setModoPrecio(modo)
        setGuardandoModo(true)
        try {
            await api.actualizarModoPrecioSugerido(modo)
            mostrarMsg(true, "Modo de precio sugerido actualizado")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error guardando el modo de precio"}`)
            // Revertir al valor persistido
            api.getPerfil()
                .then(p => setModoPrecio(p.modo_precio_sugerido || "antiguo"))
                .catch(() => {})
        } finally {
            setGuardandoModo(false)
        }
    }

    useEffect(() => {
        async function loadData() {
            try {
                // Obtener datos del usuario autenticado
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    setUserEmail(user.email ?? "Usuario Nezzura Digital")
                }
                const inv = await api.getInventario()
                setProductos(inv)
            } catch (e) {
                console.error("Error cargando configuración:", e)
            } finally {
                setCargando(false)
            }
        }
        loadData()
    }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 4000)
    }

    // Procesa y sube el archivo de imagen, convirtiéndolo a WebP
    async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !tenant?.tenant_id) return
        try {
            setSubiendoLogo(true)

            // Subir foto directamente sin compresión
            const nombreClave = `_logo_${tenant.tenant_id.slice(0, 8)}`
            const { ruta } = await api.subirFoto(nombreClave, file)

            setLogoUrl(ruta)
            mostrarMsg(true, "📷 Logo subido temporalmente — Haz clic en Guardar Cambios para aplicarlo en el sistema")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al subir logo"}`)
        } finally {
            setSubiendoLogo(false)
            if (inputFileRef.current) inputFileRef.current.value = ""
        }
    }

    // ── Subir banner/hero del catálogo (escritorio o móvil) ──
    // 1) Se elige el archivo → se abre el modal de recorte con la relación correcta.
    function handleBannerFile(e: React.ChangeEvent<HTMLInputElement>, target: "escritorio" | "movil") {
        const file = e.target.files?.[0]
        if (!file) return
        setBannerCrop({ url: URL.createObjectURL(file), target })
        // Permitir volver a seleccionar el mismo archivo
        ;(e.target as HTMLInputElement).value = ""
    }

    // 2) El usuario aceptó el recorte → comprimir, subir y guardar según el target.
    async function handleBannerCropComplete(blob: Blob) {
        if (!bannerCrop || !tenant?.tenant_id) return
        const { target, url } = bannerCrop
        setBannerCrop(null)
        const esMovil = target === "movil"
        try {
            if (esMovil) setSubiendoBannerMovil(true)
            else setSubiendoBanner(true)
            const nombreClave = `_banner${esMovil ? "_movil" : ""}_${tenant.tenant_id.slice(0, 8)}`
            const archivo = new File([blob], `banner-${esMovil ? "movil" : "escritorio"}.jpg`, { type: blob.type || "image/jpeg" })
            // Comprimir conservando resolución (máx 1920px) antes de subir:
            // el endpoint tiene límite de 1MB y los banners lo superan fácilmente
            let imgAEnviar: Blob | File = archivo
            try { imgAEnviar = await comprimirBanner(archivo) }
            catch { /* enviar el recorte si falla la compresión */ }
            const { ruta } = await api.subirFoto(nombreClave, imgAEnviar as File)
            // URL anterior del banner: se borra de Cloudinary solo tras guardar el nuevo
            const viejaUrl = esMovil ? (catalogoConfig?.banner_url_movil || "") : (catalogoConfig?.banner_url || "")
            if (esMovil) {
                setCatalogoConfig(prev => prev ? { ...prev, banner_url_movil: ruta } : prev)
                const ok = await ejecutarGuardado("banner_url_movil", { banner_url_movil: ruta })
                if (ok && viejaUrl && viejaUrl !== ruta) {
                    api.borrarImagen(viejaUrl).catch(() => {})
                } else if (!ok) {
                    // Guardado falló: limpiar la imagen recién subida (huérfana)
                    api.borrarImagen(ruta).catch(() => {})
                }
            } else {
                setCatalogoConfig(prev => prev ? { ...prev, banner_url: ruta } : prev)
                const ok = await ejecutarGuardado("banner_url", { banner_url: ruta })
                if (ok && viejaUrl && viejaUrl !== ruta) {
                    api.borrarImagen(viejaUrl).catch(() => {})
                } else if (!ok) {
                    // Guardado falló: limpiar la imagen recién subida (huérfana)
                    api.borrarImagen(ruta).catch(() => {})
                }
            }
            mostrarMsg(true, "🖼️ Banner subido y aplicado")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al subir banner"}`)
        } finally {
            setSubiendoBannerMovil(false)
            setSubiendoBanner(false)
            // Revocar el objectURL una vez el modal ya se desmontó
            setTimeout(() => URL.revokeObjectURL(url), 0)
        }
    }

    // ── Quitar banner (escritorio o móvil) ──
    async function quitarBanner(target: "escritorio" | "movil") {
        const campo = target === "escritorio" ? "banner_url" : "banner_url_movil"
        const viejaUrl = target === "escritorio" ? (catalogoConfig?.banner_url || "") : (catalogoConfig?.banner_url_movil || "")
        setCatalogoConfig(prev => prev ? { ...prev, [campo]: "" } : prev)
        const ok = await ejecutarGuardado(campo, { [campo]: "" })
        if (ok && viejaUrl) {
            api.borrarImagen(viejaUrl).catch(() => {})
        }
    }

    // Guarda empresa y logo en Supabase
    async function guardarCambios() {
        if (!empresa.trim()) {
            mostrarMsg(false, "❌ El nombre del negocio no puede estar vacío")
            return
        }
        try {
            setGuardando(true)

            // Llama a la función global actualizar del contexto que actualiza WHERE id = tenant_id
            await actualizar({
                empresa: empresa.trim(),
                logo: logoUrl.trim()
            })

            // Si el logo cambió, borrar el anterior de Cloudinary (best-effort)
            const logoNuevo = logoUrl.trim()
            const logoViejo = logoOriginal
            if (logoNuevo && logoViejo && logoViejo !== logoNuevo && logoViejo !== "No hay foto") {
                api.borrarImagen(logoViejo).catch(() => {})
            }
            setLogoOriginal(logoNuevo)

            mostrarMsg(true, "✅ Cambios guardados y aplicados correctamente")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al guardar cambios"}`)
        } finally {
            setGuardando(false)
        }
    }

    // ── Cargar configuración del catálogo ──
    useEffect(() => {
        async function loadCatalogo() {
            setCargandoCatalogo(true)
            try {
                const [config, cats] = await Promise.all([
                    api.getConfigCatalogo(),
                    api.getCategorias()
                ])
                setCatalogoConfig(config)
                setCategoriasCatalogo(cats)
            } catch (e) {
                console.error("Error cargando config del catálogo:", e)
            } finally {
                setCargandoCatalogo(false)
            }
        }
        if (tab === "catalogo" && !configCargadaRef.current) {
            configCargadaRef.current = true
            loadCatalogo()
        }
    }, [tab])

    // ── Alternar visibilidad de una categoría ──
    async function toggleCategoria(categoria: string) {
        setCategoriaToggling(categoria)
        try {
            const res = await api.toggleVisibilidadCategoria(categoria)
            // Actualizar la lista local
            setCategoriasCatalogo(prev =>
                prev.map(c =>
                    c.nombre === categoria
                        ? { ...c, visible_en_catalogo: res.visible_en_catalogo }
                        : c
                )
            )
            mostrarMsg(true, res.mensaje)
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al cambiar visibilidad"}`)
        } finally {
            setCategoriaToggling(null)
        }
    }

    // ── Auto-guardado: cada control se guarda solo al cambiar ──
    // "campoGuardando" indica qué control se está guardando ahora mismo (spinner).
    const [campoGuardando, setCampoGuardando] = useState<string | null>(null)
    const debounceRef = useRef<Record<string, { timer: ReturnType<typeof setTimeout>; data: () => Record<string, any> }>>({})

    async function ejecutarGuardado(campo: string, data: Record<string, any>): Promise<boolean> {
        setCampoGuardando(campo)
        try {
            await api.actualizarConfigCatalogo(data)
            return true
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error guardando configuración"}`)
            return false
        } finally {
            setCampoGuardando(prev => prev === campo ? null : prev)
        }
    }

    /** Guarda al instante (toggles y selectores) */
    function autoguardar(campo: string, data: Record<string, any>) {
        if (debounceRef.current[campo]) { clearTimeout(debounceRef.current[campo].timer); delete debounceRef.current[campo] }
        void ejecutarGuardado(campo, data)
    }

    /** Guarda con debounce (textos: título, subtítulo, anuncio) */
    function autoguardarDebounce(campo: string, data: () => Record<string, any>) {
        if (debounceRef.current[campo]) clearTimeout(debounceRef.current[campo].timer)
        setCampoGuardando(campo)
        debounceRef.current[campo] = {
            timer: setTimeout(() => {
                delete debounceRef.current[campo]
                void ejecutarGuardado(campo, data())
            }, 650),
            data,
        }
    }

    // ── Al salir de la página: flushear los guardados pendientes para no perder cambios ──
    useEffect(() => {
        return () => {
            Object.values(debounceRef.current).forEach(({ timer, data }) => {
                clearTimeout(timer)
                try { void api.actualizarConfigCatalogo(data()) } catch { /* el unmount ya no puede mostrar errores */ }
            })
        }
    }, [])

    /** Indicador "Guardando…" junto al control que se está guardando */
    function renderGuardado(campo: string) {
        if (campoGuardando !== campo) return null
        return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.65rem", fontWeight: 700, color: "var(--primary-mid)", whiteSpace: "nowrap" }}>
                <style>{`@keyframes cataSpin { to { transform: rotate(360deg) } }`}</style>
                <div style={{
                    width: 11, height: 11, borderRadius: "50%",
                    border: "2px solid var(--border-light)",
                    borderTopColor: "var(--primary-mid)",
                    animation: "cataSpin 0.8s linear infinite",
                }} />
                Guardando…
            </span>
        )
    }

    // ── Copiar link del catálogo ──
    async function copiarLink(slug: string) {
        const url = `${window.location.origin}/catalogo/${slug}`
        try {
            await navigator.clipboard.writeText(url)
            setLinkCopiado(true)
            setTimeout(() => setLinkCopiado(false), 2500)
        } catch {
            // Fallback para navegadores sin clipboard API
            const textarea = document.createElement("textarea")
            textarea.value = url
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand("copy")
            document.body.removeChild(textarea)
            setLinkCopiado(true)
            setTimeout(() => setLinkCopiado(false), 2500)
        }
    }

    // ── Descargar QR como PNG ──
    async function descargarQR() {
        const canvas = qrCanvasRef.current
        if (!canvas) return

        try {
            // Convertir canvas a Blob (PNG)
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"))
            if (!blob) return

            // Crear URL temporal y disparar descarga
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `catalogo-${catalogoConfig?.slug || "qr"}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)

            // Limpiar la URL temporal
            setTimeout(() => URL.revokeObjectURL(url), 5000)

            setQrDescargado(true)
            setTimeout(() => setQrDescargado(false), 2500)
        } catch (e) {
            console.error("Error descargando QR:", e)
        }
    }

    // ── Compartir link (nativo) ──
    async function compartirLink() {
        if (!CATALOGO_LINK) return

        const shareData = {
            title: catalogoConfig?.titulo || "Catálogo",
            text: `¡Mira el catálogo de ${catalogoConfig?.titulo || "Nezzura Digital"}!`,
            url: CATALOGO_LINK,
        }

        // navigator.share() solo disponible en HTTPS y moviles
        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                await navigator.share(shareData)
            } catch (e: any) {
                // Si el usuario cancela, no hacer nada
                if (e.name !== "AbortError") {
                    console.error("Error al compartir:", e)
                }
            }
        } else {
            // Fallback: copiar al portapapeles y mostrar mensaje
            await copiarLink(catalogoConfig!.slug)
        }
    }

    const CATALOGO_LINK = catalogoConfig?.slug
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/catalogo/${catalogoConfig.slug}`
        : ""

    const TEMPLATES_OPTS = [
        { value: "grid-clasico", label: "Grid Clásico", icon: "LayoutGrid", desc: "Tarjetas con imagen, nombre y precio. Ideal para tiendas." },
        { value: "menu-carta", label: "Menú Carta", icon: "NotebookText", desc: "Lista agrupada por categorías. Ideal para restaurantes." },
    ]

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: "cuenta", label: "Mi Cuenta", icon: "User" },
        { id: "catalogo", label: "Catálogo", icon: "ClipboardList" },
    ]

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-5)", padding: "32px 24px 90px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={400}
                        magnetRadius={12}
                        ringRadius={8}
                        waveSpeed={0.5}
                        waveAmplitude={1.2}
                        particleSize={1.5}
                        lerpSpeed={0.08}
                        color="var(--ag-color-5)"
                        autoAnimate={true}
                        particleVariance={0.8}
                        rotationSpeed={0.3}
                        depthFactor={0.5}
                        pulseSpeed={2}
                        particleShape="capsule"
                        fieldStrength={8}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    {/* Mostramos el nombre del tema actual en lugar de un texto fijo */}
                    <p style={{ color: "rgba(255, 255, 255, 0.91)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" }}>
                        {temaActual}
                    </p>
                    <h1 className="hidden md:flex" style={{ color: "var(--white)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}>
                        <div style={{ marginLeft: "-5px" }}>
                            <Icon name="UserRoundPen" size={32} color="var(--white)" />
                        </div>
                        Personalización
                    </h1>
                </div>
            </div>

            <div style={{ width: "100%", padding: "0 24px", marginTop: -47 }}>

                {/* ── Selector de Temas ── */}
                <div style={{ flex: 1, gap: 12, marginBottom: 24 }}>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="PaintBucket" size={32} color="var(--primary-alter)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Temas</p>
                        </div>
                        <div style={{ display: "flex", flex: 1, gap: 20, justifyContent: "center" }}>
                            <button onClick={() => cambiarTema('default')}
                                style={{ width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", background: "linear-gradient(135deg, #6f7375ff 0%, #5e87a4ff 100%)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                                title="Steel Slate"
                            />
                            <button onClick={() => cambiarTema('midnightBlack')}
                                style={{ width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", background: "linear-gradient(135deg, #1f2321ff 0%, #1e6456ff 100%)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                                title="Midnight Black"
                            />
                            <button onClick={() => cambiarTema('strawberry')}
                                style={{ width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", background: "linear-gradient(135deg, #f33376 0%, #fa30dfff 100%)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                                title="Strawberry Pink"
                            />
                            <button onClick={() => cambiarTema('cozyYellow')}
                                style={{ width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", background: "linear-gradient(135deg, #ffd05bff 0%, #eb7456ff 100%)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                                title="Cozy Yellow"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Selector de Pestañas (Tabs) ── */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "10px 20px",
                                borderRadius: 12,
                                border: "none",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                background: tab === t.id ? "var(--primary-mid)" : "var(--bg-card)",
                                color: tab === t.id ? "#fff" : "var(--text-muted)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                                transition: "all 0.2s"
                            }}
                        >
                            <Icon name={t.icon as any} size={16} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Contenido de las pestañas ── */}
                {tab === "cuenta" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>

                        {/* Info de la sesión */}
                        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 320px", maxWidth: 460 }}>
                            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Información de la Cuenta</h2>
                            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>Detalles del administrador de Nezzura Digital.</p>

                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 12 }}>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Correo Electrónico</span>
                                    <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>{cargando ? "Cargando..." : userEmail}</span>
                                </div>
                                <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 12 }}>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tenant ID</span>
                                    <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-main)", fontWeight: 700, wordBreak: "break-all" }}>{cargandoTenant ? "Cargando..." : tenant?.tenant_id}</span>
                                </div>
                                <div>
                                    <button
                                        id="btn-logout"
                                        onClick={handleLogout}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            width: "100%",
                                            padding: "10px 16px",
                                            background: "none",
                                            border: "1.5px solid var(--border-primary)",
                                            borderRadius: 12,
                                            color: "var(--primary-icons)",
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            transition: "background 0.15s",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "var(--primary-soft)")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                                    >
                                        <Icon name="LogOut" size={16} />
                                        Cerrar sesión
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Editor de la Identidad del Negocio */}
                        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 320px", maxWidth: 460 }}>
                            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Identidad del Negocio</h2>
                            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>Personaliza el logo y el nombre de tu empresa.</p>

                            {msg && (
                                <div style={{
                                    padding: "10px 14px", marginBottom: 16,
                                    borderRadius: 10, fontSize: "0.82rem", fontWeight: 700,
                                    background: msg.ok ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.1)",
                                    color: msg.ok ? "#2e7d32" : "#c62828",
                                    borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`
                                }}>
                                    {msg.texto}
                                </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                                {/* Logo: Vista previa y subida */}
                                <div>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Logo del Negocio</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                        {/* Vista previa circular (click para cambiar) */}
                                        <div
                                            onClick={() => inputFileRef.current?.click()}
                                            style={{
                                                width: 72, height: 72, borderRadius: "50%",
                                                border: "2.5px solid var(--border-primary)",
                                                overflow: "hidden", flexShrink: 0,
                                                background: "var(--bg-app)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                cursor: "pointer",
                                                transition: "opacity 0.2s"
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                                            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                                        >
                                            {logoUrl ? (
                                                <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <Icon name="ImageOff" size={28} color="var(--text-muted)" />
                                            )}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                                            <input
                                                ref={inputFileRef}
                                                type="file"
                                                accept="image/*"
                                                style={{ display: "none" }}
                                                onChange={handleLogoFile}
                                            />
                                            <button
                                                onClick={() => inputFileRef.current?.click()}
                                                disabled={subiendoLogo}
                                                className="btn-primary"
                                                style={{ fontSize: "0.8rem", padding: "8px 14px", width: "fit-content" }}
                                            >
                                                {subiendoLogo ? "Subiendo..." : <><Icon name="Camera" size={16} /> Subir imagen</>}
                                            </button>
                                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                                Se optimiza a WebP automáticamente
                                            </span>
                                        </div>
                                    </div>

                                    {/* URL manual */}
                                    <div style={{ marginTop: 12 }}>
                                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                            O pega un enlace directo de Cloudinary
                                        </span>
                                        <input
                                            className="input-primary"
                                            placeholder="https://res.cloudinary.com/..."
                                            value={logoUrl}
                                            onChange={e => setLogoUrl(e.target.value)}
                                            style={{ fontSize: "0.8rem" }}
                                        />
                                    </div>
                                </div>

                                {/* Nombre del negocio */}
                                <div>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Nombre del Negocio</span>
                                    <input
                                        className="input-primary"
                                        placeholder="Ej: Nezzura Digital"
                                        value={empresa}
                                        onChange={e => setEmpresa(e.target.value)}
                                        maxLength={60}
                                    />
                                </div>

                                {/* Modo de precio sugerido del Punto de Venta */}
                                <div>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Precio sugerido (Punto de Venta)</span>
                                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 0 8px", fontWeight: 500 }}>
                                        Cómo el POS sugiere el precio al agregar un producto al carrito.
                                    </p>
                                    <select
                                        value={modoPrecio}
                                        disabled={guardandoModo}
                                        onChange={e => cambiarModoPrecio(e.target.value)}
                                        style={{
                                            width: "100%",
                                            fontSize: "0.8rem",
                                            padding: "8px 10px",
                                            borderRadius: 8,
                                            border: "1px solid var(--border-primary)",
                                            background: "var(--bg-card2)",
                                            color: "var(--text-main)",
                                            outline: "none",
                                            cursor: "pointer",
                                            fontWeight: 600,
                                        }}
                                    >
                                        <option value="antiguo">Lote más antiguo con stock (recomendado)</option>
                                        <option value="maximo">Precio máximo con stock</option>
                                        <option value="reciente">Lote más reciente con stock</option>
                                    </select>
                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block", marginTop: 6 }}>
                                        {guardandoModo ? "Guardando..." : "Se guarda automáticamente"}
                                    </span>
                                </div>

                                {/* Guardar Cambios */}
                                <button
                                    className="btn-primary"
                                    onClick={guardarCambios}
                                    disabled={guardando || cargandoTenant}
                                    style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                                >
                                    <Icon name="Save" size={16} />
                                    {guardando ? "Guardando..." : "Guardar Cambios"}
                                </button>
                            </div>
                        </div>

                    </div>
                )}

                {tab === "catalogo" && (
                    <>
                        {cargandoCatalogo ? (
                            <div className="card fade-up" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                Cargando configuración...
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>

                                {/* ── Configuración del Catálogo ── */}
                                <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 400px", maxWidth: 520 }}>
                                    <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Configuración del Catálogo</h2>
                                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>
                                        Personaliza la apariencia y el contenido de tu catálogo público.
                                    </p>

                                    {msg && (
                                        <div style={{
                                            padding: "10px 14px", marginBottom: 16,
                                            borderRadius: 10, fontSize: "0.82rem", fontWeight: 700,
                                            background: msg.ok ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.1)",
                                            color: msg.ok ? "#2e7d32" : "#c62828",
                                            borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`
                                        }}>
                                            {msg.texto}
                                        </div>
                                    )}

                                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                        {/* ── Sección: Estado ── */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                            <Icon name="Power" size={15} color="var(--primary-mid)" />
                                            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-mid)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                                                Estado
                                            </span>
                                            <div style={{ flex: 1, height: 1.5, background: "var(--border-primary)", borderRadius: 1 }} />
                                        </div>
                                        {/* Activar / Desactivar */}
                                        <div style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
                                        }}>
                                            <div>
                                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Catálogo público</span>
                                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                                    {catalogoConfig?.activo ? "Tu catálogo es visible para cualquier persona con el link." : "Actívalo para que tus clientes puedan verlo."}
                                                </p>
                                                {renderGuardado("activo")}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const nuevo = !catalogoConfig?.activo
                                                    setCatalogoConfig(prev => prev ? { ...prev, activo: nuevo } : prev)
                                                    autoguardar("activo", { activo: nuevo })
                                                }}
                                                disabled={campoGuardando === "activo"}
                                                style={{
                                                    position: "relative",
                                                    width: 52, height: 28,
                                                    borderRadius: 14,
                                                    border: "none",
                                                    cursor: campoGuardando === "activo" ? "not-allowed" : "pointer",
                                                    background: catalogoConfig?.activo ? "var(--primary-mid)" : "var(--border-primary)",
                                                    transition: "background 0.25s",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <div style={{
                                                    position: "absolute",
                                                    top: 3, left: catalogoConfig?.activo ? 26 : 3,
                                                    width: 22, height: 22,
                                                    borderRadius: "50%",
                                                    background: "#fff",
                                                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                                    transition: "left 0.25s",
                                                }} />
                                            </button>
                                        </div>

                                        {/* ── Sección: Contenido ── */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                            <Icon name="FileText" size={15} color="var(--primary-mid)" />
                                            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-mid)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                                                Contenido
                                            </span>
                                            <div style={{ flex: 1, height: 1.5, background: "var(--border-primary)", borderRadius: 1 }} />
                                        </div>
                                        {/* Título */}
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Título del Catálogo</span>
                                                {renderGuardado("titulo")}
                                            </div>
                                            <input
                                                className="input-primary"
                                                placeholder="Ej: Nuestros productos"
                                                value={catalogoConfig?.titulo || ""}
                                                onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, titulo: e.target.value } : null); autoguardarDebounce("titulo", () => ({ titulo: e.target.value })) }}
                                                maxLength={60}
                                                style={{ fontSize: "0.85rem" }}
                                            />
                                        </div>

                                        {/* Subtítulo */}
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Subtítulo</span>
                                                {renderGuardado("subtitulo")}
                                            </div>
                                            <input
                                                className="input-primary"
                                                placeholder="Ej: Los mejores productos de la región"
                                                value={catalogoConfig?.subtitulo || ""}
                                                onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, subtitulo: e.target.value } : null); autoguardarDebounce("subtitulo", () => ({ subtitulo: e.target.value })) }}
                                                maxLength={120}
                                                style={{ fontSize: "0.85rem" }}
                                            />
                                        </div>

                                        {/* ── Barra de anuncios ── */}
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Barra de anuncios</span>
                                                {renderGuardado("anuncio_texto")}
                                            </div>
                                            <input
                                                className="input-primary"
                                                placeholder="Ej: 🚚 Envíos gratis desde $500"
                                                value={catalogoConfig?.anuncio_texto || ""}
                                                onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, anuncio_texto: e.target.value } : null); autoguardarDebounce("anuncio_texto", () => ({ anuncio_texto: e.target.value })) }}
                                                maxLength={120}
                                                style={{ fontSize: "0.85rem" }}
                                            />
                                            <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                                Franja que aparece arriba del catálogo. Vacío = oculta.
                                            </p>
                                        </div>

                                        {/* ── Sección: Comportamiento ── */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                            <Icon name="SlidersHorizontal" size={15} color="var(--primary-mid)" />
                                            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-mid)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                                                Comportamiento
                                            </span>
                                            <div style={{ flex: 1, height: 1.5, background: "var(--border-primary)", borderRadius: 1 }} />
                                        </div>
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
                                            <button
                                                onClick={() => {
                                                    const nuevo = !catalogoConfig?.agrupar_por_categoria
                                                    setCatalogoConfig(prev => prev ? { ...prev, agrupar_por_categoria: nuevo } : prev)
                                                    autoguardar("agrupar_por_categoria", { agrupar_por_categoria: nuevo })
                                                }}
                                                disabled={campoGuardando === "agrupar_por_categoria"}
                                                style={{
                                                    position: "relative",
                                                    width: 52, height: 28,
                                                    borderRadius: 14,
                                                    border: "none",
                                                    cursor: campoGuardando === "agrupar_por_categoria" ? "not-allowed" : "pointer",
                                                    background: catalogoConfig?.agrupar_por_categoria ? "var(--primary-mid)" : "var(--border-primary)",
                                                    transition: "background 0.25s",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <div style={{
                                                    position: "absolute",
                                                    top: 3, left: catalogoConfig?.agrupar_por_categoria ? 26 : 3,
                                                    width: 22, height: 22,
                                                    borderRadius: "50%",
                                                    background: "#fff",
                                                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                                    transition: "left 0.25s",
                                                }} />
                                            </button>
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
                                            <button
                                                onClick={() => {
                                                    const nuevo = !catalogoConfig?.permitir_descarga
                                                    setCatalogoConfig(prev => prev ? { ...prev, permitir_descarga: nuevo } : prev)
                                                    autoguardar("permitir_descarga", { permitir_descarga: nuevo })
                                                }}
                                                disabled={campoGuardando === "permitir_descarga"}
                                                style={{
                                                    position: "relative",
                                                    width: 52, height: 28,
                                                    borderRadius: 14,
                                                    border: "none",
                                                    cursor: campoGuardando === "permitir_descarga" ? "not-allowed" : "pointer",
                                                    background: catalogoConfig?.permitir_descarga ? "var(--primary-mid)" : "var(--border-primary)",
                                                    transition: "background 0.25s",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <div style={{
                                                    position: "absolute",
                                                    top: 3, left: catalogoConfig?.permitir_descarga ? 26 : 3,
                                                    width: 22, height: 22,
                                                    borderRadius: "50%",
                                                    background: "#fff",
                                                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                                    transition: "left 0.25s",
                                                }} />
                                            </button>
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

                                        {/* ── Sección: Apariencia ── */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                            <Icon name="Palette" size={15} color="var(--primary-mid)" />
                                            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-mid)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                                                Apariencia
                                            </span>
                                            <div style={{ flex: 1, height: 1.5, background: "var(--border-primary)", borderRadius: 1 }} />
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
                                                            <div style={{ border: "1.5px solid var(--border-light)", borderRadius: 12, padding: 12, background: "var(--bg-card2)" }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                        <Icon name="Monitor" size={16} color="var(--primary-mid)" />
                                                                        <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>Banner escritorio</span>
                                                                    </div>
                                                                    {renderGuardado("banner_url")}
                                                                </div>
                                                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                                                    <div style={{
                                                                        width: 110, height: 40,
                                                                        borderRadius: 8, overflow: "hidden", flexShrink: 0,
                                                                        background: "var(--bg-app)",
                                                                        border: "2px dashed var(--border-primary)",
                                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                                    }}>
                                                                        {catalogoConfig?.banner_url ? (
                                                                            <img
                                                                                src={catalogoConfig.banner_url}
                                                                                alt="Banner escritorio"
                                                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                                                onError={e => { e.currentTarget.style.display = "none" }}
                                                                            />
                                                                        ) : (
                                                                            <Icon name="ImagePlus" size={20} color="var(--text-muted)" />
                                                                        )}
                                                                    </div>
                                                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                                                                        <input
                                                                            ref={bannerInputRef}
                                                                            type="file"
                                                                            accept="image/*"
                                                                            style={{ display: "none" }}
                                                                            onChange={e => handleBannerFile(e, "escritorio")}
                                                                        />
                                                                        <button
                                                                            onClick={() => bannerInputRef.current?.click()}
                                                                            disabled={subiendoBanner}
                                                                            className="btn-primary"
                                                                            style={{ fontSize: "0.75rem", padding: "7px 12px", width: "fit-content" }}
                                                                        >
                                                                            {subiendoBanner ? "Subiendo..." : <><Icon name="Upload" size={13} /> Subir imagen</>}
                                                                        </button>
                                                                        {catalogoConfig?.banner_url && (
                                                                            <button
                                                                                onClick={() => quitarBanner("escritorio")}
                                                                                style={{
                                                                                    fontSize: "0.7rem", fontWeight: 700, padding: "5px 10px",
                                                                                    borderRadius: 8, border: "1px solid var(--border-primary)",
                                                                                    background: "var(--bg-card2)", color: "var(--text-muted)",
                                                                                    cursor: "pointer", width: "fit-content",
                                                                                }}
                                                                            >
                                                                                Quitar
                                                                            </button>
                                                                        )}
                                                                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                                                            Recomendado: <b>1920 × 373 px</b>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* ── Banner móvil (750 × 310) ── */}
                                                            <div style={{ border: "1.5px solid var(--border-light)", borderRadius: 12, padding: 12, background: "var(--bg-card2)" }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                        <Icon name="Smartphone" size={16} color="var(--primary-mid)" />
                                                                        <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>Banner móvil</span>
                                                                    </div>
                                                                    {renderGuardado("banner_url_movil")}
                                                                </div>
                                                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                                                    <div style={{
                                                                        width: 110, height: 46,
                                                                        borderRadius: 8, overflow: "hidden", flexShrink: 0,
                                                                        background: "var(--bg-app)",
                                                                        border: "2px dashed var(--border-primary)",
                                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                                    }}>
                                                                        {catalogoConfig?.banner_url_movil ? (
                                                                            <img
                                                                                src={catalogoConfig.banner_url_movil}
                                                                                alt="Banner móvil"
                                                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                                                onError={e => { e.currentTarget.style.display = "none" }}
                                                                            />
                                                                        ) : (
                                                                            <Icon name="ImagePlus" size={20} color="var(--text-muted)" />
                                                                        )}
                                                                    </div>
                                                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                                                                        <input
                                                                            ref={bannerMovilInputRef}
                                                                            type="file"
                                                                            accept="image/*"
                                                                            style={{ display: "none" }}
                                                                            onChange={e => handleBannerFile(e, "movil")}
                                                                        />
                                                                        <button
                                                                            onClick={() => bannerMovilInputRef.current?.click()}
                                                                            disabled={subiendoBannerMovil}
                                                                            className="btn-primary"
                                                                            style={{ fontSize: "0.75rem", padding: "7px 12px", width: "fit-content" }}
                                                                        >
                                                                            {subiendoBannerMovil ? "Subiendo..." : <><Icon name="Upload" size={13} /> Subir imagen</>}
                                                                        </button>
                                                                        {catalogoConfig?.banner_url_movil && (
                                                                            <button
                                                                                onClick={() => quitarBanner("movil")}
                                                                                style={{
                                                                                    fontSize: "0.7rem", fontWeight: 700, padding: "5px 10px",
                                                                                    borderRadius: 8, border: "1px solid var(--border-primary)",
                                                                                    background: "var(--bg-card2)", color: "var(--text-muted)",
                                                                                    cursor: "pointer", width: "fit-content",
                                                                                }}
                                                                            >
                                                                                Quitar
                                                                            </button>
                                                                        )}
                                                                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                                                            Recomendado: <b>750 × 420 px</b>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
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
                                                        <button
                                                            onClick={() => {
                                                                const nuevo = !(catalogoConfig?.banner_mostrar_texto ?? true)
                                                                setCatalogoConfig(prev => prev ? { ...prev, banner_mostrar_texto: nuevo } : prev)
                                                                autoguardar("banner_mostrar_texto", { banner_mostrar_texto: nuevo })
                                                            }}
                                                            disabled={campoGuardando === "banner_mostrar_texto"}
                                                            style={{
                                                                position: "relative",
                                                                width: 52, height: 28,
                                                                borderRadius: 14,
                                                                border: "none",
                                                                cursor: campoGuardando === "banner_mostrar_texto" ? "not-allowed" : "pointer",
                                                                background: (catalogoConfig?.banner_mostrar_texto ?? true) !== false ? "var(--primary-mid)" : "var(--border-primary)",
                                                                transition: "background 0.25s",
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <div style={{
                                                                position: "absolute",
                                                                top: 3, left: (catalogoConfig?.banner_mostrar_texto ?? true) !== false ? 26 : 3,
                                                                width: 22, height: 22,
                                                                borderRadius: "50%",
                                                                background: "#fff",
                                                                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                                                transition: "left 0.25s",
                                                            }} />
                                                        </button>
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
                                                        <button
                                                            onClick={() => {
                                                                const nuevo = !(catalogoConfig?.banner_mostrar_logo ?? true)
                                                                setCatalogoConfig(prev => prev ? { ...prev, banner_mostrar_logo: nuevo } : prev)
                                                                autoguardar("banner_mostrar_logo", { banner_mostrar_logo: nuevo })
                                                            }}
                                                            disabled={campoGuardando === "banner_mostrar_logo"}
                                                            style={{
                                                                position: "relative",
                                                                width: 52, height: 28,
                                                                borderRadius: 14,
                                                                border: "none",
                                                                cursor: campoGuardando === "banner_mostrar_logo" ? "not-allowed" : "pointer",
                                                                background: (catalogoConfig?.banner_mostrar_logo ?? true) !== false ? "var(--primary-mid)" : "var(--border-primary)",
                                                                transition: "background 0.25s",
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <div style={{
                                                                position: "absolute",
                                                                top: 3, left: (catalogoConfig?.banner_mostrar_logo ?? true) !== false ? 26 : 3,
                                                                width: 22, height: 22,
                                                                borderRadius: "50%",
                                                                background: "#fff",
                                                                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                                                transition: "left 0.25s",
                                                            }} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

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
                                                {[
                                                    { key: "default", label: "Steel Slate", colors: ["#3a7dbf", "#5e87a4"] },
                                                    { key: "midnightBlack", label: "Midnight Black", colors: ["#1f2321", "#1e6456"] },
                                                    { key: "strawberry", label: "Strawberry Pink", colors: ["#f33376", "#fa30df"] },
                                                    { key: "cozyYellow", label: "Cozy Yellow", colors: ["#ffd05b", "#eb7456"] },
                                                ].map(t => (
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

                                        {/* ── Sección: Visibilidad ── */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                            <Icon name="Eye" size={15} color="var(--primary-mid)" />
                                            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-mid)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                                                Visibilidad
                                            </span>
                                            <div style={{ flex: 1, height: 1.5, background: "var(--border-primary)", borderRadius: 1 }} />
                                        </div>

                                        {/* Ocultar stock (guardado como el inverso de mostrar_stock: null/true = visible) */}
                                        <div style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
                                        }}>
                                            <div>
                                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Ocultar stock</span>
                                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                                    Los clientes no verán cuántas unidades quedan de cada producto.
                                                </p>
                                                {renderGuardado("mostrar_stock")}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const ocultando = (catalogoConfig?.mostrar_stock ?? true) === false
                                                    setCatalogoConfig(prev => prev ? { ...prev, mostrar_stock: ocultando } : prev)
                                                    autoguardar("mostrar_stock", { mostrar_stock: ocultando })
                                                }}
                                                disabled={campoGuardando === "mostrar_stock"}
                                                style={{
                                                    position: "relative",
                                                    width: 52, height: 28,
                                                    borderRadius: 14,
                                                    border: "none",
                                                    cursor: campoGuardando === "mostrar_stock" ? "not-allowed" : "pointer",
                                                    background: (catalogoConfig?.mostrar_stock ?? true) === false ? "var(--primary-mid)" : "var(--border-primary)",
                                                    transition: "background 0.25s",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <div style={{
                                                    position: "absolute",
                                                    top: 3, left: (catalogoConfig?.mostrar_stock ?? true) === false ? 26 : 3,
                                                    width: 22, height: 22,
                                                    borderRadius: "50%",
                                                    background: "#fff",
                                                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                                    transition: "left 0.25s",
                                                }} />
                                            </button>
                                        </div>

                                        {/* Ocultar productos agotados */}
                                        <div style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
                                        }}>
                                            <div>
                                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Ocultar productos agotados</span>
                                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                                    Los productos sin stock desaparecerán del catálogo.
                                                </p>
                                                {renderGuardado("ocultar_agotados")}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const nuevo = !catalogoConfig?.ocultar_agotados
                                                    setCatalogoConfig(prev => prev ? { ...prev, ocultar_agotados: nuevo } : prev)
                                                    autoguardar("ocultar_agotados", { ocultar_agotados: nuevo })
                                                }}
                                                disabled={campoGuardando === "ocultar_agotados"}
                                                style={{
                                                    position: "relative",
                                                    width: 52, height: 28,
                                                    borderRadius: 14,
                                                    border: "none",
                                                    cursor: campoGuardando === "ocultar_agotados" ? "not-allowed" : "pointer",
                                                    background: catalogoConfig?.ocultar_agotados ? "var(--primary-mid)" : "var(--border-primary)",
                                                    transition: "background 0.25s",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <div style={{
                                                    position: "absolute",
                                                    top: 3, left: catalogoConfig?.ocultar_agotados ? 26 : 3,
                                                    width: 22, height: 22,
                                                    borderRadius: "50%",
                                                    background: "#fff",
                                                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                                    transition: "left 0.25s",
                                                }} />
                                            </button>
                                        </div>

                                        {/* ── Visibilidad de categorías ── */}
                                        {categoriasCatalogo.length > 0 && (
                                            <div>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                                                    Categorías visibles
                                                </span>
                                                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 12px", fontWeight: 500 }}>
                                                    Las categorías que ocultes no se mostrarán en el catálogo público.
                                                </p>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                    {categoriasCatalogo.map(cat => {
                                                        const visible = cat.visible_en_catalogo !== false
                                                        return (
                                                            <button
                                                                key={cat.id}
                                                                onClick={() => toggleCategoria(cat.nombre)}
                                                                disabled={categoriaToggling === cat.nombre}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "space-between",
                                                                    padding: "12px 14px",
                                                                    borderRadius: 10,
                                                                    border: `1.5px solid ${visible ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                                                    background: visible ? "var(--primary-soft)" : "var(--bg-card2)",
                                                                    cursor: categoriaToggling === cat.nombre ? "wait" : "pointer",
                                                                    textAlign: "left",
                                                                    transition: "all 0.15s",
                                                                    width: "100%",
                                                                    opacity: visible ? 1 : 0.6,
                                                                }}
                                                            >
                                                                <div>
                                                                    <span style={{
                                                                        fontWeight: 700,
                                                                        fontSize: "0.82rem",
                                                                        color: visible ? "var(--text-main)" : "var(--text-muted)",
                                                                    }}>
                                                                        {cat.nombre}
                                                                    </span>
                                                                    <span style={{
                                                                        fontSize: "0.7rem",
                                                                        color: "var(--text-muted)",
                                                                        marginLeft: 8,
                                                                        fontWeight: 500,
                                                                    }}>
                                                                        ({cat.total_productos} productos)
                                                                    </span>
                                                                </div>
                                                                <Icon
                                                                    name={visible ? "Eye" : "EyeOff"}
                                                                    size={18}
                                                                    color={visible ? "var(--primary-mid)" : "var(--text-muted)"}
                                                                />
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}


                                    </div>
                                </div>

                                {/* ── Compartir Catálogo ── */}
                                <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 300px", maxWidth: 380 }}>
                                    <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Compartir</h2>
                                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>
                                        Comparte tu catálogo con tus clientes.
                                    </p>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
                                        {/* Estado del catálogo */}
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "8px 16px",
                                            borderRadius: 20,
                                            background: catalogoConfig?.activo ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.08)",
                                            color: catalogoConfig?.activo ? "#2e7d32" : "#c62828",
                                            fontWeight: 700,
                                            fontSize: "0.8rem",
                                        }}>
                                            <div style={{
                                                width: 8, height: 8,
                                                borderRadius: "50%",
                                                background: catalogoConfig?.activo ? "#4caf50" : "#f44336",
                                                animation: catalogoConfig?.activo ? "pulse 2s infinite" : "none",
                                            }} />
                                            {catalogoConfig?.activo ? "Catálogo activo" : "Catálogo inactivo"}
                                            <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
                                        </div>

                                        {/* QR Code */}
                                        {catalogoConfig?.slug && (
                                            <>
                                                {/* QR visible (SVG) */}
                                                <div style={{
                                                    background: "#fff",
                                                    padding: 16,
                                                    borderRadius: 16,
                                                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}>
                                                    <QRCodeSVG
                                                        value={CATALOGO_LINK}
                                                        size={180}
                                                        bgColor="#ffffff"
                                                        fgColor="#000000"
                                                        level="M"
                                                    />
                                                </div>

                                                {/* QR canvas (oculto, solo para descargar PNG) */}
                                                <div style={{ display: "none" }}>
                                                    <QRCodeCanvas
                                                        ref={qrCanvasRef}
                                                        value={CATALOGO_LINK}
                                                        size={512} // Alta resolución para descarga
                                                        bgColor="#ffffff"
                                                        fgColor="#000000"
                                                        level="M"
                                                    />
                                                </div>

                                                {/* Botones de acción */}
                                                <div style={{
                                                    display: "flex",
                                                    gap: 8,
                                                    width: "100%",
                                                    flexWrap: "wrap",
                                                    justifyContent: "center",
                                                }}>
                                                    {/* Descargar QR */}
                                                    <button
                                                        onClick={descargarQR}
                                                        className="btn-primary"
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 120,
                                                            padding: "10px 14px",
                                                            fontSize: "0.78rem",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: 6,
                                                        }}
                                                    >
                                                        <Icon name={qrDescargado ? "Check" : "Download"} size={14} />
                                                        {qrDescargado ? "Descargado" : "Descargar QR"}
                                                    </button>

                                                    {/* Compartir nativo */}
                                                    <button
                                                        onClick={compartirLink}
                                                        className="btn-primary"
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 120,
                                                            padding: "10px 14px",
                                                            fontSize: "0.78rem",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: 6,
                                                        }}
                                                    >
                                                        <Icon name="Share2" size={14} />
                                                        Compartir
                                                    </button>
                                                </div>

                                                {/* Link directo WhatsApp */}
                                                <a
                                                    href={`https://wa.me/?text=${encodeURIComponent(CATALOGO_LINK + " — " + (catalogoConfig?.titulo || "Catálogo"))}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: 8,
                                                        padding: "10px 14px",
                                                        borderRadius: 12,
                                                        background: "rgba(37,211,102,0.1)",
                                                        color: "#25d366",
                                                        fontSize: "0.82rem",
                                                        fontWeight: 700,
                                                        textDecoration: "none",
                                                        width: "100%",
                                                        transition: "background 0.15s",
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(37,211,102,0.2)"}
                                                    onMouseLeave={e => e.currentTarget.style.background = "rgba(37,211,102,0.1)"}
                                                >
                                                    <svg viewBox="0 0 24 24" width={18} height={18} fill="#25d366">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                                    </svg>
                                                    Compartir por WhatsApp
                                                </a>
                                            </>
                                        )}

                                        {/* Link */}
                                        {catalogoConfig?.slug && (
                                            <div style={{ width: "100%" }}>
                                                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Enlace público</span>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <input
                                                        readOnly
                                                        value={CATALOGO_LINK}
                                                        onClick={e => (e.target as HTMLInputElement).select()}
                                                        className="input-primary"
                                                        style={{
                                                            flex: 1,
                                                            fontSize: "0.75rem",
                                                            fontFamily: "monospace",
                                                            cursor: "text",
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => copiarLink(catalogoConfig!.slug)}
                                                        className="btn-primary"
                                                        style={{
                                                            padding: "8px 14px",
                                                            fontSize: "0.78rem",
                                                            whiteSpace: "nowrap",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 6,
                                                        }}
                                                    >
                                                        <Icon name={linkCopiado ? "Check" : "Copy"} size={14} />
                                                        {linkCopiado ? "Copiado" : "Copiar"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {!catalogoConfig?.slug && (
                                            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center" }}>
                                                Guarda la configuración para generar el link de tu catálogo.
                                            </p>
                                        )}
                                    </div>
                                </div>

                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Modal de recorte del banner (relación según target) ── */}
            {bannerCrop && (
                <ImageCropperModal
                    imageUrl={bannerCrop.url}
                    aspectRatio={bannerCrop.target === "escritorio" ? 1920 / 373 : 750 / 420}
                    dimensionLabel={bannerCrop.target === "escritorio" ? "1920 × 373" : "750 × 420"}
                    onCropComplete={handleBannerCropComplete}
                    onCancel={() => { URL.revokeObjectURL(bannerCrop.url); setBannerCrop(null) }}
                />
            )}

            <div style={{ height: 32 }} />
        </div>
    )
}