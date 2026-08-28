// ==============================================================================
// src/hooks/usePersonalizacionCuenta.ts
// Dominio "Mi Cuenta": email del usuario autenticado, logout, descargas de
// respaldo (JSON/XLSX) e identidad del negocio (empresa, logo + limpieza del
// logo anterior en Cloudinary, modo de precio sugerido del POS, guardar
// cambios). Recibe tenant/actualizar desde useTenant (el contenedor los usa
// también en su JSX) y consume el toast global.
// ==============================================================================

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { api, descargarDatosJson, descargarDatosXlsx } from "@/lib/api"
import { useToast } from "@/components/ui/Toast"
import { useQueryClient } from "@tanstack/react-query"
import { inventarioQueryKeys } from "@/lib/inventarioQueries"

interface UsePersonalizacionCuentaArgs {
    tenant: { tenant_id: string; empresa: string; logo: string; plan: string } | null
    actualizar: (data: { empresa?: string; logo?: string }) => Promise<void>
}

export function usePersonalizacionCuenta({ tenant, actualizar }: UsePersonalizacionCuentaArgs) {
    const { mostrarMsg } = useToast()
    const queryClient = useQueryClient()
    const router = useRouter()

    // Email del usuario (y flag de carga del bloque de cuenta)
    const [cargando, setCargando] = useState(true)
    const [userEmail, setUserEmail] = useState<string | null>(null)

    // ── Formulario de identidad del negocio ──
    const [empresa, setEmpresa] = useState("")
    const [logoUrl, setLogoUrl] = useState("")
    // Último logo persistido en la DB (para borrar el anterior de Cloudinary al reemplazarlo)
    const [logoOriginal, setLogoOriginal] = useState("")
    const [guardando, setGuardando] = useState(false)
    // Modo de precio sugerido del Punto de Venta ('antiguo' | 'maximo' | 'reciente')
    const [modoPrecio, setModoPrecio] = useState("antiguo")
    const [guardandoModo, setGuardandoModo] = useState(false)
    const [subiendoLogo, setSubiendoLogo] = useState(false)
    // Tipo de descarga en curso: "json" | "xlsx" | null (respaldo de datos)
    const [descargando, setDescargando] = useState<"json" | "xlsx" | null>(null)
    const inputFileRef = useRef<HTMLInputElement>(null)

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

    // Cargar el email del usuario autenticado al montar
    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    setUserEmail(user.email ?? "Usuario Nezzura Digital")
                }
            } catch (e) {
                console.error("Error cargando configuración:", e)
            } finally {
                setCargando(false)
            }
        }
        loadData()
    }, [])

    async function cambiarModoPrecio(modo: string) {
        setModoPrecio(modo)
        setGuardandoModo(true)
        try {
            await api.actualizarModoPrecioSugerido(modo)
            if (tenant?.tenant_id) {
                await queryClient.invalidateQueries({
                    queryKey: inventarioQueryKeys.productos(tenant.tenant_id),
                    refetchType: "active",
                })
            }
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

    // Descarga el respaldo JSON con todos los datos del tenant autenticado
    async function handleDescargarJson() {
        if (descargando) return
        setDescargando("json")
        try {
            await descargarDatosJson()
            mostrarMsg(true, "✅ Respaldo JSON descargado — guárdalo en un lugar seguro")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al descargar el respaldo"}`)
        } finally {
            setDescargando(null)
        }
    }

    // Descarga la vista Excel (XLSX) de los datos del tenant autenticado
    async function handleDescargarXlsx() {
        if (descargando) return
        setDescargando("xlsx")
        try {
            await descargarDatosXlsx()
            mostrarMsg(true, "✅ Archivo Excel descargado")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al descargar el Excel"}`)
        } finally {
            setDescargando(null)
        }
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

    return {
        // Estado (lectura + escritura según lo que consume el JSX)
        cargando,
        userEmail,
        empresa,
        setEmpresa,
        logoUrl,
        setLogoUrl,
        guardando,
        modoPrecio,
        guardandoModo,
        subiendoLogo,
        descargando,
        inputFileRef,
        // Handlers
        handleLogout,
        handleDescargarJson,
        handleDescargarXlsx,
        handleLogoFile,
        cambiarModoPrecio,
        guardarCambios,
    }
}
