// ==============================================================================
// src/hooks/useOrdenes.ts
// Dominio de datos de Órdenes de servicio (giro 'servicios', mig 077).
// Patrón useCobros/usePlanes: react-query con clave propia + invalidación.
// Solo-nube (igual que Cobros).
// ==============================================================================

import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { ordenesApi, type OrdenPayload, type OrdenEditarPayload } from "@/lib/api/ordenes"
import type { EstadoOrden } from "@/types"

/** Clave base de todas las queries del dominio (invalidación por bloque). */
export function claveOrdenes(tenantId: string | undefined) {
    return ["ordenes", tenantId ?? "sin-tenant"] as const
}

export function useOrdenes(params: { estado?: EstadoOrden; solo_abiertas?: boolean } = {}) {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const q = useQuery({
        queryKey: [...claveOrdenes(tenantId), "lista", params],
        queryFn: () => ordenesApi.listar(params),
        enabled: Boolean(tenantId),
    })
    const ordenes = q.data ?? []
    return { ordenes, cargando: q.isPending, error: q.error }
}

/**
 * Acciones de Órdenes: wrappers de mutación que refrescan el dominio al
 * terminar. Cada acción lanza el error — la UI decide el toast (patrón useCobros).
 */
export function useAccionesOrdenes() {
    const queryClient = useQueryClient()
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id

    const refrescar = useCallback(
        () => queryClient.invalidateQueries({ queryKey: claveOrdenes(tenantId) }),
        [queryClient, tenantId]
    )

    const crear = useMutation({
        mutationFn: (data: OrdenPayload) => ordenesApi.crear(data),
        onSuccess: () => refrescar(),
    })

    const actualizar = useMutation({
        mutationFn: ({ id, data }: { id: string; data: OrdenEditarPayload }) => ordenesApi.actualizar(id, data),
        onSuccess: () => refrescar(),
    })

    const eliminar = useMutation({
        mutationFn: (id: string) => ordenesApi.eliminar(id),
        onSuccess: () => refrescar(),
    })

    return {
        crear: crear.mutateAsync,
        actualizar: actualizar.mutateAsync,
        eliminar: eliminar.mutateAsync,
    }
}
