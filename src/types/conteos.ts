// ==============================================================================
// src/types/conteos.ts
// Conteos de auditoría (conteo físico vs sistema — migración 041 del backend).
// ==============================================================================

/** Decisión aplicada a un renglón del conteo (o su estado final en el historial). */
export type ResolucionConteo =
    | "merma"                   // faltante dado de baja como pérdida (sin venta)
    | "venta"                   // faltante que sí se vendió fuera del sistema (crea ticket retroactivo)
    | "error_sistema"           // el stock del sistema estaba mal (corrección)
    | "entrada_no_registrada"   // sobrante: mercancía que llegó sin darse de alta
    | "cuadrado"                // contado == stock vivo al cierre (no se toca nada)
    | "sin_contar"              // renglón sin captura al cerrar (no se toca nada)

export interface ConteoItem {
    id: string
    producto_id: number
    producto: string
    /** '' = stock base del producto (sin variación) */
    variacion: string
    /** Snapshot del stock del sistema al ABRIR el conteo */
    esperado: number
    /** Total contado físico (absoluto). null = aún sin contar */
    contado: number | null
    /** Stock vivo al momento del cierre (solo se llena al cerrar) */
    vivo: number | null
    /** contado − vivo al cierre: negativo = faltante, positivo = sobrante */
    delta: number | null
    resolucion: ResolucionConteo | null
    /** 'snapshot' = lo generó abrir_conteo; 'manual' = producto no registrado agregado a mano (056) */
    origen?: "snapshot" | "manual"
    /** Solo manual: cuánto había al inicio (para declarar la venta al cerrar) */
    inicial?: number | null
}

/** Alta de renglón manual dentro del conteo (producto nunca registrado). */
export interface RenglonManualConteo {
    producto: string
    /** Cuánto había al inicio: si contado < inicial, el cierre declara la venta */
    inicial?: number | null
    contado?: number | null
}

export interface ResumenConteo {
    cuadrados: number
    sin_contar: number
    omitidos: number
    mermas: number
    /** Costo total de las mermas (Σ costo del lote × cantidad) */
    merma_costo: number
    /** Número de renglones de venta declarada (no tickets: un ticket agrupa todos) */
    ventas: number
    venta_total: number
    entradas: number
    ajustes: number
    /** Orden retroactiva creada con las ventas declaradas (si hubo) */
    orden_id?: string
    n_ticket?: number
    /** Gasto automático de merma creado al cerrar (figura en Egresos, categoría "Merma") */
    gasto_merma_id?: number
}

/** Alcance de un conteo PARCIAL (057): categorías y/o productos (unión). */
export interface AlcanceConteo {
    categorias?: string[]
    productos?: string[]
    producto_ids?: number[]
}

export interface Conteo {
    id: string
    estado: "abierto" | "cerrado"
    abierto_at: string
    cerrado_at: string | null
    resumen: ResumenConteo | null
    /** null = conteo completo; presente = conteo parcial (057) */
    alcance?: AlcanceConteo | null
}

/** Autosave: total contado ABSOLUTO de un renglón (no un incremento). */
export interface CapturaConteo {
    producto: string
    variacion: string
    contado: number | null
}

/** Resolución enviada al cerrar para cada renglón con diferencia. */
export interface ResolucionConteoItem {
    producto: string
    variacion: string
    resolucion?: "merma" | "venta" | "error_sistema" | "entrada_no_registrada"
    costo?: number
    precio_venta?: number
    /** Solo venta: precio REAL al que se vendió (subasta, descuento). Sin él se usa el precio de lista. */
    precio_real?: number
}
