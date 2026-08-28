// ==============================================================================
// src/hooks/usePosDatos.ts
// Dominio "Datos" del Punto de Venta: carga inicial de inventario (con retry
// de initDB si las tablas no existen), lotes, relación global de las fotos
// (config del catálogo). El tenant y la validación del JWT provienen de
// TenantProvider, por lo que no se repite esa petición aquí.
// Recargar() refresca inventario + lotes tras una venta; lo usa
// usePosCarrito.cobrar vía props (patrón useInventarioForm).
// ==============================================================================

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { inventarioQueryKeys, obtenerConfigCatalogo, obtenerInventario, obtenerLotes, obtenerTerminales } from "@/lib/inventarioQueries"

export function usePosDatos() {
    const { tenant } = useTenant()
    const queryClient = useQueryClient()
    const tenantId = tenant?.tenant_id

    const productosQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.productos(tenantId) : ["inventario", "sin-tenant"],
        queryFn: obtenerInventario,
        enabled: Boolean(tenantId),
    })
    const lotesQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.lotes(tenantId) : ["lotes", "sin-tenant"],
        queryFn: obtenerLotes,
        enabled: Boolean(tenantId),
    })
    const configQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.configCatalogo(tenantId) : ["config-catalogo", "sin-tenant"],
        queryFn: obtenerConfigCatalogo,
        enabled: Boolean(tenantId),
    })
    const terminalesQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.terminales(tenantId) : ["terminales", "sin-tenant"],
        queryFn: obtenerTerminales,
        enabled: Boolean(tenantId),
    })

    const productos = productosQuery.data ?? []
    const lotes = lotesQuery.data ?? []
    const terminales = (terminalesQuery.data ?? []).filter(t => t.activo)
    const relacionImagen = configQuery.data?.relacion_imagen === "4:5" ? "4 / 5" : "1"
    const userId = tenantId || (tenant ? "Sesión Inválida" : "Cargando...")
    const cargando = productosQuery.isPending

    /** Refresca inventario + lotes tras una venta (lo invoca usePosCarrito.cobrar).
     * También invalida ventas/órdenes: con el cache global de 2 minutos, sin esto
     * el nuevo ticket tardaría hasta 2 minutos en verse en Estadísticas. */
    async function recargar() {
        if (!tenantId) return
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: inventarioQueryKeys.productos(tenantId),
                refetchType: "active",
            }),
            queryClient.invalidateQueries({
                queryKey: inventarioQueryKeys.lotes(tenantId),
                refetchType: "active",
            }),
            queryClient.invalidateQueries({
                queryKey: inventarioQueryKeys.ventas(tenantId),
                refetchType: "active",
            }),
            queryClient.invalidateQueries({
                queryKey: inventarioQueryKeys.ordenes(tenantId),
                refetchType: "active",
            }),
        ])
    }

    return {
        productos,
        lotes,
        terminales,
        cargando,
        relacionImagen,
        userId,
        recargar,
    }
}
