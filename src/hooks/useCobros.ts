// ==============================================================================
// src/hooks/useCobros.ts
// Dominio de datos de Cobros (giro 'servicios'): lista, resumen (aging),
// cuotas y acciones (generar mes, altas/edición, abonos). Patrón
// useGastosDatos: react-query con clave por tenant + invalidación por grupo.
//
// Solo-nube: el giro 'servicios' no tiene puerto Modo Local (Dexie), la UI
// avisa si se entra sin nube.
// ==============================================================================

import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { cobrosApi, type AbonoPayload, type CobroEditarPayload, type CobroExtraPayload, type CuotaEditarPayload, type CuotaPayload } from "@/lib/api/cobros"
import type { Cobro, CuotaCliente, ResumenCobros } from "@/types"

/** Clave base de todas las queries del dominio (invalidación por bloque). */
export function claveCobros(tenantId: string | undefined) {
    return ["cobros", tenantId ?? "sin-tenant"] as const
}

/** Mes en curso en formato 'YYYY-MM' (default de los selectores). */
export function periodoActual(): string {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
}

export function useCobrosLista(params: { periodo?: string; cliente_id?: string; solo_pendientes?: boolean } = {}) {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const q = useQuery({
        queryKey: [...claveCobros(tenantId), "lista", params],
        queryFn: () => cobrosApi.listar(params),
        enabled: Boolean(tenantId),
    })
    const cobros: Cobro[] = q.data ?? []
    return { cobros, cargando: q.isPending, error: q.error }
}

export function useResumenCobros(periodo?: string) {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const q = useQuery({
        queryKey: [...claveCobros(tenantId), "resumen", periodo ?? "actual"],
        queryFn: () => cobrosApi.getResumen(periodo),
        enabled: Boolean(tenantId),
    })
    const resumen: ResumenCobros | undefined = q.data
    return { resumen, cargando: q.isPending, error: q.error }
}

export function useCuotas(soloActivas = false) {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const q = useQuery({
        queryKey: [...claveCobros(tenantId), "cuotas", { soloActivas }],
        queryFn: () => cobrosApi.getCuotas(soloActivas),
        enabled: Boolean(tenantId),
    })
    const cuotas: CuotaCliente[] = q.data ?? []
    return { cuotas, cargando: q.isPending, error: q.error }
}

/**
 * Acciones de Cobros: wrappers de mutación que refrescan el dominio al
 * terminar. Cada acción ya muestra el error a la llamada (throw) — la UI
 * decide el toast.
 */
export function useAccionesCobros() {
    const queryClient = useQueryClient()
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id

    const refrescar = useCallback(
        () => queryClient.invalidateQueries({ queryKey: claveCobros(tenantId) }),
        [queryClient, tenantId]
    )

    /** Genera cobros de un periodo desde las cuotas activas (idempotente). */
    const generar = useMutation({
        mutationFn: (periodo: string) => cobrosApi.generar(periodo),
        onSuccess: () => refrescar(),
    })

    const crearExtra = useMutation({
        mutationFn: (data: CobroExtraPayload) => cobrosApi.crearExtra(data),
        onSuccess: () => refrescar(),
    })

    const actualizarCobro = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CobroEditarPayload }) => cobrosApi.actualizarCobro(id, data),
        onSuccess: () => refrescar(),
    })

    const eliminarCobro = useMutation({
        mutationFn: (id: string) => cobrosApi.eliminarCobro(id),
        onSuccess: () => refrescar(),
    })

    const abonar = useMutation({
        mutationFn: ({ id, data }: { id: string; data: AbonoPayload }) => cobrosApi.abonar(id, data),
        onSuccess: () => refrescar(),
    })

    const quitarAbono = useMutation({
        mutationFn: ({ id, indice }: { id: string; indice: number }) => cobrosApi.quitarAbono(id, indice),
        onSuccess: () => refrescar(),
    })

    const crearCuota = useMutation({
        mutationFn: (data: CuotaPayload) => cobrosApi.crearCuota(data),
        onSuccess: () => refrescar(),
    })

    const actualizarCuota = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CuotaEditarPayload }) => cobrosApi.actualizarCuota(id, data),
        onSuccess: () => refrescar(),
    })

    const eliminarCuota = useMutation({
        mutationFn: (id: string) => cobrosApi.eliminarCuota(id),
        onSuccess: () => refrescar(),
    })

    return {
        generar: generar.mutateAsync,
        crearExtra: crearExtra.mutateAsync,
        actualizarCobro: actualizarCobro.mutateAsync,
        eliminarCobro: eliminarCobro.mutateAsync,
        abonar: abonar.mutateAsync,
        quitarAbono: quitarAbono.mutateAsync,
        crearCuota: crearCuota.mutateAsync,
        actualizarCuota: actualizarCuota.mutateAsync,
        eliminarCuota: eliminarCuota.mutateAsync,
    }
}
