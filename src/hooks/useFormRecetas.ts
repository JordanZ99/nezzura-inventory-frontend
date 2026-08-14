// ==============================================================================
// src/hooks/useFormRecetas.ts
// Sub-hook del módulo Inventario: lógica, estado y validaciones de los
// MATERIALES / RECETA del compuesto en edición — buscador de insumos (solo
// productos de stock), agregar material, editar cantidad, eliminar y el
// contexto de receta por variación.
// No toca JSX: devuelve estado, setters y handlers para que el orquestador
// (useInventarioForm) los combine con los otros sub-hooks.
// ==============================================================================

import { useState } from "react"
import { api, MaterialReceta, Producto } from "@/lib/api"

// Materiales pendientes del ALTA (se guardan en la misma transacción que el
// producto, vía crear_producto_completo). Vive aquí por dominio y el hook
// principal la re-exporta para mantener compatibilidad con la UI.
export type NuevoMaterialAlta = { material: string; cantidad: number }

interface UseFormRecetasArgs {
    inv: Producto[]
    prodEditar: string
    mostrarMsg: (ok: boolean, texto: string) => void
}

export function useFormRecetas({ inv, prodEditar, mostrarMsg }: UseFormRecetasArgs) {
    // ── Materiales de la receta del compuesto en edición (Fases 3 y 4) ──
    const [editRecetas, setEditRecetas] = useState<MaterialReceta[]>([])
    const [matBuscador, setMatBuscador] = useState("")
    const [matSeleccionado, setMatSeleccionado] = useState("")
    const [matCantidad, setMatCantidad] = useState("" as number | string)
    const [guardandoReceta, setGuardandoReceta] = useState(false)
    // Contexto de la receta que se edita: null = receta base, id = variación
    const [matVariacionSel, setMatVariacionSel] = useState<number | null>(null)

    // ── CRUD de materiales de la receta (Fase 3) ──
    // El buscador sugiere SOLO productos de stock (los que tienen inventario).
    const matSugerencias = (() => {
        if (!matBuscador.trim()) return []
        const q = matBuscador.toLowerCase()
        return inv
            .filter(p => p.tipo_producto === "stock" && p.producto.toLowerCase().includes(q) && p.producto !== prodEditar)
            .slice(0, 6)
    })()

    async function agregarMaterialItem() {
        if (!prodEditar || guardandoReceta || !matSeleccionado) return
        const cant = Number(matCantidad === "" ? 1 : matCantidad)
        if (!(cant > 0)) { mostrarMsg(false, "La cantidad debe ser mayor a 0"); return }
        setGuardandoReceta(true)
        try {
            // variacion_id: el contexto de receta seleccionado (null = base)
            const res = await api.agregarMaterial(prodEditar, matSeleccionado, cant, matVariacionSel)
            if (res.ok) {
                // Recargar la receta completa (para reflejar el id y orden)
                const recetas = await api.getRecetas(prodEditar)
                setEditRecetas(recetas)
                setMatBuscador(""); setMatSeleccionado(""); setMatCantidad("")
                mostrarMsg(true, `Material '${matSeleccionado}' agregado a la receta`)
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al agregar el material")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoReceta(false) }
    }

    async function editarMaterialItem(id: number, cantidad: number) {
        if (guardandoReceta) return
        setGuardandoReceta(true)
        try {
            const res = await api.editarMaterial(id, cantidad)
            if (res.ok) {
                setEditRecetas(prev => prev.map(r => r.id === id ? { ...r, cantidad: res.cantidad } : r))
                mostrarMsg(true, "Cantidad actualizada")
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al actualizar")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoReceta(false) }
    }

    async function eliminarMaterialItem(id: number) {
        if (guardandoReceta) return
        if (!confirm("¿Quitar este material de la receta?")) return
        setGuardandoReceta(true)
        try {
            const res = await api.eliminarMaterial(id)
            if (res.ok) {
                setEditRecetas(prev => prev.filter(r => r.id !== id))
                mostrarMsg(true, "Material eliminado de la receta")
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al eliminar")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoReceta(false) }
    }

    /** Resetea el estado de la receta al cargar un producto en edición.
     *  Lo invoca useFormProductoCore dentro de cargarProductoEdicion. */
    function resetEstadoRecetas(prod: Producto) {
        setEditRecetas(prod.recetas ?? [])
        setMatBuscador(""); setMatSeleccionado(""); setMatCantidad(""); setMatVariacionSel(null)
    }

    return {
        // Recetas
        editRecetas, setEditRecetas,
        matBuscador, setMatBuscador,
        matSeleccionado, setMatSeleccionado,
        matCantidad, setMatCantidad,
        matVariacionSel, setMatVariacionSel,
        guardandoReceta,
        matSugerencias,
        agregarMaterialItem,
        editarMaterialItem,
        eliminarMaterialItem,
        // Interno para el orquestador (lo consume useFormProductoCore)
        resetEstadoRecetas,
    }
}
