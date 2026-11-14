// ==============================================================================
// repos/utilidades.ts — Helpers compartidos de los repos locales.
//
// Antes `redondear` estaba copiada 6 veces (ventas/inventario/gastos/stats/
// turnos/clientes) y `redondear3`/`round2` en conteos; `filaVenta` vivía
// duplicada en ventas y stats con riesgo de divergencia silenciosa. Ahora
// vive aquí UNA vez: al reescribir repos sobre SQLite (Fase 1) la regla se
// migra una vez, no seis.
// ==============================================================================

import type { Venta, RangoFechas } from "@/types"
import type { VentaLocal } from "../db"

/** Redondeo a centavos (2 decimales) — dinero. */
export function redondear(n: number): number {
    return Math.round(n * 100) / 100
}

/** Redondeo a gramos/mililitros (3 decimales) — conteos y stock. */
export function redondear3(n: number): number {
    return Math.round(n * 1000) / 1000
}

/** Convierte una fila de ventas local al contrato HTTP exacto (GET /ventas).
 * Antes duplicada en ventas.ts y stats.ts — cuerpo idéntico verificado. */
export function filaVenta(v: VentaLocal, id: number): Venta {
    return {
        id,
        n_ticket: v.n_ticket,
        fecha: v.fecha,
        producto: v.producto,
        cantidad: v.cantidad,
        precio_lista: v.precio_lista,
        precio_real: v.precio_real,
        costo_unitario: v.costo_unitario,
        total_venta: v.total_venta,
        ganancia_bruta: v.ganancia_bruta,
        estado: v.estado,
        tipo_producto: v.tipo_producto,
        variacion: v.variacion || undefined,
        descripcion: v.descripcion || undefined,
        consumo: v.consumo || undefined,
        orden_id: v.orden_id,
    }
}

export type { Venta, RangoFechas }
