// ==============================================================================
// src/hooks/useGastosForm.ts
// Dominio "Form + Categorías" de Gastos: formulario de registro, edición de
// movimientos y CRUD completo de categorías. Viven juntos porque comparten
// estado: renombrar/eliminar una categoría actualiza form.categoria y
// editCategoria en vivo. También posee los estados de confirmación de los
// modales (eliminar/descartar gasto y eliminar categoría) junto a las acciones
// que los consumen. Recibe recargar() por props (desde useGastosDatos) para
// refrescar tras cada acción — flujo unidireccional, cero dependencias
// circulares. Usa el toast global.
// ==============================================================================

import { useEffect, useState } from "react"
import { api, type Gasto } from "@/lib/api"
import { useToast } from "@/components/ui/Toast"

export interface FormGasto {
    fecha: string
    categoria: string
    descripcion: string
    monto: string
}

export function useGastosForm(recargar: () => Promise<void>) {
    const { mostrarMsg } = useToast()
    const [form, setForm] = useState<FormGasto>({
        fecha: new Date().toISOString().substring(0, 10),
        categoria: "Otros",
        descripcion: "",
        monto: ""
    })
    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [editMonto, setEditMonto] = useState("")
    const [editCategoria, setEditCategoria] = useState("Otros")
    const [editDescripcion, setEditDescripcion] = useState("")

    // ── Estados para modales de confirmación ──
    const [confirmEliminarGastoId, setConfirmEliminarGastoId] = useState<number | null>(null)
    const [confirmDescartarGastoId, setConfirmDescartarGastoId] = useState<number | null>(null)

    // ── Estado para categorías de gasto editables ──
    const [categoriasGasto, setCategoriasGasto] = useState<string[]>(["Otros"])
    const [cargandoCats, setCargandoCats] = useState(false)
    const [nuevaCatNombre, setNuevaCatNombre] = useState("")
    const [catEditandoNombre, setCatEditandoNombre] = useState<string | null>(null)
    const [catEditandoVal, setCatEditandoVal] = useState("")
    const [guardandoCat, setGuardandoCat] = useState(false)
    const [confirmEliminarCatGasto, setConfirmEliminarCatGasto] = useState<string | null>(null)

    /**
     * Carga la lista de categorías de gasto desde la API.
     * Si el tenant no tiene categorías (primer inicio), siembra las categorías
     * por defecto para que el usuario no vea una lista vacía.
     */
    async function cargarCategoriasGasto() {
        setCargandoCats(true)
        try {
            const cats = await api.getCategoriasGasto()
            if (cats.length === 0) {
                // Seed inicial: crear las categorías por defecto
                const defaults = ["Evento", "Decoración", "Materiales", "Alimentos", "Envíos", "Otros"]
                await Promise.all(defaults.map(n => api.crearCategoriaGasto(n).catch(() => {})))
                const cats2 = await api.getCategoriasGasto()
                setCategoriasGasto(cats2.map(c => c.nombre))
            } else {
                setCategoriasGasto(cats.map(c => c.nombre))
            }
        } catch {
            // Si falla la API, usamos las categorías por defecto como fallback
            setCategoriasGasto(["Evento", "Decoración", "Materiales", "Alimentos", "Envíos", "Otros"])
        } finally {
            setCargandoCats(false)
        }
    }
    useEffect(() => { cargarCategoriasGasto() }, [])

    async function guardarNuevaCategoriaGasto() {
        const nombre = nuevaCatNombre.trim()
        if (!nombre || guardandoCat) return
        setGuardandoCat(true)
        try {
            await api.crearCategoriaGasto(nombre)
            setNuevaCatNombre("")
            await cargarCategoriasGasto()
            mostrarMsg(true, `Categoría "${nombre}" creada`)
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error al crear categoría"}`)
        } finally {
            setGuardandoCat(false)
        }
    }

    function iniciarEditarCategoriaGasto(nombre: string) {
        setCatEditandoNombre(nombre)
        setCatEditandoVal(nombre)
    }

    async function guardarEditarCategoriaGasto(viejoNombre: string) {
        const nuevo = catEditandoVal.trim()
        if (!nuevo || nuevo === viejoNombre || guardandoCat) {
            cancelarEditarCategoriaGasto()
            return
        }
        setGuardandoCat(true)
        try {
            await api.editarCategoriaGasto(viejoNombre, nuevo)
            cancelarEditarCategoriaGasto()
            await cargarCategoriasGasto()
            // Actualizar también el form y edit si estaban usando el nombre viejo
            if (form.categoria === viejoNombre) setForm(f => ({ ...f, categoria: nuevo }))
            if (editCategoria === viejoNombre) setEditCategoria(nuevo)
            mostrarMsg(true, `Categoría renombrada a "${nuevo}"`)
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error al renombrar"}`)
        } finally {
            setGuardandoCat(false)
        }
    }

    function cancelarEditarCategoriaGasto() {
        setCatEditandoNombre(null)
        setCatEditandoVal("")
    }

    async function confirmarEliminarCategoriaGasto() {
        const nombre = confirmEliminarCatGasto
        if (!nombre) return
        setConfirmEliminarCatGasto(null)
        try {
            await api.eliminarCategoriaGasto(nombre)
            await cargarCategoriasGasto()
            // Si el form o edit usaban esta categoría, reasignar a Otros
            if (form.categoria === nombre) setForm(f => ({ ...f, categoria: "Otros" }))
            if (editCategoria === nombre) setEditCategoria("Otros")
            mostrarMsg(true, `Categoría "${nombre}" eliminada`)
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error al eliminar categoría"}`)
        }
    }

    async function agregar() {
        const monto = parseFloat(form.monto)
        if (!form.descripcion || isNaN(monto)) return
        try {
            await api.crearGasto({
                fecha: form.fecha + "T12:00:00.000Z",
                categoria: form.categoria,
                descripcion: form.descripcion,
                monto
            })
            mostrarMsg(true, `Gasto registrado: $${monto.toFixed(2)}`)
            setForm(f => ({ ...f, descripcion: "", monto: "" }))
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    async function eliminar(id: number) {
        setConfirmEliminarGastoId(null)
        try {
            await api.eliminarGasto(id)
            mostrarMsg(true, "Gasto eliminado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    async function confirmar(id: number) {
        try {
            await api.confirmarGasto(id)
            mostrarMsg(true, "Gasto confirmado como pagado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    async function descartar(id: number) {
        setConfirmDescartarGastoId(null)
        try {
            await api.descartarGasto(id)
            mostrarMsg(true, "Gasto descartado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    function iniciarEdicion(g: Gasto) {
        setEditandoId(g.id)
        setEditMonto(g.monto.toString())
        setEditCategoria(g.categoria)
        setEditDescripcion(g.descripcion)
    }

    function cancelarEdicion() {
        setEditandoId(null)
        setEditMonto("")
        setEditCategoria("Otros")
        setEditDescripcion("")
    }

    async function guardarEdicion(id: number) {
        const monto = parseFloat(editMonto)
        if (isNaN(monto) || monto <= 0) return
        try {
            await api.actualizarGasto(id, { monto, categoria: editCategoria, descripcion: editDescripcion })
            mostrarMsg(true, "Gasto actualizado")
            cancelarEdicion()
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    return {
        form,
        setForm,
        editandoId,
        setEditandoId,
        editMonto,
        setEditMonto,
        editCategoria,
        setEditCategoria,
        editDescripcion,
        setEditDescripcion,
        confirmEliminarGastoId,
        setConfirmEliminarGastoId,
        confirmDescartarGastoId,
        setConfirmDescartarGastoId,
        categoriasGasto,
        cargandoCats,
        nuevaCatNombre,
        setNuevaCatNombre,
        catEditandoNombre,
        setCatEditandoNombre,
        catEditandoVal,
        setCatEditandoVal,
        guardandoCat,
        confirmEliminarCatGasto,
        setConfirmEliminarCatGasto,
        guardarNuevaCategoriaGasto,
        iniciarEditarCategoriaGasto,
        guardarEditarCategoriaGasto,
        cancelarEditarCategoriaGasto,
        confirmarEliminarCategoriaGasto,
        agregar,
        eliminar,
        confirmar,
        descartar,
        iniciarEdicion,
        cancelarEdicion,
        guardarEdicion,
    }
}
