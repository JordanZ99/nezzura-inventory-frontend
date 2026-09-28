// ==============================================================================
// src/hooks/usePosUI.ts
// Estado de interfaz del Punto de Venta: búsqueda, categoría seleccionada,
// ordenamiento, apertura del drawer móvil y los derivados categorias /
// productosFiltrados (búsqueda + categoría + switch de 6 ordenamientos).
// Recibe productos desde usePosDatos vía props.
// ==============================================================================

import { useState } from "react"
import type { Producto } from "@/lib/api"
import { categoriasUnicas, compararProductos, filtrarProductos } from "@/lib/ordenamiento"

interface Args {
    productos: Producto[]
}

export function usePosUI({ productos }: Args) {
    const [busqueda, setBusqueda] = useState("")
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("Todas")
    // Estado para el tipo de ordenamiento de los productos
    const [ordenamiento, setOrdenamiento] = useState<string>("alfabetico")
    const [carritoAbierto, setCarritoAbierto] = useState(false)

    const categorias = categoriasUnicas(productos)

    // Filtrado (búsqueda + categoría) y ordenamiento compartidos con Inventario
    // y Estadísticas (src/lib/ordenamiento.ts)
    const productosFiltrados = filtrarProductos(productos, busqueda, categoriaSeleccionada)
        .sort((a, b) => compararProductos(a, b, ordenamiento))

    return {
        busqueda,
        setBusqueda,
        categoriaSeleccionada,
        setCategoriaSeleccionada,
        ordenamiento,
        setOrdenamiento,
        carritoAbierto,
        setCarritoAbierto,
        categorias,
        productosFiltrados,
    }
}
