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

/** Porción de un abono en cascada (mig 081): a qué cobro fue a parar cada parte. */
export interface RepartoAbono {
    cobro_id: string
    vencimiento: string | null
    monto: number
    /** true si el sobrante final se asignó a un cobro ya cubierto (pagó de más). */
    sobrepago?: boolean
}

/** Una deuda concreta: la cuota de un mes o un trabajo puntual. */
export interface Cobro {
    id: string
    cliente_id: string
    cliente_nombre: string
    /** Contacto del cliente para recibos/recordatorios (mig 081). */
    cliente_telefono?: string | null
    cliente_email?: string | null
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

/** Frecuencia de la suscripción (mig 063). Semanal: cada 'dia_semana'
 *  del mes. Quincenal: día 1 y día 15 fijos. */
export type FrecuenciaCuota = "mensual" | "semanal" | "quincenal"

/** Cuota recurrente ('cuota') o VENTA A PLAZOS ('venta', mig 076): el
 *  concepto es el artículo, monto_meta = precio total y costo → ganancia. */
export type TipoCuota = "cuota" | "venta"

/** La suscripción recurrente o venta a plazos (genera cobros por periodo). */
export interface CuotaCliente {
    id: string
    tenant_id?: string
    cliente_id: string
    cliente_nombre: string
    concepto: string
    monto: number
    dia_cobro: number // 1..28 (solo mensual; 1 en las demás)
    frecuencia: FrecuenciaCuota
    dia_semana: number | null // 0=Lunes..6=Domingo (solo semanal)
    /** Cuenta finita (064): total a cubrir; NULL = cuota infinita.
     *  En venta (076) es el PRECIO TOTAL y es obligatorio. */
    monto_meta: number | null
    /** Mig 076: tipo y costo de la venta a plazos. */
    tipo: TipoCuota
    costo: number | null
    /** Derivado (076): monto_meta - costo (solo venta con costo). */
    ganancia: number | null
    /** Derivados del backend (064). */
    programado_meta: number // SUM de cobros generados a la cuenta
    abonado_meta: number    // SUM de dinero realmente recibido
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

/** Próximo pago por vencer (card del dashboard; el backend ordena y trunca a 6). */
export interface ProximoCobro {
    cliente_id: string
    cliente_nombre: string
    concepto: string
    saldo: number
    vencimiento: string | null  // 'YYYY-MM-DD'
    vencido: boolean            // siempre false: los vencidos viven en el aging
    dias_vencido: number
}

/** KPIs del dashboard financiero (GET /cobros/resumen). */
export interface ResumenCobros {
    periodo: string          // 'YYYY-MM'
    pendiente_total: number
    num_pendientes: number
    cobrado_periodo: number
    aging: AgingCobros
    deudores: DeudorCobros[]
    /** Opcional: solo lo expone el backend ya actualizado (resumen >= 2026-11). */
    proximos?: ProximoCobro[]
}

// ── Mis cuentas (mig 075): registro MANUAL de planes del gestor por cliente ──

/** Estado del COBRO de un plan otorgado (no del plan en sí). */
export type EstadoCobroPlan = "cobrando" | "gratis" | "pausado"

/** Una anotación del cuaderno: "Le di el Plan Plus a Alejandra, de momento gratis". */
export interface PlanCliente {
    id: string
    cliente_id: string
    cliente_nombre: string
    plan: string                 // texto libre: 'local', 'plus', 'básico'...
    estado_cobro: EstadoCobroPlan
    monto_acordado: number | null // informativo; NULL = sin monto
    otorgado: string | null      // 'YYYY-MM-DD'
    notas: string | null
    creado_en: string
}
