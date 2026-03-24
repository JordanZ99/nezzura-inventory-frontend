"use client"
// ==============================================================================
// src/app/inventario/page.tsx
// Gestión de inventario: tabla por precio/lote, registrar producto,
// restockear, y editar producto o lote específico.
// ==============================================================================

import { useState, useEffect, useRef } from "react"
import { api, Producto, Lote, NuevoProducto, Restock } from "@/lib/api"

function Badge({ children, color = "pink" }: { children: React.ReactNode; color?: string }) {
    const colors: Record<string, string> = {
        pink: "bg-pink-100 text-pink-700",
        green: "bg-green-100 text-green-700",
        red: "bg-red-100 text-red-700",
        gray: "bg-gray-100 text-gray-500",
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color]}`}>{children}</span>
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">{label}</label>
            <input {...props} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
        </div>
    )
}

function Btn({ children, variant = "primary", ...props }: {
    children: React.ReactNode; variant?: "primary" | "secondary" | "danger"
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const s = { primary: "bg-pink-500 hover:bg-pink-600 text-white", secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700", danger: "bg-red-50 hover:bg-red-100 text-red-600" }
    return <button {...props} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${s[variant]} ${props.className ?? ""}`}>{children}</button>
}

export default function Inventario() {
    const [lotes, setLotes] = useState<Lote[]>([])
    const [inv, setInv] = useState<Producto[]>([])
    const [cargando, setCargando] = useState(true)
    const [tab, setTab] = useState<"catalogo" | "nuevo" | "restock" | "editar">("catalogo")
    const [loteEditar, setLoteEditar] = useState<Lote | null>(null)
    const [editLote, setEditLote] = useState({ costo: 0, precio_venta: 0 })
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [form, setForm] = useState<NuevoProducto>({ producto: "", descripcion: "", costo: 0, precio_venta: 0, stock: 1 })
    const [restock, setRestock] = useState<Restock>({ producto: "", costo: 0, precio_venta: 0, stock: 1 })
    const fotoRef = useRef<HTMLInputElement>(null)

    async function recargar() {
        const [l, i] = await Promise.all([api.getLotes(), api.getInventario()])
        setLotes(l)
        setInv(i)
    }

    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto })
        setTimeout(() => setMsg(null), 3000)
    }

    // Agrupar lotes por producto → grupos de costo+precio
    const tablaLotes = lotes.reduce<Record<string, { costo: number; precio: number; stock: number; lote: Lote }[]>>((acc, lote) => {
        if (!acc[lote.producto]) acc[lote.producto] = []
        const key = `${lote.costo}-${lote.precio_venta}`
        const ex = acc[lote.producto].find(g => `${g.costo}-${g.precio}` === key)
        if (ex) { ex.stock += lote.stock_lote }
        else { acc[lote.producto].push({ costo: lote.costo, precio: lote.precio_venta, stock: lote.stock_lote, lote }) }
        return acc
    }, {})

    async function guardarNuevo() {
        try {
            let imagen = "No hay foto"
            if (fotoRef.current?.files?.[0]) {
                const r = await api.subirFoto(form.producto, fotoRef.current.files[0])
                imagen = r.ruta
            }
            await api.crearProducto({ ...form, imagen })
            mostrarMsg(true, `✅ ${form.producto} registrado`)
            setForm({ producto: "", descripcion: "", costo: 0, precio_venta: 0, stock: 1 })
            setTab("catalogo")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function guardarRestock() {
        try {
            const prodActual = inv.find(p => p.producto === restock.producto)
            const precio = restock.precio_venta || prodActual?.precio_venta || 0
            await api.restockear({ ...restock, precio_venta: precio })
            mostrarMsg(true, `✅ +${restock.stock} a ${restock.producto}`)
            setTab("catalogo")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function guardarLote() {
        if (!loteEditar) return
        try {
            await api.editarLote(loteEditar.id_lote, editLote)
            mostrarMsg(true, "✅ Lote actualizado")
            setLoteEditar(null)
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function darDeBaja(producto: string) {
        if (!confirm(`¿Dar de baja ${producto}?`)) return
        try {
            const p = inv.find(x => x.producto === producto)
            await api.editarProducto(producto, { descripcion: p?.descripcion ?? "", imagen: p?.imagen ?? "No hay foto", estado: "Inactivo" })
            mostrarMsg(true, `✅ ${producto} dado de baja`)
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    if (cargando) return <div className="p-8 text-center text-gray-500">Cargando inventario...</div>

    const productos = Array.from(new Set(lotes.map(l => l.producto))).sort()

    return (
        <div className="p-6 max-w-5xl">
            <h1 className="text-2xl font-bold text-pink-600 mb-4">📦 Inventario</h1>

            {/* Métricas */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { label: "Productos activos", valor: inv.filter(p => p.stock_total > 0).length },
                    { label: "Valor del inventario", valor: `$${inv.reduce((a, p) => a + p.stock_total * p.precio_venta, 0).toFixed(2)}` },
                    { label: "Ganancia potencial", valor: `$${inv.reduce((a, p) => a + p.stock_total * (p.precio_venta - p.costo_promedio), 0).toFixed(2)}` },
                    { label: "Stock bajo (≤3)", valor: inv.filter(p => p.stock_total <= 3 && p.stock_total > 0).length },
                ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-xs text-gray-400 mb-1">{m.label}</p>
                        <p className="text-xl font-bold text-gray-800">{m.valor}</p>
                    </div>
                ))}
            </div>

            {msg && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {msg.texto}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {(["catalogo", "nuevo", "restock", "editar"] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? "bg-pink-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {{ catalogo: "📋 Catálogo", nuevo: "✨ Nuevo", restock: "📦 Restock", editar: "⚙️ Editar" }[t]}
                    </button>
                ))}
            </div>

            {/* Catálogo */}
            {tab === "catalogo" && (
                <div className="space-y-3">
                    {productos.map(producto => {
                        const grupos = tablaLotes[producto] ?? []
                        const stockTotal = grupos.reduce((a, g) => a + g.stock, 0)
                        return (
                            <div key={producto} className="border border-gray-100 rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold">{producto}</span>
                                        <Badge color={stockTotal <= 3 ? "red" : "green"}>{stockTotal} en stock</Badge>
                                    </div>
                                    <Btn variant="danger" onClick={() => darDeBaja(producto)}>Dar de baja</Btn>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-400 border-b border-gray-100">
                                        <tr>
                                            {["Costo unit.", "Precio venta", "Stock", "Margen", ""].map(h => (
                                                <th key={h} className="text-left px-4 py-2">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grupos.map((g, i) => (
                                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                                <td className="px-4 py-2">${g.costo.toFixed(2)}</td>
                                                <td className="px-4 py-2">${g.precio.toFixed(2)}</td>
                                                <td className="px-4 py-2">{g.stock}</td>
                                                <td className="px-4 py-2">
                                                    <Badge color={g.precio > g.costo ? "green" : "red"}>
                                                        {g.precio > 0 ? `${(((g.precio - g.costo) / g.precio) * 100).toFixed(0)}%` : "—"}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <button onClick={() => { setLoteEditar(g.lote); setEditLote({ costo: g.costo, precio_venta: g.precio }); setTab("editar") }}
                                                        className="text-xs text-pink-500 hover:text-pink-700">Editar</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    })}
                    {productos.length === 0 && <p className="text-gray-400 text-sm">No hay productos registrados.</p>}
                </div>
            )}

            {/* Nuevo producto */}
            {tab === "nuevo" && (
                <div className="max-w-md space-y-4">
                    <Input label="Nombre del producto" value={form.producto} onChange={e => setForm(p => ({ ...p, producto: e.target.value }))} />
                    <Input label="Descripción o código" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
                    <div>
                        <label className="text-xs font-medium text-gray-500">Foto</label>
                        <input type="file" accept="image/*" ref={fotoRef} className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-pink-50 file:text-pink-700" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Input label="Cantidad" type="number" min={1} value={form.stock} onChange={e => setForm(p => ({ ...p, stock: +e.target.value }))} />
                        <Input label="Costo" type="number" min={0} step="0.01" value={form.costo} onChange={e => setForm(p => ({ ...p, costo: +e.target.value }))} />
                        <Input label="Precio" type="number" min={0} step="0.01" value={form.precio_venta} onChange={e => setForm(p => ({ ...p, precio_venta: +e.target.value }))} />
                    </div>
                    <Btn onClick={guardarNuevo} disabled={!form.producto || form.precio_venta === 0}>✅ Dar de Alta</Btn>
                </div>
            )}

            {/* Restock */}
            {tab === "restock" && (
                <div className="max-w-md space-y-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Producto</label>
                        <select value={restock.producto}
                            onChange={e => {
                                const p = inv.find(x => x.producto === e.target.value)
                                setRestock(r => ({ ...r, producto: e.target.value, costo: p?.costo_promedio ?? 0, precio_venta: p?.precio_venta ?? 0 }))
                            }}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                            <option value="">— Selecciona —</option>
                            {productos.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <p className="text-xs text-gray-400">Costo y precio precargados del último lote. Cámbialos si son distintos.</p>
                    <div className="grid grid-cols-3 gap-3">
                        <Input label="Cantidad" type="number" min={1} value={restock.stock} onChange={e => setRestock(r => ({ ...r, stock: +e.target.value }))} />
                        <Input label="Costo" type="number" min={0} step="0.01" value={restock.costo} onChange={e => setRestock(r => ({ ...r, costo: +e.target.value }))} />
                        <Input label="Precio" type="number" min={0} step="0.01" value={restock.precio_venta} onChange={e => setRestock(r => ({ ...r, precio_venta: +e.target.value }))} />
                    </div>
                    <Btn onClick={guardarRestock} disabled={!restock.producto}>➕ Añadir Stock</Btn>
                </div>
            )}

            {/* Editar lote */}
            {tab === "editar" && (
                <div className="max-w-md space-y-4">
                    {!loteEditar ? (
                        <p className="text-sm text-gray-400">Selecciona un lote desde el Catálogo → Editar.</p>
                    ) : (
                        <>
                            <div className="bg-gray-50 rounded-xl p-3 text-sm">
                                <p className="font-medium">{loteEditar.producto}</p>
                                <p className="text-gray-400 text-xs">ID: {loteEditar.id_lote}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Costo unitario" type="number" min={0} step="0.01" value={editLote.costo} onChange={e => setEditLote(l => ({ ...l, costo: +e.target.value }))} />
                                <Input label="Precio de venta" type="number" min={0} step="0.01" value={editLote.precio_venta} onChange={e => setEditLote(l => ({ ...l, precio_venta: +e.target.value }))} />
                            </div>
                            <div className="flex gap-2">
                                <Btn onClick={guardarLote}>💾 Guardar</Btn>
                                <Btn variant="secondary" onClick={() => setLoteEditar(null)}>Cancelar</Btn>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
