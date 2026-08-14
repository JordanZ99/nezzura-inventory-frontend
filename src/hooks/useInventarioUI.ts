// ==============================================================================
// src/hooks/useInventarioUI.ts
// Custom hook: estado exclusivamente visual del módulo Inventario.
// - Tab activa, buscadores, ordenamiento, filtros de categoría.
// - Producto seleccionado en el Restock y estado de modales (KPI popup).
// - Debounce del buscador de Restock y detección de vista móvil.
// No contiene lógica de negocio ni llamadas a la API.
// ==============================================================================

import { useEffect, useState } from "react"
import type { Producto } from "@/lib/api"
import type { Tab } from "@/hooks/useInventarioForm"

export function useInventarioUI() {
    // Vista móvil (<= 899px): los botones de tipo de producto apilan el ícono
    // arriba del texto en vez de al lado (evita que se comprima en pantallas chicas).
    const [esMovil, setEsMovil] = useState<boolean>(() =>
        typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches)
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 899px)")
        setEsMovil(mq.matches)
        const handler = (e: MediaQueryListEvent) => setEsMovil(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Tab activa de la cabecera
    const [tab, setTab] = useState<Tab>("nuevo")

    // ── Estados para el Restock con buscador (como Editar Prod.) ──
    const [restockBuscador, setRestockBuscador] = useState("")
    const [restockCatSelec, setRestockCatSelec] = useState("Todas")
    const [restockProdSeleccionado, setRestockProdSeleccionado] = useState<Producto | null>(null)
    // ── Ordenamiento del grid de Restock (default: menor stock primero) ──
    const [restockOrdenamiento, setRestockOrdenamiento] = useState("stock-desc")
    // ── Debounce del buscador: retrasa el filtrado 300ms para no recalcular en cada tecla ──
    const [restockBuscadorDebounced, setRestockBuscadorDebounced] = useState("")
    useEffect(() => {
        const timer = setTimeout(() => setRestockBuscadorDebounced(restockBuscador), 300)
        return () => clearTimeout(timer)
    }, [restockBuscador])

    // ── Ordenamiento del grid de "Editar Prod." (default: alfabético, igual que el backend) ──
    const [buscadorEditar, setBuscadorEditar] = useState("")
    const [catSelecEditar, setCatSelecEditar] = useState("Todas")
    const [editarOrdenamiento, setEditarOrdenamiento] = useState("alfabetico")

    // ── Estado para la explicación de cada KPI (popup informativo) ──
    const [kpiExplicacion, setKpiExplicacion] = useState<string | null>(null)

    return {
        esMovil,
        tab, setTab,
        restockBuscador, setRestockBuscador,
        restockCatSelec, setRestockCatSelec,
        restockProdSeleccionado, setRestockProdSeleccionado,
        restockOrdenamiento, setRestockOrdenamiento,
        restockBuscadorDebounced, setRestockBuscadorDebounced,
        buscadorEditar, setBuscadorEditar,
        catSelecEditar, setCatSelecEditar,
        editarOrdenamiento, setEditarOrdenamiento,
        kpiExplicacion, setKpiExplicacion,
    }
}
