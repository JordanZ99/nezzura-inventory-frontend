// ==============================================================================
// src/hooks/usePosCarrito.ts
// El corazón del Punto de Venta: carrito + precios custom con lazy init y
// persistencia en localStorage, agregar (directo / con variación), fusión de
// líneas al cambiar variación, selección de lote con precio sugerido PEPS,
// pasos de cantidad (fraccionables), modo descuento, cobro con advertencia de
// stock (por tipo de producto y por variación) y los modales de variación y de
// advertencia. Recibe productos/lotes/recargar desde usePosDatos y
// setCarritoAbierto desde usePosUI vía props (flujo unidireccional, sin
// dependencias circulares).
// ==============================================================================

import { useEffect, useState } from "react"
import { api, type Producto, type Lote, type ItemCarrito } from "@/lib/api"
import { useToast } from "@/components/ui/Toast"

interface Args {
    productos: Producto[]
    lotes: Lote[]
    recargar: () => Promise<void>
    setCarritoAbierto: (abierto: boolean) => void
}

export function usePosCarrito({ productos, lotes, recargar, setCarritoAbierto }: Args) {
    // Mensajes globales (toast): reemplaza el estado local mensaje del POS.
    const { mostrarMsg } = useToast()

    const [carrito, setCarrito] = useState<ItemCarrito[]>(() => {
        try {
            const saved = localStorage.getItem("pos_carrito")
            return saved ? JSON.parse(saved) : []
        } catch { return [] }
    })
    const [precios, setPrecios] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem("pos_precios")
            return saved ? JSON.parse(saved) : {}
        } catch { return {} }
    })
    const [cobrando, setCobrando] = useState(false)
    const [modoDescuento, setModoDescuento] = useState(false)
    // Estado para el modal de advertencia por stock insuficiente
    const [modalAdvertencia, setModalAdvertencia] = useState<{
        visible: boolean;
        nombres: string;
    }>({ visible: false, nombres: "" })
    // Modal de selección de variación (productos con presentaciones y precio propio)
    const [modalVariacion, setModalVariacion] = useState<{ visible: boolean; prod: Producto | null }>({ visible: false, prod: null })

    function manejarToggleDescuento() {
        if (modoDescuento) {
            // Si lo estamos apagando, reseteamos todos los precios al original de lista.
            // Los ítems CON variación conservan el precio de su variación (no el del lote).
            setCarrito(prev => prev.map(item => {
                if (item.variacion) {
                    const prod = productos.find(p => p.producto === item.producto)
                    const variacion = (prod?.variaciones || []).find(v => v.nombre === item.variacion)
                    return variacion ? { ...item, precio_real: variacion.precio } : item
                }
                const prod = productos.find(p => p.producto === item.producto)
                // Precio sugerido = lote más antiguo con stock (el que PEPS venderá)
                return { ...item, precio_real: prod ? (prod.precio_sugerido ?? prod.precio_venta) : item.precio_real }
            }))
            setPrecios({})
        }
        setModoDescuento(!modoDescuento)
    }

    // Persistir carrito en localStorage al cambiar de sección
    useEffect(() => {
        localStorage.setItem("pos_carrito", JSON.stringify(carrito))
    }, [carrito])

    useEffect(() => {
        localStorage.setItem("pos_precios", JSON.stringify(precios))
    }, [precios])

    function lotesParaProducto(producto: string): Lote[] {
        return lotes.filter(l => l.producto === producto && l.stock_lote > 0)
            .sort((a, b) => new Date(a.fecha_entrada).getTime() - new Date(b.fecha_entrada).getTime())
    }

    // Clave única de cada línea del carrito: producto + variación. Permite tener
    // VARIAS variaciones del mismo producto en el mismo ticket (ej. Sencilla y
    // Doble como líneas independientes, cada una con su precio y cantidad).
    function keyCarrito(item: { producto: string; variacion?: string }): string {
        return item.variacion ? `${item.producto}::${item.variacion}` : item.producto
    }

    // Cambia la variación de un ítem ya en el carrito (precio propio de la variación).
    // Si la combinación destino ya existe en otra línea, se FUSIONA sumando cantidades.
    function cambiarVariacionCarrito(key: string, nombre: string) {
        const item = carrito.find(i => keyCarrito(i) === key)
        if (!item) return
        const prod = productos.find(p => p.producto === item.producto)
        const variacion = (prod?.variaciones || []).find(v => v.nombre === nombre)
        if (!variacion) return
        const nuevaKey = keyCarrito({ producto: item.producto, variacion: nombre })
        if (nuevaKey === key) return
        setCarrito(prev => {
            const sinActual = prev.filter(i => keyCarrito(i) !== key)
            const destino = sinActual.find(i => keyCarrito(i) === nuevaKey)
            if (destino) {
                return sinActual.map(i =>
                    keyCarrito(i) === nuevaKey
                        // Al fusionar se descarta el id_lote (de la fuente y del
                        // destino): que PEPS decida de dónde salir el stock.
                        ? { ...i, cantidad: i.cantidad + item.cantidad, id_lote: undefined, variacion: nombre, precio_real: variacion.precio }
                        : i
                )
            }
            return [...sinActual, { ...item, variacion: nombre, precio_real: variacion.precio }]
        })
        setPrecios(prev => {
            const nuevo = { ...prev }
            delete nuevo[key]
            delete nuevo[nuevaKey]
            return nuevo
        })
    }

    function cambiarLoteCarrito(key: string, id_lote: string | undefined) {
        // Si el ítem tiene variación, el PRECIO lo define la variación (no el lote):
        // el lote solo determina de DÓNDE se descuenta el stock.
        const itemActual = carrito.find(i => keyCarrito(i) === key)
        const itemConVariacion = itemActual?.variacion
        if (itemConVariacion) {
            const prod = productos.find(p => p.producto === itemActual?.producto)
            const variacion = (prod?.variaciones || []).find(v => v.nombre === itemConVariacion)
            setCarrito(prev => prev.map(i =>
                keyCarrito(i) === key ? { ...i, id_lote } : i
            ))
            if (variacion) setPrecios(prev => ({ ...prev, [key]: variacion.precio.toFixed(2) }))
            return
        }
        // Propuesta 2: el precio sugerido sigue al lote seleccionado
        // (y "Más antiguo" usa el precio del lote más antiguo con stock).
        let precioSugerido: number | null = null
        if (id_lote) {
            const lote = lotes.find(l => l.id_lote === id_lote)
            precioSugerido = lote ? lote.precio_venta : null
        } else {
            const prod = productos.find(p => p.producto === itemActual?.producto)
            precioSugerido = prod ? (prod.precio_sugerido ?? prod.precio_venta) : null
        }
        setCarrito(prev => prev.map(i => {
            if (keyCarrito(i) !== key) return i
            return precioSugerido !== null ? { ...i, id_lote, precio_real: precioSugerido } : { ...i, id_lote }
        }))
        if (precioSugerido !== null) {
            const precioStr = precioSugerido.toFixed(2)
            setPrecios(prev => ({ ...prev, [key]: precioStr }))
        }
    }

    function agregarAlCarrito(prod: Producto) {
        // Si el producto tiene variaciones, primero se elige cuál (modal)
        if ((prod.variaciones || []).length > 0) {
            setModalVariacion({ visible: true, prod })
            return
        }
        agregarDirecto(prod)
    }

    function agregarDirecto(prod: Producto) {
        const key = keyCarrito({ producto: prod.producto })
        const yaEnCarrito = carrito.some(i => keyCarrito(i) === key)
        setCarrito(prev => {
            const idx = prev.findIndex(i => keyCarrito(i) === key)
            if (idx >= 0) {
                // NOTA: Ya no limitamos por stock_total para permitir
                // vender aunque el inventario esté en 0 o negativo.
                // La advertencia se muestra al momento de cobrar.
                const nuevo = [...prev]
                nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad + 1 }
                return nuevo
            }
            // Precio sugerido = lote más antiguo con stock (el que PEPS venderá)
            return [...prev, { producto: prod.producto, cantidad: 1, precio_real: (prod.precio_sugerido ?? prod.precio_venta) }]
        })
        // Al añadir un ítem NUEVO, la sugerencia manda: descartamos el precio custom
        // persistido de sesiones anteriores (evita mostrar $30 en el input y cobrar $35).
        if (!yaEnCarrito) {
            setPrecios(prev => {
                const nuevo = { ...prev }
                delete nuevo[key]
                return nuevo
            })
        }
    }

    // Agrega un producto con la variación elegida (precio propio de esa variación).
    // La clave es producto+variación: si ESA combinación ya está, suma cantidad;
    // si es otra variación, crea una línea independiente en el carrito.
    function agregarConVariacion(prod: Producto, nombre: string, precio: number) {
        const key = keyCarrito({ producto: prod.producto, variacion: nombre })
        setCarrito(prev => {
            const idx = prev.findIndex(i => keyCarrito(i) === key)
            if (idx >= 0) {
                const nuevo = [...prev]
                nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad + 1, variacion: nombre, precio_real: precio }
                return nuevo
            }
            return [...prev, { producto: prod.producto, cantidad: 1, precio_real: precio, variacion: nombre }]
        })
        // La variación define el precio: se descarta el precio custom persistido
        setPrecios(prev => {
            const nuevo = { ...prev }
            delete nuevo[key]
            return nuevo
        })
        setModalVariacion({ visible: false, prod: null })
    }

    function cambiarCantidad(key: string, cantidad: number) {
        setCarrito(prev => prev.map(i => keyCarrito(i) === key ? { ...i, cantidad } : i))
    }

    // Paso de los botones ± del carrito:
    //  - Productos por UNIDADES (c/u, no fraccionable): paso entero de 1.
    //    Al llegar a 1 y presionar −, el resultado es 0 → el caller ELIMINA la
    //    línea (evita vender 0.1 llaveros por error de dedo).
    //  - Productos FRACCIONABLES (kg/lt/mt): paso 1 mientras sea > 1 y 0.1 al
    //    bajar de la unidad (2 → 1 → 0.9 → … → 0.01). Desde el mínimo (0.01)
    //    el botón − elimina la línea.
    function pasoCantidad(actual: number, dir: 1 | -1, fracc: boolean): number {
        if (!fracc) {
            return Math.max(0, Math.round(actual + dir))
        }
        // Mínimo vendible por fracción: 0.01 (ej. 10 g). Si ya se llegó al
        // mínimo y se presiona −, devolvemos 0 → el caller ELIMINA la línea.
        if (actual <= 0.01 && dir === -1) return 0
        const paso = actual > 1 ? 1 : 0.1
        return Math.max(0.01, +(actual + dir * paso).toFixed(1))
    }

    function cambiarPrecio(key: string, texto: string) {
        setPrecios(prev => ({ ...prev, [key]: texto }))
        const num = parseFloat(texto.replace(",", "."))
        if (!isNaN(num) && num >= 0)
            setCarrito(prev => prev.map(i => keyCarrito(i) === key ? { ...i, precio_real: num } : i))
    }

    function cambiarTotal(key: string, texto: string) {
        const item = carrito.find(i => keyCarrito(i) === key)
        if (!item || item.cantidad === 0) return

        const totalNum = parseFloat(texto.replace(",", "."))
        if (!isNaN(totalNum) && totalNum >= 0) {
            const nuevoPrecio = totalNum / item.cantidad
            setCarrito(prev => prev.map(i => keyCarrito(i) === key ? { ...i, precio_real: nuevoPrecio } : i))
            // Actualizamos también el string del precio para que se vea el cambio
            setPrecios(prev => ({ ...prev, [key]: nuevoPrecio.toFixed(2) }))
        }
    }

    function quitarDelCarrito(key: string) {
        setCarrito(prev => prev.filter(i => keyCarrito(i) !== key))
    }

    /** Vacía el carrito y limpia la persistencia (cierra también el drawer móvil) */
    function vaciarCarrito() {
        setCarrito([]); setPrecios({}); setCarritoAbierto(false);
        localStorage.removeItem("pos_carrito"); localStorage.removeItem("pos_precios")
    }

    /**
     * Verifica si hay productos con stock insuficiente en el carrito.
     * Si los hay, abre el modal de advertencia en lugar del window.confirm().
     * Si el usuario confirma desde el modal, ejecuta cobrar().
     */
    function cobrarConAdvertencia() {
        if (carrito.length === 0) return

        // Guarda defensiva: ningún ítem puede cobrarse con cantidad 0 o negativa
        // (puede quedar un "0" tipeado si el usuario no salió del campo).
        const invalidos = carrito.filter(item => !(item.cantidad > 0))
        if (invalidos.length > 0) {
            const nombres = invalidos.map(i => i.variacion ? `${i.producto} (${i.variacion})` : i.producto).join(", ")
            mostrarMsg(false, `Corrige la cantidad de: ${nombres} (debe ser mayor a 0)`)
            return
        }

        // Identificar productos del carrito que no tienen stock suficiente.
        // Los servicios y compuestos (sin stock por diseño) nunca disparan la advertencia.
        const sinStock = carrito.filter(item => {
            const prod = productos.find(p => p.producto === item.producto)
            if (prod?.tipo_producto && prod.tipo_producto !== "stock") return false
            // Si el producto tiene variaciones, la comparación es contra el stock
            // de ESA variación (suma de sus lotes), no contra el stock total del
            // producto: así 3 de A + 3 de B con 2 de cada una sí dispara la advertencia.
            if (item.variacion && (prod?.variaciones?.length ?? 0) > 0) {
                const stockVar = (prod?.variaciones || []).find(v => v.nombre === item.variacion)?.stock ?? 0
                return item.cantidad > stockVar
            }
            return !prod || prod.stock_total <= 0 || item.cantidad > prod.stock_total
        })

        if (sinStock.length > 0) {
            // Abrimos el modal personalizado en lugar del window.confirm() nativo
            const nombres = sinStock.map(i => i.variacion ? `${i.producto} (${i.variacion})` : i.producto).join(", ")
            setModalAdvertencia({ visible: true, nombres })
            return
        }

        // Si no hay advertencia, ejecutar cobro directamente
        cobrar()
    }

    /** Callback ejecutado cuando el usuario acepta la advertencia en el modal */
    function confirmarCobroConAdvertencia() {
        setModalAdvertencia({ visible: false, nombres: "" })
        cobrar()
    }

    /** Callback para cancelar desde el modal */
    function cancelarAdvertencia() {
        setModalAdvertencia({ visible: false, nombres: "" })
    }

    // Cerrar los modales con la tecla Escape
    useEffect(() => {
        function manejarEscape(e: KeyboardEvent) {
            if (e.key === "Escape" && modalAdvertencia.visible) {
                cancelarAdvertencia()
            }
            if (e.key === "Escape" && modalVariacion.visible) {
                setModalVariacion({ visible: false, prod: null })
            }
        }
        document.addEventListener("keydown", manejarEscape)
        return () => document.removeEventListener("keydown", manejarEscape)
    }, [modalAdvertencia.visible, modalVariacion.visible])

    async function cobrar() {
        if (carrito.length === 0) return
        setCobrando(true)
        try {
            // Limpiar id_lote vacío/indefinido antes de enviar
            const itemsParaCobro = carrito.map(i => ({
                ...i,
                id_lote: i.id_lote || undefined
            }))
            const res = await api.cobrarCarrito(itemsParaCobro)
            mostrarMsg(true, `Venta registrada — $${res.total_cobrado.toFixed(2)}`)
            setCarrito([]); setPrecios({}); setCarritoAbierto(false);
            localStorage.removeItem("pos_carrito"); localStorage.removeItem("pos_precios")
            // Refrescar inventario + lotes para reflejar el nuevo stock en el grid
            await recargar()
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`)
        } finally { setCobrando(false) }
    }

    function nombreLote(lote: Lote): string {
        const fecha = new Date(lote.fecha_entrada).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" })
        // Si el lote tiene etiqueta de presentación (20cm, Premium...), es lo más útil para distinguirlo
        const etiqueta = lote.etiqueta?.trim()
        if (etiqueta) {
            return `${etiqueta} — $${lote.costo.toFixed(2)} — ${lote.stock_lote}uds`
        }
        return `${fecha} — $${lote.costo.toFixed(2)} — ${lote.stock_lote}uds`
    }

    function lotePorId(id: string): Lote | undefined {
        return lotes.find(l => l.id_lote === id)
    }

    const totalCarrito = carrito.reduce((acc, i) => acc + i.cantidad * i.precio_real, 0)
    const totalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0)

    return {
        // Estado
        carrito,
        precios,
        cobrando,
        modoDescuento,
        modalAdvertencia,
        modalVariacion,
        setModalVariacion,
        // Handlers del carrito
        manejarToggleDescuento,
        agregarAlCarrito,
        agregarDirecto,
        agregarConVariacion,
        cambiarVariacionCarrito,
        cambiarLoteCarrito,
        cambiarCantidad,
        pasoCantidad,
        cambiarPrecio,
        cambiarTotal,
        quitarDelCarrito,
        vaciarCarrito,
        // Cobro
        cobrarConAdvertencia,
        confirmarCobroConAdvertencia,
        cancelarAdvertencia,
        cobrar,
        // Helpers
        keyCarrito,
        lotesParaProducto,
        nombreLote,
        lotePorId,
        // Derivados
        totalCarrito,
        totalItems,
    }
}
