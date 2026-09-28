// ==============================================================================
// src/hooks/useBanners.ts
// Dominio "Banners" del catálogo: selección del archivo (abre el modal de
// recorte con la relación correcta), compresión + subida + guardado con
// limpieza de la imagen anterior en Cloudinary (y rollback del huérfano si el
// guardado falla) y quitar banner. El target "fondo" (migración 045) sube SIN
// recorte: una textura/fondo no tiene relación fija.
// Recibe catalogoConfig/setCatalogoConfig/ejecutarGuardado desde
// useConfigCatalogo (la MISMA instancia de estado) y tenant para las claves
// de Cloudinary; así no hay una segunda copia del estado de la config.
// ==============================================================================

import { useRef, useState } from "react"
import { api, type CatalogoConfig } from "@/lib/api"
import { comprimirBanner } from "@/lib/image-utils"
import { useToast } from "@/components/ui/Toast"

export type TargetBanner = "escritorio" | "movil" | "fondo" | "hero" | "hero_movil"

// Relación y etiqueta del crop por target (compartido con el modal de recorte
// en personalizacion/page.tsx): los valores 'hero' son de la migración 047.
export const RELACION_CROP: Record<Exclude<TargetBanner, "fondo">, { ratio: number; etiqueta: string }> = {
    escritorio: { ratio: 1920 / 373, etiqueta: "1920 × 373" },
    movil: { ratio: 750 / 420, etiqueta: "750 × 420" },
    hero: { ratio: 1920 / 1080, etiqueta: "1920 × 1080" },
    hero_movil: { ratio: 750 / 1334, etiqueta: "750 × 1334" },
}

interface UseBannersArgs {
    tenant: { tenant_id: string } | null
    catalogoConfig: CatalogoConfig | null
    setCatalogoConfig: React.Dispatch<React.SetStateAction<CatalogoConfig | null>>
    ejecutarGuardado: (campo: string, data: Record<string, any>) => Promise<boolean>
}

export function useBanners({ tenant, catalogoConfig, setCatalogoConfig, ejecutarGuardado }: UseBannersArgs) {
    const { mostrarMsg } = useToast()

    const bannerInputRef = useRef<HTMLInputElement>(null)
    const bannerMovilInputRef = useRef<HTMLInputElement>(null)
    const fondoInputRef = useRef<HTMLInputElement>(null)
    const heroInputRef = useRef<HTMLInputElement>(null)
    const heroMovilInputRef = useRef<HTMLInputElement>(null)
    const [subiendoBanner, setSubiendoBanner] = useState(false)
    const [subiendoBannerMovil, setSubiendoBannerMovil] = useState(false)
    const [subiendoFondo, setSubiendoFondo] = useState(false)
    const [subiendoHero, setSubiendoHero] = useState(false)
    const [subiendoHeroMovil, setSubiendoHeroMovil] = useState(false)
    // Crop del banner: imagen seleccionada esperando recorte (escritorio, móvil o hero)
    const [bannerCrop, setBannerCrop] = useState<{ url: string; target: Exclude<TargetBanner, "fondo"> } | null>(null)

    // ── Subir banner/hero del catálogo (escritorio o móvil) ──
    // 1) Se elige el archivo → se abre el modal de recorte con la relación correcta.
    //    El fondo del catálogo (migración 045) NO pasa por recorte: sube directo.
    function handleBannerFile(e: React.ChangeEvent<HTMLInputElement>, target: TargetBanner) {
        const file = e.target.files?.[0]
        if (!file) return
        if (target === "fondo") {
            void subirFondo(file)
        } else {
            setBannerCrop({ url: URL.createObjectURL(file), target })
        }
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
            if (target === "hero") setSubiendoHero(true)
            else if (target === "hero_movil") setSubiendoHeroMovil(true)
            else if (esMovil) setSubiendoBannerMovil(true)
            else setSubiendoBanner(true)
            const esHero = target === "hero" || target === "hero_movil"
            const nombreClave = esHero
                ? `_banner_${target === "hero" ? "hero" : "hero_movil"}_${tenant.tenant_id.slice(0, 8)}`
                : `_banner${esMovil ? "_movil" : ""}_${tenant.tenant_id.slice(0, 8)}`
            const archivo = new File([blob], `banner-${target}.jpg`, { type: blob.type || "image/jpeg" })
            // Comprimir conservando resolución (máx 1920px) antes de subir:
            // el endpoint tiene límite de 1MB y los banners lo superan fácilmente
            let imgAEnviar: Blob | File = archivo
            try { imgAEnviar = await comprimirBanner(archivo) }
            catch { /* enviar el recorte si falla la compresión */ }
            const { ruta } = await api.subirFoto(nombreClave, imgAEnviar as File)
            // URL anterior del banner: se borra de Cloudinary solo tras guardar el nuevo
            const viejaUrl = esHero
                ? (target === "hero" ? (catalogoConfig?.hero_url || "") : (catalogoConfig?.hero_url_movil || ""))
                : esMovil ? (catalogoConfig?.banner_url_movil || "") : (catalogoConfig?.banner_url || "")
            let campo: string, campoUrl: string
            if (target === "hero") { campo = "hero_url"; campoUrl = "hero_url" }
            else if (target === "hero_movil") { campo = "hero_url_movil"; campoUrl = "hero_url_movil" }
            else if (esMovil) { campo = "banner_url_movil"; campoUrl = campo }
            else { campo = "banner_url"; campoUrl = campo }
            setCatalogoConfig(prev => prev ? { ...prev, [campoUrl]: ruta } : prev)
            const ok = await ejecutarGuardado(campo, { [campo]: ruta })
            if (ok && viejaUrl && viejaUrl !== ruta) {
                api.borrarImagen(viejaUrl).catch(() => {})
            } else if (!ok) {
                // Guardado falló: limpiar la imagen recién subida (huérfana)
                api.borrarImagen(ruta).catch(() => {})
            }
            mostrarMsg(true, "🖼️ Banner subido y aplicado")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al subir banner"}`)
        } finally {
            setSubiendoBannerMovil(false)
            setSubiendoBanner(false)
            setSubiendoHero(false)
            setSubiendoHeroMovil(false)
            // Revocar el objectURL una vez el modal ya se desmontó
            setTimeout(() => URL.revokeObjectURL(url), 0)
        }
    }

    // ── Subir la imagen/textura de FONDO del catálogo (migración 045) ──
    // Sin recorte (no hay relación fija) y con el mismo ciclo de vida que los
    // banners: comprimir → subir → guardar → limpiar la anterior (o el huérfano).
    async function subirFondo(file: File) {
        if (!tenant?.tenant_id) return
        try {
            setSubiendoFondo(true)
            const nombreClave = `_fondo_${tenant.tenant_id.slice(0, 8)}`
            let imgAEnviar: Blob | File = file
            try { imgAEnviar = await comprimirBanner(file, 1600, 1600) }
            catch { /* enviar el original si falla la compresión */ }
            const { ruta } = await api.subirFoto(nombreClave, imgAEnviar as File)
            // La imagen anterior se borra de Cloudinary solo tras guardar la nueva
            const viejaUrl = catalogoConfig?.fondo_url || ""
            setCatalogoConfig(prev => prev ? { ...prev, fondo_url: ruta } : prev)
            const ok = await ejecutarGuardado("fondo_url", { fondo_url: ruta })
            if (ok && viejaUrl && viejaUrl !== ruta) {
                api.borrarImagen(viejaUrl).catch(() => {})
            } else if (!ok) {
                // Guardado falló: limpiar la imagen recién subida (huérfana)
                api.borrarImagen(ruta).catch(() => {})
                setCatalogoConfig(prev => prev ? { ...prev, fondo_url: viejaUrl } : prev)
            } else {
                mostrarMsg(true, "✨ Fondo subido y aplicado")
            }
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al subir el fondo"}`)
        } finally {
            setSubiendoFondo(false)
        }
    }

    // ── Quitar banner (escritorio, móvil, hero) o el fondo ──
    async function quitarBanner(target: TargetBanner) {
        const campo = target === "fondo" ? "fondo_url"
            : target === "hero" ? "hero_url"
            : target === "hero_movil" ? "hero_url_movil"
            : target === "escritorio" ? "banner_url" : "banner_url_movil"
        const viejaUrl = target === "fondo" ? (catalogoConfig?.fondo_url || "")
            : target === "hero" ? (catalogoConfig?.hero_url || "")
            : target === "hero_movil" ? (catalogoConfig?.hero_url_movil || "")
            : target === "escritorio" ? (catalogoConfig?.banner_url || "") : (catalogoConfig?.banner_url_movil || "")
        setCatalogoConfig(prev => prev ? { ...prev, [campo]: "" } : prev)
        const ok = await ejecutarGuardado(campo, { [campo]: "" })
        if (ok && viejaUrl) {
            api.borrarImagen(viejaUrl).catch(() => {})
        }
    }

    // Cancelar el recorte: liberar el objectURL y cerrar el modal
    function cancelarCrop() {
        if (bannerCrop) {
            URL.revokeObjectURL(bannerCrop.url)
            setBannerCrop(null)
        }
    }

    return {
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
        bannerCrop,
        handleBannerFile,
        handleBannerCropComplete,
        quitarBanner,
        cancelarCrop,
    }
}
