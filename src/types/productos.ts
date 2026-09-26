import type { PostOverride } from "./catalogo"

export interface Producto {
    producto: string;
    descripcion: string;
    imagen: string;
    estado: string;
    stock_total: number;
    precio_venta: number;
    // Precio del lote más antiguo con stock (el que PEPS venderá); null/undefined si no aplica
    precio_sugerido?: number;
    // Rango de precios de los lotes con stock (para mostrar variabilidad en el POS)
    precio_min?: number;
    precio_max?: number;
    costo_promedio: number;
    categoria: string[];
    codigo_interno?: string;
    codigo_barras?: string;
    ubicacion?: string;
    visible_en_catalogo?: boolean;
    // Sufijo del precio en el catálogo ("c/u", "por kilo", "por litro", ...); vacío = sin sufijo
    sufijo_precio?: string;
    // Si true, se puede vender por fracciones (0.5 kg, 1.5 lt, ...). Si false
    // (default), solo unidades enteras — ni digitando decimales en el POS.
    fraccionable?: boolean;
    // Tipo de producto: 'stock' (normal) | 'servicio' (sin inventario, ej. corte de cabello)
    tipo_producto?: string;
    // Costo/precio de venta de un servicio (viven en el producto, no en lotes)
    costo_servicio?: number;
    precio_servicio?: number;
    // Variaciones: presentaciones con su PROPIO precio (ej. Sencilla/Doble, S/M/L).
    // Si un producto tiene variaciones, cada una lleva su propio inventario.
    variaciones?: Variacion[];
    // Receta de un producto compuesto (materiales que consume al venderse)
    recetas?: MaterialReceta[];
    // Solo compuestos: cuántas unidades se pueden vender con el stock actual
    // de sus materiales (min sobre la receta). null = sin receta → no estimable.
    disponibilidad_estimada?: number | null;
    // Override de la tarjeta de post de ESTE producto (Posts Automáticos, Fase 1).
    // null/undefined = usa los defaults del negocio (post_config).
    post_override?: PostOverride | null;
}

export interface Variacion {
    id: number;
    nombre: string;
    precio: number;
    // Foto propia de la variación (URL de Cloudinary) — el catálogo la muestra
    // al seleccionar esta presentación (ej. la foto de la Hamburguesa Doble).
    foto?: string;
    // Stock EXCLUSIVO de esta variación (suma de sus lotes).
    stock?: number;
}

/**
 * Material de la receta de un producto compuesto.
 * Un compuesto (ej. hamburguesa) no tiene stock propio: al venderlo se
 * descuenta `cantidad` de este material (producto de stock).
 */
export interface MaterialReceta {
    id: number;
    material: string;   // nombre del material (producto de stock)
    cantidad: number;   // cantidad por unidad del compuesto (permite 0.5, 150, ...)
    variacion_id?: number | null;
    variacion?: string; // nombre de la variación (solo informativo)
}

export interface Lote {
    id_lote: string;
    producto: string;
    costo: number;
    precio_venta: number;
    stock_lote: number;
    fecha_entrada: string;
    estado: string;
    // Presentación opcional del lote (ej. "20cm", "Premium", "Oferta")
    etiqueta?: string;
    // A qué variación pertenece este lote
    // (null/undefined = stock base del producto, sin variación)
    variacion_id?: number | null;
    variacion?: string;
}

export interface NuevoProducto {
    producto: string;
    descripcion: string;
    costo: number;
    precio_venta: number;
    stock: number;
    imagen?: string;
    categoria?: string[];
    codigo_interno?: string;
    codigo_barras?: string;
    ubicacion?: string;
    etiqueta?: string;
    sufijo_precio?: string;
    fraccionable?: boolean;        // Si true, se vende por fracciones (0.5 kg)
    tipo_producto?: string;        // 'stock' | 'servicio' | 'compuesto'
    costo_servicio?: number;
    precio_servicio?: number;
    visible_en_catalogo?: boolean;
    variaciones?: { nombre: string; precio: number; stock_inicial?: number; costo?: number }[];
    recetas?: { material: string; cantidad: number }[];
}

export interface Restock {
    producto: string;
    costo: number;
    precio_venta: number;
    stock: number;
    etiqueta?: string;
    variacion?: string;
}

/**
 * Representa una imagen extra en la galería de un producto (Plan Plus).
 */
export interface ImagenProducto {
    id: number;
    url: string;
    orden: number;
}

// ── Ledger de inventario (migración 040): historial append-only de cambios ──
export type TipoMovimiento = "entrada" | "salida" | "ajuste";
export type OrigenMovimiento =
    | "venta"          // salida por cobro en el POS (incluye consumo de compuestos)
    | "restock"        // entrada por alta de producto/variación o restock
    | "ajuste_manual"  // corrección del stock de un lote (edición absoluta)
    | "edicion_venta"  // delta por editar la cantidad de una venta cobrada
    | "anulacion"      // devolución de stock por anular venta o ticket
    | "baja_lote"      // stock que sale al dar de baja un lote
    | "conteo";        // resolución de un conteo de auditoría (merma/corrección/ingreso)

export interface MovimientoInventario {
    id: string;
    producto_id: number | null;
    producto: string;
    variacion: string | null;
    id_lote: string | null;
    tipo: TipoMovimiento;
    origen: OrigenMovimiento;
    /** Unidades con signo: + entra, − sale */
    cantidad: number;
    /** Snapshot del stock del lote justo después del movimiento */
    stock_resultante: number | null;
    /** orden_id (ticket) cuando el movimiento nace de una venta */
    referencia_id: string | null;
    concepto: string | null;
    fecha: string;
}

export interface RespuestaMovimientos {
    movimientos: MovimientoInventario[];
    total: number;
    limit: number;
    offset: number;
}
