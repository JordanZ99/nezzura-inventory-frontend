// ==============================================================================
// src/hooks/useGastosDatos.ts
// Dominio "Datos" de Gastos: carga de movimientos (getGastos), recargar() y el
// flag responsivo esMobile (matchMedia 767px, mobile-first).
// ==============================================================================

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { inventarioQueryKeys, obtenerGastos } from "@/lib/inventarioQueries"

export function useGastosDatos() {
    const { tenant } = useTenant()
    const queryClient = useQueryClient()
    const tenantId = tenant?.tenant_id
    const gastosQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.gastos(tenantId) : ["gastos", "sin-tenant"],
        queryFn: obtenerGastos,
        enabled: Boolean(tenantId),
    })
    const gastos = gastosQuery.data ?? []
    const cargando = gastosQuery.isPending
    const [esMobile, setEsMobile] = useState(true) // mobile-first para evitar flash de contenido

    useEffect(() => {
        // Detectar si es mobile para el colapsable de categorías
        const mql = window.matchMedia('(max-width: 767px)')
        setEsMobile(mql.matches)
        const handler = (e: MediaQueryListEvent) => setEsMobile(e.matches)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [])

    async function recargar() {
        if (!tenantId) return
        await queryClient.invalidateQueries({
            queryKey: inventarioQueryKeys.gastos(tenantId),
            refetchType: "active",
        })
    }

    return {
        gastos,
        cargando,
        recargar,
        esMobile,
    }
}
