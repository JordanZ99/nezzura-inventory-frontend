// ==============================================================================
// src/hooks/useInventarioForm.ts
// Hook ORQUESTADOR del módulo Inventario. Ya no contiene lógica de negocio:
// eleva el estado compartido (mensajes, contexto de edición y restock) y
// consume los 3 sub-hooks especializados por dominio:
//   - useFormProductoCore   → alta/edición básica, compresión, lotes, categorías
//   - useFormVariaciones    → variaciones del producto en edición
//   - useFormRecetas        → materiales/receta del compuesto en edición
// Mantiene la MISMA firma de props y el MISMO shape de retorno para que la
// página y los componentes de UI no cambien.
// ==============================================================================

import { useState } from "react"
import type { Producto } from "@/lib/api"
import { useFormProductoCore } from "@/hooks/useFormProductoCore"
import { useFormVariaciones } from "@/hooks/useFormVariaciones"
import { useFormRecetas } from "@/hooks/useFormRecetas"

// Re-export de tipos para mantener compatibilidad con los componentes de UI
// (CardAltaProducto, FormRestock, FormEditar, useInventarioUI, page.tsx).
export type { FormAltaProducto, FormRestock, FormEditProd, FormEditLote } from "@/hooks/useFormProductoCore"
export type { NuevaVariacionAlta } from "@/hooks/useFormVariaciones"
export type { NuevoMaterialAlta } from "@/hooks/useFormRecetas"

export type Tab = "nuevo" | "restock" | "editar"

interface UseInventarioFormArgs {
    // Datos compartidos (provienen de useInventarioData)
    inv: Producto[]
    actualizarInv: (fn: (prev: Producto[]) => Producto[]) => void
    recargar: () => Promise<void>
    cargarCategorias: () => Promise<void>
    // UI del contenedor (la página) que algunos handlers necesitan mutar
    setTab: (tab: Tab) => void
    setRestockProdSeleccionado: (p: Producto | null) => void
}

export function useInventarioForm({
    inv,
    actualizarInv,
    recargar,
    cargarCategorias,
    setTab,
    setRestockProdSeleccionado,
}: UseInventarioFormArgs) {
    // ── Estado compartido por los 3 sub-hooks ──
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }
    // Contexto del producto abierto en "Editar Prod." (lo usan los 3 sub-hooks:
    // core para guardar/cargar, variaciones y recetas para acotar sus operaciones).
    const [prodEditar, setProdEditar] = useState("")
    // Formulario de Restock (el sub-hook de variaciones lo precarga al
    // "Ajustar stock" de una variación, y el core lo envía/limpia al guardar).
    const [restock, setRestock] = useState<{ producto: string; costo: number | string; precio_venta: number | string; stock: number | string; etiqueta: string; variacion: string }>({ producto: "", costo: "", precio_venta: "", stock: 1, etiqueta: "", variacion: "" })

    // ── Sub-hooks de dominio ──
    const variaciones = useFormVariaciones({
        inv,
        actualizarInv,
        prodEditar,
        setRestock,
        setTab,
        setRestockProdSeleccionado,
        mostrarMsg,
    })
    const recetas = useFormRecetas({ inv, prodEditar, mostrarMsg })
    const core = useFormProductoCore({
        inv,
        recargar,
        cargarCategorias,
        setRestockProdSeleccionado,
        mostrarMsg,
        prodEditar,
        setProdEditar,
        restock,
        setRestock,
        // El core guarda las variaciones pendientes junto al producto y las
        // resetea al cargar otro: recibe estado y resets desde su sub-hook.
        editVariaciones: variaciones.editVariaciones,
        pendientesVarRef: variaciones.pendientesVarRef,
        resetEstadoVariaciones: variaciones.resetEstadoVariaciones,
        resetEstadoRecetas: recetas.resetEstadoRecetas,
    })

    return {
        // Mensajes
        msg,
        // Alta de producto
        form: core.form, setForm: core.setForm,
        nuevasVariaciones: core.nuevasVariaciones, setNuevasVariaciones: core.setNuevasVariaciones,
        altaConVariaciones: core.altaConVariaciones, setAltaConVariaciones: core.setAltaConVariaciones,
        nuevosMateriales: core.nuevosMateriales, setNuevosMateriales: core.setNuevosMateriales,
        nuevasFotos: core.nuevasFotos, setNuevasFotos: core.setNuevasFotos,
        nuevaCategoria: core.nuevaCategoria, setNuevaCategoria: core.setNuevaCategoria,
        agregarCategoria: core.agregarCategoria,
        guardarNuevo: core.guardarNuevo,
        guardando: core.guardando,
        // Restock
        restock, setRestock,
        guardarRestock: core.guardarRestock,
        // Edición de producto
        prodEditar, setProdEditar,
        editProdNombre: core.editProdNombre, setEditProdNombre: core.setEditProdNombre,
        editProdVal: core.editProdVal, setEditProdVal: core.setEditProdVal,
        editFotos: core.editFotos, setEditFotos: core.setEditFotos,
        guardarProducto: core.guardarProducto,
        editVariaciones: variaciones.editVariaciones,
        nuevaVarNombre: variaciones.nuevaVarNombre, setNuevaVarNombre: variaciones.setNuevaVarNombre,
        nuevaVarPrecio: variaciones.nuevaVarPrecio, setNuevaVarPrecio: variaciones.setNuevaVarPrecio,
        nuevaVarStock: variaciones.nuevaVarStock, setNuevaVarStock: variaciones.setNuevaVarStock,
        guardandoVar: variaciones.guardandoVar,
        cropVariacion: variaciones.cropVariacion,
        cargarProductoEdicion: core.cargarProductoEdicion,
        registrarCambioVariacion: variaciones.registrarCambioVariacion,
        ajustarStockVariacion: variaciones.ajustarStockVariacion,
        agregarVariacion: variaciones.agregarVariacion,
        eliminarVariacionItem: variaciones.eliminarVariacionItem,
        solicitarFotoVariacion: variaciones.solicitarFotoVariacion,
        cancelarCropVariacion: variaciones.cancelarCropVariacion,
        completarFotoVariacion: variaciones.completarFotoVariacion,
        quitarFotoVariacionItem: variaciones.quitarFotoVariacionItem,
        pendientesVarRef: variaciones.pendientesVarRef,
        // Recetas
        editRecetas: recetas.editRecetas,
        matBuscador: recetas.matBuscador, setMatBuscador: recetas.setMatBuscador,
        matSeleccionado: recetas.matSeleccionado, setMatSeleccionado: recetas.setMatSeleccionado,
        matCantidad: recetas.matCantidad, setMatCantidad: recetas.setMatCantidad,
        matVariacionSel: recetas.matVariacionSel, setMatVariacionSel: recetas.setMatVariacionSel,
        guardandoReceta: recetas.guardandoReceta,
        matSugerencias: recetas.matSugerencias,
        agregarMaterialItem: recetas.agregarMaterialItem,
        editarMaterialItem: recetas.editarMaterialItem,
        eliminarMaterialItem: recetas.eliminarMaterialItem,
        // Lotes en edición
        loteEditandoId: core.loteEditandoId, setLoteEditandoId: core.setLoteEditandoId,
        editLoteVal: core.editLoteVal, setEditLoteVal: core.setEditLoteVal,
        loteEliminarConfirm: core.loteEliminarConfirm, setLoteEliminarConfirm: core.setLoteEliminarConfirm,
        guardarLoteIndividual: core.guardarLoteIndividual,
        eliminarLoteHandler: core.eliminarLoteHandler,
        // Gestión de categorías
        nuevaCatNombre: core.nuevaCatNombre, setNuevaCatNombre: core.setNuevaCatNombre,
        catEditandoId: core.catEditandoId, setCatEditandoId: core.setCatEditandoId,
        catEditandoNombre: core.catEditandoNombre, setCatEditandoNombre: core.setCatEditandoNombre,
        confirmEliminarCat: core.confirmEliminarCat, setConfirmEliminarCat: core.setConfirmEliminarCat,
        guardarNuevaCategoria: core.guardarNuevaCategoria,
        iniciarEditarCategoria: core.iniciarEditarCategoria,
        guardarEditarCategoria: core.guardarEditarCategoria,
        cancelarEditarCategoria: core.cancelarEditarCategoria,
        confirmarEliminarCategoria: core.confirmarEliminarCategoria,
    }
}
