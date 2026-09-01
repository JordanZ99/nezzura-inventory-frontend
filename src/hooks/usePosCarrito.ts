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
import { api, type Producto, type Lote, type ItemCarrito, type Terminal } from "@/lib/api"
import { NOMBRE_VENTA_LIBRE } from "@/lib/ventaLibre"
import { useToast } from "@/components/ui/Toast"

interface Args {
    productos: Producto[]
    lotes: Lote[]
    terminales: Terminal[]
    recargar: () => Promise<void>
    setCarritoAbierto: (abierto: boolean) => void
    metodoPagoInicial?: string
}

export type MetodoCobro = "efectivo" | "tarjeta_debito" | "tarjeta_credito" | "mixto"
export type MetodoPagoSimple = "efectivo" | "tarjeta_debito" | "tarjeta_credito"
export interface LineaPagoMixto {
    metodo: MetodoPagoSimple
    monto: string
    terminal_id: string
}

function aNumero(texto: string): number {
    const n = parseFloat(texto.replace(",", "."))
    return isNaN(n) ? 0 : n
}

export function usePosCarrito({ productos, lotes, terminales, recargar, setCarritoAbierto, metodoPagoInicial }: Args) {
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
    // ── Panel de cobro (engranaje, Fase A) ──
    const [panelCobro, setPanelCobro] = useState(false)
    const [metodoPago, setMetodoPago] = useState<MetodoCobro>(
        metodoPagoInicial === "tarjeta_debito" || metodoPagoInicial === "tarjeta_credito" || metodoPagoInicial === "mixto"
            ? metodoPagoInicial as MetodoCobro
            : "efectivo"
    )
    const [propina, setPropina] = useState("0")
    const [montoRecibido, setMontoRecibido] = useState("")
    const [pagosMixtos, setPagosMixtos] = useState<LineaPagoMixto[]>([
        { metodo: "efectivo", monto: "", terminal_id: "" },
        { metodo: "tarjeta_credito", monto: "", terminal_id: "" },
    ])
    const [terminalId, setTerminalId] = useState("")  // terminal para método tarjeta simple
    const [subtotalAlAbrir, setSubtotalAlAbrir] = useState(0)
    // Estado para el modal de advertencia por stock insuficiente
    const [modalAdvertencia, setModalAdvertencia] = useState<{
        visible: boolean;
        nombres: string;
    }>({ visible: false, nombres: "" })
    // Modal de selección de variación (productos con presentaciones y precio propio)
    const [modalVariacion, setModalVariacion] = useState<{ visible: boolean; prod: Producto | null }>({ visible: false, prod: null })
    // ── Cobro de mesa (Fase 2) ──
    // Id de la mesa cuyo orden abierto está en el carrito para cobrarse. El
    // backend usa mesa_id para convertir el carrito en el ticket de ESA mesa y
    // liberarla en la misma transacción. Persiste en localStorage porque el
    // carrito también persiste.
    const [mesaCobrando, setMesaCobrando] = useState<string | null>(() => {
        try { return localStorage.getItem("pos_mesa_cobrando") || null } catch { return null }
    })

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

    // Clave única de cada línea del carrito: producto + variación (o producto +
    // descripción en la venta libre). Permite tener VARIAS variaciones del mismo
    // producto en el mismo ticket (ej. Sencilla y Doble como líneas independientes,
    // cada una con su precio y cantidad) y varios artículos libres distintos.
    function keyCarrito(item: { producto: string; variacion?: string; descripcion?: string }): string {
        if (item.variacion) return `${item.producto}::${item.variacion}`
        if (item.descripcion) return `${item.producto}::${item.descripcion}`
        return item.producto
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

    // ── Venta libre (migración 036) ──
    // Renglón del producto genérico 'Venta libre' (tile fijo del POS): cobra
    // algo que NO está registrado en inventario con descripción y precio
    // capturados al vuelo; costo opcional (0 = ganancia = precio completo).
    // Dos capturas con la MISMA descripción fusionan cantidad; con otra
    // descripción crean una línea independiente (misma mecánica que variaciones).
    function agregarVentaLibre(descripcion: string, precio: number, costo: number) {
        const desc = descripcion.trim()
        const item: ItemCarrito = {
            producto: NOMBRE_VENTA_LIBRE,
            cantidad: 1,
            precio_real: Math.max(0, precio),
            ...(desc ? { descripcion: desc } : {}),
            ...(costo > 0 ? { costo } : {}),
        }
        const key = keyCarrito(item)
        setCarrito(prev => {
            const idx = prev.findIndex(i => keyCarrito(i) === key)
            if (idx >= 0) {
                const nuevo = [...prev]
                nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad + 1, precio_real: item.precio_real, costo: item.costo }
                return nuevo
            }
            return [...prev, item]
        })
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
        setPanelCobro(false); setPropina("0"); setMontoRecibido("")
        setPagosMixtos([
            { metodo: "efectivo", monto: "", terminal_id: "" },
            { metodo: "tarjeta_credito", monto: "", terminal_id: "" },
        ])
        localStorage.removeItem("pos_carrito"); localStorage.removeItem("pos_precios")
        // Si se estaba cobrando una mesa, el cobro quedó cancelado
        setMesaCobrando(null); localStorage.removeItem("pos_mesa_cobrando")
    }

    // ── Cobro de mesa (Fase 2) ──
    // Carga los renglones de la orden abierta de una mesa EN el carrito y abre
    // el panel de cobro: el ticket se cobra con el flujo de cobro EXISTENTE
    // (método, propina, mixto, cambio, terminal, turno). Al cobrar, el backend
    // recibe mesa_id y libera la mesa en la misma transacción del cobro.
    function iniciarCobroMesa(items: ItemCarrito[], mesaId: string) {
        setCarrito(items)
        setPrecios({})
        setCarritoAbierto(false)
        setPanelCobro(true)
        setPropina("0")
        setMontoRecibido("")
        setMesaCobrando(mesaId)
        localStorage.setItem("pos_mesa_cobrando", mesaId)
    }

    /** Cancela el cobro de mesa: el carrito se vacía y la orden abierta queda
     *  intacta en el servidor (nada se tocó todavía). */
    function cancelarCobroMesa() {
        vaciarCarrito()
    }

    const totalCarrito = carrito.reduce((acc, i) => acc + i.cantidad * i.precio_real, 0)
    const totalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0)

    // ── Panel de cobro: derivados y handlers ──
    const propinaNum = Math.max(0, aNumero(propina))
    const totalAPagar = totalCarrito + propinaNum
    const recibidoNum = aNumero(montoRecibido)
    // Efectivo: si no se capturó "recibió", se asume pago exacto (cambio 0)
    const cambio = metodoPago === "efectivo"
        ? Math.max(0, +((isNaN(parseFloat(montoRecibido.replace(",", "."))) ? totalAPagar : recibidoNum) - totalAPagar).toFixed(2))
        : 0
    const sumaMixta = pagosMixtos.reduce((a, p) => a + aNumero(p.monto), 0)
    const faltanteMixto = metodoPago === "mixto" ? +(totalAPagar - sumaMixta).toFixed(2) : 0

    /** Entra/sale del panel de cobro; al entrar congela el subtotal original
     *  (para poder restaurarlo después de un descuento). */
    function togglePanelCobro() {
        setPanelCobro(v => {
            if (!v) setSubtotalAlAbrir(totalCarrito)
            return !v
        })
    }

    /** Fija el subtotal del carrito a un monto concreto (descuento directo):
     *  reparte proporcionalmente entre los renglones; el último absorbe el
     *  redondeo para que la suma cuadre al centavo. */
    function aplicarSubtotal(texto: string) {
        const nuevo = parseFloat(texto.replace(",", "."))
        if (isNaN(nuevo) || nuevo < 0 || carrito.length === 0) return
        const actual = carrito.reduce((a, i) => a + i.cantidad * i.precio_real, 0)
        if (actual <= 0) return
        const factor = nuevo / actual
        const totalEscala = (i: ItemCarrito) => Math.round(i.cantidad * i.precio_real * factor * 100) / 100
        setCarrito(prev => prev.map((i, idx) => {
            const totalItem = idx === prev.length - 1
                ? +(nuevo - prev.slice(0, idx).reduce((a, j) => a + totalEscala(j), 0)).toFixed(2)
                : totalEscala(i)
            return { ...i, precio_real: i.cantidad > 0 ? totalItem / i.cantidad : i.precio_real }
        }))
        // Los inputs de precio por renglón se re-derivan del carrito (fallback item.precio_real)
        setPrecios({})
    }

    function setLineaMixta(idx: number, campo: "metodo" | "monto" | "terminal_id", valor: string) {
        setPagosMixtos(prev => prev.map((l, i) => i === idx
            ? (campo === "metodo" ? { ...l, metodo: valor as MetodoPagoSimple } : { ...l, [campo]: valor })
            : l
        ))
    }

    function agregarLineaMixta() {
        setPagosMixtos(prev => [...prev, { metodo: "tarjeta_debito", monto: "", terminal_id: "" }])
    }

    function quitarLineaMixta(idx: number) {
        setPagosMixtos(prev => prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev)
    }

    /** Comisión estimada de un pago con tarjeta según su terminal (Fase B) */
    function comisionEstimada(metodo: MetodoPagoSimple, monto: number, terminal_id: string): number {
        if (monto <= 0 || (metodo !== "tarjeta_debito" && metodo !== "tarjeta_credito")) return 0
        const t = terminales.find(x => x.id === terminal_id)
        if (!t) return 0
        const pct = metodo === "tarjeta_debito" ? t.comision_debito_pct : t.comision_credito_pct
        return +(monto * pct / 100 + t.comision_fija).toFixed(2)
    }

    /** Construye el payload de pago; devuelve null (con toast) si no cuadra */
    function construirPago(): { metodo: string; propina: number; pagos?: { metodo: string; monto: number }[]; monto_recibido?: number } | null {
        if (metodoPago === "efectivo") {
            const recibio = montoRecibido.trim() !== ""
            if (recibio && recibidoNum < totalAPagar - 0.005) {
                mostrarMsg(false, `El monto recibido ($${recibidoNum.toFixed(2)}) es menor al total a pagar ($${totalAPagar.toFixed(2)})`)
                return null
            }
            return {
                metodo: "efectivo",
                propina: +propinaNum.toFixed(2),
                ...(recibio ? { monto_recibido: +recibidoNum.toFixed(2) } : {}),
            }
        }
        if (metodoPago === "mixto") {
            const lineas = pagosMixtos
                .map(l => ({ metodo: l.metodo, monto: +aNumero(l.monto).toFixed(2), terminal_id: l.terminal_id || undefined }))
                .filter(l => l.monto > 0)
            if (lineas.length < 2) {
                mostrarMsg(false, "El pago mixto necesita al menos dos montos")
                return null
            }
            if (Math.abs(faltanteMixto) > 0.01) {
                mostrarMsg(false, `Los pagos suman $${sumaMixta.toFixed(2)} de $${totalAPagar.toFixed(2)} — ajusta los montos`)
                return null
            }
            return { metodo: "mixto", propina: +propinaNum.toFixed(2), pagos: lineas }
        }
        return {
            metodo: metodoPago,
            propina: +propinaNum.toFixed(2),
            ...(terminalId ? { terminal_id: terminalId } : {}),
        }
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
            // Venta libre: no tiene inventario por diseño (y su producto genérico
            // no viene en la lista de productos, así que sin este guard el
            // `!prod` de abajo la marcaría como "sin stock" siempre).
            if (item.producto === NOMBRE_VENTA_LIBRE) return false
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
        const pago = construirPago()
        if (pago === null) return
        setCobrando(true)
        try {
            // Limpiar id_lote vacío/indefinido antes de enviar
            const itemsParaCobro = carrito.map(i => ({
                ...i,
                id_lote: i.id_lote || undefined
            }))
            const res = await api.cobrarCarrito(itemsParaCobro, pago, mesaCobrando)
            const cambioTxt = res.cambio && res.cambio > 0 ? ` · Cambio: $${res.cambio.toFixed(2)}` : ""
            const mesaTxt = res.mesa_nombre ? ` · Mesa ${res.mesa_nombre} liberada` : ""
            mostrarMsg(true, `Venta registrada — $${res.total_cobrado.toFixed(2)}${cambioTxt}${mesaTxt}`)
            setCarrito([]); setPrecios({}); setCarritoAbierto(false);
            setPanelCobro(false); setPropina("0"); setMontoRecibido(""); setTerminalId("")
            setPagosMixtos([
                { metodo: "efectivo", monto: "", terminal_id: "" },
                { metodo: "tarjeta_credito", monto: "", terminal_id: "" },
            ])
            localStorage.removeItem("pos_carrito"); localStorage.removeItem("pos_precios")
            // El cobro de mesa terminó bien: el backend ya liberó la mesa
            setMesaCobrando(null); localStorage.removeItem("pos_mesa_cobrando")
            // Refrescar inventario + lotes + ventas/órdenes (ticket nuevo en Estadísticas)
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

    return {
        // Estado
        carrito,
        precios,
        cobrando,
        modoDescuento,
        modalAdvertencia,
        modalVariacion,
        setModalVariacion,
        // Cobro de mesa (Fase 2)
        mesaCobrando,
        iniciarCobroMesa,
        cancelarCobroMesa,
        // Panel de cobro (Fase A)
        panelCobro,
        togglePanelCobro,
        metodoPago,
        setMetodoPago,
        propina,
        setPropina,
        montoRecibido,
        setMontoRecibido,
        pagosMixtos,
        setLineaMixta,
        agregarLineaMixta,
        quitarLineaMixta,
        terminalId,
        setTerminalId,
        comisionEstimada,
        subtotalAlAbrir,
        aplicarSubtotal,
        totalAPagar,
        cambio,
        sumaMixta,
        faltanteMixto,
        // Handlers del carrito
        manejarToggleDescuento,
        agregarAlCarrito,
        agregarDirecto,
        agregarConVariacion,
        agregarVentaLibre,
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
