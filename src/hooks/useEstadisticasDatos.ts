// ==============================================================================
// src/hooks/useEstadisticasDatos.ts
// Dominio "Datos base" de Estadísticas: catálogo de productos (metadatos para
// las tarjetas), config del catálogo y el flag responsivo isMobile.
// Las MÉTRICAS (resumen/serie/productos/historial) viven en
// useEstadisticasRango — la BDD calcula y aquí solo llega el catálogo.
// ==============================================================================

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { inventarioQueryKeys, obtenerConfigCatalogo, obtenerInventario } from "@/lib/inventarioQueries"

export function useEstadisticasDatos() {
    const { tenant } = useTenant()
    const queryClient = useQueryClient()
    const tenantId = tenant?.tenant_id

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

    const productos = productosQuery.data ?? []
    const relacionImagen = configQuery.data?.relacion_imagen === "4:5" ? "4 / 5" : "1"

    // Responsive
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 899px)")
        setIsMobile(mq.matches)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    /**
     * Refresca tras editar/anular ventas o tickets. Invalida por PREFIJO de
     * clave: cualquier rango/página cacheada de las métricas se refresca.
     * Anular una venta restaura stock → productos/lotes también se marcan.
     */
    async function recargar() {
        if (!tenantId) return
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["stats-resumen"] }),
            queryClient.invalidateQueries({ queryKey: ["stats-serie"] }),
            queryClient.invalidateQueries({ queryKey: ["stats-productos"] }),
            queryClient.invalidateQueries({ queryKey: ["stats-venta-producto"] }),
            queryClient.invalidateQueries({ queryKey: ["ordenes-pag"] }),
            queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.productos(tenantId) }),
            queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.lotes(tenantId) }),
        ])
    }

    return {
        productos,
        cargando: productosQuery.isPending,
        recargar,
        relacionImagen,
        isMobile,
    }
}
