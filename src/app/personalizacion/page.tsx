"use client"

import { useState, useEffect } from "react"
import { useTenant } from "@/contexts/TenantContext"
import Icon from "@/components/ui/Icon"
import ImageCropperModal from "@/components/ui/ImageCropperModal"
import PageHeader from "@/components/ui/PageHeader"
import { usePersonalizacionCuenta } from "@/hooks/usePersonalizacionCuenta"
import { useConfigCatalogo } from "@/hooks/useConfigCatalogo"
import { useBanners } from "@/hooks/useBanners"
import { obtenerTemaGestor } from "@/lib/temas"
import { CardInfoCuenta } from "@/components/personalizacion/CardInfoCuenta"
import { CardIdentidadNegocio } from "@/components/personalizacion/CardIdentidadNegocio"
import { CardMiNegocio } from "@/components/personalizacion/CardMiNegocio"
import { CardTerminales } from "@/components/personalizacion/CardTerminales"
import { CardClientesConfig } from "@/components/personalizacion/CardClientesConfig"
import { CardPuntosConfig } from "@/components/personalizacion/CardPuntosConfig"
import { ConfigCatalogo } from "@/components/personalizacion/ConfigCatalogo"
import { CardCompartir } from "@/components/personalizacion/CardCompartir"

type Tab = "cuenta" | "negocio" | "catalogo"

/**
 * Mapa que traduce las claves de tema guardadas en localStorage
 * a nombres mostrables en la interfaz.
 * - default        → "Steel Slate" (tema por defecto, gris-azulado)
 * - midnightSlate  → "Midnight Slate" (oscuro, teal + índigo)
 * - strawberry     → "Strawberry Pink"
 * - cozyYellow     → "Cozy Yellow"
 * - botanical      → "Botanic Green"
 * - cottonCandy    → "Cotton Candy"
 */
const NOMBRES_TEMA: Record<string, string> = {
    default: "Steel Slate",
    midnightSlate: "Midnight Slate",
    strawberry: "Strawberry Pink",
    cozyYellow: "Cozy Yellow",
    botanical: "Botanic Green",
    cottonCandy: "Cotton Candy",
    blackGrill: "Black Grill",
}

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "cuenta", label: "Cuenta", icon: "User" },
    { id: "negocio", label: "Negocio", icon: "Store" },
    { id: "catalogo", label: "Catálogo", icon: "ClipboardList" },
]

// Círculos del selector de temas (deben coincidir con las paletas de globals.css)
const TEMAS_CIRCULOS = [
    { clave: 'default', title: "Steel Slate", background: "linear-gradient(135deg, #6f7375ff 0%, #5e87a4ff 100%)" },
    { clave: 'midnightSlate', title: "Midnight Slate", background: "linear-gradient(135deg, #1f2321ff 0%, #1e6456ff 100%)" },
    { clave: 'strawberry', title: "Strawberry Pink", background: "linear-gradient(135deg, #f33376 0%, #fa30dfff 100%)" },
    { clave: 'cozyYellow', title: "Cozy Yellow", background: "linear-gradient(135deg, #ffd05bff 0%, #eb7456ff 100%)" },
    { clave: 'botanical', title: "Botanic Green", background: "linear-gradient(135deg, #24a85bff 0%, #5ec967ff 100%)" },
    { clave: 'cottonCandy', title: "Cotton Candy", background: "linear-gradient(135deg, #f472b6ff 0%, #7dd3fcff 100%)" },
    { clave: 'blackGrill', title: "Black Grill", background: "linear-gradient(135deg, #1b1b1bff 0%, #3b3b3bff 100%)" },
]

const ESTILO_CIRCULO: React.CSSProperties = { width: 34, height: 34, borderRadius: "50%", flexShrink: 0, cursor: "pointer", border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }

export default function Personalizacion() {
    const { tenant, cargando: cargandoTenant, actualizar } = useTenant()

    // Tab activa + nombre del tema actual (estado de UI del contenedor)
    const [tab, setTab] = useState<Tab>("cuenta")
    const [temaActual, setTemaActual] = useState<string>("Steel Slate")
    // En móvil solo se muestran 3 temas + un botón con flecha para expandir el resto
    const [mostrarTodosTemas, setMostrarTodosTemas] = useState(false)

    // ── Hooks de dominio (Fases B y C) ──
    const cuenta = usePersonalizacionCuenta({ tenant, actualizar })
    const config = useConfigCatalogo(tab)
    const banners = useBanners({
        tenant,
        catalogoConfig: config.catalogoConfig,
        setCatalogoConfig: config.setCatalogoConfig,
        ejecutarGuardado: config.ejecutarGuardado,
    })

    /**
     * Cambia el tema visual de la aplicación: actualiza el atributo
     * data-theme en el elemento <html>, persiste la elección en
     * localStorage y actualiza el nombre visible en el Hero.
     *
     * @param claveTema - Clave del tema ('default', 'midnightSlate', etc.)
     */
    function cambiarTema(claveTema: string) {
        // Aplicamos el tema al documento
        document.documentElement.setAttribute('data-theme', claveTema)
        // Lo persistimos para que sobreviva a recargas de página
        localStorage.setItem('tema', claveTema)
        // Cookie para que el servidor renderice data-theme sin flash
        document.cookie = `tema=${claveTema};path=/;max-age=31536000;samesite=lax`
        // Actualizamos el nombre mostrado en el Hero
        setTemaActual(NOMBRES_TEMA[claveTema] || claveTema)
    }

    // Al montar el componente, leemos el tema guardado para mostrarlo
    useEffect(() => {
        const temaGuardado = obtenerTemaGestor()
        setTemaActual(NOMBRES_TEMA[temaGuardado] || 'Steel Slate')
    }, [])

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero ── */}
            <PageHeader
                gradiente="var(--gradient-5)"
                agColor="var(--ag-color-5)"
                // Mostramos el nombre del tema actual en lugar de un texto fijo
                subtitulo={temaActual}
                subtituloStyle={{ color: "rgba(255, 255, 255, 0.91)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" }}
                titulo="Personalización"
                icono="UserRoundPen"
                iconoEncerrado
                iconoColor="var(--on-primary)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--on-primary)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
            />

            <div style={{ width: "100%", padding: "0 24px", marginTop: -47 }}>

                {/* ── Selector de Temas ── */}
                <div style={{ flex: 1, gap: 12, marginBottom: 24 }}>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="PaintBucket" size={32} color="var(--primary-alter)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Temas</p>
                        </div>
                        {/* Desktop: todos los temas siempre en una fila */}
                        <div className="hidden md:flex" style={{ flex: 1, gap: 20, justifyContent: "center" }}>
                            {TEMAS_CIRCULOS.map(t => (
                                <button key={t.clave} onClick={() => cambiarTema(t.clave)}
                                    style={{ ...ESTILO_CIRCULO, background: t.background }}
                                    title={t.title}
                                />
                            ))}
                        </div>
                        {/* Móvil: 3 temas + flecha siempre como 4º círculo; al expandir los demás bajan a filas siguientes */}
                        <div className="flex md:hidden" style={{ flex: 1, gap: 20, rowGap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                            {TEMAS_CIRCULOS.slice(0, 3).map(t => (
                                <button key={t.clave} onClick={() => cambiarTema(t.clave)}
                                    style={{ ...ESTILO_CIRCULO, background: t.background }}
                                    title={t.title}
                                />
                            ))}
                            <button onClick={() => setMostrarTodosTemas(v => !v)}
                                style={{ ...ESTILO_CIRCULO, background: "var(--bg-card)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                                title={mostrarTodosTemas ? "Mostrar menos" : "Más temas"}
                            >
                                <Icon name={mostrarTodosTemas ? "ChevronUp" : "ChevronDown"} size={16} />
                            </button>
                            {mostrarTodosTemas && TEMAS_CIRCULOS.slice(3).map(t => (
                                <button key={t.clave} onClick={() => cambiarTema(t.clave)}
                                    style={{ ...ESTILO_CIRCULO, background: t.background }}
                                    title={t.title}
                                />
                            ))}
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
                        <CardInfoCuenta
                            cargando={cuenta.cargando}
                            userEmail={cuenta.userEmail}
                            cargandoTenant={cargandoTenant}
                            tenantId={tenant?.tenant_id}
                            descargando={cuenta.descargando}
                            handleDescargarJson={cuenta.handleDescargarJson}
                            handleDescargarXlsx={cuenta.handleDescargarXlsx}
                            handleLogout={cuenta.handleLogout}
                        />
                        <CardIdentidadNegocio
                            inputFileRef={cuenta.inputFileRef}
                            logoUrl={cuenta.logoUrl}
                            setLogoUrl={cuenta.setLogoUrl}
                            handleLogoFile={cuenta.handleLogoFile}
                            subiendoLogo={cuenta.subiendoLogo}
                            empresa={cuenta.empresa}
                            setEmpresa={cuenta.setEmpresa}
                            modoPrecio={cuenta.modoPrecio}
                            cambiarModoPrecio={cuenta.cambiarModoPrecio}
                            guardandoModo={cuenta.guardandoModo}
                            guardando={cuenta.guardando}
                            cargandoTenant={cargandoTenant}
                            guardarCambios={cuenta.guardarCambios}
                        />
                    </div>
                )}

                {tab === "negocio" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
                        <CardMiNegocio
                            zonaHoraria={cuenta.zonaHorario}
                            setZonaHoraria={cuenta.setZonaHorario}
                            guardarZonaHoraria={cuenta.guardarZonaHoraria}
                            guardando={cuenta.guardandoZona}
                            cargandoTenant={cargandoTenant}
                            gastoComision={cuenta.gastoComision}
                            toggleGastoComision={cuenta.toggleGastoComision}
                        />
                        {/* Cartera de clientes + sistema de puntos (migraciones 038/039) */}
                        <CardClientesConfig cargandoTenant={cargandoTenant} />
                        <CardPuntosConfig cargandoTenant={cargandoTenant} />
                        <CardTerminales />
                    </div>
                )}

                {tab === "catalogo" && (
                    <>
                        {config.cargandoCatalogo ? (
                            <div className="card fade-up" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                Cargando configuración...
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
                                <ConfigCatalogo
                                    catalogoConfig={config.catalogoConfig}
                                    setCatalogoConfig={config.setCatalogoConfig}
                                    autoguardar={config.autoguardar}
                                    autoguardarDebounce={config.autoguardarDebounce}
                                    campoGuardando={config.campoGuardando}
                                    renderGuardado={config.renderGuardado}
                                    bannerInputRef={banners.bannerInputRef}
                                    bannerMovilInputRef={banners.bannerMovilInputRef}
                                    subiendoBanner={banners.subiendoBanner}
                                    subiendoBannerMovil={banners.subiendoBannerMovil}
                                    handleBannerFile={banners.handleBannerFile}
                                    quitarBanner={banners.quitarBanner}
                                    categoriasCatalogo={config.categoriasCatalogo}
                                    categoriaToggling={config.categoriaToggling}
                                    toggleCategoria={config.toggleCategoria}
                                />
                                <CardCompartir
                                    catalogoConfig={config.catalogoConfig}
                                    CATALOGO_LINK={config.CATALOGO_LINK}
                                    qrCanvasRef={config.qrCanvasRef}
                                    qrDescargado={config.qrDescargado}
                                    descargarQR={config.descargarQR}
                                    compartirLink={config.compartirLink}
                                    linkCopiado={config.linkCopiado}
                                    copiarLink={config.copiarLink}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Modal de recorte del banner (relación según target) ── */}
            {banners.bannerCrop && (
                <ImageCropperModal
                    imageUrl={banners.bannerCrop.url}
                    aspectRatio={banners.bannerCrop.target === "escritorio" ? 1920 / 373 : 750 / 420}
                    dimensionLabel={banners.bannerCrop.target === "escritorio" ? "1920 × 373" : "750 × 420"}
                    onCropComplete={banners.handleBannerCropComplete}
                    onCancel={banners.cancelarCrop}
                />
            )}

            <div style={{ height: 32 }} />
        </div>
    )
}
