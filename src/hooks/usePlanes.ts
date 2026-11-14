// ==============================================================================
// src/hooks/usePlanes.ts
// Dominio de datos de "Mis cuentas" (giro 'servicios', mig 075): registro
// MANUAL de planes del gestor por cliente. Patrón useCobros: react-query con
// clave propia + invalidación por bloque. Solo-nube (igual que Cobros).
// ==============================================================================

import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { planesApi, type PlanPayload, type PlanEditarPayload } from "@/lib/api/planes"
import type { EstadoCobroPlan } from "@/types"

/** Clave base de todas las queries del dominio (invalidación por bloque). */
export function clavePlanes(tenantId: string | undefined) {
    return ["planes", tenantId ?? "sin-tenant"] as const
}

export function usePlanes(estado?: EstadoCobroPlan) {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const q = useQuery({
        queryKey: [...clavePlanes(tenantId), "lista", estado ?? "todos"],
        queryFn: () => planesApi.listar(estado),
        enabled: Boolean(tenantId),
    })
    const planes = q.data ?? []
    return { planes, cargando: q.isPending, error: q.error }
}

/**
 * Acciones de Mis cuentas: wrappers de mutación que refrescan el dominio al
 * terminar. Cada acción lanza el error — la UI decide el toast (patrón useCobros).
 */
export function useAccionesPlanes() {
    const queryClient = useQueryClient()
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id

    const refrescar = useCallback(
        () => queryClient.invalidateQueries({ queryKey: clavePlanes(tenantId) }),
        [queryClient, tenantId]
    )

    const crear = useMutation({
        mutationFn: (data: PlanPayload) => planesApi.crear(data),
        onSuccess: () => refrescar(),
    })

    const actualizar = useMutation({
        mutationFn: ({ id, data }: { id: string; data: PlanEditarPayload }) => planesApi.actualizar(id, data),
        onSuccess: () => refrescar(),
    })

    const eliminar = useMutation({
        mutationFn: (id: string) => planesApi.eliminar(id),
        onSuccess: () => refrescar(),
    })

    return {
        crear: crear.mutateAsync,
        actualizar: actualizar.mutateAsync,
        eliminar: eliminar.mutateAsync,
    }
}
