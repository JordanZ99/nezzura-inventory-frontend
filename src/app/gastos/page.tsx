"use client"
// ==============================================================================
// src/app/gastos/page.tsx — Rediseño Argon primary
// Soporta gastos con estado: 'pagado', 'pendiente', 'descartado'
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
    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [editMonto, setEditMonto] = useState("")
    const [editCategoria, setEditCategoria] = useState("Otros")
    const [editDescripcion, setEditDescripcion] = useState("")

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
                fecha: form.fecha + "T12:00:00.000Z",
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

    async function confirmar(id: number) {
        try {
            await api.confirmarGasto(id)
            mostrarMsg(true, "✅ Gasto confirmado como pagado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function descartar(id: number) {
        if (!confirm("¿Descartar este gasto pendiente?")) return
        try {
            await api.descartarGasto(id)
            mostrarMsg(true, "🗑️ Gasto descartado")
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    function iniciarEdicion(g: Gasto) {
        setEditandoId(g.id)
        setEditMonto(g.monto.toString())
        setEditCategoria(g.categoria)
        setEditDescripcion(g.descripcion)
    }

    function cancelarEdicion() {
        setEditandoId(null)
        setEditMonto("")
        setEditCategoria("Otros")
        setEditDescripcion("")
    }

    async function guardarEdicion(id: number) {
        const monto = parseFloat(editMonto)
        if (isNaN(monto) || monto <= 0) return
        try {
            await api.actualizarGasto(id, { monto, categoria: editCategoria, descripcion: editDescripcion })
            mostrarMsg(true, "✅ Gasto actualizado")
            cancelarEdicion()
            recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    // ── Stats: solo gastos pagados ──
    const pagados = gastos.filter(g => g.estado !== "pendiente" && g.estado !== "descartado")
    const totalPagado = pagados.reduce((a, g) => a + g.monto, 0)
    const numPagados = pagados.length
    const pendientes = gastos.filter(g => g.estado === "pendiente")
    const totalPendiente = pendientes.reduce((a, g) => a + g.monto, 0)

    // ── Estado badge ──
    function estadoBadge(estado?: string) {
        switch (estado) {
            case "pendiente":
                return { label: "Pendiente", bg: "#fef9c3", color: "#ca8a04" }
            case "descartado":
                return { label: "Descartado", bg: "#f3f4f6", color: "#6b7280" }
            default:
                return { label: "Pagado", bg: "#dcfce7", color: "#16a34a" }
        }
    }

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-4)", padding: "32px 24px 90px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={400} magnetRadius={12} ringRadius={8}
                        waveSpeed={0.5} waveAmplitude={1.2} particleSize={1.5}
                        lerpSpeed={0.08} color="var(--ag-color-4)" autoAnimate={true}
                        particleVariance={0.8} rotationSpeed={0.3} depthFactor={0.5}
                        pulseSpeed={2} particleShape="capsule" fieldStrength={8}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>EGRESOS</p>
                    <h1 className="hidden md:flex" style={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}>
                        <div style={{ marginLeft: "-5px" }}>
                            <Icon name="DollarSign" size={32} color="var(--primary-soft)" />
                        </div>
                        Gastos</h1>
                </div>
            </div>

            <div style={{ padding: "0 16px", marginTop: -60 }}>
                {/* Stats cards: solo pagados */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="BanknoteArrowDown" size={32} color="var(--primary-alter)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Total Pagado</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-alter)" }}>${totalPagado.toFixed(0)}</p>
                        </div>
                    </div>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="ClipboardList" size={32} color="var(--primary-pale)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Pagados</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-pale)" }}>{numPagados}</p>
                        </div>
                    </div>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="Clock" size={32} color="var(--primary-dark)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Pendientes</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-dark)" }}>
                                {pendientes.length > 0 ? `${pendientes.length} ($${totalPendiente.toFixed(0)})` : "0"}
                            </p>
                        </div>
                    </div>
                </div>

                {msg && (
                    <div className="card fade-up" style={{
                        padding: "12px 16px", marginBottom: 16,
                        borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#ef4444"}`,
                        color: msg.ok ? "#2e7d32" : "#b91c1c",
                        fontSize: "0.9rem", fontWeight: 700
                    }}>
                        {msg.texto}
                    </div>
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
                            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>
                                <span style={{ marginRight: 6, verticalAlign: "middle", display: "inline-flex" }}>
                                    <Icon name="ListChecks" size={18} />
                                </span>
                                Movimientos
                            </h3>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                    <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                        {["Fecha", "Categoría", "Gasto", "Monto", "Estado", ""].map(h => (
                                            <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastos.map(g => {
                                        const esPendiente = g.estado === "pendiente"
                                        const badge = estadoBadge(g.estado)
                                        return (
                                            <tr key={g.id} style={{
                                                borderBottom: "1px solid var(--bg-card)",
                                                background: esPendiente ? "var(--bg-warning)" : "transparent",
                                                borderLeft: esPendiente ? "3px solid #f59e0b" : "3px solid transparent",
                                                opacity: g.estado === "descartado" ? 0.5 : 1,
                                                transition: "background 0.15s",
                                            }} className={esPendiente ? "" : "hover:bg-primary-50/20"}>
                                                <td style={{ padding: "12px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                                    {new Date(g.fecha).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: "12px 14px" }}>
                                                    {editandoId === g.id ? (
                                                        <select
                                                            className="input-primary"
                                                            style={{ padding: "4px 8px", fontSize: "0.75rem", fontWeight: 600 }}
                                                            value={editCategoria}
                                                            onChange={e => setEditCategoria(e.target.value)}
                                                        >
                                                            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    ) : (
                                                        <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#fdf2f8", color: "var(--primary-dark)", padding: "3px 8px", borderRadius: 12 }}>
                                                            {g.categoria}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                                                    {editandoId === g.id ? (
                                                        <input
                                                            type="text"
                                                            className="input-primary"
                                                            style={{ padding: "4px 8px", fontSize: "0.85rem", fontWeight: 600, minWidth: 120 }}
                                                            value={editDescripcion}
                                                            onChange={e => setEditDescripcion(e.target.value)}
                                                        />
                                                    ) : (
                                                        g.descripcion
                                                    )}
                                                </td>
                                                <td style={{ padding: "12px 14px", fontWeight: 800, color: esPendiente ? "#d97706" : "#b71c1c" }}>
                                                    {editandoId === g.id ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0.01"
                                                            className="input-primary"
                                                            style={{ width: 100, padding: "4px 8px", fontSize: "0.85rem", fontWeight: 700 }}
                                                            value={editMonto}
                                                            onChange={e => setEditMonto(e.target.value)}
                                                        />
                                                    ) : (
                                                        `-$${g.monto.toFixed(2)}`
                                                    )}
                                                </td>
                                                <td style={{ padding: "12px 14px" }}>
                                                    <span style={{
                                                        fontSize: "0.7rem", fontWeight: 700,
                                                        background: badge.bg, color: badge.color,
                                                        padding: "3px 8px", borderRadius: 12,
                                                        display: "inline-flex", alignItems: "center", gap: 4,
                                                    }}>
                                                        {esPendiente && <Icon name="Timer" size={12} />}
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                                                    {editandoId === g.id ? (
                                                        <span style={{ display: "inline-flex", gap: 4 }}>
                                                            <button
                                                                onClick={() => guardarEdicion(g.id)}
                                                                title="Guardar cambios"
                                                                style={{
                                                                    background: "var(--bg-success)", border: "none",
                                                                    borderRadius: 8, padding: "6px 8px",
                                                                    cursor: "pointer", color: "#16a34a",
                                                                    display: "inline-flex", alignItems: "center",
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = "#bbf7d0"; e.currentTarget.style.color = "#15803d" }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-success)"; e.currentTarget.style.color = "#16a34a" }}
                                                            >
                                                                <Icon name="Check" size={16} />
                                                            </button>
                                                            <button
                                                                onClick={cancelarEdicion}
                                                                title="Cancelar"
                                                                style={{
                                                                    background: "transparent", border: "1.5px solid var(--border-primary)",
                                                                    borderRadius: 8, padding: "6px 8px",
                                                                    cursor: "pointer", color: "var(--text-muted)",
                                                                    display: "inline-flex", alignItems: "center",
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.borderColor = "#fca5a5"; e.currentTarget.style.color = "#b91c1c" }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-primary)"; e.currentTarget.style.color = "var(--text-muted)" }}
                                                            >
                                                                <Icon name="X" size={16} />
                                                            </button>
                                                        </span>
                                                    ) : esPendiente ? (
                                                        <span style={{ display: "inline-flex", gap: 4 }}>
                                                            <button
                                                                onClick={() => confirmar(g.id)}
                                                                title="Confirmar pago"
                                                                style={{
                                                                    background: "var(--bg-success)", border: "none",
                                                                    borderRadius: 8, padding: "6px 8px",
                                                                    cursor: "pointer", color: "#16a34a",
                                                                    display: "inline-flex", alignItems: "center",
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = "#bbf7d0"; e.currentTarget.style.color = "#15803d" }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-success)"; e.currentTarget.style.color = "#16a34a" }}
                                                            >
                                                                <Icon name="Check" size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => descartar(g.id)}
                                                                title="Descartar gasto"
                                                                style={{
                                                                    background: "transparent", border: "1.5px solid var(--border-primary)",
                                                                    borderRadius: 8, padding: "6px 8px",
                                                                    cursor: "pointer", color: "var(--text-muted)",
                                                                    display: "inline-flex", alignItems: "center",
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#9ca3af" }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-primary)" }}
                                                            >
                                                                <Icon name="X" size={16} />
                                                            </button>
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: "inline-flex", gap: 20, alignItems: "center" }}>
                                                            <button
                                                                onClick={() => iniciarEdicion(g)}
                                                                title="Editar gasto"
                                                                style={{
                                                                    background: "none", border: "none",
                                                                    cursor: "pointer", opacity: 0.35,
                                                                    display: "inline-flex", alignItems: "center",
                                                                    justifyContent: "center",
                                                                    padding: "8px",
                                                                    borderRadius: 8,
                                                                    minWidth: 32,
                                                                    minHeight: 32,
                                                                    transition: "opacity 0.15s, background 0.15s",
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.background = "var(--bg-card2)" }}
                                                                onMouseLeave={e => { e.currentTarget.style.opacity = "0.35"; e.currentTarget.style.background = "transparent" }}
                                                            >
                                                                <Icon name="Pencil" size={16} />
                                                            </button>
                                                            <button onClick={() => eliminar(g.id)}
                                                                title="Eliminar gasto"
                                                                style={{
                                                                    background: "none", border: "none",
                                                                    cursor: "pointer", opacity: 0.3,
                                                                    display: "inline-flex", alignItems: "center",
                                                                    justifyContent: "center",
                                                                    padding: "8px",
                                                                    borderRadius: 8,
                                                                    minWidth: 32,
                                                                    minHeight: 32,
                                                                    transition: "opacity 0.15s, background 0.15s",
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.background = "var(--bg-card2)" }}
                                                                onMouseLeave={e => { e.currentTarget.style.opacity = "0.3"; e.currentTarget.style.background = "transparent" }}
                                                            >
                                                                <Icon name="Trash2" size={16} />
                                                            </button>
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {gastos.length === 0 && !cargando && (
                                        <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No hay gastos registrados.</td></tr>
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
