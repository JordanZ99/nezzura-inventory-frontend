// ==============================================================================
// src/hooks/useTurnos.ts
// Turnos de caja (Fase C): consulta del historial + acciones abrir/cerrar con
// arqueo. El cierre devuelve esperado/contado/diferencia para mostrar el
// resultado al cajero.
// ==============================================================================

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type Turno } from "@/lib/api"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"

export function useTurnos() {
    const { tenant } = useTenant()
    const { mostrarMsg } = useToast()
    const queryClient = useQueryClient()
    const tenantId = tenant?.tenant_id

    const turnosQuery = useQuery({
        queryKey: tenantId ? ["turnos", tenantId] : ["turnos", "sin-tenant"],
        queryFn: () => api.getTurnos(),
        enabled: Boolean(tenantId),
    })

    const turnoAbierto: Turno | null = turnosQuery.data?.find(t => t.estado === "Abierto") ?? null
    const historial: Turno[] = turnosQuery.data?.filter(t => t.estado === "Cerrado") ?? []

    function invalidar() {
        if (tenantId) queryClient.invalidateQueries({ queryKey: ["turnos", tenantId] })
    }

    async function abrir(montoApertura: number): Promise<boolean> {
        try {
            await api.abrirTurno(montoApertura)
            mostrarMsg(true, "✅ Turno abierto")
            invalidar()
            return true
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
            return false
        }
    }

    async function cerrar(turnoId: string, efectivoContado: number, notas?: string) {
        try {
            const r = await api.cerrarTurno(turnoId, efectivoContado, notas)
            const signo = r.diferencia === 0 ? "cuadrado ✓" : r.diferencia > 0 ? `sobrante +$${r.diferencia.toFixed(2)}` : `faltante -$${Math.abs(r.diferencia).toFixed(2)}`
            mostrarMsg(true, `Turno cerrado — esperado $${r.efectivo_esperado.toFixed(2)}, contado $${r.efectivo_contado.toFixed(2)} (${signo})`)
            invalidar()
            return r
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
            return null
        }
    }

    return { turnoAbierto, historial, cargando: turnosQuery.isPending, abrir, cerrar }
}
