"use client"
// ==============================================================================
// src/app/page.tsx  —  Punto de Venta (rediseño Argon primary)
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Producto, ItemCarrito, Lote } from "@/lib/api"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import { supabase } from "@/lib/supabase"
import { useTenant } from "@/contexts/TenantContext"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

export default function PuntoDeVenta() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [lotes, setLotes] = useState<Lote[]>([])
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
    const [busqueda, setBusqueda] = useState("")
    const [cargando, setCargando] = useState(true)
    const [cobrando, setCobrando] = useState(false)
    const [carritoAbierto, setCarritoAbierto] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
    const [modoDescuento, setModoDescuento] = useState(false)
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("Todas")
    // Estado para el tipo de ordenamiento de los productos
    const [ordenamiento, setOrdenamiento] = useState<string>("alfabetico")
    // Estado para el modal de advertencia por stock insuficiente
    const [modalAdvertencia, setModalAdvertencia] = useState<{
        visible: boolean;
        nombres: string;
    }>({ visible: false, nombres: "" })
    // Modal de selección de variación (productos con presentaciones y precio propio)
    const [modalVariacion, setModalVariacion] = useState<{ visible: boolean; prod: Producto | null }>({ visible: false, prod: null })
    const [userId, setUserId] = useState<string>("Cargando...");
    const { tenant } = useTenant()
    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "Nezzura Digital"


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

    useEffect(() => {
        api.getPerfil()
            .then((data) => {
                // Guardamos el ID que el backend extrajo del JWT
                setUserId(data.tenant_id);
            })
            .catch((error) => {
                console.error("Error al validar JWT:", error);
                setUserId("Sesión Inválida");
            });
    }, []);


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
    }, [])

    // Persistir carrito en localStorage al cambiar de sección
    useEffect(() => {
        localStorage.setItem("pos_carrito", JSON.stringify(carrito))
    }, [carrito])

    useEffect(() => {
        localStorage.setItem("pos_precios", JSON.stringify(precios))
    }, [precios])

    const categorias = ["Todas", ...Array.from(new Set(productos.flatMap(p => (p.categoria || ["General"]).map(c => c.trim())))).sort()]

    const productosFiltrados = productos.filter(p => {
        const busquedaBase = busqueda.toLowerCase()
        const porBusqueda = p.producto.toLowerCase().includes(busquedaBase) ||
            p.descripcion?.toLowerCase().includes(busquedaBase) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(busquedaBase)

        const porCategoria = categoriaSeleccionada === "Todas" || (p.categoria || ["General"]).includes(categoriaSeleccionada)
        return porBusqueda && porCategoria
    }).sort((a, b) => {
        // Aplicamos el ordenamiento seleccionado por el usuario
        switch (ordenamiento) {
            case "precio-desc":
                return b.precio_venta - a.precio_venta
            case "precio-asc":
                return a.precio_venta - b.precio_venta
            case "stock-desc":
                return b.stock_total - a.stock_total
            case "stock-asc":
                return a.stock_total - b.stock_total
            case "alfabetico":
                return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
            case "alfabetico-desc":
                return b.producto.localeCompare(a.producto, "es", { sensitivity: "base" })
            default:
                return a.stock_total - b.stock_total
        }
    })

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

    /**
     * Verifica si hay productos con stock insuficiente en el carrito
     * y muestra una confirmación antes de proceder con el cobro.
     * Si el usuario acepta, ejecuta cobrar().
     */
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
            setMensaje({ tipo: "error", texto: `Corrige la cantidad de: ${nombres} (debe ser mayor a 0)` })
            return
        }

        // Identificar productos del carrito que no tienen stock suficiente.
        // Los servicios y compuestos (sin stock por diseño) nunca disparan la advertencia.
        const sinStock = carrito.filter(item => {
            const prod = productos.find(p => p.producto === item.producto)
            if (prod?.tipo_producto && prod.tipo_producto !== "stock") return false
            // Con stock por variación, la comparación es contra el stock de ESA
            // variación (suma de sus lotes), no contra el stock total del producto:
            // así 3 de A + 3 de B con 2 de cada una sí dispara la advertencia.
            if (prod?.stock_por_variacion && item.variacion) {
                const stockVar = (prod.variaciones || []).find(v => v.nombre === item.variacion)?.stock ?? 0
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
        setCobrando(true); setMensaje(null)
        try {
            // Limpiar id_lote vacío/indefinido antes de enviar
            const itemsParaCobro = carrito.map(i => ({
                ...i,
                id_lote: i.id_lote || undefined
            }))
            const res = await api.cobrarCarrito(itemsParaCobro)
            setMensaje({ tipo: "ok", texto: `Venta registrada — $${res.total_cobrado.toFixed(2)}` })
            setCarrito([]); setPrecios({}); setCarritoAbierto(false);
            localStorage.removeItem("pos_carrito"); localStorage.removeItem("pos_precios")
            const data = await api.getInventario()
            setProductos(data)
            api.getLotes().then(setLotes).catch(() => {})
        } catch (e: unknown) {
            setMensaje({ tipo: "error", texto: `${e instanceof Error ? e.message : "Error"}` })
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

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>

            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-1)", padding: "32px 24px 80px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={400}
                        magnetRadius={12}
                        ringRadius={8}
                        waveSpeed={0.5}
                        waveAmplitude={1.2}
                        particleSize={1.5}
                        lerpSpeed={0.08}
                        color="var(--ag-color-1)"
                        autoAnimate={true}
                        particleVariance={0.8}
                        rotationSpeed={0.3}
                        depthFactor={0.5}
                        pulseSpeed={2}
                        particleShape="capsule"
                        fieldStrength={8}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p className="hidden md:block" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>
                        Te damos la bienvenida
                    </p>

                    <h1 className="hidden md:flex" style={{ color: "#fff", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}>
                        <Icon name="ShoppingCart" size={32} color="#fff" />
                        Punto de Venta
                    </h1>

                    <h1 className="flex md:hidden" style={{ color: "#fff", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 12 }}>
                        <img src={logoSrc} alt={empresa}
                            style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", background: "white", padding: 3 }} />
                        Punto de Venta
                    </h1>
                    <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.875rem", margin: 0 }}>
                        {productos.length} productos disponibles hoy
                    </p>
                </div>
            </div>

            {/* ── Contenido sobre el hero ── */}
            <div style={{ padding: "0 16px", marginTop: -16 }}>

                {/* Mensaje de resultado */}
                {mensaje && (
                    <div className="fade-up card" style={{
                        padding: "12px 16px", marginBottom: 12,
                        borderLeft: `4px solid ${mensaje.tipo === "ok" ? "#4caf50" : "#f44336"}`,
                        color: mensaje.tipo === "ok" ? "#2e7d32" : "#b71c1c",
                        fontSize: "0.875rem", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 8
                    }}>
                        <Icon name={mensaje.tipo === "ok" ? "CircleCheck" : "CircleX"} size={18} color={mensaje.tipo === "ok" ? "#2e7d32" : "#b71c1c"} />
                        {mensaje.texto}
                    </div>
                )}

                {/* Layout desktop: catálogo + carrito lateral */}
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

                    {/* ── Catálogo ── */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* ── Filtro de categorías como pills (inspirado en Editar Prod.) ── */}
                        <div style={{ marginBottom: 12 }}>
                            <p style={{
                                fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
                                textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px"
                            }}>
                                Filtrar por categoría
                            </p>
                            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 8px 8px", scrollbarWidth: "none" }}>
                                {categorias.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoriaSeleccionada(cat)}
                                        style={{
                                            padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.78rem",
                                            whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                                            background: categoriaSeleccionada === cat ? "var(--primary-mid)" : "var(--bg-card2)",
                                            color: categoriaSeleccionada === cat ? "#fff" : "var(--primary-dark)",
                                            boxShadow: categoriaSeleccionada === cat ? "0 2px 6px var(--primary-glow)" : "none"
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 200 }}>
                                <Icon name="Search" size={20} color="var(--text-muted)" />
                                <input
                                    className="input-primary"
                                    style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                                    placeholder="Buscar producto, código o categoría..."
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                                <button
                                    onClick={() => {
                                        setOrdenamiento(prev => {
                                            if (prev === "alfabetico") return "alfabetico-desc"
                                            if (prev === "alfabetico-desc") return "alfabetico"
                                            if (prev.endsWith("-asc")) return prev.replace("-asc", "-desc")
                                            if (prev.endsWith("-desc")) return prev.replace("-desc", "-asc")
                                            return prev
                                        })
                                    }}
                                    title="Invertir orden"
                                    style={{
                                        background: "none", border: "none",
                                        cursor: "pointer", padding: 4,
                                        borderRadius: 6, display: "flex", alignItems: "center",
                                        transition: "all 0.15s"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card2)" }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "none" }}
                                >
                                    <Icon name="ArrowUpDown" size={20} color="var(--text-muted)" />
                                </button>
                                <select
                                    className="input-primary"
                                    style={{ border: "none", padding: "4px 8px", fontSize: "0.85rem", background: "transparent", cursor: "pointer", fontWeight: 700, color: "var(--primary-dark)" }}
                                    value={ordenamiento}
                                    onChange={e => setOrdenamiento(e.target.value)}
                                >
                                    <option value="stock-desc">Mayor stock</option>
                                    <option value="stock-asc">Menor stock</option>
                                    <option value="precio-desc">Mayor precio</option>
                                    <option value="precio-asc">Menor precio</option>
                                    <option value="alfabetico">Alfabético A-Z</option>
                                    <option value="alfabetico-desc">Alfabético Z-A</option>
                                </select>
                            </div>
                        </div>

                        {cargando ? (
                            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                                Cargando productos...
                            </div>
                        ) : (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                                gap: 12,
                            }}>
                                {productosFiltrados.map(prod => (
                                    <div key={prod.producto} className="card fade-up" style={{
                                        padding: 12,
                                        cursor: "pointer",
                                        transition: "transform 0.15s, box-shadow 0.15s",
                                    }}
                                        onClick={() => agregarAlCarrito(prod)}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = "translateY(-3px)"
                                            e.currentTarget.style.boxShadow = "0 8px 30px var(--primary-glow)"
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = ""
                                            e.currentTarget.style.boxShadow = ""
                                        }}>
                                        <div style={{
                                            aspectRatio: "1", borderRadius: 12,
                                            background: "var(--gradient-bg-login)",
                                            marginBottom: 10, overflow: "hidden",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            {prod.imagen && prod.imagen !== "No hay foto" ? (
                                                <img src={prod.imagen.startsWith("http") ? prod.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${prod.imagen}`}
                                                    alt={prod.producto}
                                                    /*
                                         * Usamos objectFit: "contain" en lugar de "cover" para que
                                         * las imágenes verticales (retrato) no se recorten. Con "contain"
                                         * el lado más grande se ajusta al contenedor y la imagen se ve
                                         * completa, mostrando el fondo gradiente en los bordes vacíos.
                                         * Se agrega un padding sutil para evitar que la imagen toque
                                         * los bordes del contenedor cuadrado.
                                         */
                                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8, borderRadius: 12 }} />
                                            ) : (
                                                <span style={{ fontSize: "2rem" }}>🛍️</span>
                                            )}
                                        </div>
                                        <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {prod.producto}
                                        </p>
                                        <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>
                                            {(prod.variaciones || []).length > 0
                                                ? `Desde $${Math.min(...(prod.variaciones || []).map(v => v.precio)).toFixed(2)}`
                                                : prod.precio_min !== undefined && prod.precio_max !== undefined && prod.precio_min < prod.precio_max
                                                    ? `$${prod.precio_min.toFixed(2)} – $${prod.precio_max.toFixed(2)}`
                                                    : `$${(prod.precio_sugerido ?? prod.precio_venta).toFixed(2)}`}
                                        </p>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, alignItems: "center" }}>
                                            <span
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCategoriaSeleccionada(prod.categoria?.[0] || "General");
                                                }}
                                                style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}
                                            >
                                                {(prod.categoria || ["General"]).join(", ")}
                                            </span>
                                            {prod.tipo_producto === "servicio" ? (
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#7b3fa0", background: "#f3e8ff", borderRadius: 6, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                    <Icon name="Scissors" size={11} /> Servicio
                                                </span>
                                            ) : prod.tipo_producto === "compuesto" ? (
                                                <>
                                                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#b45309", background: "#fef3c7", borderRadius: 6, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                        <Icon name="Hamburger" size={11} /> Compuesto
                                                    </span>
                                                    {prod.disponibilidad_estimada !== undefined && prod.disponibilidad_estimada !== null && (
                                                        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.disponibilidad_estimada <= 0 ? "#b71c1c" : "#6d4c41", background: prod.disponibilidad_estimada <= 0 ? "#ffeef0" : "#efebe9", borderRadius: 6, padding: "2px 6px" }}>
                                                            Quedan ~{prod.disponibilidad_estimada}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.stock_total <= 0 ? "#b71c1c" : "#2e7d32", background: prod.stock_total <= 0 ? "#ffeef0" : "#e8f5e9", borderRadius: 6, padding: "2px 6px" }}>
                                                    Stock: {prod.stock_total}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {productosFiltrados.length === 0 && !cargando && (
                                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                                        <span style={{ fontSize: "4rem", display: "block", marginBottom: 16 }}>😿</span>
                                        <h2 style={{ fontSize: "1.8rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 12px", lineHeight: 1.2, textTransform: "uppercase" }}>
                                            No hay productos
                                        </h2>
                                        <p style={{ fontSize: "1.2rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>
                                            Agrega nuevos en <span style={{ color: "var(--primary-mid)", fontWeight: 800 }}>INVENTARIO</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Carrito desktop ── */}
                    <div className="card hidden md:flex" style={{
                        width: 280, flexDirection: "column",
                        position: "sticky", top: 16, maxHeight: "calc(100vh - 80px)"
                    }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: "1rem",
                                fontWeight: 700,
                                color: "var(--text-main)",
                                display: "flex",          // Activa Flexbox
                                alignItems: "center",     // Alinea verticalmente al centro
                                gap: "8px"                // Separa el icono, el texto y la burbuja uniformemente
                            }}>
                                <Icon name="ShoppingCart" size={18} /> Carrito
                                {totalItems > 0 && (
                                    <span style={{
                                        background: "var(--primary-mid)",
                                        color: "#fff",
                                        borderRadius: "50%",
                                        padding: "2px 7px",
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        display: "inline-flex",   // Asegura que el número también se centre en su burbuja
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}>
                                        {totalItems}
                                    </span>
                                )}
                            </h2>
                            <button
                                onClick={manejarToggleDescuento}
                                style={{
                                    fontSize: "0.65rem", fontWeight: 800, padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                                    background: modoDescuento ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: modoDescuento ? "#fff" : "#999",
                                    transition: "all 0.2s"
                                }}
                            >
                                {modoDescuento ? "CON DESCUENTO" : "SIN DESCUENTO"}
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                            {carrito.length === 0 ? (
                                <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", padding: "24px 0" }}>
                                    Agrega productos
                                </p>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {carrito.map(item => {
                                        const key = keyCarrito(item)
                                        const prod = productos.find(p => p.producto === item.producto)
                                        const lotesProd = lotesParaProducto(item.producto)
                                        const loteSel = item.id_lote ? lotePorId(item.id_lote) : null
                                        return (
                                            <div key={key} style={{ padding: 10, background: "var(--bg-card)", borderRadius: 12, border: "var(--bg-card)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                                    <div style={{ flex: 1, minWidth: 0, marginRight: 6 }}>
                                                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.8rem", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {item.producto}
                                                        </p>
                                                        {item.variacion && (
                                                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--primary-dark)", background: "var(--bg-card2)", borderRadius: 6, padding: "1px 6px" }}>
                                                                {item.variacion}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button onClick={() => quitarDelCarrito(key)}
                                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>
                                                </div>
                                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg-card2)", borderRadius: 8, border: "var(--border-primary)", padding: "2px 4px" }}>
                                                        <button onClick={() => {
                                                            const next = pasoCantidad(item.cantidad, -1, !!prod?.fraccionable)
                                                            if (next <= 0) quitarDelCarrito(key)
                                                            else cambiarCantidad(key, next)
                                                        }}
                                                            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", color: "var(--primary-mid)", width: 22, height: 22 }}>−</button>
                                                        <input
                                                            type="number"
                                                            min={prod?.fraccionable ? "0.01" : "1"}
                                                            step={prod?.fraccionable ? "0.1" : "1"}
                                                            value={item.cantidad}
                                                            onChange={e => {
                                                                const fracc = !!prod?.fraccionable
                                                                if (!fracc) {
                                                                    // Unidades enteras: redondea y nunca baja de 1 (no se fracciona)
                                                                    cambiarCantidad(key, Math.max(1, Math.round(+e.target.value || 0)))
                                                                    return
                                                                }
                                                                // Fraccionable: acepta lo que se escribe (0.05, 1.25...); NaN se ignora.
                                                                // No se clampa en cada tecla para poder digitar "0.0X" de corrido.
                                                                const v = e.target.value === "" ? 0 : +e.target.value
                                                                if (isNaN(v)) return
                                                                cambiarCantidad(key, v)
                                                            }}
                                                            onBlur={() => {
                                                                // Piso al salir del campo: 0 o menor a 0.01 → 0.01
                                                                if (prod?.fraccionable) {
                                                                    const c = carrito.find(i => keyCarrito(i) === key)?.cantidad ?? 0
                                                                    if (isNaN(c) || c < 0.01) cambiarCantidad(key, 0.01)
                                                                }
                                                            }}
                                                            style={{ width: 40, border: "none", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, outline: "none", background: "transparent" }}
                                                        />
                                                        <button onClick={() => cambiarCantidad(key, pasoCantidad(item.cantidad, 1, !!prod?.fraccionable))}
                                                            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", color: "var(--primary-mid)", width: 22, height: 22 }}>+</button>
                                                    </div>
                                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                                                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>UNIT.</span>
                                                        <input
                                                            type="text" inputMode="decimal"
                                                            value={precios[key] ?? item.precio_real.toString()}
                                                            onChange={e => cambiarPrecio(key, e.target.value)}
                                                            style={{ width: "100%", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "4px 8px", fontSize: "0.8rem", textAlign: "right", outline: "none", background: "var(--bg-card2)" }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* ── Selector de variación (si el producto tiene) ── */}
                                                {(prod?.variaciones || []).length > 0 && (
                                                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                                    <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#999", whiteSpace: "nowrap" }}>VAR.:</span>
                                                    <select
                                                        value={item.variacion || ""}
                                                        onChange={e => cambiarVariacionCarrito(key, e.target.value)}
                                                        style={{
                                                            flex: 1,
                                                            fontSize: "0.65rem",
                                                            padding: "3px 6px",
                                                            borderRadius: 6,
                                                            border: "1px solid var(--border-primary)",
                                                            background: "var(--bg-card2)",
                                                            color: "var(--text-main)",
                                                            outline: "none",
                                                            cursor: "pointer",
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        {!item.variacion && <option value="">Elegir variación</option>}
                                                        {(prod?.variaciones || []).map(v => (
                                                            <option key={v.id} value={v.nombre}>
                                                                {v.nombre} — ${v.precio.toFixed(2)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                )}

                                                {/* ── Selector de lote (solo productos con stock) ── */}
                                                {(prod?.tipo_producto ?? "stock") === "stock" && (
                                                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                                    <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#999", whiteSpace: "nowrap" }}>LOTE:</span>
                                                    <select
                                                        value={item.id_lote || ""}
                                                        onChange={e => cambiarLoteCarrito(key, e.target.value || undefined)}
                                                        style={{
                                                            flex: 1,
                                                            fontSize: "0.65rem",
                                                            padding: "3px 6px",
                                                            borderRadius: 6,
                                                            border: "1px solid var(--border-primary)",
                                                            background: "var(--bg-card2)",
                                                            color: "var(--text-main)",
                                                            outline: "none",
                                                            cursor: "pointer",
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        <option value="">Más antiguo</option>
                                                        {lotesProd.map(l => (
                                                            <option key={l.id_lote} value={l.id_lote}>
                                                                {nombreLote(l)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                )}

                                                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                                                    <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700, textAlign: "right" }}>SUBTOTAL</span>
                                                    {modoDescuento ? (
                                                        <input
                                                            type="text" inputMode="decimal"
                                                            defaultValue={(item.cantidad * item.precio_real).toFixed(2)}
                                                            onBlur={e => cambiarTotal(key, e.target.value)}
                                                            onKeyDown={e => e.key === "Enter" && cambiarTotal(key, (e.target as HTMLInputElement).value)}
                                                            style={{ width: "100%", border: "1px solid var(--primary-mid)", borderRadius: 8, padding: "4px 8px", fontSize: "0.85rem", textAlign: "right", outline: "none", background: "#fff", fontWeight: 800, color: "var(--primary-dark)" }}
                                                        />
                                                    ) : (
                                                        <p style={{ margin: 0, textAlign: "right", fontSize: "0.85rem", color: "var(--primary-dark)", fontWeight: 800 }}>
                                                            ${(item.cantidad * item.precio_real).toFixed(2)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {carrito.length > 0 && (
                            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-primary)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1rem", color: "var(--text-main)", marginBottom: 12 }}>
                                    <span>Total</span>
                                    <span style={{ color: "var(--primary-dark)" }}>${totalCarrito.toFixed(2)}</span>
                                </div>
                                <button className="btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={cobrarConAdvertencia} disabled={cobrando}>
                                    {cobrando ? "Procesando..." : "Cobrar"}
                                </button>
                                <button className="btn-ghost" style={{ width: "100%" }}
                                    onClick={() => { setCarrito([]); setPrecios({}); localStorage.removeItem("pos_carrito"); localStorage.removeItem("pos_precios") }}>
                                    Vaciar carrito
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Botón flotante carrito (móvil) ── */}
            {carrito.length > 0 && (
                <button className="flex md:hidden btn-primary" style={{
                    position: "fixed", bottom: 76, right: 16,
                    borderRadius: "50px", gap: 8, zIndex: 150,
                    padding: "12px 20px", fontSize: "0.9rem",
                    boxShadow: "0 6px 25px var(--primary-glow)",
                }} onClick={() => setCarritoAbierto(true)}>
                    <Icon name="ShoppingCart" size={20} color="var(--white)" /> {totalItems} · ${totalCarrito.toFixed(2)}
                </button>
            )}

            {/* ── Drawer carrito móvil ── */}
            {carritoAbierto && (
                <div className="flex md:hidden" style={{
                    position: "fixed", inset: 0, zIndex: 300,
                    flexDirection: "column", justifyContent: "flex-end",
                }}>
                    <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={() => setCarritoAbierto(false)} />
                    <div className="card" style={{ borderRadius: "20px 20px 0 0", padding: 20, maxHeight: "80vh", overflowY: "auto", border: "none", margin: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                                <Icon name="ShoppingCart" size={20} /> Tu Carrito ({totalItems})
                            </h2>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <button
                                    onClick={manejarToggleDescuento}
                                    style={{
                                        fontSize: "0.7rem", fontWeight: 800, padding: "5px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                                        background: modoDescuento ? "var(--primary-mid)" : "var(--bg-card2)",
                                        color: modoDescuento ? "#fff" : "var(--text-muted)",
                                        display: "flex", alignItems: "center", gap: 4,
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {modoDescuento ? (
                                        <><Icon name="Sparkles" size={14} color="#fff" /> DESC. ON</>
                                    ) : (
                                        <><Icon name="Tag" size={14} /> DESCUENTO</>
                                    )}
                                </button>
                                <button onClick={() => setCarritoAbierto(false)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.2rem", padding: 4 }}>✕</button>
                            </div>
                        </div>
                        {carrito.map(item => {
                            const key = keyCarrito(item)
                            const lotesProd = lotesParaProducto(item.producto)
                            const prodCarrito = productos.find(p => p.producto === item.producto)
                            return (
                                <div key={key} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-primary)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                            <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.producto}</span>
                                            {item.variacion && (
                                                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--primary-dark)", background: "var(--bg-card2)", borderRadius: 6, padding: "1px 6px", alignSelf: "flex-start" }}>
                                                    {item.variacion}
                                                </span>
                                            )}
                                        </div>
                                        <button onClick={() => quitarDelCarrito(key)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card2)", borderRadius: 8, padding: "4px 10px" }}>
                                            <button onClick={() => {
                                                const next = pasoCantidad(item.cantidad, -1, !!prodCarrito?.fraccionable)
                                                if (next <= 0) quitarDelCarrito(key)
                                                else cambiarCantidad(key, next)
                                            }} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--primary-mid)", fontSize: "1rem" }}>−</button>
                                            <input
                                                type="number"
                                                min={prodCarrito?.fraccionable ? "0.01" : "1"}
                                                step={prodCarrito?.fraccionable ? "0.1" : "1"}
                                                value={item.cantidad}
                                                onChange={e => {
                                                    const fracc = !!prodCarrito?.fraccionable
                                                    if (!fracc) {
                                                        // Unidades enteras: redondea y nunca baja de 1 (no se fracciona)
                                                        cambiarCantidad(key, Math.max(1, Math.round(+e.target.value || 0)));
                                                        return;
                                                    }
                                                    // Fraccionable: acepta lo que se escribe (0.05, 1.25...); NaN se ignora.
                                                    const v = e.target.value === "" ? 0 : +e.target.value
                                                    if (isNaN(v)) return
                                                    cambiarCantidad(key, v);
                                                }}
                                                onBlur={() => {
                                                    // Piso al salir del campo: 0 o menor a 0.01 → 0.01
                                                    if (prodCarrito?.fraccionable) {
                                                        const c = carrito.find(i => keyCarrito(i) === key)?.cantidad ?? 0
                                                        if (isNaN(c) || c < 0.01) cambiarCantidad(key, 0.01);
                                                    }
                                                }}
                                                style={{ width: "100%", border: "none", textAlign: "center", fontSize: "0.9rem", fontWeight: 700, outline: "none", background: "transparent", color: "var(--text-main)" }}
                                            />
                                            <button onClick={() => {
                                                cambiarCantidad(key, pasoCantidad(item.cantidad, 1, !!prodCarrito?.fraccionable));
                                            }} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--primary-mid)", fontSize: "1rem" }}>+</button>
                                        </div>
                                        <input type="text" inputMode="decimal"
                                            value={precios[key] ?? item.precio_real.toString()}
                                            onChange={e => cambiarPrecio(key, e.target.value)}
                                            style={{ width: "100%", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "6px 10px", fontSize: "0.9rem", textAlign: "right", outline: "none", background: "var(--bg-card2)", color: "var(--text-main)" }}
                                        />
                                    </div>

                                    {/* ── Selector de variación (móvil) ── */}
                                    {(prodCarrito?.variaciones || []).length > 0 && (
                                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>VAR.:</span>                                            <select
                                                value={item.variacion || ""}
                                                onChange={e => cambiarVariacionCarrito(key, e.target.value)}
                                                style={{
                                                    flex: 1,
                                                    fontSize: "0.75rem",
                                                    padding: "4px 8px",
                                                    borderRadius: 8,
                                                    border: "1px solid var(--border-primary)",
                                                    background: "var(--bg-card2)",
                                                    color: "var(--text-main)",
                                                    outline: "none",
                                                    cursor: "pointer",
                                                    fontWeight: 600
                                                }}
                                            >
                                                {!item.variacion && <option value="">Elegir variación</option>}
                                                {(prodCarrito?.variaciones || []).map(v => (
                                                    <option key={v.id} value={v.nombre}>
                                                        {v.nombre} — ${v.precio.toFixed(2)}
                                                    </option>
                                                ))}
                                            </select>
                                    </div>
                                    )}

                                    {/* ── Selector de lote (móvil, solo productos con stock) ── */}
                                    {(prodCarrito?.tipo_producto ?? "stock") === "stock" && (
                                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>LOTE:</span>
                                        <select
                                            value={item.id_lote || ""}
                                            onChange={e => cambiarLoteCarrito(key, e.target.value || undefined)}
                                            style={{
                                                flex: 1,
                                                fontSize: "0.75rem",
                                                padding: "4px 8px",
                                                borderRadius: 8,
                                                border: "1px solid var(--border-primary)",
                                                background: "var(--bg-card2)",
                                                color: "var(--text-main)",
                                                outline: "none",
                                                cursor: "pointer",
                                                fontWeight: 600
                                            }}
                                        >
                                            <option value="">Más antiguo</option>
                                            {lotesProd.map(l => (
                                                <option key={l.id_lote} value={l.id_lote}>
                                                    {nombreLote(l)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    )}

                                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>{modoDescuento ? "EDITAR TOTAL:" : "SUBTOTAL:"}</span>
                                        {modoDescuento ? (
                                            <input
                                                type="text" inputMode="decimal"
                                                defaultValue={(item.cantidad * item.precio_real).toFixed(2)}
                                                onBlur={e => cambiarTotal(key, e.target.value)}
                                                style={{ width: "100px", border: "1px solid var(--primary-mid)", borderRadius: 8, padding: "6px 10px", fontSize: "0.9rem", textAlign: "right", outline: "none", background: "var(--bg-card2)", fontWeight: 800, color: "var(--primary-dark)" }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: "1rem", color: "var(--primary-dark)", fontWeight: 800 }}>
                                                ${(item.cantidad * item.precio_real).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.1rem", marginBottom: 16 }}>
                            <span style={{ color: "var(--text-main)" }}>Total</span>
                            <span style={{ color: "var(--primary-dark)" }}>${totalCarrito.toFixed(2)}</span>
                        </div>
                        <button className="btn-primary" style={{ width: "100%", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={cobrarConAdvertencia} disabled={cobrando}>
                            {cobrando ? "Procesando..." : <><Icon name="Check" size={18} /> Cobrar</>}
                        </button>
                        <button className="btn-ghost" style={{ width: "100%" }} onClick={() => { setCarrito([]); setPrecios({}); setCarritoAbierto(false); localStorage.removeItem("pos_carrito"); localStorage.removeItem("pos_precios") }}>
                            Vaciar carrito
                        </button>
                    </div>
                </div>
            )}
            {/* ── Modal de advertencia por stock insuficiente ── */}
            {/* ── Modal de selección de variación ── */}
            {modalVariacion.visible && modalVariacion.prod && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--overlay-bg)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                }}>
                    <div className="fade-up" style={{
                        background: "var(--bg-card)",
                        borderRadius: 20,
                        padding: "28px 24px 24px",
                        maxWidth: 400,
                        width: "90%",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-primary)",
                    }}>
                        <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                            {modalVariacion.prod.producto}
                        </h3>
                        <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            Elige la variación (cada una tiene su propio precio):
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {(modalVariacion.prod.variaciones || []).map(v => {
                                const stockPorVar = !!modalVariacion.prod?.stock_por_variacion
                                const agotada = stockPorVar && (v.stock ?? 0) <= 0
                                return (
                                    <button
                                        key={v.id}
                                        // Agotada NO bloquea: el vendedor puede añadirla igual (ej.
                                        // cuando el conteo físico no cuadra y quiere vender ya). Al
                                        // cobrar, la advertencia de stock insuficiente pide confirmar
                                        // y el backend descuenta a negativo, igual que los normales.
                                        onClick={() => agregarConVariacion(modalVariacion.prod!, v.nombre, v.precio)}
                                        style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            padding: "12px 14px",
                                            borderRadius: 12,
                                            border: "1px solid var(--border-primary)",
                                            background: agotada ? "var(--bg-card)" : "var(--bg-card2)",
                                            color: "var(--text-main)",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            fontSize: "0.9rem",
                                            transition: "background 0.15s, transform 0.15s",
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card3)"; e.currentTarget.style.transform = "translateY(-1px)" }}
                                        onMouseLeave={e => { e.currentTarget.style.background = agotada ? "var(--bg-card)" : "var(--bg-card2)"; e.currentTarget.style.transform = "none" }}
                                    >
                                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {v.nombre}
                                            {stockPorVar && !agotada && (
                                                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)" }}>{v.stock} uds</span>
                                            )}
                                            {stockPorVar && agotada && (
                                                <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#ad4955ff", border: "1px solid #ad4955ff", borderRadius: 6, padding: "1px 6px" }}>Agotado</span>
                                            )}
                                        </span>
                                        <span style={{ color: "var(--primary-dark)", fontWeight: 800 }}>${v.precio.toFixed(2)}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <button
                            className="btn-ghost"
                            onClick={() => setModalVariacion({ visible: false, prod: null })}
                            style={{ marginTop: 14, width: "100%" }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {modalAdvertencia.visible && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--overlay-bg)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                }}>
                    {/**
                     * Card flotante con los colores del tema actual.
                     * Usa las variables CSS del tema dinámico para mantener
                     * la coherencia visual con Midnight Black, Steel Slate,
                     * Strawberry y Cozy Yellow.
                     */}
                    <div className="fade-up" style={{
                        background: "var(--bg-card)",
                        borderRadius: 20,
                        padding: "32px 28px 24px",
                        maxWidth: 400,
                        width: "90%",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-primary)",
                        textAlign: "center",
                    }}>
                        {/* Icono de advertencia */}
                        <div style={{
                            width: 64, height: 64,
                            borderRadius: "50%",
                            background: "var(--error-bg)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 16px",
                            fontSize: "2rem",
                        }}>
                            <Icon name="TriangleAlert" size={32} color="var(--error-text)" />
                        </div>

                        <h3 style={{
                            margin: "0 0 8px",
                            fontSize: "1.1rem",
                            fontWeight: 800,
                            color: "var(--text-main)",
                        }}>
                            Stock insuficiente
                        </h3>

                        <p style={{
                            margin: "0 0 6px",
                            fontSize: "0.85rem",
                            color: "var(--text-secondary)",
                            lineHeight: 1.5,
                        }}>
                            No hay stock suficiente de:
                        </p>

                        <p style={{
                            margin: "0 0 16px",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: "var(--error-text)",
                            padding: "8px 12px",
                            background: "var(--error-bg)",
                            borderRadius: 10,
                            wordBreak: "break-word",
                        }}>
                            {modalAdvertencia.nombres}
                        </p>

                        <p style={{
                            margin: "0 0 20px",
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                        }}>
                            ¿Deseas proceder con la venta de todas formas?
                            El inventario quedará en <strong style={{ color: "var(--error-text)" }}>negativo</strong>.
                        </p>

                        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                            <button
                                className="btn-primary"
                                onClick={confirmarCobroConAdvertencia}
                                style={{ flex: 1 }}
                            >
                                Sí, cobrar
                            </button>
                            <button
                                className="btn-ghost"
                                onClick={cancelarAdvertencia}
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
