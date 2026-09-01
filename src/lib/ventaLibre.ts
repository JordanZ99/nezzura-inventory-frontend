// ==============================================================================
// src/lib/ventaLibre.ts
// Constantes del producto genérico "Venta libre" (migración 036): el tile fijo
// del POS para cobrar cosas que no están registradas en inventario (el cereal
// que le pidieron al restaurante, la silla del emprendedor, el platillo que
// aún no se da de alta). Contablemente todo cae en UN producto "Venta libre";
// el texto libre vive en item.descripcion.
// ==============================================================================

// Nombre canónico en la tabla productos. Debe coincidir EXACTO con el INSERT
// de backend/migrations/036_venta_libre.sql (la venta se valida por nombre).
export const NOMBRE_VENTA_LIBRE = "Venta libre"
