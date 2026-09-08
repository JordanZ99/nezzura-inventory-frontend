"use client"
// ==============================================================================
// src/contexts/TenantContext.tsx
// Contexto global con logo y nombre del negocio leídos desde Supabase tenants.
// También carga (y enruta) la config del negocio vía el backend FastAPI:
// zona horaria, método de pago por defecto, comisiones y la cartera de
// clientes + sistema de puntos (migraciones 038/039, doc sistemaPuntos.md).
// ==============================================================================

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { api } from "@/lib/api"
import type { ClienteCampos, ModoPuntos } from "@/types"

interface TenantInfo {
    tenant_id: string
    empresa: string
    logo: string
    plan: string  // "basico" | "plus" — controla features como galería de imágenes
    zona_horaria: string  // IANA (ej. "America/Cancun") — día contable del negocio
    metodo_pago_default: string  // método con el que el POS preselecciona el cobro
    gasto_comision_automatico: boolean  // registra comisiones de terminal como gasto al cobrar
    giro: string  // 'tienda' | 'restaurante' — preset de módulos del negocio (migración 035)
    modulos: Record<string, boolean> | null  // override de módulos; null = preset del giro
    // ── Cartera de clientes (migración 038) ──
    clientes_activos: boolean
    cliente_campos: ClienteCampos
    // ── Sistema de puntos (migración 039) ──
    puntos_activos: boolean
    puntos_valor_punto: number  // $ que vale 1 punto al canjear (1 = "1 pt = $1")
    puntos_modo: ModoPuntos  // 'por_gasto' | 'fijo'
    puntos_gasto_monto: number  // Y en "X puntos por cada $Y"
    puntos_gasto_pts: number    // X en "X puntos por cada $Y"
    puntos_fijos: number | null // puntos fijos por venta (modo 'fijo')
}

interface TenantContextValue {
    tenant: TenantInfo | null
    cargando: boolean
    actualizar: (data: Partial<ActualizarTenant>) => Promise<void>
}

/** Campos que se pueden actualizar; los de backend viajan por PATCH /inventario/me. */
export interface ActualizarTenant {
    empresa?: string
    logo?: string
    zona_horaria?: string
    metodo_pago_default?: string
    gasto_comision_automatico?: boolean
    clientes_activos?: boolean
    cliente_campos?: ClienteCampos
    puntos_activos?: boolean
    puntos_valor_punto?: number
    puntos_modo?: ModoPuntos
    puntos_gasto_monto?: number
    puntos_gasto_pts?: number
    puntos_fijos?: number | null
}

// Claves de TenantInfo que viven en el backend (NO se mandan directo a Supabase).
const CLAVES_API: (keyof ActualizarTenant)[] = [
    "zona_horaria", "gasto_comision_automatico",
    "clientes_activos", "cliente_campos",
    "puntos_activos", "puntos_valor_punto", "puntos_modo",
    "puntos_gasto_monto", "puntos_gasto_pts", "puntos_fijos",
]

const ZONA_DEFAULT = "America/Cancun"

const CAMPOS_DEFAULT: ClienteCampos = {
    email: { activo: true, requerido: true },
    telefono: { activo: true, requerido: true },
    pin: { activo: false, requerido: false },
}
/** Defaults del formulario de cliente (se exportan para el POS y otras UI). */
export const CAMPOS_CLIENTE_DEFAULT = CAMPOS_DEFAULT

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

            // Leer empresa, logo, plan y giro desde la tabla tenants de Supabase usando el 'id' (UserID)
            const { data, error } = await supabase
                .from("tenants")
                .select("id, empresa, logo, plan, giro, modulos")
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
                // Giro del negocio (migración 035): si la fila aún no tiene la
                // columna poblada, 'tienda' = comportamiento actual.
                giro: data?.giro || "tienda",
                modulos: (data?.modulos as Record<string, boolean> | null) ?? null,
                // Cartera de clientes + puntos (migraciones 038/039) — config del backend
                clientes_activos: perfil.clientes_activos ?? false,
                cliente_campos: perfil.cliente_campos ?? CAMPOS_DEFAULT,
                puntos_activos: perfil.puntos_activos ?? false,
                puntos_valor_punto: perfil.puntos_valor_punto ?? 1,
                puntos_modo: (perfil.puntos_modo as ModoPuntos) || "por_gasto",
                puntos_gasto_monto: perfil.puntos_gasto_monto ?? 10,
                puntos_gasto_pts: perfil.puntos_gasto_pts ?? 1,
                puntos_fijos: perfil.puntos_fijos ?? null,
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

    const actualizar = useCallback(async (data: Partial<ActualizarTenant>) => {
        if (!tenant?.tenant_id) throw new Error("No hay tenant activo")
        data = { ...data }

        // La config del negocio viaja por el backend (afecta cómo se registran
        // ventas/gastos/cobros con puntos); solo empresa/logo van directo a Supabase.
        const datosApi: Record<string, unknown> = {}
        for (const clave of CLAVES_API) {
            if ((data as Record<string, unknown>)[clave] !== undefined) {
                datosApi[clave] = (data as Record<string, unknown>)[clave]
            }
        }
        if (Object.keys(datosApi).length > 0) {
            const r = await api.actualizarPerfilNegocio(datosApi)
            // Adoptar los valores canonizados por el backend (validaciones/normalización)
            for (const clave of CLAVES_API) {
                if (r[clave] !== undefined) (data as Record<string, unknown>)[clave] = r[clave]
            }
        }

        const datosSupabase: Record<string, unknown> = {}
        for (const [clave, valor] of Object.entries(data)) {
            if (!CLAVES_API.includes(clave as keyof ActualizarTenant)) datosSupabase[clave] = valor
        }
        if (Object.keys(datosSupabase).length > 0) {
            const { error } = await supabase
                .from("tenants")
                .update(datosSupabase)
                .eq("id", tenant.tenant_id)
            if (error) throw new Error(error.message)
        }

        // Actualizar el estado local inmediatamente (optimistic update)
        setTenant(prev => prev ? { ...prev, ...data } as TenantInfo : null)
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
