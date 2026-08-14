// ==============================================================================
// src/hooks/useFormVariaciones.ts
// Sub-hook del módulo Inventario: lógica, estado y validaciones de las
// VARIACIONES del producto en edición — agregar, eliminar, foto por variación
// (con cropper) y el guardado unificado de cambios con "Guardar Cambios".
// No toca JSX: devuelve estado, setters y handlers para que el orquestador
// (useInventarioForm) los combine con los otros sub-hooks.
// ==============================================================================

import { useRef, useState } from "react"
import { api, Producto, Variacion } from "@/lib/api"
import { comprimirImagen } from "@/lib/image-utils"
// Imports SOLO de tipos (se borran en compilación): no crean ciclos en runtime.
import type { FormRestock } from "@/hooks/useFormProductoCore"
import type { Tab } from "@/hooks/useInventarioForm"

// Variaciones pendientes del ALTA (se guardan en la misma transacción que el
// producto, vía crear_producto_completo). Vive aquí por dominio y el hook
// principal la re-exporta para mantener compatibilidad con la UI.
export type NuevaVariacionAlta = { nombre: string; precio: number; stock_inicial?: number; costo?: number }

interface UseFormVariacionesArgs {
    inv: Producto[]
    actualizarInv: (fn: (prev: Producto[]) => Producto[]) => void
    prodEditar: string
    setRestock: React.Dispatch<React.SetStateAction<FormRestock>>
    setTab: (tab: Tab) => void
    setRestockProdSeleccionado: (p: Producto | null) => void
    mostrarMsg: (ok: boolean, texto: string) => void
}

export function useFormVariaciones({
    inv,
    actualizarInv,
    prodEditar,
    setRestock,
    setTab,
    setRestockProdSeleccionado,
    mostrarMsg,
}: UseFormVariacionesArgs) {
    // ── Variaciones del producto en edición (Fase 2) ──
    // Cada variación es una presentación con su PROPIO precio (ej. Sencilla/Doble, S/M/L).
    const [editVariaciones, setEditVariaciones] = useState<Variacion[]>([])
    const [nuevaVarNombre, setNuevaVarNombre] = useState("")
    const [nuevaVarPrecio, setNuevaVarPrecio] = useState("" as number | string)
    // Stock inicial de la nueva variación en edición (crea su lote, como el ALTA)
    const [nuevaVarStock, setNuevaVarStock] = useState("1")
    const [guardandoVar, setGuardandoVar] = useState(false)
    // Crop de la foto de una variación: al elegir archivo se abre el MISMO
    // cropper que usan las fotos de producto (con el ratio global 1:1 / 4:5).
    const [cropVariacion, setCropVariacion] = useState<{ variacionId: number; url: string; file: File } | null>(null)

    // Guardado unificado de variaciones: cambios pendientes (nombre/precio) que
    // se persisten con el botón global "Guardar Cambios". Es un ref compartido:
    // el hook principal (orquestador) lo expone a la página y useFormProductoCore
    // lo lee/limpia al guardar el producto o al cargar otro.
    const pendientesVarRef = useRef<Record<number, { nombre: string; precio: number }>>({})

    // ── Guardado unificado de variaciones ──
    // Registra cambios pendientes (nombre/precio) de una fila; se persisten
    // todos juntos al presionar "Guardar Cambios".
    function registrarCambioVariacion(id: number, nombre: string, precio: number) {
        pendientesVarRef.current[id] = { nombre, precio }
    }

    // ── Ajustar stock de una variación ──
    // Salta a la pestaña Restock con el producto y la variación precargados,
    // para crear/llenar el lote de esa variación sin salir del flujo.
    function ajustarStockVariacion(v: Variacion) {
        const prod = inv.find(p => p.producto === prodEditar)
        if (!prod) return
        setTab("restock")
        setRestockProdSeleccionado(prod)
        setRestock(r => ({
            ...r,
            producto: prod.producto,
            costo: Number(prod.costo_promedio ?? 0).toFixed(2),
            precio_venta: Number(prod.precio_venta ?? 0).toFixed(2),
            variacion: v.nombre,
        }))
    }

    // ── CRUD de variaciones (Fase 2) ──
    // Cada variación es una presentación con su PROPIO precio para el mismo
    // producto (ej. hamburguesa Sencilla/Doble, remera S/M/L).
    async function agregarVariacion() {
        if (!prodEditar || guardandoVar) return
        const nombre = nuevaVarNombre.trim()
        if (!nombre) { mostrarMsg(false, "Escribe un nombre para la variación"); return }
        setGuardandoVar(true)
        try {
            const prodCosto = inv.find(p => p.producto === prodEditar)?.costo_promedio
            const res = await api.crearVariacion(
                prodEditar, nombre,
                Number(nuevaVarPrecio === "" ? 0 : nuevaVarPrecio),
                undefined,
                nuevaVarStock === "" ? undefined : Number(nuevaVarStock),
                Number(prodCosto ?? 0)
            )
            if (res.ok) {
                setEditVariaciones(prev => [...prev, res.variacion])
                setNuevaVarNombre(""); setNuevaVarPrecio(""); setNuevaVarStock("1")
                mostrarMsg(true, `Variación '${res.variacion.nombre}' agregada${(res.variacion.stock ?? 0) > 0 ? ` con ${res.variacion.stock} uds de stock` : ""}`)
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al agregar la variación")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    async function eliminarVariacionItem(id: number) {
        if (guardandoVar) return
        if (!confirm("¿Eliminar esta variación? Los productos con esta variación en ventas históricas conservarán el texto.")) return
        setGuardandoVar(true)
        try {
            const res = await api.eliminarVariacion(id)
            if (res.ok) {
                setEditVariaciones(prev => prev.filter(v => v.id !== id))
                mostrarMsg(true, "Variación eliminada")
            } else if ("requiere_confirmacion" in res && res.requiere_confirmacion) {
                // La variación tiene stock: advertir y ofrecer eliminar de todos modos
                setGuardandoVar(false)
                const ok = window.confirm(
                    `${res.mensaje}\n\nUnidades en stock: ${res.unidades} (${res.lotes} lote(s)).\n\nSi la eliminas, su stock desaparecerá del inventario.`
                )
                if (!ok) return
                setGuardandoVar(true)
                const res2 = await api.eliminarVariacion(id, true)
                if (res2.ok) {
                    setEditVariaciones(prev => prev.filter(v => v.id !== id))
                    mostrarMsg(true, "Variación eliminada")
                } else {
                    mostrarMsg(false, (res2 as { mensaje?: string }).mensaje ?? "Error al eliminar")
                }
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al eliminar")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    // ── Foto por variación (Fase 5) ──
    // La foto de la variación se muestra en el catálogo al elegir esa
    // presentación (ej. la foto de la Hamburguesa Doble).
    //
    // Al elegir un archivo se abre el MISMO cropper que usan las fotos de
    // producto (ImageCropperModal, con el ratio global 1:1 / 4:5) y recién
    // después se comprime y sube a Cloudinary.
    function solicitarFotoVariacion(v: Variacion, file: File) {
        if (!prodEditar || guardandoVar) return
        // Si quedaba un crop abierto, liberar su URL temporal
        if (cropVariacion) URL.revokeObjectURL(cropVariacion.url)
        const url = URL.createObjectURL(file)
        setCropVariacion({ variacionId: v.id, url, file })
    }

    function cancelarCropVariacion() {
        if (cropVariacion) URL.revokeObjectURL(cropVariacion.url)
        setCropVariacion(null)
    }

    /** El usuario aceptó el recorte: comprimir y subir la foto de la variación */
    async function completarFotoVariacion(blob: Blob) {
        if (!cropVariacion) return
        const { variacionId, url, file } = cropVariacion
        URL.revokeObjectURL(url)
        setCropVariacion(null)

        const nombreBase = file.name.replace(/\.[^.]+$/, "")
        const croppedFile = new File([blob], `${nombreBase}_cropped.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
        })
        const v = editVariaciones.find(x => x.id === variacionId)
        if (!v) return
        await subirFotoVariacionItem(v, croppedFile)
    }

    /** Sube (comprime + Cloudinary) la foto YA recortada de una variación */
    async function subirFotoVariacionItem(v: Variacion, file: File) {
        if (!prodEditar || guardandoVar) return
        setGuardandoVar(true)
        try {
            const comp = await comprimirImagen(file)
            const res = await api.subirFotoVariacion(v.id, comp)
            setEditVariaciones(prev => prev.map(x => x.id === v.id ? { ...x, foto: res.url } : x))
            actualizarInv(prev => prev.map(p => p.producto === prodEditar
                ? { ...p, variaciones: (p.variaciones || []).map(x => x.id === v.id ? { ...x, foto: res.url } : x) }
                : p))
            mostrarMsg(true, "Foto de la variación guardada")
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    async function quitarFotoVariacionItem(v: Variacion) {
        if (!prodEditar || guardandoVar) return
        setGuardandoVar(true)
        try {
            if (v.foto && v.foto !== "No hay foto") api.borrarImagen(v.foto).catch(() => {})
            const res = await api.editarVariacion(v.id, v.nombre, v.precio, "")
            if (res.ok) {
                setEditVariaciones(prev => prev.map(x => x.id === v.id ? res.variacion : x))
                actualizarInv(prev => prev.map(p => p.producto === prodEditar
                    ? { ...p, variaciones: (p.variaciones || []).map(x => x.id === v.id ? { ...x, foto: "" } : x) }
                    : p))
                mostrarMsg(true, "Foto de la variación eliminada")
            } else {
                mostrarMsg(false, (res as { mensaje?: string }).mensaje ?? "Error al quitar la foto")
            }
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardandoVar(false) }
    }

    /** Resetea el estado de variaciones al cargar un producto en edición.
     *  Lo invoca useFormProductoCore dentro de cargarProductoEdicion. */
    function resetEstadoVariaciones(prod: Producto) {
        setEditVariaciones(prod.variaciones ?? [])
        setNuevaVarNombre(""); setNuevaVarPrecio(""); setNuevaVarStock("1")
    }

    return {
        // Variaciones en edición
        editVariaciones, setEditVariaciones,
        nuevaVarNombre, setNuevaVarNombre,
        nuevaVarPrecio, setNuevaVarPrecio,
        nuevaVarStock, setNuevaVarStock,
        guardandoVar,
        cropVariacion,
        pendientesVarRef,
        registrarCambioVariacion,
        ajustarStockVariacion,
        agregarVariacion,
        eliminarVariacionItem,
        solicitarFotoVariacion,
        cancelarCropVariacion,
        completarFotoVariacion,
        quitarFotoVariacionItem,
        // Interno para el orquestador (lo consume useFormProductoCore)
        resetEstadoVariaciones,
    }
}
