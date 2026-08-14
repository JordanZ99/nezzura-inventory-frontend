// ==============================================================================
// src/hooks/useGastosUI.ts
// Estado de interfaz de Gastos: tab activa, filtro de pendientes y los
// derivados (gastosVisibles + stats: pagados/pendientes). Recibe gastos desde
// useGastosDatos vía props.
// ==============================================================================

import { useState } from "react"
import type { Gasto } from "@/lib/api"

export type TabGastos = "movimientos" | "programados"

interface Args {
    gastos: Gasto[]
}

export function useGastosUI({ gastos }: Args) {
    const [tab, setTab] = useState<TabGastos>("movimientos")
    const [filtroPendientes, setFiltroPendientes] = useState(false)

    // ── Gastos visibles según filtro ──
    const gastosVisibles = filtroPendientes
        ? gastos.filter(g => g.estado === "pendiente")
        : gastos

    // ── Stats ──
    const pagados = gastos.filter(g => g.estado !== "pendiente" && g.estado !== "descartado")
    const totalPagado = pagados.reduce((a, g) => a + g.monto, 0)
    const numPagados = pagados.length
    const pendientes = gastos.filter(g => g.estado === "pendiente")
    const totalPendiente = pendientes.reduce((a, g) => a + g.monto, 0)

    return {
        tab,
        setTab,
        filtroPendientes,
        setFiltroPendientes,
        gastosVisibles,
        totalPagado,
        numPagados,
        pendientes,
        totalPendiente,
    }
}
