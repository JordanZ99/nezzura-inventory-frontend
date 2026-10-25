// ==============================================================================
// src/types/clientes.ts
// Cartera de clientes + sistema de puntos (Fase A, doc sistemaPuntos.md).
// ==============================================================================

/** Estado de un campo configurable del formulario de cliente ({activo, requerido}). */
export interface ClienteCampoEstado {
    activo: boolean
    requerido: boolean
}

/** Config de los campos pedidos al registrar un cliente (nombre es fijo). */
export interface ClienteCampos {
    email: ClienteCampoEstado
    telefono: ClienteCampoEstado
    pin: ClienteCampoEstado
}

export type ModoPuntos = "por_gasto" | "fijo"

// ── CRM (Fase B: migs 054/055) ────────────────────────────────────────────────

/** Etiqueta libre del negocio (catálogo por tenant). */
export interface Etiqueta {
    id: string
    nombre: string
    color: string
}

/** Registro del timeline de seguimiento de un cliente. */
export type TipoInteraccion = "nota" | "llamada" | "visita" | "promo"

export interface Interaccion {
    id: string
    tipo: TipoInteraccion
    texto: string
    creado_por: string
    fecha: string
}

export interface Cliente {
    id: string
    nombre: string
    email: string | null
    telefono: string | null
    notas: string | null
    activo: boolean
    fecha_registro: string
    /** CRM: cumpleaños (YYYY-MM-DD) y canal/campaña de adquisición. */
    cumpleanos: string | null
    origen: string | null
    /** Etiquetas asignadas (viene del SQL como array de {id, nombre, color}). */
    etiquetas: Etiqueta[]
    saldo_puntos: number
    compras: number
    total_gastado: number
    ticket_promedio: number
    ultima_compra: string | null
}

export interface MovimientoPuntos {
    id: string
    tipo: "ganados" | "canjeados" | "ajuste"
    puntos: number
    valor_monetario: number | null
    concepto: string | null
    fecha: string
    orden_id: string | null
}

export interface CompraCliente {
    id: string
    n_ticket: number
    fecha_ts: string
    total: number
    cantidad_items: number
}

/** Detalle de UN cliente (GET /clientes/{id}): incluye historial + timeline. */
export interface ClienteDetalle extends Cliente {
    movimientos: MovimientoPuntos[]
    ultimas_compras: CompraCliente[]
    interacciones: Interaccion[]
}

/** Segmento dinámico (GET /clientes/segmentos): censado contra compras/puntos. */
export interface Segmento {
    id: string
    nombre: string
    descripcion: string
    conteo: number
    ids: string[]
}

/** LTV de un cliente (recalculado on-demand; nada persistido). */
export interface LtvCliente {
    cliente_id: string
    nombre: string
    activo: boolean
    compras: number
    gasto: number
    ticket_promedio: number
    frecuencia_mensual: number
    dias_sin_comprar: number
    ltv_historico: number
    ltv_proyectado: number
}

export interface LtvSegmento {
    id: string
    nombre: string
    conteo: number
    ltv_promedio: number
    ltv_total: number
    gasto_historico: number
}

/** Respuesta completa del LTV (GET /clientes/ltv). */
export interface LtvResumen {
    global: {
        horizonte_meses: number
        /** 0..1; en la UI se muestra como %. */
        tasa_retencion: number
        clientes_con_compras: number
        clientes_recurrentes: number
        ltv_promedio_proyectado: number
        gasto_total_historico: number
    }
    segmentos: LtvSegmento[]
    clientes: LtvCliente[]
}

/** Un punto de la serie temporal (por período). */
export interface SerieClientePunto {
    periodo: string
    otorgados: number
    canjeados: number
    tickets: number
    identificadas: number
    total_venta: number
}

/** Cliente de la sala de honor (por gasto del período). */
export interface TopCliente {
    id: string
    nombre: string
    telefono: string | null
    email: string | null
    compras: number
    total_gastado: number
    saldo_puntos: number
    ultima_compra: string | null
}

/** KPIs de fidelización del período (GET /stats/clientes). */
export interface ResumenClientes {
    clientes_total: number
    clientes_activos: number
    clientes_nuevos_periodo: number
    clientes_recurrentes: number
    pct_recurrentes: number
    puntos_otorgados: number
    puntos_canjeados: number
    puntos_ajustados: number
    pct_canjeados: number
    saldo_puntos: number
    valor_punto: number
    pasivo_monetario: number
    tickets_total: number
    tickets_identificadas: number
    pct_identificadas: number
    ticket_con_cliente: number
    ticket_sin_cliente: number
    diferencia_ticket: number
    // ── Analítica (Fase C) ──
    top_clientes: TopCliente[]
    serie: SerieClientePunto[]
}
