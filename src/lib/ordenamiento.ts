// ==============================================================================
// src/lib/ordenamiento.ts
// Lógica compartida de ordenamiento y filtrado de productos.
//
// Antes esta lógica estaba duplicada en usePosUI, inventario/page.tsx,
// useEstadisticasCalculos y en los selects de GridProductos/GridRestock/
// GridEditar/CatalogoProductosEstadisticas. Aquí vive en un solo lugar:
//   - OPCIONES_ORDEN_PRODUCTO / OPCIONES_ORDEN_ESTADISTICAS → selects
//   - compararProductos        → los 6 ordenamientos comunes
//   - invertirOrden            → toggle asc/desc del botón de invertir
//   - filtrarProductos         → búsqueda + filtro por categoría
//   - categoriasUnicas         → derivación de la lista de categorías
// ==============================================================================

import type { Producto } from "@/lib/api"

/** Las 6 opciones de ordenamiento de productos (POS, Restock, Editar). */
export const OPCIONES_ORDEN_PRODUCTO: { valor: string; etiqueta: string }[] = [
    { valor: "stock-desc", etiqueta: "Mayor stock" },
    { valor: "stock-asc", etiqueta: "Menor stock" },
    { valor: "precio-desc", etiqueta: "Mayor precio" },
    { valor: "precio-asc", etiqueta: "Menor precio" },
    { valor: "alfabetico", etiqueta: "Alfabético A-Z" },
    { valor: "alfabetico-desc", etiqueta: "Alfabético Z-A" },
]

/**
 * Las 10 opciones de Estadísticas por Producto: los 6 comunes + ventas/ganancia.
 * Se compone a partir de OPCIONES_ORDEN_PRODUCTO para no repetir etiquetas,
 * respetando el orden visual original del select.
 */
export const OPCIONES_ORDEN_ESTADISTICAS: { valor: string; etiqueta: string }[] = [
    ...OPCIONES_ORDEN_PRODUCTO.filter(o => o.valor.startsWith("stock") || o.valor.startsWith("precio")),
    { valor: "ventas-desc", etiqueta: "Más ventas" },
    { valor: "ventas-asc", etiqueta: "Menos ventas" },
    { valor: "ganancia-desc", etiqueta: "Más ganancia" },
    { valor: "ganancia-asc", etiqueta: "Menos ganancia" },
    ...OPCIONES_ORDEN_PRODUCTO.filter(o => o.valor.startsWith("alfabetico")),
]

/**
 * Comparador de productos para los 6 ordenamientos comunes.
 * Cualquier valor no reconocido ordena por stock ascendente.
 */
export function compararProductos(a: Producto, b: Producto, orden: string): number {
    switch (orden) {
        case "precio-desc":
            return b.precio_venta - a.precio_venta
        case "precio-asc":
            return a.precio_venta - b.precio_venta
        case "stock-desc":
            return b.stock_total - a.stock_total
        case "stock-asc":
            return a.stock_total - b.stock_total
        case "alfabetico":
            return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
        case "alfabetico-desc":
            return b.producto.localeCompare(a.producto, "es", { sensitivity: "base" })
        default:
            return a.stock_total - b.stock_total
    }
}

/**
 * Invierte la dirección de un ordenamiento (asc ↔ desc), con el caso especial
 * de alfabético (A-Z ↔ Z-A). Usado por el botón de invertir de los grids.
 */
export function invertirOrden(orden: string): string {
    if (orden === "alfabetico") return "alfabetico-desc"
    if (orden === "alfabetico-desc") return "alfabetico"
    if (orden.endsWith("-asc")) return orden.replace("-asc", "-desc")
    if (orden.endsWith("-desc")) return orden.replace("-desc", "-asc")
    return orden
}

/**
 * Filtra productos por búsqueda de texto y por categoría.
 *  - busqueda: coincide con nombre, descripción, códigos (opcional) y categorías.
 *  - categoria: "Todas" no filtra; cualquier otro valor exige que el producto
 *    la tenga (con fallback "General" para productos sin categoría).
 *  - incluirCodigos: si es true, la búsqueda también cubre código interno/barras
 *    (lo usan Restock y Estadísticas; el POS y Editar no buscan códigos).
 */
export function filtrarProductos<T extends {
    producto: string
    descripcion?: string
    categoria?: string[]
    codigo_interno?: string
    codigo_barras?: string
}>(
    productos: T[],
    busqueda: string,
    categoria: string,
    incluirCodigos = false,
): T[] {
    const q = busqueda.toLowerCase()
    return productos.filter(p => {
        const porBusqueda = !q
            || p.producto.toLowerCase().includes(q)
            || (p.descripcion || "").toLowerCase().includes(q)
            || (incluirCodigos && (p.codigo_interno || "").toLowerCase().includes(q))
            || (incluirCodigos && (p.codigo_barras || "").toLowerCase().includes(q))
            || (p.categoria || ["General"]).join(" ").toLowerCase().includes(q)
        const porCategoria = categoria === "Todas" || (p.categoria || ["General"]).includes(categoria)
        return porBusqueda && porCategoria
    })
}

/**
 * Categorías únicas (ordenadas alfabéticamente) de una lista de productos,
 * precedidas por "Todas" para el filtro de chips/pills.
 */
export function categoriasUnicas<T extends { categoria?: string[] }>(productos: T[]): string[] {
    return ["Todas", ...Array.from(new Set(productos.flatMap(p => (p.categoria || ["General"]).map(c => c.trim())))).sort()]
}
