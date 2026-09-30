"use client"
// ==============================================================================
// src/hooks/useAnalisisInteligente.ts
// Estado del botón "Análisis Inteligente": dispara la consulta bajo demanda
// (no al abrir la página) y expone los tres estados que ve el usuario:
// Plus → reporte, básico → tarjeta de upsell, error → mensaje.
// ==============================================================================

import { useCallback, useState } from "react"
import { ApiError, api } from "@/lib/api"
import type { AnalisisInteligente as Analisis } from "@/types"

export function useAnalisisInteligente(rango: { desde?: string; hasta?: string; todo: boolean }, esPlus: boolean) {
    const [datos, setDatos] = useState<Analisis | null>(null)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [abierto, setAbierto] = useState(false)

    const generar = useCallback(async () => {
        if (!esPlus) {
            // Sin Plus solo se muestra la tarjeta de upsell (no gastamos request).
            setAbierto(true)
            return
        }
        setCargando(true)
        setError(null)
        try {
            const r = await api.getAnalisis({ desde: rango.desde, hasta: rango.hasta, todo: rango.todo })
            setDatos(r)
            setAbierto(true)
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "error inesperado")
            setAbierto(true)
        } finally {
            setCargando(false)
        }
    }, [rango.desde, rango.hasta, rango.todo, esPlus])

    // Si el tenant cambia de período, el reporte viejo deja de corresponder.
    const cerrar = useCallback(() => {
        setAbierto(false)
        setDatos(null)
        setError(null)
    }, [])

    return { datos, cargando, error, abierto, generar, cerrar }
}
