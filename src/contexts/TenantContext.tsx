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
}

interface TenantContextValue {
    tenant: TenantInfo | null
    cargando: boolean
    actualizar: (data: Partial<Pick<TenantInfo, "empresa" | "logo">>) => Promise<void>
}

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

            // Leer empresa y logo desde la tabla tenants de Supabase
            const { data, error } = await supabase
                .from("tenants")
                .select("tenant_id, empresa, logo")
                .eq("tenant_id", perfil.tenant_id)
                .single()

            if (!error && data) {
                setTenant(data)
            } else {
                // Si no tiene fila aún, guardamos solo el tenant_id
                setTenant({ tenant_id: perfil.tenant_id, empresa: "", logo: "" })
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

    const actualizar = useCallback(async (data: Partial<Pick<TenantInfo, "empresa" | "logo">>) => {
        if (!tenant?.tenant_id) throw new Error("No hay tenant activo")

        const { error } = await supabase
            .from("tenants")
            .update(data)
            .eq("tenant_id", tenant.tenant_id)

        if (error) throw new Error(error.message)

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
