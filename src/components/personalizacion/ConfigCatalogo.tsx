// ==============================================================================
// src/components/personalizacion/ConfigCatalogo.tsx
// Card "Configuración del Catálogo": compone las 6 secciones (Estado,
// Contenido, Comportamiento, Apariencia, Plantilla y Visibilidad) dentro de
// la columna. Recibe todo el estado/handlers desde useConfigCatalogo +
// useBanners vía props.
// ==============================================================================

import { ToastBanner } from "@/components/ui/Toast"
import { SeccionEstado } from "./SeccionEstado"
import { SeccionContenido } from "./SeccionContenido"
import { SeccionComportamiento } from "./SeccionComportamiento"
import { SeccionApariencia } from "./SeccionApariencia"
import { SeccionPlantilla } from "./SeccionPlantilla"
import { SeccionVisibilidad } from "./SeccionVisibilidad"
import type { Categoria } from "@/lib/api"
import type { PropsSeccionConfig } from "./tipos"

interface Props extends PropsSeccionConfig {
    bannerInputRef: React.RefObject<HTMLInputElement>
    bannerMovilInputRef: React.RefObject<HTMLInputElement>
    subiendoBanner: boolean
    subiendoBannerMovil: boolean
    handleBannerFile: (e: React.ChangeEvent<HTMLInputElement>, target: "escritorio" | "movil") => void
    quitarBanner: (target: "escritorio" | "movil") => void
    categoriasCatalogo: Categoria[]
    categoriaToggling: string | null
    toggleCategoria: (categoria: string) => void
}

export function ConfigCatalogo(props: Props) {
    const {
        catalogoConfig,
        setCatalogoConfig,
        autoguardar,
        autoguardarDebounce,
        campoGuardando,
        renderGuardado,
        bannerInputRef,
        bannerMovilInputRef,
        subiendoBanner,
        subiendoBannerMovil,
        handleBannerFile,
        quitarBanner,
        categoriasCatalogo,
        categoriaToggling,
        toggleCategoria,
    } = props

    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 400px", maxWidth: 520 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Configuración del Catálogo</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>
                Personaliza la apariencia y el contenido de tu catálogo público.
            </p>

            <ToastBanner />

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <SeccionEstado
                    catalogoConfig={catalogoConfig}
                    setCatalogoConfig={setCatalogoConfig}
                    autoguardar={autoguardar}
                    autoguardarDebounce={autoguardarDebounce}
                    campoGuardando={campoGuardando}
                    renderGuardado={renderGuardado}
                />
                <SeccionContenido
                    catalogoConfig={catalogoConfig}
                    setCatalogoConfig={setCatalogoConfig}
                    autoguardar={autoguardar}
                    autoguardarDebounce={autoguardarDebounce}
                    campoGuardando={campoGuardando}
                    renderGuardado={renderGuardado}
                />
                <SeccionComportamiento
                    catalogoConfig={catalogoConfig}
                    setCatalogoConfig={setCatalogoConfig}
                    autoguardar={autoguardar}
                    autoguardarDebounce={autoguardarDebounce}
                    campoGuardando={campoGuardando}
                    renderGuardado={renderGuardado}
                />
                <SeccionApariencia
                    catalogoConfig={catalogoConfig}
                    setCatalogoConfig={setCatalogoConfig}
                    autoguardar={autoguardar}
                    autoguardarDebounce={autoguardarDebounce}
                    campoGuardando={campoGuardando}
                    renderGuardado={renderGuardado}
                    bannerInputRef={bannerInputRef}
                    bannerMovilInputRef={bannerMovilInputRef}
                    subiendoBanner={subiendoBanner}
                    subiendoBannerMovil={subiendoBannerMovil}
                    handleBannerFile={handleBannerFile}
                    quitarBanner={quitarBanner}
                />
                <SeccionPlantilla
                    catalogoConfig={catalogoConfig}
                    setCatalogoConfig={setCatalogoConfig}
                    autoguardar={autoguardar}
                    autoguardarDebounce={autoguardarDebounce}
                    campoGuardando={campoGuardando}
                    renderGuardado={renderGuardado}
                />
                <SeccionVisibilidad
                    catalogoConfig={catalogoConfig}
                    setCatalogoConfig={setCatalogoConfig}
                    autoguardar={autoguardar}
                    autoguardarDebounce={autoguardarDebounce}
                    campoGuardando={campoGuardando}
                    renderGuardado={renderGuardado}
                    categoriasCatalogo={categoriasCatalogo}
                    categoriaToggling={categoriaToggling}
                    toggleCategoria={toggleCategoria}
                />
            </div>
        </div>
    )
}
