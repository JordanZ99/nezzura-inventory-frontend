// ==============================================================================
// src/types/cobros.ts
// Cobros del giro 'servicios' (migración 059): mensualidades por cliente
// (cuotas), trabajos extra (dev/consultoría) y abonos parciales.
// El backend deriva estado/saldo/vencido (monto - SUM(pagos)); el frontend
// solo los consume — jamás los recalcula ni persiste.
// ==============================================================================

/** Abono registrado en un cobro (append-only en el backend, JSONB `pagos`). */
export interface PagoCobro {
    fecha: string          // 'YYYY-MM-DD'
    monto: number
    metodo?: string | null // 'efectivo' | 'transferencia' | 'tarjeta' | 'otro'
}

/** Cuota del plan de pagos comprometido (el ACUERDO, no el dinero recibido). */
export interface EntradaPrograma {
    etiqueta: string       // 'Anticipo 50%', 'Entrega final'...
    monto: number
    fecha: string          // 'YYYY-MM-DD' comprometida
}

export type EstadoCobro = "pendiente" | "parcial" | "pagado"
export type OrigenCobro = "cuota" | "extra"

/** Una deuda concreta: la cuota de un mes o un trabajo puntual. */
export interface Cobro {
    id: string
    cliente_id: string
    cliente_nombre: string
    cuota_id: string | null
    origen: OrigenCobro
    concepto: string
    periodo: string | null // 'YYYY-MM' (solo cuotas)
    monto: number
    vencimiento: string | null
    programa: EntradaPrograma[]
    notas: string | null
    pagos: PagoCobro[]
    // Derivados por el backend:
    pagado: number
    saldo: number
    estado: EstadoCobro
    vencido: boolean
    dias_vencido: number
    creado_en: string
}

/** La suscripción mensual (no guarda dinero; genera cobros por periodo). */
export interface CuotaCliente {
    id: string
    tenant_id?: string
    cliente_id: string
    cliente_nombre: string
    concepto: string
    monto: number
    dia_cobro: number // 1..28
    activo: boolean
    notas: string | null
    creado_en?: string
}

/** Buckets de antigüedad del saldo vencido (AR aging, estilo Xero/Stripe). */
export interface AgingCobros {
    actual: number  // aún no vence
    d30: number     // vencido ≤ 30 días
    d60: number     // vencido 31–60
    d90: number     // vencido 61–90
    mas90: number   // vencido +90 (riesgo de incobrable)
}

export interface DeudorCobros {
    cliente_id: string
    nombre: string
    saldo: number
    cobros_pendientes: number
}

/** KPIs del dashboard financiero (GET /cobros/resumen). */
export interface ResumenCobros {
    periodo: string          // 'YYYY-MM'
    pendiente_total: number
    num_pendientes: number
    cobrado_periodo: number
    aging: AgingCobros
    deudores: DeudorCobros[]
}
