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
import { CLAVES_CONTACTO } from "@/contexts/TenantContext"

/** Datos de contacto opcionales del negocio (tenants, migración 043). */
interface ContactoNegocio {
    telefono: string
    correo: string
    instagram: string
    facebook: string
    tiktok: string
    sitio_web: string
    maps: string
}

const CONTACTO_VACIO: ContactoNegocio = {
    telefono: "", correo: "", instagram: "", facebook: "", tiktok: "", sitio_web: "", maps: "",
}

interface UsePersonalizacionCuentaArgs {
    tenant: {
        tenant_id: string; empresa: string; logo: string; plan: string
        zona_horaria: string; metodo_pago_default: string; gasto_comision_automatico: boolean
        dias_cerrados?: string[]
    } | null
    actualizar: (data: { empresa?: string; logo?: string; zona_horaria?: string; metodo_pago_default?: string; gasto_comision_automatico?: boolean; dias_cerrados?: string[] } & Partial<ContactoNegocio>) => Promise<void>
}

/** Días de la semana en orden natural (lunes → domingo). */
function sortedDias(dias: string[]): string[] {
    const orden = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
    return dias.sort((a, b) => orden.indexOf(a) - orden.indexOf(b))
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
    // Zona horaria IANA del negocio (tab "Mi Negocio")
    const [zonaHorario, setZonaHorario] = useState("America/Cancun")
    const [guardandoZona, setGuardandoZona] = useState(false)
    // Gasto automático de comisiones de terminal (Fase B)
    const [gastoComision, setGastoComision] = useState(false)
    // Días de descanso del negocio (migración 051): 'sabado', 'domingo', ...
    const [diasCerrados, setDiasCerrados] = useState<string[]>([])
    const [guardandoDias, setGuardandoDias] = useState(false)
    const [subiendoLogo, setSubiendoLogo] = useState(false)
    // Recorte del logo en curso (mismo modal que banners): { url: blob URL }
    const [logoCrop, setLogoCrop] = useState<{ url: string } | null>(null)
    // Tipo de descarga en curso: "json" | "xlsx" | null (respaldo de datos)
    const [descargando, setDescargando] = useState<"json" | "xlsx" | null>(null)
    const inputFileRef = useRef<HTMLInputElement>(null)

    async function handleLogout() {
        await supabase.auth.signOut()
        router.replace("/login")
    }

    // ── Datos de contacto del negocio (migración 043, opcionales) ──
    const [contacto, setContacto] = useState<ContactoNegocio>(CONTACTO_VACIO)

    /** Cambia un solo campo de contacto manteniendo el resto */
    function setContactoCampo(campo: keyof ContactoNegocio, valor: string) {
        setContacto(prev => ({ ...prev, [campo]: valor }))
    }

    // Sincronizar formulario con los datos cargados desde el contexto
    useEffect(() => {
        if (tenant) {
            setEmpresa(tenant.empresa || "")
            setLogoUrl(tenant.logo || "")
            setLogoOriginal(tenant.logo || "")
            setZonaHorario(tenant.zona_horaria || "America/Cancun")
            setGastoComision(tenant.gasto_comision_automatico)
            if (Array.isArray(tenant.dias_cerrados)) setDiasCerrados(tenant.dias_cerrados)
            setContacto(prev => {
                const nuevo: ContactoNegocio = { ...prev }
                for (const clave of CLAVES_CONTACTO) {
                    nuevo[clave as keyof ContactoNegocio] = ((tenant as Record<string, unknown>)[clave as string] as string) || ""
                }
                return nuevo
            })
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
            // El logo SIEMPRE se muestra circular: abrimos el recorte 1:1
            // (mismo modal que banners/productos) antes de subir. La subida
            // ocurre al confirmar en handleLogoCropComplete.
            const url = URL.createObjectURL(file)
            setLogoCrop({ url })
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al abrir el recorte del logo"}`)
        } finally {
            setSubiendoLogo(false)
            if (inputFileRef.current) inputFileRef.current.value = ""
        }
    }

    /** Recorte del logo confirmado: subir el blob 1:1 a Cloudinary */
    async function handleLogoCropComplete(blob: Blob) {
        if (!logoCrop || !tenant?.tenant_id) return
        const url = logoCrop.url
        setLogoCrop(null)
        URL.revokeObjectURL(url)
        try {
            setSubiendoLogo(true)
            const nombreClave = `_logo_${tenant.tenant_id.slice(0, 8)}`
            const { ruta } = await api.subirFoto(nombreClave, blob as File)

            setLogoUrl(ruta)
            mostrarMsg(true, "📷 Logo recortado y subido — Haz clic en Guardar Cambios para aplicarlo en el sistema")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al subir logo"}`)
        } finally {
            setSubiendoLogo(false)
        }
    }

    function cancelarLogoCrop() {
        if (logoCrop) {
            URL.revokeObjectURL(logoCrop.url)
            setLogoCrop(null)
        }
    }

    // Guarda empresa, logo y datos de contacto en Supabase
    async function guardarCambios() {
        if (!empresa.trim()) {
            mostrarMsg(false, "❌ El nombre del negocio no puede estar vacío")
            return
        }
        try {
            setGuardando(true)

            // Llama a la función global actualizar del contexto que actualiza WHERE id = tenant_id
            const datosContacto: Partial<ContactoNegocio> = {}
            for (const clave of CLAVES_CONTACTO) {
                const campo = clave as keyof ContactoNegocio
                datosContacto[campo] = contacto[campo].trim()
            }
            await actualizar({
                empresa: empresa.trim(),
                logo: logoUrl.trim(),
                ...datosContacto,
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

    // Guarda la zona horaria del negocio (día contable de ventas/gastos/cortes)
    async function guardarZonaHoraria() {
        if (!zonaHorario.trim()) {
            mostrarMsg(false, "❌ Selecciona una zona horaria válida")
            return
        }
        try {
            setGuardandoZona(true)
            await actualizar({ zona_horaria: zonaHorario.trim() })
            mostrarMsg(true, "✅ Zona horaria del negocio actualizada")
        } catch (err: any) {
            mostrarMsg(false, `❌ ${err.message || "Error al guardar la zona horaria"}`)
        } finally {
            setGuardandoZona(false)
        }
    }

    /** Activa/desactiva el gasto automático de comisiones de terminal */
    async function toggleGastoComision(v: boolean) {
        const previo = gastoComision
        setGastoComision(v)
        try {
            await actualizar({ gasto_comision_automatico: v })
            mostrarMsg(true, v ? "✅ Comisiones se registrarán como gasto" : "Comisiones solo informativas")
        } catch (err: unknown) {
            setGastoComision(previo)
            mostrarMsg(false, `❌ ${err instanceof Error ? err.message : "Error"}`)
        }
    }

    /** Marca/desmarca un día de descanso (migración 051): guarda la lista completa. */
    async function toggleDiaCerrado(dia: string) {
        const previo = diasCerrados
        const nuevos = previo.includes(dia) ? previo.filter(d => d !== dia) : sortedDias([...previo, dia])
        setDiasCerrados(nuevos)
        setGuardandoDias(true)
        try {
            await actualizar({ dias_cerrados: nuevos })
            mostrarMsg(true, nuevos.length ? "✅ Días de descanso actualizados" : "✅ Negocio abierto los 7 días")
        } catch (err: unknown) {
            setDiasCerrados(previo)
            mostrarMsg(false, `❌ ${err instanceof Error ? err.message : "Error"}`)
        } finally {
            setGuardandoDias(false)
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
        zonaHorario,
        setZonaHorario,
        guardandoZona,
        gastoComision,
        toggleGastoComision,
        diasCerrados,
        toggleDiaCerrado,
        guardandoDias,
        subiendoLogo,
        descargando,
        inputFileRef,
        // Recorte circular del logo
        logoCrop,
        handleLogoCropComplete,
        cancelarLogoCrop,
        // Datos de contacto (migración 043)
        contacto,
        setContactoCampo,
        // Handlers
        handleLogout,
        handleDescargarJson,
        handleDescargarXlsx,
        handleLogoFile,
        cambiarModoPrecio,
        guardarZonaHoraria,
        guardarCambios,
    }
}
