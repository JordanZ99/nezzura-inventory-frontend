"use client"
// ==============================================================================
// src/app/gastos/page.tsx — Rediseño Argon primary
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Gasto } from "@/lib/api"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

export default function Gastos() {
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [cargando, setCargando] = useState(true)
    const [form, setForm] = useState({
        fecha: new Date().toISOString().substring(0, 10),
        categoria: "Otros",
        descripcion: "",
        monto: ""
    })
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

    const CATEGORIAS = ["Evento", "Decoración", "Materiales", "Alimentos", "Envíos", "Otros"]

    async function recargar() {
        const g = await api.getGastos()
        setGastos(g)
    }
    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    async function agregar() {
        const monto = parseFloat(form.monto)
        if (!form.descripcion || isNaN(monto)) return
        try {
            await api.crearGasto({
                fecha: form.fecha + "T12:00:00.000Z", // add time to ensure it posts correctly in UTC/local timezone logic
                categoria: form.categoria,
                descripcion: form.descripcion,
                monto
            })
            mostrarMsg(true, `✅ Gasto registrado: $${monto.toFixed(2)}`)
            setForm(f => ({ ...f, descripcion: "", monto: "" }))
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function eliminar(id: number) {
        if (!confirm("¿Eliminar este gasto?")) return
        try {
            await api.eliminarGasto(id)
            mostrarMsg(true, "🗑️ Gasto eliminado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    const total = gastos.reduce((a, g) => a + g.monto, 0)
    const numGastos = gastos.length

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-4)", padding: "32px 24px 90px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={400}
                        magnetRadius={12}
                        ringRadius={8}
                        waveSpeed={0.5}
                        waveAmplitude={1.2}
                        particleSize={1.5}
                        lerpSpeed={0.08}
                        color="var(--ag-color-4)"
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
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>EGRESOS</p>
                    {/*Aquí va el titulo de la pagina*/}
                    <h1 className="hidden md:flex" style={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}>
                        <div style={{ marginLeft: "-5px" }}>
                            <Icon name="DollarSign" size={32} color="var(--primary-soft)" />
                        </div>
                        Gastos</h1>
                </div>
            </div>

            <div style={{ padding: "0 16px", marginTop: -60 }}>
                {/* Stats cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="BanknoteArrowDown" size={32} color="var(--primary-alter)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Total Gastado</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-alter)" }}>${total.toFixed(0)}</p>
                        </div>
                    </div>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="ClipboardList" size={32} color="var(--primary-pale)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Operaciones</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-pale)" }}>{numGastos}</p>
                        </div>
                    </div>
                </div>

                {msg && (
                    <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, borderLeft: "4px solid #4caf50", color: "#2e7d32", fontSize: "0.9rem", fontWeight: 700 }}>{msg.texto}</div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>

                    {/* Formulario */}
                    <div className="card fade-up" style={{ padding: 20, flex: "1 1 300px", maxWidth: 400 }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 800 }}> Registrar Gasto</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Fecha</label>
                                <input type="date" className="input-primary" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Categoría</label>
                                <select className="input-primary" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Descripción</label>
                                <input className="input-primary" placeholder="Ej: Pago de luz, comida..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Monto ($)</label>
                                <input type="number" step="0.01" className="input-primary" placeholder="0.00" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                            </div>
                            <button className="btn-primary" style={{ marginTop: 8 }} onClick={agregar} disabled={!form.descripcion || !form.monto || !form.fecha}>
                                Añadir Gasto
                            </button>
                        </div>
                    </div>

                    {/* Lista / Tabla */}
                    <div className="card fade-up" style={{ flex: "1 1 400px", overflow: "hidden" }}>
                        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-primary)", backgroundColor: "var(--bg-card)" }}>
                            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>Movimientos</h3>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                    <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                        {["Fecha", "Categoría", "Gasto", "Monto", ""].map(h => (
                                            <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastos.map(g => (
                                        <tr key={g.id} style={{ borderBottom: "1px solid var(--bg-card)" }} className="hover:bg-primary-50/20">
                                            <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(g.fecha).toLocaleDateString()}</td>
                                            <td style={{ padding: "12px 16px" }}>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#fdf2f8", color: "var(--primary-dark)", padding: "3px 8px", borderRadius: 12 }}>
                                                    {g.categoria}
                                                </span>
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 600 }}>{g.descripcion}</td>
                                            <td style={{ padding: "12px 16px", fontWeight: 800, color: "#b71c1c" }}>-${g.monto.toFixed(2)}</td>
                                            <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                                <button onClick={() => eliminar(g.id)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.3 }}><Icon name="Trash2" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {gastos.length === 0 && !cargando && (
                                        <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No hay gastos registrados.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
                <div style={{ height: 32 }} />
            </div>
        </div>
    )
}
