// ==============================================================================
// src/hooks/usePosUI.ts
// Estado de interfaz del Punto de Venta: búsqueda, categoría seleccionada,
// ordenamiento, apertura del drawer móvil y los derivados categorias /
// productosFiltrados (búsqueda + categoría + switch de 6 ordenamientos).
// Recibe productos desde usePosDatos vía props.
// ==============================================================================

import { useState } from "react"
import type { Producto } from "@/lib/api"

interface Args {
    productos: Producto[]
}

export function usePosUI({ productos }: Args) {
    const [busqueda, setBusqueda] = useState("")
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("Todas")
    // Estado para el tipo de ordenamiento de los productos
    const [ordenamiento, setOrdenamiento] = useState<string>("alfabetico")
    const [carritoAbierto, setCarritoAbierto] = useState(false)

    const categorias = ["Todas", ...Array.from(new Set(productos.flatMap(p => (p.categoria || ["General"]).map(c => c.trim())))).sort()]

    const productosFiltrados = productos.filter(p => {
        const busquedaBase = busqueda.toLowerCase()
        const porBusqueda = p.producto.toLowerCase().includes(busquedaBase) ||
            p.descripcion?.toLowerCase().includes(busquedaBase) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(busquedaBase)

        const porCategoria = categoriaSeleccionada === "Todas" || (p.categoria || ["General"]).includes(categoriaSeleccionada)
        return porBusqueda && porCategoria
    }).sort((a, b) => {
        // Aplicamos el ordenamiento seleccionado por el usuario
        switch (ordenamiento) {
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
    })

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
