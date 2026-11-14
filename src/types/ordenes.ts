// ==============================================================================
// src/types/ordenes.ts
// Órdenes de servicio (giro 'servicios', migración 077): el registro del
// TRABAJO — genérico (reparaciones, instalaciones, consultoría, mantenimiento,
// otro). El dinero vive en cobros; aquí solo precio informativo + cobro_id.
// ==============================================================================

export type TipoOrden = "reparacion" | "instalacion" | "consultoria" | "mantenimiento" | "otro"

/** Flujo del trabajo (patrón de los sistemas de reparación): 'esperando'
 *  sirve para pieza, aprobación de cliente o lo que frene el trabajo. */
export type EstadoOrden = "recibido" | "en_proceso" | "esperando" | "listo" | "entregado" | "cancelado"

export interface OrdenServicio {
    id: string
    tenant_id?: string
    cliente_id: string | null
    cliente_nombre: string | null
    tipo: TipoOrden
    titulo: string
    equipo: string | null
    detalle_reportado: string | null
    solucion: string | null
    estado: EstadoOrden
    fecha_recibido: string      // 'YYYY-MM-DD'
    fecha_entregado: string | null
    precio: number | null        // informativo hasta cobrarse
    /** Enlace de cobro (078, mutuamente excluyentes): cobro puntual → cobro_id;
     *  venta a plazos → cuota_id (la cuota que genera sus abonos). */
    cobro_id: string | null
    cuota_id: string | null
    cobro_concepto: string | null
    cobro_saldo: number | null   // saldo del cobro/cuota enlazado (derivado)
    notas: string | null
    creado_en: string
}

/** Etiquetas legibles compartidas por la UI (selects, badges, filtros). */
export const TIPOS_ORDEN: Record<TipoOrden, string> = {
    reparacion: "Reparación",
    instalacion: "Instalación",
    consultoria: "Consultoría",
    mantenimiento: "Mantenimiento",
    otro: "Otro",
}

export const ESTADOS_ORDEN: Record<EstadoOrden, string> = {
    recibido: "Recibido",
    en_proceso: "En proceso",
    esperando: "En espera",
    listo: "Listo",
    entregado: "Entregado",
    cancelado: "Cancelado",
}
