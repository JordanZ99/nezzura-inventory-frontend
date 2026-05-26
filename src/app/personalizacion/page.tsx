"use client"

import { useState, useEffect, useRef } from "react"
import { api, Producto } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useTenant } from "@/contexts/TenantContext"
import { comprimirImagen } from "@/lib/image-utils"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import { usePathname, useRouter } from "next/navigation"

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
    const router = useRouter()

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
                    setUserEmail(user.email ?? "Usuario Goyangi")
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

            // 1. Convertir y comprimir a WebP automáticamente
            const webp = await comprimirImagen(file, 400, 400, 0.85)

            // 2. Subir foto usando el nombre clave para Cloudinary
            const nombreClave = `_logo_${tenant.tenant_id.slice(0, 8)}`
            const { ruta } = await api.subirFoto(nombreClave, webp)

            setLogoUrl(ruta)
            mostrarMsg(true, "📷 Logo subido temporalmente — Haz clic en Guardar Cambios para aplicarlo en el sistema")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al subir logo"}`)
        } finally {
            setSubiendoLogo(false)
            if (inputFileRef.current) inputFileRef.current.value = ""
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
                            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>Detalles del administrador de Goyangi Store.</p>

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
                                        {/* Vista previa circular */}
                                        <div style={{
                                            width: 72, height: 72, borderRadius: "50%",
                                            border: "2.5px solid var(--border-primary)",
                                            overflow: "hidden", flexShrink: 0,
                                            background: "var(--bg-app)",
                                            display: "flex", alignItems: "center", justifyContent: "center"
                                        }}>
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
                                                {subiendoLogo ? "Subiendo..." : "📷 Subir imagen"}
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
                                        placeholder="Ej: Goyangi Store"
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
                    <div className="card fade-up" style={{ padding: "20px 24px", overflow: "hidden" }}>
                        <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Catálogo de Productos</h2>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>Visualiza el catálogo de productos disponibles en el inventario.</p>

                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                    <tr style={{ color: "var(--text-muted)", borderBottom: "1.5px solid var(--border-primary)" }}>
                                        {["Imagen", "Producto", "Categoría", "Stock Total", "Precio"].map(h => (
                                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.map(p => (
                                        <tr key={p.producto} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "12px 16px" }}>
                                                {p.imagen ? (
                                                    <img src={p.imagen} alt={p.producto} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                                                ) : (
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <Icon name="Package" size={18} color="var(--text-muted)" />
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 700 }}>{p.producto}</td>
                                            <td style={{ padding: "12px 16px" }}>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "var(--bg-app)", color: "var(--primary-dark)", padding: "3px 8px", borderRadius: 12 }}>
                                                    {(p.categoria || ["Otros"]).join(", ")}
                                                </span>
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 800 }}>{p.stock_total} uds</td>
                                            <td style={{ padding: "12px 16px", fontWeight: 800, color: "var(--primary-dark)" }}>${p.precio_venta.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {productos.length === 0 && !cargando && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No hay productos en el catálogo.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            <div style={{ height: 32 }} />
        </div>
    )
}