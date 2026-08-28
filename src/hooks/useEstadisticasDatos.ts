// ==============================================================================
// src/hooks/useEstadisticasDatos.ts
// Dominio "Datos" de Estadísticas: carga inicial (ventas + gastos + inventario
// en Promise.all), recargar(), relación global de las fotos (config del
// catálogo) y el flag responsivo isMobile (matchMedia 899px).
// ==============================================================================

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { inventarioQueryKeys, obtenerConfigCatalogo, obtenerGastos, obtenerInventario, obtenerOrdenes, obtenerVentas } from "@/lib/inventarioQueries"

export function useEstadisticasDatos() {
    const { tenant } = useTenant()
    const queryClient = useQueryClient()
    const tenantId = tenant?.tenant_id
    const ventasQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.ventas(tenantId) : ["ventas", "sin-tenant"],
        queryFn: obtenerVentas,
        enabled: Boolean(tenantId),
    })
    const ordenesQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.ordenes(tenantId) : ["ordenes", "sin-tenant"],
        queryFn: obtenerOrdenes,
        enabled: Boolean(tenantId),
    })
    const gastosQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.gastos(tenantId) : ["gastos", "sin-tenant"],
        queryFn: obtenerGastos,
        enabled: Boolean(tenantId),
    })
    const productosQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.productos(tenantId) : ["inventario", "sin-tenant"],
        queryFn: obtenerInventario,
        enabled: Boolean(tenantId),
    })
    const configQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.configCatalogo(tenantId) : ["config-catalogo", "sin-tenant"],
        queryFn: obtenerConfigCatalogo,
        enabled: Boolean(tenantId),
    })
    const ventas = ventasQuery.data ?? []
    const ordenes = ordenesQuery.data ?? []
    const gastos = gastosQuery.data ?? []
    const productos = productosQuery.data ?? []
    const relacionImagen = configQuery.data?.relacion_imagen === "4:5" ? "4 / 5" : "1"
    const cargando = ventasQuery.isPending || gastosQuery.isPending || productosQuery.isPending
    // Responsive
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 899px)")
        setIsMobile(mq.matches)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    async function recargar() {
        if (!tenantId) return
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.ventas(tenantId), refetchType: "active" }),
            queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.ordenes(tenantId), refetchType: "active" }),
            queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.gastos(tenantId), refetchType: "active" }),
            queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.productos(tenantId), refetchType: "active" }),
            queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.lotes(tenantId), refetchType: "active" }),
        ])
    }

    return {
        ventas,
        ordenes,
        gastos,
        productos,
        cargando,
        recargar,
        relacionImagen,
        isMobile,
    }
}
