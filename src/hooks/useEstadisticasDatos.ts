// ==============================================================================
// src/hooks/useEstadisticasDatos.ts
// Dominio "Datos" de Estadísticas: carga inicial (ventas + gastos + inventario
// en Promise.all), recargar(), relación global de las fotos (config del
// catálogo) y el flag responsivo isMobile (matchMedia 899px).
// ==============================================================================

import { useEffect, useState } from "react"
import { api, type Venta, type Gasto, type Producto } from "@/lib/api"

export function useEstadisticasDatos() {
    const [ventas, setVentas] = useState<Venta[]>([])
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [cargando, setCargando] = useState(true)
    // Relación global de las fotos de producto ('1' | '4 / 5') — config del catálogo
    const [relacionImagen, setRelacionImagen] = useState("1")
    // Responsive
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 899px)")
        setIsMobile(mq.matches)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    useEffect(() => {
        api.getConfigCatalogo()
            .then(c => setRelacionImagen(c?.relacion_imagen === "4:5" ? "4 / 5" : "1"))
            .catch(() => {})
    }, [])

    async function recargar() {
        try {
            const [v, g, p] = await Promise.all([api.getVentas(), api.getGastos(), api.getInventario()])
            setVentas(v)
            setGastos(g)
            setProductos(p)
        } catch (e) {
            console.error(e)
        }
    }
    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    return {
        ventas,
        gastos,
        productos,
        cargando,
        recargar,
        relacionImagen,
        isMobile,
    }
}
