// ==============================================================================
// src/components/pos/tipos.ts
// Tipos compartidos por los componentes del Punto de Venta. Las acciones del
// carrito (acciones) vienen de usePosCarrito y se pasan por props para
// mantener el flujo unidireccional.
// ==============================================================================

import type { ItemCarrito, Lote, Producto } from "@/lib/api"

/** Handlers del carrito que comparten ItemCarrito, CarritoDesktop y el Drawer. */
export interface AccionesItemCarrito {
    keyCarrito: (item: { producto: string; variacion?: string; descripcion?: string }) => string
    lotesParaProducto: (producto: string) => Lote[]
    pasoCantidad: (actual: number, dir: 1 | -1, fracc: boolean) => number
    cambiarCantidad: (key: string, cantidad: number) => void
    cambiarPrecio: (key: string, texto: string) => void
    cambiarTotal: (key: string, texto: string) => void
    cambiarVariacionCarrito: (key: string, nombre: string) => void
    cambiarLoteCarrito: (key: string, id_lote: string | undefined) => void
    quitarDelCarrito: (key: string) => void
    nombreLote: (lote: Lote) => string
}

export interface PropsItemCarrito {
    item: ItemCarrito
    prod: Producto | undefined
    lotesProd: Lote[]
    /** "desktop" = panel lateral (compacto), "movil" = drawer (más grande). */
    variante: "desktop" | "movil"
    precios: Record<string, string>
    carrito: ItemCarrito[]
    modoDescuento: boolean
    acciones: AccionesItemCarrito
}
