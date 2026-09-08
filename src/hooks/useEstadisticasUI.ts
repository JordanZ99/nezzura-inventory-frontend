// ==============================================================================
// src/hooks/useEstadisticasUI.ts
// Estado visual + acciones de Estadísticas: dates, búsquedas/órdenes/
// paginación, catálogo de productos (búsqueda con debounce, categoría, orden,
// modal de detalle con carga de fotos) y la edición/anulación de ventas
// (guardarEdicion / anularVenta / iniciarEdicion). Recibe recargar() por props
// (desde useEstadisticasDatos) para refrescar tras guardar/anular — flujo
// unidireccional, cero dependencias circulares. Usa el toast global.
// ==============================================================================

import { useEffect, useState } from "react"
import { api, type Orden, type Producto } from "@/lib/api"
import { useToast } from "@/components/ui/Toast"
import type { DateRangePickerValue } from "@tremor/react"

export interface EditVenta {
    fecha: string
    cantidad: number
    precio_real: number
    total_venta: number
    ganancia_bruta: number
    costo_unitario: number
}

// Presets del selector de período (en español; el "custom" muestra el picker).
// "todo" abre el histórico completo: el backend lo resuelve con ?todo=true.
export type PresetPeriodo = "mtd" | "mes-anterior" | "ultimos-30" | "ytd" | "todo" | "custom"

export function useEstadisticasUI(recargar: () => Promise<void>) {
    const { mostrarMsg } = useToast()
    const [dates, setDates] = useState<DateRangePickerValue>({ from: undefined, to: undefined })

    // Período seleccionado. "Desde este mes" es el DEFAULT y NO envía fechas:
    // el backend aplica el mes contable del negocio según su zona horaria,
    // así el tenant ve (y entiende) que los datos son "desde este mes".
    const [preset, setPresetEstado] = useState<PresetPeriodo>("mtd")

    function setPreset(valor: PresetPeriodo) {
        setPresetEstado(valor)
        if (valor === "mtd" || valor === "todo") {
            // "mtd" delega el mes contable al backend; "todo" pide ?todo=true.
            // En ambos casos no viajan fechas del picker.
            setDates({ from: undefined, to: undefined })
            return
        }
        const hoy = new Date()
        if (valor === "ytd") {
            setDates({ from: new Date(hoy.getFullYear(), 0, 1), to: undefined })
            return
        }
        if (valor === "ultimos-30") {
            const desde = new Date(hoy)
            desde.setDate(desde.getDate() - 29)
            setDates({ from: desde, to: undefined })
            return
        }
        if (valor === "mes-anterior") {
            // new Date(año, mes, 0) = último día del mes anterior
            setDates({
                from: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1),
                to: new Date(hoy.getFullYear(), hoy.getMonth(), 0),
            })
            return
        }
        // "custom": conserva las fechas actuales; el usuario ajusta el picker
    }

    // Paginación
    const [paginaActual, setPaginaActual] = useState(1)
    const [busquedaVentas, setBusquedaVentas] = useState("")
    // La búsqueda del historial viaja al SERVIDOR: se debounced para no
    // disparar una petición por tecla.
    const [busquedaVentasDebounced, setBusquedaVentasDebounced] = useState("")
    useEffect(() => {
        const timer = setTimeout(() => setBusquedaVentasDebounced(busquedaVentas), 300)
        return () => clearTimeout(timer)
    }, [busquedaVentas])
    const [ordenVentas, setOrdenVentas] = useState("fecha-desc")

    // Catálogo de productos en estadísticas
    const [busquedaProd, setBusquedaProd] = useState("")
    const [busquedaProdDebounced, setBusquedaProdDebounced] = useState("")
    useEffect(() => {
        const timer = setTimeout(() => setBusquedaProdDebounced(busquedaProd), 300)
        return () => clearTimeout(timer)
    }, [busquedaProd])
    const [catSelecProd, setCatSelecProd] = useState("Todas")
    const [ordenProd, setOrdenProd] = useState("ventas-desc")
    const [prodSeleccionado, setProdSeleccionado] = useState<Producto | null>(null)
    const [fotosModal, setFotosModal] = useState<{ url: string; orden: number }[]>([])
    const [indiceFoto, setIndiceFoto] = useState(0)

    // Edición / anulación de ventas (renglones)
    const [editando, setEditando] = useState<number | null>(null)
    const [editVal, setEditVal] = useState<EditVenta>({ fecha: "", cantidad: 0, precio_real: 0, total_venta: 0, ganancia_bruta: 0, costo_unitario: 0 })
    const [guardando, setGuardando] = useState(false)
    const [confirmAnularVentaId, setConfirmAnularVentaId] = useState<number | null>(null)

    // Edición / anulación de TICKETS (órdenes)
    const [confirmAnularOrdenId, setConfirmAnularOrdenId] = useState<string | null>(null)
    const [ordenEditando, setOrdenEditando] = useState<string | null>(null)
    const [ordenFecha, setOrdenFecha] = useState("")

    // Cargar todas las imágenes del producto al abrir el modal
    useEffect(() => {
        if (!prodSeleccionado) {
            setFotosModal([])
            setIndiceFoto(0)
            return
        }
        setIndiceFoto(0)
        const fotos: { url: string; orden: number }[] = []
        if (prodSeleccionado.imagen && prodSeleccionado.imagen !== "No hay foto") {
            fotos.push({ url: prodSeleccionado.imagen, orden: 1 })
        }
        api.getImagenesProducto(prodSeleccionado.producto)
            .then(extras => {
                setFotosModal([...fotos, ...extras.map(e => ({ url: e.url, orden: e.orden }))])
            })
            .catch(() => setFotosModal(fotos))
    }, [prodSeleccionado])

    // Reiniciar paginación cuando cambian los filtros
    useEffect(() => {
        setPaginaActual(1)
    }, [dates.from, dates.to, busquedaVentas, ordenVentas])

    async function guardarEdicion() {
        if (editando === null || guardando) return
        setGuardando(true)
        try {
            await api.actualizarVenta(editando, editVal)
            mostrarMsg(true, "Venta actualizada")
            setEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function anularVenta(id: number) {
        setConfirmAnularVentaId(null)
        try {
            await api.eliminarVenta(id)
            mostrarMsg(true, "Venta anulada")
            setEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    /** Entra en modo edición de la fecha de un ticket */
    function iniciarEdicionOrden(o: Orden) {
        setOrdenEditando(o.id)
        setOrdenFecha(new Date(o.fecha).toISOString().substring(0, 10))
    }

    /** Guarda la nueva fecha del ticket (cascada a sus renglones) */
    async function guardarEdicionOrden() {
        if (!ordenEditando || guardando) return
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ordenFecha)) {
            mostrarMsg(false, "❌ Selecciona una fecha válida")
            return
        }
        setGuardando(true)
        try {
            await api.actualizarOrden(ordenEditando, { fecha: ordenFecha })
            mostrarMsg(true, "Ticket actualizado")
            setOrdenEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    /** Anula el ticket completo: restaura el stock de todos sus renglones */
    async function anularOrden(ordenId: string) {
        setConfirmAnularOrdenId(null)
        try {
            const r = await api.anularOrden(ordenId)
            mostrarMsg(true, `Ticket anulado — ${(r.anuladas ?? 0)} renglón(es), stock devuelto`)
            setOrdenEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    /** Descarga una imagen desde una URL con el nombre del producto */
    function descargarImagen(url: string, nombre: string) {
        const a = document.createElement("a")
        a.href = url
        a.download = nombre.replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, "").trim() || "imagen"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    return {
        dates,
        setDates,
        preset,
        setPreset,
        paginaActual,
        setPaginaActual,
        busquedaVentas,
        setBusquedaVentas,
        busquedaVentasDebounced,
        ordenVentas,
        setOrdenVentas,
        busquedaProd,
        setBusquedaProd,
        busquedaProdDebounced,
        catSelecProd,
        setCatSelecProd,
        ordenProd,
        setOrdenProd,
        prodSeleccionado,
        setProdSeleccionado,
        fotosModal,
        setFotosModal,
        indiceFoto,
        setIndiceFoto,
        editando,
        setEditando,
        editVal,
        setEditVal,
        guardando,
        setGuardando,
        confirmAnularVentaId,
        setConfirmAnularVentaId,
        confirmAnularOrdenId,
        setConfirmAnularOrdenId,
        ordenEditando,
        setOrdenEditando,
        ordenFecha,
        setOrdenFecha,
        guardarEdicion,
        anularVenta,
        iniciarEdicionOrden,
        guardarEdicionOrden,
        anularOrden,
        descargarImagen,
    }
}
