// ==============================================================================
// src/hooks/useConfigCatalogo.ts
// Dominio "Catálogo": configuración del catálogo público con AUTO-GUARDADO
// (inmediato para toggles/selectores, con debounce de 650ms para textos),
// flush de los pendientes al desmontar, visibilidad de categorías y la
// tarjeta Compartir (link, QR, copiar/compartir). El estado vive aquí y se
// expone setCatalogoConfig/ejecutarGuardado para que useBanners (misma
// instancia) pueda subir banners y guardarlos en el mismo objeto.
// ==============================================================================

import { useState, useEffect, useRef } from "react"
import { api, type CatalogoConfig, type Categoria } from "@/lib/api"
import { useToast } from "@/components/ui/Toast"
import { useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { inventarioQueryKeys } from "@/lib/inventarioQueries"

/**
 * Hook de configuración del catálogo. Recibe la tab activa para cargar la
 * config solo la primera vez que el usuario abre la pestaña "catálogo".
 */
export function useConfigCatalogo(tab: string) {
    const { mostrarMsg } = useToast()
    const { tenant } = useTenant()
    const queryClient = useQueryClient()

    // ── Configuración del catálogo público ──
    const [catalogoConfig, setCatalogoConfig] = useState<CatalogoConfig | null>(null)
    const [cargandoCatalogo, setCargandoCatalogo] = useState(false)
    const configCargadaRef = useRef(false)

    // ── Tarjeta Compartir ──
    const [linkCopiado, setLinkCopiado] = useState(false)
    const [qrDescargado, setQrDescargado] = useState(false)
    const qrCanvasRef = useRef<HTMLCanvasElement>(null)

    // ── Visibilidad de categorías en el catálogo ──
    const [categoriasCatalogo, setCategoriasCatalogo] = useState<Categoria[]>([])
    const [categoriaToggling, setCategoriaToggling] = useState<string | null>(null)

    // ── Auto-guardado: cada control se guarda solo al cambiar ──
    // "campoGuardando" indica qué control se está guardando ahora mismo (spinner).
    const [campoGuardando, setCampoGuardando] = useState<string | null>(null)
    const debounceRef = useRef<Record<string, { timer: ReturnType<typeof setTimeout>; data: () => Record<string, any> }>>({})

    async function ejecutarGuardado(campo: string, data: Record<string, any>): Promise<boolean> {
        setCampoGuardando(campo)
        try {
            await api.actualizarConfigCatalogo(data)
            if (tenant?.tenant_id) {
                await queryClient.invalidateQueries({
                    queryKey: inventarioQueryKeys.configCatalogo(tenant.tenant_id),
                    refetchType: "active",
                })
            }
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
            if (tenant?.tenant_id) {
                await queryClient.invalidateQueries({
                    queryKey: inventarioQueryKeys.categorias(tenant.tenant_id),
                    refetchType: "active",
                })
            }
            mostrarMsg(true, res.mensaje)
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al cambiar visibilidad"}`)
        } finally {
            setCategoriaToggling(null)
        }
    }

    const CATALOGO_LINK = catalogoConfig?.slug
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/catalogo/${catalogoConfig.slug}`
        : ""

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

    return {
        // Estado
        catalogoConfig,
        setCatalogoConfig,
        cargandoCatalogo,
        categoriasCatalogo,
        categoriaToggling,
        campoGuardando,
        linkCopiado,
        qrDescargado,
        qrCanvasRef,
        CATALOGO_LINK,
        // Auto-guardado
        ejecutarGuardado,
        autoguardar,
        autoguardarDebounce,
        renderGuardado,
        // Visibilidad de categorías
        toggleCategoria,
        // Compartir
        copiarLink,
        descargarQR,
        compartirLink,
    }
}
