// ==============================================================================
// Tipos del Análisis Inteligente (contrato estable, ver ANALITICA_PLAN.md §4).
// El backend devuelve métricas + hallazgos; el frontend solo los presenta.
// ==============================================================================

export type Severidad = "rojo" | "amarillo" | "verde"

export interface Hallazgo {
    tipo: string
    severidad: Severidad
    titulo: string
    detalle: string
    recomendacion: string
}

export interface MetricasAnalisis {
    ingresos_total: number
    ganancia_bruta_total: number
    margen_bruto_pct: number
    gastos_total: number
    utilidad_neta: number
    margen_neto_pct: number
    ticket_promedio: number
    ticket_mediano: number
    num_ventas: number
    mejor_dia: { dia: string; ingresos: number }
    mejor_mes: { mes: string; ingresos: number }
    proyeccion_mes_actual: number
    valor_inventario_costo: number
    valor_stock_muerto_costo: number
}

export interface AnalisisInteligente {
    generado_en: string
    zona_horaria: string
    rango_analizado: { desde: string; hasta: string }
    /** Tenant con pocas ventas: se muestran métricas, pero ninguna regla. */
    cold_start: boolean
    mensaje: string
    metricas: MetricasAnalisis
    hallazgos: Hallazgo[]
}
