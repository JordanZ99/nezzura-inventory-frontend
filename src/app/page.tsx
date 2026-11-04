"use client"
// ==============================================================================
// src/app/page.tsx  —  Home (router por giro, Fase 0/2 + servicios)
// ==============================================================================
// Según el giro del tenant (migración 035 + useModulo):
//   - preset 'servicios' (módulo 'cobros') → DashboardServicios: panel
//     financiero (cobrado del mes, pendiente, aging, deudores). Este giro no
//     vende productos: cobra servicios/consultoría (migración 059).
//   - preset 'restaurante' (módulo 'mesas') → PosRestaurante: parrilla de
//     mesas, panel por mesa y cobro del ticket de mesa con el flujo de cobro
//     clásico (usePosCarrito.mesaCobrando).
//   - preset 'tienda' (todos los demás) → PosClasico: la misma interfaz de
//     siempre, sin ningún cambio de comportamiento.
// ==============================================================================

import { useModulo } from "@/hooks/useModulo"
import PosClasico from "@/components/pos/PosClasico"
import PosRestaurante from "@/components/mesas/PosRestaurante"
import DashboardServicios from "@/components/servicios/DashboardServicios"

export default function Home() {
    // Ambos flags se leen SIEMPRE (reglas de hooks); el giro decide qué render.
    const esServicios = useModulo("cobros")
    const esRestaurante = useModulo("mesas")
    if (esServicios) return <DashboardServicios />
    if (esRestaurante) return <PosRestaurante />
    return <PosClasico />
}
