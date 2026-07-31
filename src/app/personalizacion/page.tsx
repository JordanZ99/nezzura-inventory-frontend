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
import { comprimirImagen } from "@/lib/image-utils"

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
    const [guardando, setGuardando] = useState(false)
    const [subiendoLogo, setSubiendoLogo] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const inputFileRef = useRef<HTMLInputElement>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)
    const [subiendoBanner, setSubiendoBanner] = useState(false)
    const router = useRouter()

    // Estados para la configuración del catálogo público
    const [catalogoConfig, setCatalogoConfig] = useState<CatalogoConfig | null>(null)
    const [cargandoCatalogo, setCargandoCatalogo] = useState(false)
    const [guardandoCatalogo, setGuardandoCatalogo] = useState(false)
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
        }
    }, [tenant])

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

    // ── Subir banner/hero del catálogo ──
    async function handleBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !tenant?.tenant_id) return
        try {
            setSubiendoBanner(true)
            const nombreClave = `_banner_${tenant.tenant_id.slice(0, 8)}`
            // Comprimir antes de subir: el endpoint tiene límite de 1MB y los
            // banners de alta resolución lo superan fácilmente
            let imgAEnviar = file
            try { imgAEnviar = await comprimirImagen(file) }
            catch { /* enviar original si falla la compresión */ }
            const { ruta } = await api.subirFoto(nombreClave, imgAEnviar)
            setCatalogoConfig(prev => prev ? { ...prev, banner_url: ruta } : null)
            mostrarMsg(true, "🖼️ Banner subido — Haz clic en Guardar Cambios para aplicarlo")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al subir banner"}`)
        } finally {
            setSubiendoBanner(false)
            if (bannerInputRef.current) bannerInputRef.current.value = ""
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
        if (tab === "catalogo") loadCatalogo()
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

    // ── Guardar configuración del catálogo ──
    async function guardarConfigCatalogo(data: {
        activo?: boolean
        tema?: string
        template?: string
        titulo?: string
        subtitulo?: string
        mostrar_precios?: boolean
        mostrar_stock?: boolean
        mostrar_categorias?: boolean
        banner_url?: string
        hero_estilo?: string
        anuncio_texto?: string
    }) {
        setGuardandoCatalogo(true)
        try {
            const res = await api.actualizarConfigCatalogo(data)
            // Recargar la config para tener los datos actualizados
            const config = await api.getConfigCatalogo()
            setCatalogoConfig(config)
            mostrarMsg(true, "✅ Configuración del catálogo guardada")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error guardando configuración"}`)
        } finally {
            setGuardandoCatalogo(false)
        }
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
                                            </div>
                                            <button
                                                onClick={() => guardarConfigCatalogo({ activo: !catalogoConfig?.activo })}
                                                disabled={guardandoCatalogo}
                                                style={{
                                                    position: "relative",
                                                    width: 52, height: 28,
                                                    borderRadius: 14,
                                                    border: "none",
                                                    cursor: guardandoCatalogo ? "not-allowed" : "pointer",
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

                                        {/* Título */}
                                        <div>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Título del Catálogo</span>
                                            <input
                                                className="input-primary"
                                                placeholder="Ej: Nuestros productos"
                                                value={catalogoConfig?.titulo || ""}
                                                onChange={e => setCatalogoConfig(prev => prev ? { ...prev, titulo: e.target.value } : null)}
                                                maxLength={60}
                                                style={{ fontSize: "0.85rem" }}
                                            />
                                        </div>

                                        {/* Subtítulo */}
                                        <div>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Subtítulo</span>
                                            <input
                                                className="input-primary"
                                                placeholder="Ej: Los mejores productos de la región"
                                                value={catalogoConfig?.subtitulo || ""}
                                                onChange={e => setCatalogoConfig(prev => prev ? { ...prev, subtitulo: e.target.value } : null)}
                                                maxLength={120}
                                                style={{ fontSize: "0.85rem" }}
                                            />
                                        </div>

                                        {/* ── Barra de anuncios ── */}
                                        <div>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Barra de anuncios</span>
                                            <input
                                                className="input-primary"
                                                placeholder="Ej: 🚚 Envíos gratis desde $500"
                                                value={catalogoConfig?.anuncio_texto || ""}
                                                onChange={e => setCatalogoConfig(prev => prev ? { ...prev, anuncio_texto: e.target.value } : null)}
                                                maxLength={120}
                                                style={{ fontSize: "0.85rem" }}
                                            />
                                            <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                                Franja que aparece arriba del catálogo. Vacío = oculta.
                                            </p>
                                        </div>

                                        {/* ── Banner / Hero ── */}
                                        <div>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Banner / Imagen de portada</span>
                                            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                                {/* Vista previa */}
                                                <div style={{
                                                    width: 120, height: 68,
                                                    borderRadius: 10, overflow: "hidden", flexShrink: 0,
                                                    background: "var(--bg-app)",
                                                    border: "2px dashed var(--border-primary)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                }}>
                                                    {catalogoConfig?.banner_url ? (
                                                        <img
                                                            src={catalogoConfig.banner_url}
                                                            alt="Banner del catálogo"
                                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                            onError={e => { e.currentTarget.style.display = "none" }}
                                                        />
                                                    ) : (
                                                        <Icon name="ImagePlus" size={24} color="var(--text-muted)" />
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                                                    <input
                                                        ref={bannerInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: "none" }}
                                                        onChange={handleBannerFile}
                                                    />
                                                    <button
                                                        onClick={() => bannerInputRef.current?.click()}
                                                        disabled={subiendoBanner}
                                                        className="btn-primary"
                                                        style={{ fontSize: "0.78rem", padding: "8px 14px", width: "fit-content" }}
                                                    >
                                                        {subiendoBanner ? "Subiendo..." : <><Icon name="Upload" size={14} /> Subir imagen</>}
                                                    </button>
                                                    {catalogoConfig?.banner_url && (
                                                        <button
                                                            onClick={() => setCatalogoConfig(prev => prev ? { ...prev, banner_url: "" } : null)}
                                                            style={{
                                                                fontSize: "0.72rem", fontWeight: 700, padding: "6px 12px",
                                                                borderRadius: 8, border: "1px solid var(--border-primary)",
                                                                background: "var(--bg-card2)", color: "var(--text-muted)",
                                                                cursor: "pointer", width: "fit-content",
                                                            }}
                                                        >
                                                            Quitar banner
                                                        </button>
                                                    )}
                                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                                        Tamaño recomendado: 1200×400 px
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Estilo del hero ── */}
                                        <div>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Estilo de la portada</span>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                {[
                                                    { key: "gradiente", label: "Gradiente", desc: "Fondo con degradado del tema + banner arriba (recomendado)" },
                                                    { key: "imagen", label: "Imagen de fondo", desc: "El banner cubre toda la portada con el título encima" },
                                                ].map(h => (
                                                    <button
                                                        key={h.key}
                                                        onClick={() => setCatalogoConfig(prev => prev ? { ...prev, hero_estilo: h.key } : null)}
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
                                        </div>

                                        {/* Selector de Template */}
                                        <div>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Plantilla Visual</span>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                {TEMPLATES_OPTS.map(t => (
                                                    <button
                                                        key={t.value}
                                                        onClick={() => setCatalogoConfig(prev => prev ? { ...prev, template: t.value } : null)}
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
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Tema de Colores</span>
                                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                                                {[
                                                    { key: "default", label: "Steel Slate", colors: ["#3a7dbf", "#5e87a4"] },
                                                    { key: "midnightBlack", label: "Midnight Black", colors: ["#1f2321", "#1e6456"] },
                                                    { key: "strawberry", label: "Strawberry Pink", colors: ["#f33376", "#fa30df"] },
                                                    { key: "cozyYellow", label: "Cozy Yellow", colors: ["#ffd05b", "#eb7456"] },
                                                ].map(t => (
                                                    <button
                                                        key={t.key}
                                                        onClick={() => setCatalogoConfig(prev => prev ? { ...prev, tema: t.key } : null)}
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

                                        {/* Guardar — barra sticky: siempre visible aunque haya muchas categorías */}
                                        <div style={{
                                            position: "sticky",
                                            bottom: -12,
                                            marginTop: 8,
                                            marginBottom: -24,
                                            padding: "12px 4px",
                                            background: "var(--bg-card2)",
                                            borderTop: "1px solid var(--border-light)",
                                            borderBottomLeftRadius: 14,
                                            borderBottomRightRadius: 14,
                                            zIndex: 5,
                                        }}>
                                            <button
                                                className="btn-primary"
                                                onClick={() => guardarConfigCatalogo({
                                                    titulo: catalogoConfig?.titulo,
                                                    subtitulo: catalogoConfig?.subtitulo,
                                                    template: catalogoConfig?.template,
                                                    tema: catalogoConfig?.tema,
                                                    banner_url: catalogoConfig?.banner_url,
                                                    hero_estilo: catalogoConfig?.hero_estilo,
                                                    anuncio_texto: catalogoConfig?.anuncio_texto,
                                                })}
                                                disabled={guardandoCatalogo}
                                                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                                            >
                                                <Icon name="Save" size={16} />
                                                {guardandoCatalogo ? "Guardando..." : "Guardar Cambios"}
                                            </button>
                                        </div>
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
            <div style={{ height: 32 }} />
        </div>
    )
}