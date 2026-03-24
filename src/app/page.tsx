"use client"
// ==============================================================================
// src/app/page.tsx
// Punto de Venta — página principal.
// Catálogo de productos + carrito de compras en tiempo real.
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Producto, ItemCarrito } from "@/lib/api"

export default function PuntoDeVenta() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [precios, setPrecios] = useState<Record<string, string>>({})
    const [busqueda, setBusqueda] = useState("")
    const [cargando, setCargando] = useState(true)
    const [cobrando, setCobrando] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error", texto: string } | null>(null)

    useEffect(() => {
        api.getInventario()
            .then(data => setProductos(data.filter(p => p.stock_total > 0)))
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

    function quitarDelCarrito(producto: string) {
        setCarrito(prev => prev.filter(i => i.producto !== producto))
    }

    function cambiarCantidad(producto: string, cantidad: number) {
        setCarrito(prev => prev.map(i => i.producto === producto ? { ...i, cantidad } : i))
    }

    function cambiarPrecio(producto: string, texto: string) {
        setPrecios(prev => ({ ...prev, [producto]: texto }))
        const num = parseFloat(texto.replace(",", "."))
        if (!isNaN(num) && num > 0) {
            setCarrito(prev => prev.map(i => i.producto === producto ? { ...i, precio_real: num } : i))
        }
    }

    async function cobrar() {
        if (carrito.length === 0) return
        setCobrando(true)
        setMensaje(null)
        try {
            const res = await api.cobrarCarrito(carrito)
            setMensaje({ tipo: "ok", texto: `✅ Venta registrada — $${res.total_cobrado.toFixed(2)}` })
            setCarrito([])
            setPrecios({})
            // Recargar inventario para actualizar stock
            const data = await api.getInventario()
            setProductos(data.filter(p => p.stock_total > 0))
        } catch (e: any) {
            setMensaje({ tipo: "error", texto: `❌ ${e.message}` })
        } finally {
            setCobrando(false)
        }
    }

    const totalCarrito = carrito.reduce((acc, i) => acc + i.cantidad * i.precio_real, 0)

    if (cargando) return <div className="p-8 text-center text-gray-500">Cargando productos...</div>

    return (
        <div className="flex gap-4 p-4 h-screen">

            {/* ── Catálogo ── */}
            <div className="flex-1 overflow-y-auto">
                <h1 className="text-2xl font-bold text-pink-600 mb-4">🛍️ Punto de Venta</h1>

                <input
                    type="text"
                    placeholder="Buscar producto o código..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-pink-300"
                />

                {mensaje && (
                    <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${mensaje.tipo === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}>
                        {mensaje.texto}
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {productosFiltrados.map(prod => (
                        <div key={prod.producto}
                            className="border border-gray-100 rounded-2xl p-3 hover:border-pink-300 hover:shadow-sm transition-all">

                            {/* Foto */}
                            <div className="aspect-square rounded-xl overflow-hidden bg-pink-50 mb-2">
                                {prod.imagen && prod.imagen !== "No hay foto" ? (
                                    <img src={`http://localhost:8000/${prod.imagen}`}
                                        alt={prod.producto}
                                        className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-3xl">🛍️</div>
                                )}
                            </div>

                            <p className="font-semibold text-sm text-gray-800 truncate">{prod.producto}</p>
                            <p className="text-pink-600 font-bold text-lg">${prod.precio_venta.toFixed(2)}</p>
                            <p className="text-xs text-gray-400 mb-2">Stock: {prod.stock_total}</p>

                            <button
                                onClick={() => agregarAlCarrito(prod)}
                                className="w-full bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium py-1.5 rounded-xl transition-colors">
                                ＋ Agregar
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Carrito ── */}
            <div className="w-72 flex flex-col border-l border-gray-100 pl-4">
                <h2 className="text-lg font-bold text-gray-700 mb-3">🛒 Carrito</h2>

                {carrito.length === 0 ? (
                    <p className="text-sm text-gray-400">Agrega productos con ＋</p>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {carrito.map((item) => {
                                const prod = productos.find(p => p.producto === item.producto)
                                return (
                                    <div key={item.producto} className="border border-gray-100 rounded-xl p-2">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="font-medium text-sm text-gray-800 flex-1 mr-1">{item.producto}</p>
                                            <button onClick={() => quitarDelCarrito(item.producto)}
                                                className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                                        </div>

                                        <div className="flex gap-2 items-center">
                                            {/* Cantidad */}
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => cambiarCantidad(item.producto, Math.max(1, item.cantidad - 1))}
                                                    className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold">−</button>
                                                <span className="text-sm w-5 text-center">{item.cantidad}</span>
                                                <button onClick={() => cambiarCantidad(item.producto, Math.min(prod?.stock_total ?? 99, item.cantidad + 1))}
                                                    className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold">+</button>
                                            </div>

                                            {/* Precio editable */}
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={precios[item.producto] ?? item.precio_real.toString()}
                                                onChange={e => cambiarPrecio(item.producto, e.target.value)}
                                                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-pink-300"
                                            />
                                        </div>

                                        <p className="text-right text-xs text-gray-500 mt-1">
                                            ${(item.cantidad * item.precio_real).toFixed(2)}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                            <div className="flex justify-between font-bold text-gray-800">
                                <span>Total</span>
                                <span>${totalCarrito.toFixed(2)}</span>
                            </div>

                            <button
                                onClick={cobrar}
                                disabled={cobrando}
                                className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
                                {cobrando ? "Procesando..." : "✅ Cobrar"}
                            </button>

                            <button
                                onClick={() => { setCarrito([]); setPrecios({}) }}
                                className="w-full text-gray-400 hover:text-gray-600 text-sm py-1">
                                Vaciar carrito
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
