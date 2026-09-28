// ==============================================================================
// src/components/personalizacion/ConfigCatalogo.tsx
// Card "Configuración del Catálogo": 3 sub-pestañas para no saturar
// (General, Apariencia, Opciones). Recibe estado/handlers desde
// useConfigCatalogo + useBanners vía props.
// ==============================================================================

import { useState } from "react"
import Icon from "@/components/ui/Icon"
import { ToastBanner } from "@/components/ui/Toast"
import { SeccionEstado } from "./SeccionEstado"
import { SeccionContenido } from "./SeccionContenido"
import { SeccionComportamiento } from "./SeccionComportamiento"
import { SeccionApariencia } from "./SeccionApariencia"
import { SeccionPlantilla } from "./SeccionPlantilla"
import { SeccionVisibilidad } from "./SeccionVisibilidad"
import type { Categoria } from "@/lib/api"
import type { PropsSeccionConfig } from "./tipos"

type SubTab = "general" | "apariencia" | "opciones"

const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
    { id: "general", label: "General", icon: "Power" },
    { id: "apariencia", label: "Apariencia", icon: "Palette" },
    { id: "opciones", label: "Opciones", icon: "SlidersHorizontal" },
]

interface Props extends PropsSeccionConfig {
    bannerInputRef: React.RefObject<HTMLInputElement>
    bannerMovilInputRef: React.RefObject<HTMLInputElement>
    fondoInputRef: React.RefObject<HTMLInputElement>
    heroInputRef: React.RefObject<HTMLInputElement>
    heroMovilInputRef: React.RefObject<HTMLInputElement>
    subiendoBanner: boolean
    subiendoBannerMovil: boolean
    subiendoFondo: boolean
    subiendoHero: boolean
    subiendoHeroMovil: boolean
    handleBannerFile: (e: React.ChangeEvent<HTMLInputElement>, target: "escritorio" | "movil" | "fondo" | "hero" | "hero_movil") => void
    quitarBanner: (target: "escritorio" | "movil" | "fondo" | "hero" | "hero_movil") => void
    categoriasCatalogo: Categoria[]
    categoriaToggling: string | null
    toggleCategoria: (categoria: string) => void
    reordenarCategorias: (nuevaLista: Categoria[]) => void
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
        fondoInputRef,
        heroInputRef,
        heroMovilInputRef,
        subiendoBanner,
        subiendoBannerMovil,
        subiendoFondo,
        subiendoHero,
        subiendoHeroMovil,
        handleBannerFile,
        quitarBanner,
        categoriasCatalogo,
        categoriaToggling,
        toggleCategoria,
        reordenarCategorias,
    } = props

    const [subTab, setSubTab] = useState<SubTab>("general")

    const seccion: PropsSeccionConfig = {
        catalogoConfig,
        setCatalogoConfig,
        autoguardar,
        autoguardarDebounce,
        campoGuardando,
        renderGuardado,
    }

    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 400px", maxWidth: 520 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Configuración del Catálogo</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>
                Personaliza la apariencia y el contenido de tu catálogo público.
            </p>

            <ToastBanner />

            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
                {SUB_TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setSubTab(t.id)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "none",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            background: subTab === t.id ? "var(--primary-mid)" : "var(--bg-card2)",
                            color: subTab === t.id ? "#fff" : "var(--text-muted)",
                            transition: "all 0.2s",
                        }}
                    >
                        <Icon name={t.icon as any} size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {subTab === "general" && (
                    <>
                        <SeccionEstado {...seccion} />
                        <SeccionPlantilla {...seccion} />
                        <SeccionContenido {...seccion} />
                    </>
                )}
                {subTab === "apariencia" && (
                    <SeccionApariencia
                        {...seccion}
                        bannerInputRef={bannerInputRef}
                        bannerMovilInputRef={bannerMovilInputRef}
                        fondoInputRef={fondoInputRef}
                        heroInputRef={heroInputRef}
                        heroMovilInputRef={heroMovilInputRef}
                        subiendoBanner={subiendoBanner}
                        subiendoBannerMovil={subiendoBannerMovil}
                        subiendoFondo={subiendoFondo}
                        subiendoHero={subiendoHero}
                        subiendoHeroMovil={subiendoHeroMovil}
                        handleBannerFile={handleBannerFile}
                        quitarBanner={quitarBanner}
                    />
                )}
                {subTab === "opciones" && (
                    <>
                        <SeccionVisibilidad
                            {...seccion}
                            categoriasCatalogo={categoriasCatalogo}
                            categoriaToggling={categoriaToggling}
                            toggleCategoria={toggleCategoria}
                            reordenarCategorias={reordenarCategorias}
                        />
                        <SeccionComportamiento {...seccion} />
                    </>
                )}
            </div>
        </div>
    )
}
