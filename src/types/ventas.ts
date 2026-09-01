export interface ItemCarrito {
    producto: string;
    cantidad: number;
    precio_real: number;
    id_lote?: string;
    // Nombre de la variación vendida (ej. "Doble", "S") — cambia el precio
    variacion?: string;
}

export interface Venta {
    id: number;
    n_ticket: number;
    fecha: string;
    producto: string;
    cantidad: number;
    precio_lista: number;
    precio_real: number;
    costo_unitario: number;
    total_venta: number;
    ganancia_bruta: number;
    estado: string;
    // 'stock' | 'servicio' | 'compuesto' — para saber en el historial si la venta consumió inventario
    tipo_producto?: string;
    // Nombre de la variación vendida (ej. "Doble", "S") — vacío = sin variación
    variacion?: string;
    // Consumo real de materiales de una venta COMPUESTA (solo compuestos)
    consumo?: { material: string; id_lote: string | null; cantidad: number; costo: number }[] | null;
    // Orden (ticket) a la que pertenece el renglón (migración 032)
    orden_id?: string;
}

// Pago individual dentro de un ticket (efectivo o tarjeta; el mixto son varios)
export interface PagoOrden {
    metodo: string;
    monto: number;
    referencia?: string | null;
    terminal_id?: string | null;
    terminal_nombre?: string | null;
    comision?: number;
}

// Terminal bancaria del negocio con su tarifa real (Fase B)
export interface Terminal {
    id: string;
    nombre: string;
    banco?: string | null;
    comision_debito_pct: number;
    comision_credito_pct: number;
    comision_fija: number;
    activo: boolean;
}

// Turno de caja con arqueo (Fase C)
export interface Turno {
    id: string;
    estado: "Abierto" | "Cerrado";
    abierta_en: string;
    cerrada_en: string | null;
    monto_apertura: number;
    efectivo_esperado: number | null;
    efectivo_contado: number | null;
    diferencia: number | null;
    notas?: string | null;
    num_ordenes: number;
    total_turno: number;
    efectivo_cobrado: number;
}

// Ticket/orden de venta: cabecera de un cobro que agrupa sus renglones
export interface Orden {
    id: string;
    n_ticket: number;
    fecha: string;
    total: number;
    ganancia: number;
    cantidad_items: number;
    estado: string; // 'Activa' | 'Anulada'
    ventas: Venta[];
    // Cobro (Fase A): NULL/undefined en órdenes legadas = "No registrado"
    metodo_pago?: string | null; // 'efectivo' | 'tarjeta_debito' | 'tarjeta_credito' | 'mixto'
    pagos?: PagoOrden[] | null;
    propina?: number;
    monto_recibido?: number | null;
    cambio?: number | null;
    comision_total?: number;
    turno_id?: string | null;
}

// ── Estadísticas server-side: respuestas de la BDD, no dumps de renglones ──

// Totales de UN producto en el período (GET /stats/productos)
export interface StatsProducto {
    producto: string;
    total: number;
    unidades: number;
    ganancia: number;
    num_ventas: number;
}

// KPIs del período (GET /stats/resumen)
export interface ResumenStats {
    total_vendido: number;
    ganancia_bruta: number;
    unidades: number;
    num_ventas: number;
    num_anuladas: number;
    tickets: number;
    ticket_promedio: number;
    total_gastos: number;
    cobros_por_metodo: { efectivo: number; tarjeta_debito: number; tarjeta_credito: number; no_registrado: number };
    propinas: number;
    con_metodo: boolean;
    por_terminal: { nombre: string; cobrado: number; comision: number }[];
    top_productos: StatsProducto[];
}

// Cubo temporal de la serie (GET /stats/serie): día/semana/més según el rango
export interface FilaSerie {
    periodo: string;   // 'YYYY-MM-DD' (inicio del cubo)
    ventas: number;
    ganancia: number;
    gastos: number;
}

// Historial de tickets paginado en servidor (GET /ventas/ordenes/paginadas)
export interface RespuestaOrdenesPaginadas {
    ordenes: Orden[];
    total: number;
    pagina: number;
    por_pagina: number;
    total_paginas: number;
}
