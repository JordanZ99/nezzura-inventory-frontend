"use client"
// ==============================================================================
// src/app/inventario/page.tsx  —  Rediseño Argon pink
// ==============================================================================

import { useState, useEffect, useRef } from "react"
import { api, Producto, Lote, NuevoProducto, Restock } from "@/lib/api"

type Tab = "catalogo" | "nuevo" | "restock" | "editar"

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>
            <input {...props} className="input-pink" />
        </div>
    )
}

function Pill({ children, color = "pink" }: { children: React.ReactNode; color?: "pink" | "green" | "red" | "gray" }) {
    const map = { pink: "stat-pill-pink", green: "stat-pill-green", red: "stat-pill-red", gray: "stat-pill-gray" }
    return (
        <span className={map[color]} style={{ fontSize: "0.7rem", fontWeight: 700, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>
            {children}
        </span>
    )
}

export default function Inventario() {
    const [lotes, setLotes]       = useState<Lote[]>([])
    const [inv, setInv]           = useState<Producto[]>([])
    const [cargando, setCargando] = useState(true)
    const [tab, setTab]           = useState<Tab>("catalogo")
    const [loteEditar, setLoteEditar] = useState<Lote | null>(null)
    const [editLote, setEditLote] = useState({ costo: 0, precio_venta: 0 })
    const [msg, setMsg]           = useState<{ ok: boolean; texto: string } | null>(null)
    const [form, setForm]         = useState<NuevoProducto>({ producto: "", descripcion: "", costo: 0, precio_venta: 0, stock: 1 })
    const [restock, setRestock]   = useState<Restock>({ producto: "", costo: 0, precio_venta: 0, stock: 1 })
    const fotoRef = useRef<HTMLInputElement>(null)

    async function recargar() {
        const [l, i] = await Promise.all([api.getLotes(), api.getInventario()])
        setLotes(l); setInv(i)
    }
    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    const tablaLotes = lotes.reduce<Record<string, { costo: number; precio: number; stock: number; lote: Lote }[]>>((acc, lote) => {
        if (!acc[lote.producto]) acc[lote.producto] = []
        const key = `${lote.costo}-${lote.precio_venta}`
        const ex = acc[lote.producto].find(g => `${g.costo}-${g.precio}` === key)
        if (ex) { ex.stock += lote.stock_lote }
        else { acc[lote.producto].push({ costo: lote.costo, precio: lote.precio_venta, stock: lote.stock_lote, lote }) }
        return acc
    }, {})

    const productos = Array.from(new Set(lotes.map(l => l.producto))).sort()

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
            setTab("catalogo"); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function guardarRestock() {
        try {
            const prodActual = inv.find(p => p.producto === restock.producto)
            const precio = restock.precio_venta || prodActual?.precio_venta || 0
            await api.restockear({ ...restock, precio_venta: precio })
            mostrarMsg(true, `✅ +${restock.stock} a ${restock.producto}`)
            setTab("catalogo"); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function guardarLote() {
        if (!loteEditar) return
        try {
            await api.editarLote(loteEditar.id_lote, editLote)
            mostrarMsg(true, "✅ Lote actualizado")
            setLoteEditar(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function darDeBaja(producto: string) {
        if (!confirm(`¿Dar de baja ${producto}?`)) return
        try {
            const p = inv.find(x => x.producto === producto)
            await api.editarProducto(producto, { descripcion: p?.descripcion ?? "", imagen: p?.imagen ?? "No hay foto", estado: "Inactivo" })
            mostrarMsg(true, `✅ ${producto} dado de baja`); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: "catalogo", label: "Catálogo",   icon: "📋" },
        { id: "nuevo",    label: "Nuevo",       icon: "✨" },
        { id: "restock",  label: "Restock",     icon: "📦" },
        { id: "editar",   label: "Editar lote", icon: "⚙️" },
    ]

    const totalActivos = inv.filter(p => p.stock_total > 0).length
    const valorInv     = inv.reduce((a, p) => a + p.stock_total * p.precio_venta, 0)
    const ganPotencial = inv.reduce((a, p) => a + p.stock_total * (p.precio_venta - p.costo_promedio), 0)
    const stockBajo    = inv.filter(p => p.stock_total <= 3 && p.stock_total > 0).length

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* Hero */}
            <div className="hero-gradient" style={{ padding: "32px 24px 90px" }}>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>GESTIÓN</p>
                <h1 style={{ color: "#fff", fontSize: "1.7rem", fontWeight: 800, margin: 0 }}>📦 Inventario</h1>
            </div>

            <div style={{ padding: "0 16px", marginTop: -60 }}>
                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }} className="md:grid-cols-4">
                    {[
                        { label: "Productos activos",    valor: totalActivos,               icon: "📦" },
                        { label: "Valor del inventario", valor: `$${valorInv.toFixed(0)}`,  icon: "💰" },
                        { label: "Ganancia potencial",   valor: `$${ganPotencial.toFixed(0)}`, icon: "📈" },
                        { label: "Stock bajo (≤3)",      valor: stockBajo,                  icon: "⚠️" },
                    ].map(m => (
                        <div key={m.label} className="card fade-up" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ background: "linear-gradient(135deg,#e91e8c,#f06292)", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem" }}>
                                {m.icon}
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{m.label}</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{m.valor}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Mensaje */}
                {msg && (
                    <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 12, borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`, color: msg.ok ? "#2e7d32" : "#b71c1c", fontSize: "0.875rem", fontWeight: 600 }}>
                        {msg.texto}
                    </div>
                )}

                {/* Tabs */}
                <div className="card" style={{ display: "flex", padding: 6, gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            flex: 1, minWidth: 80, padding: "8px 12px", borderRadius: 10, border: "none",
                            background: tab === t.id ? "linear-gradient(135deg,#e91e8c,#f06292)" : "transparent",
                            color: tab === t.id ? "#fff" : "var(--text-muted)",
                            fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", transition: "all 0.2s",
                        }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* Catálogo */}
                {tab === "catalogo" && !cargando && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {productos.map(producto => {
                            const grupos = tablaLotes[producto] ?? []
                            const stockTotal = grupos.reduce((a, g) => a + g.stock, 0)
                            return (
                                <div key={producto} className="card fade-up" style={{ overflow: "hidden" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fdf6f9", borderBottom: "1px solid #fce4ec" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{producto}</span>
                                            <Pill color={stockTotal <= 3 ? "red" : "green"}>{stockTotal} en stock</Pill>
                                        </div>
                                        <button onClick={() => darDeBaja(producto)} style={{ background: "#ffeef0", color: "#b71c1c", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                                            Dar de baja
                                        </button>
                                    </div>
                                    <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                            <thead>
                                                <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid #fce4ec" }}>
                                                    {["Costo unit.", "Precio venta", "Stock", "Margen", ""].map(h => (
                                                        <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {grupos.map((g, i) => (
                                                    <tr key={i} style={{ borderBottom: "1px solid #fdf6f9" }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = "#fdf6f9")}
                                                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                                                        <td style={{ padding: "10px 16px" }}>${g.costo.toFixed(2)}</td>
                                                        <td style={{ padding: "10px 16px", fontWeight: 700, color: "var(--pink-mid)" }}>${g.precio.toFixed(2)}</td>
                                                        <td style={{ padding: "10px 16px" }}>{g.stock}</td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            <Pill color={g.precio > g.costo ? "green" : "red"}>
                                                                {g.precio > 0 ? `${(((g.precio - g.costo) / g.precio) * 100).toFixed(0)}%` : "—"}
                                                            </Pill>
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            <button onClick={() => { setLoteEditar(g.lote); setEditLote({ costo: g.costo, precio_venta: g.precio }); setTab("editar") }}
                                                                style={{ background: "none", border: "none", color: "var(--pink-mid)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>
                                                                Editar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        })}
                        {productos.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>No hay productos registrados.</p>}
                    </div>
                )}
                {tab === "catalogo" && cargando && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Cargando inventario...</p>}

                {/* Nuevo producto */}
                {tab === "nuevo" && (
                    <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>✨ Dar de alta producto</h2>
                        <Input label="Nombre del producto" value={form.producto} onChange={e => setForm(p => ({ ...p, producto: e.target.value }))} />
                        <Input label="Descripción o código" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Foto</label>
                            <input type="file" accept="image/*" ref={fotoRef} style={{ fontSize: "0.85rem" }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <Input label="Cantidad" type="number" min={1} value={form.stock} onChange={e => setForm(p => ({ ...p, stock: +e.target.value }))} />
                            <Input label="Costo" type="number" min={0} step="0.01" value={form.costo} onChange={e => setForm(p => ({ ...p, costo: +e.target.value }))} />
                            <Input label="Precio" type="number" min={0} step="0.01" value={form.precio_venta} onChange={e => setForm(p => ({ ...p, precio_venta: +e.target.value }))} />
                        </div>
                        <button className="btn-pink" onClick={guardarNuevo} disabled={!form.producto || form.precio_venta === 0}>✅ Dar de Alta</button>
                    </div>
                )}

                {/* Restock */}
                {tab === "restock" && (
                    <div className="card fade-up" style={{ padding: 20, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>📦 Añadir Stock</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Producto</label>
                            <select className="input-pink" value={restock.producto}
                                onChange={e => {
                                    const p = inv.find(x => x.producto === e.target.value)
                                    setRestock(r => ({ ...r, producto: e.target.value, costo: p?.costo_promedio ?? 0, precio_venta: p?.precio_venta ?? 0 }))
                                }}>
                                <option value="">— Selecciona —</option>
                                {productos.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>Costo y precio prellenados del último lote. Cámbialos si el nuevo lote es diferente.</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <Input label="Cantidad" type="number" min={1} value={restock.stock} onChange={e => setRestock(r => ({ ...r, stock: +e.target.value }))} />
                            <Input label="Costo" type="number" min={0} step="0.01" value={restock.costo} onChange={e => setRestock(r => ({ ...r, costo: +e.target.value }))} />
                            <Input label="Precio" type="number" min={0} step="0.01" value={restock.precio_venta} onChange={e => setRestock(r => ({ ...r, precio_venta: +e.target.value }))} />
                        </div>
                        <button className="btn-pink" onClick={guardarRestock} disabled={!restock.producto}>➕ Añadir Stock</button>
                    </div>
                )}

                {/* Editar lote */}
                {tab === "editar" && (
                    <div className="card fade-up" style={{ padding: 20, maxWidth: 400, display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>⚙️ Editar Lote</h2>
                        {!loteEditar ? (
                            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Selecciona un lote desde Catálogo → Editar.</p>
                        ) : (
                            <>
                                <div style={{ background: "#fdf6f9", borderRadius: 12, padding: 12 }}>
                                    <p style={{ margin: 0, fontWeight: 700 }}>{loteEditar.producto}</p>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>ID: {loteEditar.id_lote}</p>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <Input label="Costo unitario" type="number" min={0} step="0.01" value={editLote.costo} onChange={e => setEditLote(l => ({ ...l, costo: +e.target.value }))} />
                                    <Input label="Precio de venta" type="number" min={0} step="0.01" value={editLote.precio_venta} onChange={e => setEditLote(l => ({ ...l, precio_venta: +e.target.value }))} />
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn-pink" onClick={guardarLote}>💾 Guardar</button>
                                    <button className="btn-ghost" onClick={() => setLoteEditar(null)}>Cancelar</button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div style={{ height: 20 }} />
            </div>
        </div>
    )
}
