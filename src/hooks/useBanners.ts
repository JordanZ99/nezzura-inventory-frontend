// ==============================================================================
// src/hooks/useBanners.ts
// Dominio "Banners" del catálogo: selección del archivo (abre el modal de
// recorte con la relación correcta), compresión + subida + guardado con
// limpieza de la imagen anterior en Cloudinary (y rollback del huérfano si el
// guardado falla) y quitar banner.
// Recibe catalogoConfig/setCatalogoConfig/ejecutarGuardado desde
// useConfigCatalogo (la MISMA instancia de estado) y tenant para las claves
// de Cloudinary; así no hay una segunda copia del estado de la config.
// ==============================================================================

import { useRef, useState } from "react"
import { api, type CatalogoConfig } from "@/lib/api"
import { comprimirBanner } from "@/lib/image-utils"
import { useToast } from "@/components/ui/Toast"

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
    const [subiendoBanner, setSubiendoBanner] = useState(false)
    const [subiendoBannerMovil, setSubiendoBannerMovil] = useState(false)
    // Crop del banner: imagen seleccionada esperando recorte (escritorio o móvil)
    const [bannerCrop, setBannerCrop] = useState<{ url: string; target: "escritorio" | "movil" } | null>(null)

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
        subiendoBanner,
        subiendoBannerMovil,
        bannerCrop,
        handleBannerFile,
        handleBannerCropComplete,
        quitarBanner,
        cancelarCrop,
    }
}
