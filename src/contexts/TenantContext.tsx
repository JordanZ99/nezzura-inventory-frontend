"use client"
// ==============================================================================
// src/contexts/TenantContext.tsx
// Contexto global con logo y nombre del negocio leídos desde Supabase tenants.
// ==============================================================================

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { api } from "@/lib/api"

interface TenantInfo {
    tenant_id: string
    empresa: string
    logo: string
    plan: string  // "basico" | "plus" — controla features como galería de imágenes
    zona_horaria: string  // IANA (ej. "America/Cancun") — día contable del negocio
    metodo_pago_default: string  // método con el que el POS preselecciona el cobro
    gasto_comision_automatico: boolean  // registra comisiones de terminal como gasto al cobrar
}

interface TenantContextValue {
    tenant: TenantInfo | null
    cargando: boolean
    actualizar: (data: Partial<Pick<TenantInfo, "empresa" | "logo" | "zona_horaria" | "metodo_pago_default" | "gasto_comision_automatico">>) => Promise<void>
}

const ZONA_DEFAULT = "America/Cancun"

const TenantContext = createContext<TenantContextValue>({
    tenant: null,
    cargando: true,
    actualizar: async () => {},
})

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const [tenant, setTenant] = useState<TenantInfo | null>(null)
    const [cargando, setCargando] = useState(true)

    async function cargar() {
        try {
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData.session?.user) { setCargando(false); return }

            // Obtener el tenant_id desde el backend (FastAPI)
            const perfil = await api.getPerfil()
            if (!perfil?.tenant_id) { setCargando(false); return }

            // Leer empresa, logo y plan desde la tabla tenants de Supabase usando el 'id' (UserID)
            const { data, error } = await supabase
                .from("tenants")
                .select("id, empresa, logo, plan")
                .eq("id", perfil.tenant_id)
                .single()

            const mapaTenant = (id: string) => ({
                tenant_id: id,
                empresa: data?.empresa || "",
                logo: data?.logo || "",
                plan: data?.plan || "basico",
                zona_horaria: perfil.zona_horaria || ZONA_DEFAULT,
                metodo_pago_default: perfil.metodo_pago_default || "efectivo",
                gasto_comision_automatico: perfil.gasto_comision_automatico ?? false,
            })
            if (!error && data) {
                setTenant(mapaTenant(data.id))
            } else {
                // Si no tiene fila aún, guardamos solo el tenant_id
                setTenant(mapaTenant(perfil.tenant_id))
            }
        } catch (e) {
            console.error("Error cargando tenant:", e)
        } finally {
            setCargando(false)
        }
    }

    useEffect(() => {
        cargar()

        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_IN") cargar()
            if (event === "SIGNED_OUT") { setTenant(null); setCargando(false) }
        })

        return () => listener.subscription.unsubscribe()
    }, [])

    const actualizar = useCallback(async (data: Partial<Pick<TenantInfo, "empresa" | "logo" | "zona_horaria" | "metodo_pago_default" | "gasto_comision_automatico">>) => {
        if (!tenant?.tenant_id) throw new Error("No hay tenant activo")

        // La zona horaria y el gasto de comisiones viven en el backend (afectan
        // cómo se registran ventas/gastos); el resto va directo a Supabase.
        if (data.zona_horaria !== undefined) {
            const r = await api.actualizarZonaHoraria(data.zona_horaria)
            data = { ...data, zona_horaria: r.zona_horaria || data.zona_horaria }
        }
        if (data.gasto_comision_automatico !== undefined) {
            const r = await api.actualizarGastoComision(data.gasto_comision_automatico)
            data = { ...data, gasto_comision_automatico: r.gasto_comision_automatico }
        }
        const { zona_horaria: _zona, gasto_comision_automatico: _gasto, ...datosSupabase } = data
        if (Object.keys(datosSupabase).length > 0) {
            const { error } = await supabase
                .from("tenants")
                .update(datosSupabase)
                .eq("id", tenant.tenant_id)
            if (error) throw new Error(error.message)
        }

        // Actualizar el estado local inmediatamente (optimistic update)
        setTenant(prev => prev ? { ...prev, ...data } : null)
    }, [tenant?.tenant_id])

    return (
        <TenantContext.Provider value={{ tenant, cargando, actualizar }}>
            {children}
        </TenantContext.Provider>
    )
}

export function useTenant() {
    return useContext(TenantContext)
}
