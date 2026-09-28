// ==============================================================================
// src/hooks/useInventarioData.ts
// Custom hook: estado y carga de datos del módulo Inventario.
// - Lotes, inventario (productos), categorías y relación global de fotos.
// - Peticiones a la API (recargar, cargarCategorias) con retry de initDB.
// - Derivados: KPIs de la cabecera y categorías existentes (usados por la UI).
// ==============================================================================

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { inventarioQueryKeys, obtenerCategorias, obtenerConfigCatalogo, obtenerInventario, obtenerLotes } from "@/lib/inventarioQueries"
import type { Producto } from "@/lib/api"

export function useInventarioData() {
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
    const categoriasQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.categorias(tenantId) : ["categorias", "sin-tenant"],
        queryFn: obtenerCategorias,
        enabled: Boolean(tenantId),
        staleTime: 5 * 60 * 1000,
    })
    const configQuery = useQuery({
        queryKey: tenantId ? inventarioQueryKeys.configCatalogo(tenantId) : ["config-catalogo", "sin-tenant"],
        queryFn: obtenerConfigCatalogo,
        enabled: Boolean(tenantId),
    })

    const lotes = lotesQuery.data ?? []
    const inv = productosQuery.data ?? []
    const categorias = categoriasQuery.data ?? []
    const relacionImagen = configQuery.data?.relacion_imagen === "4:5" ? "4 / 5" : "1"

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
        ])
    }

    /**
     * Carga la lista de categorías desde la API
     * (tabla 'categorias' con conteo de productos asociados)
     */
    async function cargarCategorias() {
        if (!tenantId) return
        await queryClient.invalidateQueries({
            queryKey: inventarioQueryKeys.categorias(tenantId),
            refetchType: "active",
        })
    }

    // Permite al hook de formularios actualizar el inventario en memoria
    // (ej. al cambiar la foto de una variación, para reflejarla en el grid).
    const actualizarInv = useCallback((fn: (prev: Producto[]) => Producto[]) => {
        if (!tenantId) return
        queryClient.setQueryData<Producto[]>(inventarioQueryKeys.productos(tenantId), prev => fn(prev ?? []))
    }, [queryClient, tenantId])

    // ── Derivados: KPIs de la cabecera ──
    const totalActivos = inv.filter(p => p.stock_total > 0).length
    const valorInv = inv.reduce((a, p) => a + p.stock_total * p.precio_venta, 0)
    const ganPotencial = inv.reduce((a, p) => a + p.stock_total * (p.precio_venta - p.costo_promedio), 0)
    const stockDesc = inv.filter(p => p.stock_total <= 0).length
    // Categorías disponibles: combina las que están en uso por productos + las de la tabla 'categorias'
    // Al unir ambas fuentes, las categorías recién creadas aparecen como chips cliqueables inmediatamente
    const categoriasExistentes = Array.from(new Set([
        ...inv.flatMap(p => (p.categoria || ["General"]).map(c => c.trim())),
        ...categorias.map(c => c.nombre)
    ])).sort()

    return {
        lotes,
        inv,
        categorias,
        cargandoCats: categoriasQuery.isPending || categoriasQuery.isFetching,
        relacionImagen,
        recargar,
        cargarCategorias,
        actualizarInv,
        totalActivos,
        valorInv,
        ganPotencial,
        stockDesc,
        categoriasExistentes,
    }
}
