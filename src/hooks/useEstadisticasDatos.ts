// ==============================================================================
// src/hooks/useEstadisticasDatos.ts
// Dominio "Datos" de Estadísticas: carga inicial (ventas + gastos + inventario
// en Promise.all), recargar(), relación global de las fotos (config del
// catálogo) y el flag responsivo isMobile (matchMedia 899px).
// ==============================================================================

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/contexts/TenantContext"
import { api, type Venta, type Gasto, type Producto } from "@/lib/api"
import { inventarioQueryKeys } from "@/lib/inventarioQueries"

export function useEstadisticasDatos() {
    const { tenant } = useTenant()
    const queryClient = useQueryClient()
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
            // Editar o anular una venta puede modificar el stock. Se marca la
            // cache del POS como obsoleta para que se actualice al regresar.
            if (tenant?.tenant_id) {
                await Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: inventarioQueryKeys.productos(tenant.tenant_id),
                        refetchType: "active",
                    }),
                    queryClient.invalidateQueries({
                        queryKey: inventarioQueryKeys.lotes(tenant.tenant_id),
                        refetchType: "active",
                    }),
                ])
            }
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
