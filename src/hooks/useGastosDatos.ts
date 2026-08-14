// ==============================================================================
// src/hooks/useGastosDatos.ts
// Dominio "Datos" de Gastos: carga de movimientos (getGastos), recargar() y el
// flag responsivo esMobile (matchMedia 767px, mobile-first).
// ==============================================================================

import { useEffect, useState } from "react"
import { api, type Gasto } from "@/lib/api"

export function useGastosDatos() {
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [cargando, setCargando] = useState(true)
    const [esMobile, setEsMobile] = useState(true) // mobile-first para evitar flash de contenido

    useEffect(() => {
        // Detectar si es mobile para el colapsable de categorías
        const mql = window.matchMedia('(max-width: 767px)')
        setEsMobile(mql.matches)
        const handler = (e: MediaQueryListEvent) => setEsMobile(e.matches)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [])

    async function recargar() {
        const g = await api.getGastos()
        setGastos(g)
    }
    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    return {
        gastos,
        cargando,
        recargar,
        esMobile,
    }
}
