// ==============================================================================
// src/types/actividad.ts
// Historial completo (migración 062): registro de actividad que NO es stock
// — ediciones de producto (foto, precio, nombre...), CRM (clientes, etiquetas,
// interacciones, puntos) y cobros del giro 'servicios'. El detalle de STOCK
// vive en el ledger 040 (MovimientoInventario, types/productos.ts).
// ==============================================================================

/** Sección de la app donde nació el evento (badges de color en la UI).
 *  068 agrega 'venta' y 'gasto': las ediciones de ventas y gastos también
 *  quedan en el Historial (las haga el dueño o el agente IA). */
export type DominioActividad = "producto" | "cliente" | "cobro" | "venta" | "gasto"

/** Qué se tocó dentro del dominio. */
export type EntidadActividad =
    | "producto" | "variacion"      // dominio producto
    | "cliente" | "etiqueta" | "interaccion" | "puntos"  // dominio cliente
    | "cobro" | "abono" | "cuota"   // dominio cobro
    | "venta"                       // dominio venta (068)
    | "gasto"                       // dominio gasto (068)

/**
 * Qué pasó. La migración 062 garantiza estos valores por CHECK:
 *   crear | editar | eliminar | abonar | quitar_abono | generar | ajustar_puntos
 */
export type AccionActividad =
    | "crear" | "editar" | "eliminar"
    | "abonar" | "quitar_abono"
    | "generar" | "ajustar_puntos"

/**
 * detalle JSONB. Formas que llena el backend:
 * - Editar: diff al estilo ledger — { campo: [antes, despues], ... }
 * - Otros: contexto plano ({ monto, fecha, ... }).
 */
export type DetalleActividad = Record<string, unknown> | null

export interface EventoActividad {
    id: string
    fecha: string
    dominio: DominioActividad
    entidad: EntidadActividad
    accion: AccionActividad
    /** ID de la fila tocada (producto/variacion/cliente/cobro/cuota...) */
    entidad_id: string | null
    /** Texto legible ya redactado por el backend. */
    resumen: string
    detalle: DetalleActividad
}

export interface RespuestaActividad {
    eventos: EventoActividad[]
    total: number
    limit: number
    offset: number
}
