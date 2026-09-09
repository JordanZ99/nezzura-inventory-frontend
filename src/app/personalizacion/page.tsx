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
 */
const NOMBRES_TEMA: Record<string, string> = {
    default: "Steel Slate",
    midnightSlate: "Midnight Slate",
    strawberry: "Strawberry Pink",
    cozyYellow: "Cozy Yellow",
}

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "cuenta", label: "Mi Cuenta", icon: "User" },
    { id: "negocio", label: "Mi Negocio", icon: "Store" },
    { id: "catalogo", label: "Catálogo", icon: "ClipboardList" },
]

export default function Personalizacion() {
    const { tenant, cargando: cargandoTenant, actualizar } = useTenant()

    // Tab activa + nombre del tema actual (estado de UI del contenedor)
    const [tab, setTab] = useState<Tab>("cuenta")
    const [temaActual, setTemaActual] = useState<string>("Steel Slate")

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
                        <div style={{ display: "flex", flex: 1, gap: 20, justifyContent: "center" }}>
                            <button onClick={() => cambiarTema('default')}
                                style={{ width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", background: "linear-gradient(135deg, #6f7375ff 0%, #5e87a4ff 100%)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                                title="Steel Slate"
                            />
                            <button onClick={() => cambiarTema('midnightSlate')}
                                style={{ width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", background: "linear-gradient(135deg, #1f2321ff 0%, #1e6456ff 100%)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                                title="Midnight Slate"
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
