"use client"
// ==============================================================================
// src/app/page.tsx  —  Punto de Venta (router por giro, Fase 0/2)
// ==============================================================================
// Según el giro del tenant (migración 035 + useModulo):
//   - preset 'restaurante' (módulo 'mesas') → PosRestaurante: parrilla de
//     mesas, panel por mesa y cobro del ticket de mesa con el flujo de cobro
//     clásico (usePosCarrito.mesaCobrando).
//   - preset 'tienda' (todos los tenants actuales) → PosClasico: la misma
//     interfaz de siempre, sin ningún cambio de comportamiento.
// ==============================================================================

import { useModulo } from "@/hooks/useModulo"
import PosClasico from "@/components/pos/PosClasico"
import PosRestaurante from "@/components/mesas/PosRestaurante"

export default function PuntoDeVenta() {
    const esRestaurante = useModulo("mesas")
    if (esRestaurante) return <PosRestaurante />
    return <PosClasico />
}
