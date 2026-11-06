// ==============================================================================
// src/hooks/useActividad.ts
// Datos del Historial completo (migración 062): query paginada con filtros
// (dominio, texto y ventana de fechas). Lectura pura — no hay mutaciones.
// Solo-nube, como cobros.
// ==============================================================================

import { useQuery } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { actividadApi, type ActividadFiltros } from "@/lib/api/actividad"
import type { EventoActividad } from "@/types"

/** Clave base del dominio (invalidaciones futuras por bloque). */
export function claveActividad(tenantId: string | undefined) {
    return ["actividad", tenantId ?? "sin-tenant"] as const
}

/**
 * Hoy (-90 días) en 'YYYY-MM-DD'. Default de la ventana: mirar 3 meses atrás
 * es el 90% del uso; navegar más atrás queda un click en el selector.
 */
export function fechaHace90Dias(): string {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function useActividad(params: ActividadFiltros & { pagina: number }) {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const POR_PAGINA = params.limit ?? 50
    const q = useQuery({
        queryKey: [...claveActividad(tenantId), "feed", { ...params, limit: POR_PAGINA }],
        queryFn: () =>
            actividadApi.listar({
                ...params,
                limit: POR_PAGINA,
                offset: (params.pagina - 1) * POR_PAGINA,
            }),
        enabled: Boolean(tenantId),
    })
    const eventos: EventoActividad[] = q.data?.eventos ?? []
    return {
        eventos,
        total: q.data?.total ?? 0,
        limit: q.data?.limit ?? POR_PAGINA,
        cargando: q.isPending,
        error: q.error,
    }
}
