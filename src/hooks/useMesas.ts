// ==============================================================================
// src/hooks/useMesas.ts
// Dominio "Mesas" del POS restaurante (Fase 2): parrilla con órdenes abiertas,
// CRUD de mesas, agregar/quitar renglones, pedir cuenta, cancelar orden y
// preparación del cobro (convierte los renglones abiertos en carrito vía
// posCarrito.iniciarCobroMesa — el cobro real lo maneja el flujo existente).
// ==============================================================================

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type Mesa, type ItemCarrito } from "@/lib/api"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"

export function useMesas() {
    const { tenant } = useTenant()
    const { mostrarMsg } = useToast()
    const queryClient = useQueryClient()
    const tenantId = tenant?.tenant_id

    const mesasQuery = useQuery({
        queryKey: tenantId ? ["mesas", tenantId] : ["mesas", "sin-tenant"],
        queryFn: () => api.getMesas(),
        enabled: Boolean(tenantId),
    })

    const mesas = mesasQuery.data ?? []
    // Mesa abierta en el panel de detalle (null = parrilla)
    const [mesaId, setMesaId] = useState<string | null>(null)
    const mesa = mesas.find(m => m.id === mesaId) ?? null

    function invalidar() {
        if (tenantId) queryClient.invalidateQueries({ queryKey: ["mesas", tenantId] })
    }

    async function crear(nombre: string, capacidad: number | null) {
        try {
            await api.crearMesa({ nombre, capacidad })
            mostrarMsg(true, `Mesa "${nombre}" creada`)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function actualizar(mesaId: string, nombre: string, capacidad: number | null) {
        try {
            await api.actualizarMesa(mesaId, { nombre, capacidad })
            mostrarMsg(true, "Mesa actualizada")
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function eliminar(mesaAEliminar: string) {
        try {
            await api.eliminarMesa(mesaAEliminar)
            mostrarMsg(true, "Mesa eliminada")
            if (mesaId === mesaAEliminar) setMesaId(null)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function reordenar(ordenNuevo: { id: string; orden: number }[]) {
        try {
            await api.reordenarMesas(ordenNuevo)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function agregarItems(mesaDestino: string, items: {
        producto: string
        cantidad: number
        precio_unitario: number
        descripcion?: string
        variacion?: string
        costo?: number
        notas?: string
    }[]) {
        try {
            await api.agregarItems(mesaDestino, items)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function quitarItem(mesaDestino: string, itemId: string) {
        try {
            await api.quitarItem(mesaDestino, itemId)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function pedirCuenta(mesaDestino: string) {
        try {
            await api.pedirCuenta(mesaDestino)
            mostrarMsg(true, "Cuenta pedida")
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function regresarAOcupada(mesaDestino: string) {
        try {
            await api.regresarAOcupada(mesaDestino)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    async function cancelarOrden(mesaDestino: string) {
        try {
            const r = await api.cancelarOrden(mesaDestino)
            mostrarMsg(true, `Orden cancelada (${r.cancelados} renglón/ones)`)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`)
        }
    }

    /** Convierte la orden abierta en carrito y abre el panel de cobro EXISTENTE. */
    function prepararCobro(mesaACobrar: Mesa): ItemCarrito[] {
        return (mesaACobrar.items || []).map(it => ({
            producto: it.producto,
            cantidad: Number(it.cantidad),
            precio_real: Number(it.precio_unitario),
            ...(it.variacion ? { variacion: it.variacion } : {}),
            ...(it.descripcion ? { descripcion: it.descripcion } : {}),
            ...(it.costo != null ? { costo: Number(it.costo) } : {}),
        }))
    }

    return {
        mesas,
        cargando: mesasQuery.isPending,
        mesa,
        mesaId,
        setMesaId,
        recargar: invalidar,
        crear,
        actualizar,
        eliminar,
        reordenar,
        agregarItems,
        quitarItem,
        pedirCuenta,
        regresarAOcupada,
        cancelarOrden,
        prepararCobro,
    }
}
