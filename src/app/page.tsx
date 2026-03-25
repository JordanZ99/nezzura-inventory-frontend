"use client"
// ==============================================================================
// src/app/page.tsx  —  Punto de Venta (rediseño Argon pink)
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Producto, ItemCarrito } from "@/lib/api"

export default function PuntoDeVenta() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [carrito, setCarrito]     = useState<ItemCarrito[]>([])
    const [precios, setPrecios]     = useState<Record<string, string>>({})
    const [busqueda, setBusqueda]   = useState("")
    const [cargando, setCargando]   = useState(true)
    const [cobrando, setCobrando]   = useState(false)
    const [carritoAbierto, setCarritoAbierto] = useState(false)
    const [mensaje, setMensaje]     = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)

    useEffect(() => {
        api.getInventario()
            .then(data => setProductos(data.filter(p => p.stock_total > 0)))
            .catch(async () => {
                // Tables might not exist — force creation and retry
                try {
                    await api.initDB()
                    const data = await api.getInventario()
                    setProductos(data.filter(p => p.stock_total > 0))
                } catch {
                    // DB is empty, keep empty state
                }
            })
            .finally(() => setCargando(false))
    }, [])

    const productosFiltrados = productos.filter(p =>
        p.producto.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    )

    function agregarAlCarrito(prod: Producto) {
        setCarrito(prev => {
            const idx = prev.findIndex(i => i.producto === prod.producto)
            if (idx >= 0) {
                if (prev[idx].cantidad >= prod.stock_total) return prev
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
        if (!isNaN(num) && num > 0)
            setCarrito(prev => prev.map(i => i.producto === producto ? { ...i, precio_real: num } : i))
    }

    function quitarDelCarrito(producto: string) {
        setCarrito(prev => prev.filter(i => i.producto !== producto))
    }

    async function cobrar() {
        if (carrito.length === 0) return
        setCobrando(true); setMensaje(null)
        try {
            const res = await api.cobrarCarrito(carrito)
            setMensaje({ tipo: "ok", texto: `✅ Venta registrada — $${res.total_cobrado.toFixed(2)}` })
            setCarrito([]); setPrecios({}); setCarritoAbierto(false)
            const data = await api.getInventario()
            setProductos(data.filter(p => p.stock_total > 0))
        } catch (e: unknown) {
            setMensaje({ tipo: "error", texto: `❌ ${e instanceof Error ? e.message : "Error"}` })
        } finally { setCobrando(false) }
    }

    const totalCarrito = carrito.reduce((acc, i) => acc + i.cantidad * i.precio_real, 0)
    const totalItems   = carrito.reduce((acc, i) => acc + i.cantidad, 0)

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>

            {/* ── Hero card ── */}
            <div className="hero-gradient" style={{ padding: "32px 24px 80px" }}>
                <p className="hidden md:block" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>
                    BIENVENIDA
                </p>
                
                {/* Desktop Title */}
                <h1 className="hidden md:flex" style={{ color: "#fff", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}>
                    🛍️ Punto de Venta
                </h1>
                
                {/* Mobile Title */}
                <h1 className="flex md:hidden" style={{ color: "#fff", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 12 }}>
                    <img src="/logo.png" alt="Logo" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "contain", background: "white", padding: 3 }} />
                    Punto de Venta
                </h1>
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.875rem", margin: 0 }}>
                    {productos.length} productos disponibles hoy
                </p>
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
                        {/* Buscador */}
                        <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontSize: "1.1rem" }}>🔍</span>
                            <input
                                className="input-pink"
                                style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                                placeholder="Buscar producto o código..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                            />
                        </div>

                        {cargando ? (
                            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                                <div style={{ fontSize: "2rem", marginBottom: 8 }}>🐱</div>
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
                                        e.currentTarget.style.boxShadow = "0 8px 30px rgba(200,50,120,0.18)"
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = ""
                                        e.currentTarget.style.boxShadow = ""
                                    }}>
                                        <div style={{
                                            aspectRatio: "1", borderRadius: 12,
                                            background: "linear-gradient(135deg, #fce4ec, #f8bbd0)",
                                            marginBottom: 10, overflow: "hidden",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            {prod.imagen && prod.imagen !== "No hay foto" ? (
                                                <img src={prod.imagen.startsWith("http") ? prod.imagen : `https://goyangi-backend.onrender.com/${prod.imagen}`}
                                                    alt={prod.producto}
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <span style={{ fontSize: "2rem" }}>🛍️</span>
                                            )}
                                        </div>
                                        <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {prod.producto}
                                        </p>
                                        <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--pink-mid)", margin: 0 }}>
                                            ${prod.precio_venta.toFixed(2)}
                                        </p>
                                        <span style={{ fontSize: "0.65rem", fontWeight: 600, color: prod.stock_total <= 3 ? "#b71c1c" : "#2e7d32", background: prod.stock_total <= 3 ? "#ffeef0" : "#e8f5e9", borderRadius: 20, padding: "2px 8px", marginTop: 4, display: "inline-block" }}>
                                            Stock: {prod.stock_total}
                                        </span>
                                    </div>
                                ))}
                                {productosFiltrados.length === 0 && !cargando && (
                                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "rgba(255,255,255,0.6)", borderRadius: 16, border: "2px dashed #f8bbd0", marginTop: 20 }}>
                                        <span style={{ fontSize: "4rem", display: "block", marginBottom: 16 }}>😿</span>
                                        <h2 style={{ fontSize: "1.8rem", color: "var(--pink-dark)", fontWeight: 800, margin: "0 0 12px", lineHeight: 1.2, textTransform: "uppercase" }}>
                                            No hay productos
                                        </h2>
                                        <p style={{ fontSize: "1.2rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>
                                            Agrega nuevos en <span style={{ color: "var(--pink-mid)", fontWeight: 800 }}>INVENTARIO</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Carrito desktop ── */}
                    <div className="card hidden md:flex" style={{
                        width: 280, flexDirection: "column",
                        position: "sticky", top: 16, maxHeight: "calc(100vh - 80px)",
                    }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid #fce4ec" }}>
                            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-main)" }}>
                                🛒 Carrito
                                {totalItems > 0 && (
                                    <span style={{
                                        marginLeft: 8, background: "var(--pink-mid)", color: "#fff",
                                        borderRadius: "50%", padding: "2px 7px", fontSize: "0.72rem", fontWeight: 700,
                                    }}>{totalItems}</span>
                                )}
                            </h2>
                        </div>

                        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                            {carrito.length === 0 ? (
                                <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", padding: "24px 0" }}>
                                    Agrega productos 🛍️
                                </p>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {carrito.map(item => {
                                        const prod = productos.find(p => p.producto === item.producto)
                                        return (
                                            <div key={item.producto} style={{ padding: 10, background: "#fdf6f9", borderRadius: 12, border: "1px solid #fce4ec" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.8rem", color: "var(--text-main)", flex: 1, marginRight: 6 }}>
                                                        {item.producto}
                                                    </p>
                                                    <button onClick={() => quitarDelCarrito(item.producto)}
                                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>✕</button>
                                                </div>
                                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", borderRadius: 8, border: "1px solid #fce4ec", padding: "2px 4px" }}>
                                                        <button onClick={() => cambiarCantidad(item.producto, Math.max(1, item.cantidad - 1))}
                                                            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", color: "var(--pink-mid)", width: 22, height: 22 }}>−</button>
                                                        <span style={{ fontSize: "0.8rem", fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.cantidad}</span>
                                                        <button onClick={() => cambiarCantidad(item.producto, Math.min(prod?.stock_total ?? 99, item.cantidad + 1))}
                                                            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", color: "var(--pink-mid)", width: 22, height: 22 }}>+</button>
                                                    </div>
                                                    <input
                                                        type="text" inputMode="decimal"
                                                        value={precios[item.producto] ?? item.precio_real.toString()}
                                                        onChange={e => cambiarPrecio(item.producto, e.target.value)}
                                                        style={{ flex: 1, border: "1px solid #fce4ec", borderRadius: 8, padding: "4px 8px", fontSize: "0.8rem", textAlign: "right", outline: "none", background: "#fff" }}
                                                    />
                                                </div>
                                                <p style={{ margin: "6px 0 0", textAlign: "right", fontSize: "0.78rem", color: "var(--pink-dark)", fontWeight: 700 }}>
                                                    ${(item.cantidad * item.precio_real).toFixed(2)}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {carrito.length > 0 && (
                            <div style={{ padding: "12px 16px", borderTop: "1px solid #fce4ec" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1rem", color: "var(--text-main)", marginBottom: 12 }}>
                                    <span>Total</span>
                                    <span style={{ color: "var(--pink-dark)" }}>${totalCarrito.toFixed(2)}</span>
                                </div>
                                <button className="btn-pink" style={{ width: "100%", marginBottom: 8 }} onClick={cobrar} disabled={cobrando}>
                                    {cobrando ? "Procesando..." : "✅ Cobrar"}
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
                <button className="flex md:hidden btn-pink" style={{
                    position: "fixed", bottom: 76, right: 16,
                    borderRadius: "50px", gap: 8, zIndex: 150,
                    padding: "12px 20px", fontSize: "0.9rem",
                    boxShadow: "0 6px 25px rgba(233,30,140,0.45)",
                }} onClick={() => setCarritoAbierto(true)}>
                    🛒 {totalItems} · ${totalCarrito.toFixed(2)}
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
                            <button style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }} onClick={() => setCarritoAbierto(false)}>✕</button>
                        </div>
                        {carrito.map(item => (
                            <div key={item.producto} style={{ padding: "10px 0", borderBottom: "1px solid #fce4ec" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.producto}</span>
                                    <button onClick={() => quitarDelCarrito(item.producto)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc" }}>✕</button>
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fdf6f9", borderRadius: 8, padding: "4px 10px" }}>
                                        <button onClick={() => cambiarCantidad(item.producto, Math.max(1, item.cantidad - 1))} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--pink-mid)", fontSize: "1rem" }}>−</button>
                                        <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center" }}>{item.cantidad}</span>
                                        <button onClick={() => cambiarCantidad(item.producto, item.cantidad + 1)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--pink-mid)", fontSize: "1rem" }}>+</button>
                                    </div>
                                    <input type="text" inputMode="decimal"
                                        value={precios[item.producto] ?? item.precio_real.toString()}
                                        onChange={e => cambiarPrecio(item.producto, e.target.value)}
                                        style={{ flex: 1, border: "1px solid #fce4ec", borderRadius: 8, padding: "6px 10px", fontSize: "0.9rem", textAlign: "right", outline: "none" }}
                                    />
                                </div>
                            </div>
                        ))}
                        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.1rem", marginBottom: 16 }}>
                            <span>Total</span>
                            <span style={{ color: "var(--pink-dark)" }}>${totalCarrito.toFixed(2)}</span>
                        </div>
                        <button className="btn-pink" style={{ width: "100%", marginBottom: 10 }} onClick={cobrar} disabled={cobrando}>
                            {cobrando ? "Procesando..." : "✅ Cobrar"}
                        </button>
                        <button className="btn-ghost" style={{ width: "100%" }} onClick={() => { setCarrito([]); setPrecios({}); setCarritoAbierto(false) }}>
                            Vaciar carrito
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
