"use client"
// ==============================================================================
// src/app/page.tsx  —  Punto de Venta (rediseño Argon primary)
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Producto, ItemCarrito } from "@/lib/api"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import { supabase } from "@/lib/supabase"
import { useTenant } from "@/contexts/TenantContext"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

export default function PuntoDeVenta() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [precios, setPrecios] = useState<Record<string, string>>({})
    const [busqueda, setBusqueda] = useState("")
    const [cargando, setCargando] = useState(true)
    const [cobrando, setCobrando] = useState(false)
    const [carritoAbierto, setCarritoAbierto] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
    const [modoDescuento, setModoDescuento] = useState(false)
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("Todas")
    // Estado para el modal de advertencia por stock insuficiente
    const [modalAdvertencia, setModalAdvertencia] = useState<{
        visible: boolean;
        nombres: string;
    }>({ visible: false, nombres: "" })
    const [userId, setUserId] = useState<string>("Cargando...");
    const { tenant } = useTenant()
    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "Goyangi Store"


    function manejarToggleDescuento() {
        if (modoDescuento) {
            // Si lo estamos apagando, reseteamos todos los precios al original de lista
            setCarrito(prev => prev.map(item => {
                const prod = productos.find(p => p.producto === item.producto)
                return { ...item, precio_real: prod ? prod.precio_venta : item.precio_real }
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
    }, [])

    const categorias = ["Todas", ...Array.from(new Set(productos.flatMap(p => p.categoria || ["General"]))).sort()]

    const productosFiltrados = productos.filter(p => {
        const busquedaBase = busqueda.toLowerCase()
        const porBusqueda = p.producto.toLowerCase().includes(busquedaBase) ||
            p.descripcion?.toLowerCase().includes(busquedaBase) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(busquedaBase)

        const porCategoria = categoriaSeleccionada === "Todas" || (p.categoria || ["General"]).includes(categoriaSeleccionada)
        return porBusqueda && porCategoria
    })

    function agregarAlCarrito(prod: Producto) {
        setCarrito(prev => {
            const idx = prev.findIndex(i => i.producto === prod.producto)
            if (idx >= 0) {
                // NOTA: Ya no limitamos por stock_total para permitir
                // vender aunque el inventario esté en 0 o negativo.
                // La advertencia se muestra al momento de cobrar.
                const nuevo = [...prev]
                nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad + 1 }
                return nuevo
            }
            return [...prev, { producto: prod.producto, cantidad: 1, precio_real: prod.precio_venta }]
        })
    }

    function cambiarCantidad(producto: string, cantidad: number) {
        setCarrito(prev => prev.map(i => i.producto === producto ? { ...i, cantidad } : i))
    }

    function cambiarPrecio(producto: string, texto: string) {
        setPrecios(prev => ({ ...prev, [producto]: texto }))
        const num = parseFloat(texto.replace(",", "."))
        if (!isNaN(num) && num >= 0)
            setCarrito(prev => prev.map(i => i.producto === producto ? { ...i, precio_real: num } : i))
    }

    function cambiarTotal(producto: string, texto: string) {
        const item = carrito.find(i => i.producto === producto)
        if (!item || item.cantidad === 0) return

        const totalNum = parseFloat(texto.replace(",", "."))
        if (!isNaN(totalNum) && totalNum >= 0) {
            const nuevoPrecio = totalNum / item.cantidad
            setCarrito(prev => prev.map(i => i.producto === producto ? { ...i, precio_real: nuevoPrecio } : i))
            // Actualizamos también el string del precio para que se vea el cambio
            setPrecios(prev => ({ ...prev, [producto]: nuevoPrecio.toFixed(2) }))
        }
    }

    function quitarDelCarrito(producto: string) {
        setCarrito(prev => prev.filter(i => i.producto !== producto))
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

        // Identificar productos del carrito que no tienen stock suficiente
        const sinStock = carrito.filter(item => {
            const prod = productos.find(p => p.producto === item.producto)
            return !prod || prod.stock_total <= 0 || item.cantidad > prod.stock_total
        })

        if (sinStock.length > 0) {
            // Abrimos el modal personalizado en lugar del window.confirm() nativo
            const nombres = sinStock.map(i => i.producto).join(", ")
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

    // Cerrar el modal con la tecla Escape
    useEffect(() => {
        function manejarEscape(e: KeyboardEvent) {
            if (e.key === "Escape" && modalAdvertencia.visible) {
                cancelarAdvertencia()
            }
        }
        document.addEventListener("keydown", manejarEscape)
        return () => document.removeEventListener("keydown", manejarEscape)
    }, [modalAdvertencia.visible])

    async function cobrar() {
        if (carrito.length === 0) return
        setCobrando(true); setMensaje(null)
        try {
            const res = await api.cobrarCarrito(carrito)
            setMensaje({ tipo: "ok", texto: `✅ Venta registrada — $${res.total_cobrado.toFixed(2)}` })
            setCarrito([]); setPrecios({}); setCarritoAbierto(false)
            const data = await api.getInventario()
            setProductos(data)
        } catch (e: unknown) {
            setMensaje({ tipo: "error", texto: `❌ ${e instanceof Error ? e.message : "Error"}` })
        } finally { setCobrando(false) }
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
            <div style={{ padding: "0 16px", marginTop: -48 }}>

                {/* Mensaje de resultado */}
                {mensaje && (
                    <div className="fade-up card" style={{
                        padding: "12px 16px", marginBottom: 12,
                        borderLeft: `4px solid ${mensaje.tipo === "ok" ? "#4caf50" : "#f44336"}`,
                        color: mensaje.tipo === "ok" ? "#2e7d32" : "#b71c1c",
                        fontSize: "0.875rem", fontWeight: 600,
                    }}>
                        {mensaje.texto}
                    </div>
                )}

                {/* Layout desktop: catálogo + carrito lateral */}
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

                    {/* ── Catálogo ── */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Categorías */}
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16, scrollbarWidth: "none" }}>
                            {categorias.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoriaSeleccionada(cat)}
                                    style={{
                                        padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                                        background: categoriaSeleccionada === cat ? "var(--primary-mid)" : "var(--bg-card2)",
                                        color: categoriaSeleccionada === cat ? "#fff" : "var(--primary-dark)",
                                        boxShadow: categoriaSeleccionada === cat ? "0 4px 10px var(--primary-glow)" : "none"
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
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
                                <Icon name="Folders" size={20} />
                                <select
                                    className="input-primary"
                                    style={{ border: "none", padding: "4px 8px", fontSize: "0.85rem", background: "transparent", cursor: "pointer", fontWeight: 700, color: "var(--primary-dark)" }}
                                    value={categoriaSeleccionada}
                                    onChange={e => setCategoriaSeleccionada(e.target.value)}
                                >
                                    {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
                                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                                            ) : (
                                                <span style={{ fontSize: "2rem" }}>🛍️</span>
                                            )}
                                        </div>
                                        <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {prod.producto}
                                        </p>
                                        <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>
                                            ${prod.precio_venta.toFixed(2)}
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
                                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: prod.stock_total <= 3 ? "#b71c1c" : "#2e7d32", background: prod.stock_total <= 3 ? "#ffeef0" : "#e8f5e9", borderRadius: 6, padding: "2px 6px" }}>
                                                Stock: {prod.stock_total}
                                            </span>
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
                                        const prod = productos.find(p => p.producto === item.producto)
                                        return (
                                            <div key={item.producto} style={{ padding: 10, background: "var(--bg-card)", borderRadius: 12, border: "var(--bg-card)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.8rem", color: "var(--text-main)", flex: 1, marginRight: 6 }}>
                                                        {item.producto}
                                                    </p>
                                                    <button onClick={() => quitarDelCarrito(item.producto)}
                                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>
                                                </div>
                                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg-card2)", borderRadius: 8, border: "var(--border-primary)", padding: "2px 4px" }}>
                                                        <button onClick={() => cambiarCantidad(item.producto, Math.max(1, item.cantidad - 1))}
                                                            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", color: "var(--primary-mid)", width: 22, height: 22 }}>−</button>
                                                        <input
                                                            type="number" min="1"
                                                            value={item.cantidad}
                                                            onChange={e => cambiarCantidad(item.producto, Math.max(1, +e.target.value))}
                                                            style={{ width: 35, border: "none", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, outline: "none", background: "transparent" }}
                                                        />
                                                        <button onClick={() => cambiarCantidad(item.producto, item.cantidad + 1)}
                                                            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", color: "var(--primary-mid)", width: 22, height: 22 }}>+</button>
                                                    </div>
                                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                                                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>UNIT.</span>
                                                        <input
                                                            type="text" inputMode="decimal"
                                                            value={precios[item.producto] ?? item.precio_real.toString()}
                                                            onChange={e => cambiarPrecio(item.producto, e.target.value)}
                                                            style={{ width: "100%", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "4px 8px", fontSize: "0.8rem", textAlign: "right", outline: "none", background: "var(--bg-card2)" }}
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                                                    <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700, textAlign: "right" }}>SUBTOTAL</span>
                                                    {modoDescuento ? (
                                                        <input
                                                            type="text" inputMode="decimal"
                                                            defaultValue={(item.cantidad * item.precio_real).toFixed(2)}
                                                            onBlur={e => cambiarTotal(item.producto, e.target.value)}
                                                            onKeyDown={e => e.key === "Enter" && cambiarTotal(item.producto, (e.target as HTMLInputElement).value)}
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
                                    onClick={() => { setCarrito([]); setPrecios({}) }}>
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
                    <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 20, maxHeight: "80vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>🛒 Tu Carrito ({totalItems})</h2>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <button
                                    onClick={manejarToggleDescuento}
                                    style={{
                                        fontSize: "0.7rem", fontWeight: 800, padding: "5px 10px", borderRadius: 10, border: "none",
                                        background: modoDescuento ? "var(--primary-mid)" : "#eee",
                                        color: modoDescuento ? "#fff" : "#999"
                                    }}
                                >
                                    {modoDescuento ? "✨ DESC. ON" : "🏷️ DESCUENTO"}
                                </button>
                                <button style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }} onClick={() => setCarritoAbierto(false)}>✕</button>
                            </div>
                        </div>
                        {carrito.map(item => (
                            <div key={item.producto} style={{ padding: "10px 0", borderBottom: "1px solid #fce4ec" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.producto}</span>
                                    <button onClick={() => quitarDelCarrito(item.producto)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc" }}>✕</button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fdf6f9", borderRadius: 8, padding: "4px 10px" }}>
                                        <button onClick={() => cambiarCantidad(item.producto, Math.max(1, item.cantidad - 1))} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--primary-mid)", fontSize: "1rem" }}>−</button>
                                        <input
                                            type="number" min="1"
                                            value={item.cantidad}
                                            onChange={e => {
                                                cambiarCantidad(item.producto, Math.max(1, +e.target.value));
                                            }}
                                            style={{ width: "100%", border: "none", textAlign: "center", fontSize: "0.9rem", fontWeight: 700, outline: "none", background: "transparent" }}
                                        />
                                        <button onClick={() => {
                                            cambiarCantidad(item.producto, item.cantidad + 1);
                                        }} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--primary-mid)", fontSize: "1rem" }}>+</button>
                                    </div>
                                    <input type="text" inputMode="decimal"
                                        value={precios[item.producto] ?? item.precio_real.toString()}
                                        onChange={e => cambiarPrecio(item.producto, e.target.value)}
                                        style={{ width: "100%", border: "1px solid #fce4ec", borderRadius: 8, padding: "6px 10px", fontSize: "0.9rem", textAlign: "right", outline: "none" }}
                                    />
                                </div>
                                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.7rem", color: "#999", fontWeight: 700 }}>{modoDescuento ? "EDITAR TOTAL:" : "SUBTOTAL:"}</span>
                                    {modoDescuento ? (
                                        <input
                                            type="text" inputMode="decimal"
                                            defaultValue={(item.cantidad * item.precio_real).toFixed(2)}
                                            onBlur={e => cambiarTotal(item.producto, e.target.value)}
                                            style={{ width: "100px", border: "1px solid var(--primary-mid)", borderRadius: 8, padding: "6px 10px", fontSize: "0.9rem", textAlign: "right", outline: "none", background: "#fff", fontWeight: 800, color: "var(--primary-dark)" }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: "1rem", color: "var(--primary-dark)", fontWeight: 800 }}>
                                            ${(item.cantidad * item.precio_real).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.1rem", marginBottom: 16 }}>
                            <span>Total</span>
                            <span style={{ color: "var(--primary-dark)" }}>${totalCarrito.toFixed(2)}</span>
                        </div>
                        <button className="btn-primary" style={{ width: "100%", marginBottom: 10 }} onClick={cobrarConAdvertencia} disabled={cobrando}>
                            {cobrando ? "Procesando..." : "✅ Cobrar"}
                        </button>
                        <button className="btn-ghost" style={{ width: "100%" }} onClick={() => { setCarrito([]); setPrecios({}); setCarritoAbierto(false) }}>
                            Vaciar carrito
                        </button>
                    </div>
                </div>
            )}
            {/* ── Modal de advertencia por stock insuficiente ── */}
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
                            ⚠️
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
