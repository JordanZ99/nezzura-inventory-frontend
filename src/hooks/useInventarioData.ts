// ==============================================================================
// src/hooks/useInventarioData.ts
// Custom hook: estado y carga de datos del módulo Inventario.
// - Lotes, inventario (productos), categorías y relación global de fotos.
// - Peticiones a la API (recargar, cargarCategorias) con retry de initDB.
// - Derivados: KPIs de la cabecera y categorías existentes (usados por la UI).
// ==============================================================================

import { useCallback, useEffect, useState } from "react"
import { api, Categoria, Lote, Producto } from "@/lib/api"

export function useInventarioData() {
    const [lotes, setLotes] = useState<Lote[]>([])
    const [inv, setInv] = useState<Producto[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [cargandoCats, setCargandoCats] = useState(false)
    // Relación global de las fotos (catálogo/POS/gestor): se lee de la config del catálogo
    const [relacionImagen, setRelacionImagen] = useState("1")

    async function recargar() {
        try {
            const [l, i] = await Promise.all([api.getLotes(), api.getInventario()])
            setLotes(l); setInv(i)
        } catch {
            // Tables might not exist — force creation and retry
            try {
                await api.initDB()
                const [l, i] = await Promise.all([api.getLotes(), api.getInventario()])
                setLotes(l); setInv(i)
            } catch {
                // DB is empty, keep empty state
            }
        }
    }

    /**
     * Carga la lista de categorías desde la API
     * (tabla 'categorias' con conteo de productos asociados)
     */
    async function cargarCategorias() {
        setCargandoCats(true)
        try {
            const cats = await api.getCategorias()
            setCategorias(cats)
        } catch {
            // Si falla, ignoramos silenciosamente
        } finally {
            setCargandoCats(false)
        }
    }

    // Permite al hook de formularios actualizar el inventario en memoria
    // (ej. al cambiar la foto de una variación, para reflejarla en el grid).
    const actualizarInv = useCallback((fn: (prev: Producto[]) => Producto[]) => setInv(fn), [])

    // Carga inicial de lotes + inventario
    useEffect(() => { recargar() }, [])

    // Relación global de las fotos (catálogo/POS/gestor): se lee de la config del catálogo
    useEffect(() => {
        api.getConfigCatalogo()
            .then(c => setRelacionImagen(c?.relacion_imagen === "4:5" ? "4 / 5" : "1"))
            .catch(() => {})
    }, [])

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
        cargandoCats,
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
