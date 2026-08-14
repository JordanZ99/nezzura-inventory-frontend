// ==============================================================================
// src/hooks/usePosDatos.ts
// Dominio "Datos" del Punto de Venta: carga inicial de inventario (con retry
// de initDB si las tablas no existen), lotes, relación global de las fotos
// (config del catálogo) y validación del JWT (getPerfil → userId).
// Recargar() refresca inventario + lotes tras una venta; lo usa
// usePosCarrito.cobrar vía props (patrón useInventarioForm).
// ==============================================================================

import { useEffect, useState } from "react"
import { api, type Producto, type Lote } from "@/lib/api"

export function usePosDatos() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [lotes, setLotes] = useState<Lote[]>([])
    const [cargando, setCargando] = useState(true)
    // Relación global de las fotos de producto ('1' | '4 / 5') — config del catálogo
    const [relacionImagen, setRelacionImagen] = useState("1")
    const [userId, setUserId] = useState<string>("Cargando...")

    // Validación del JWT (el ID que el backend extrajo del token)
    useEffect(() => {
        api.getPerfil()
            .then((data) => {
                setUserId(data.tenant_id)
            })
            .catch((error) => {
                console.error("Error al validar JWT:", error)
                setUserId("Sesión Inválida")
            })
    }, [])

    useEffect(() => {
        api.getInventario()
            .then(data => setProductos(data))
            .catch(async () => {
                // Tables might not exist — force creation and retry
                try {
                    await api.initDB()
                    const data = await api.getInventario()
                    setProductos(data)
                } catch {
                    // DB is empty, keep empty state
                }
            })
            .finally(() => setCargando(false))

        api.getLotes()
            .then(data => setLotes(data))
            .catch(() => {})

        // Relación global de las fotos (catálogo/POS/gestor): se lee de la config del catálogo
        api.getConfigCatalogo()
            .then(c => setRelacionImagen(c?.relacion_imagen === "4:5" ? "4 / 5" : "1"))
            .catch(() => {})
    }, [])

    /** Refresca inventario + lotes tras una venta (lo invoca usePosCarrito.cobrar) */
    async function recargar() {
        const data = await api.getInventario()
        setProductos(data)
        api.getLotes().then(setLotes).catch(() => {})
    }

    return {
        productos,
        lotes,
        cargando,
        relacionImagen,
        userId,
        recargar,
    }
}
