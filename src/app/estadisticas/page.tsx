"use client"
// ==============================================================================
// src/app/estadisticas/page.tsx — Rediseño Argon pink
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Venta } from "@/lib/api"

function Pill({ children, color = "pink" }: { children: React.ReactNode; color?: "pink" | "green" | "red" | "gray" }) {
    const map = { pink: "stat-pill-pink", green: "stat-pill-green", red: "stat-pill-red", gray: "stat-pill-gray" }
    return (
        <span className={map[color]} style={{ fontSize: "0.7rem", fontWeight: 700, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>
            {children}
        </span>
    )
}

export default function Estadisticas() {
    const [ventas, setVentas]     = useState<Venta[]>([])
    const [cargando, setCargando] = useState(true)
    const [editando, setEditando] = useState<number | null>(null)
    const [editVal, setEditVal]   = useState({ total_venta: 0, ganancia_bruta: 0 })
    const [msg, setMsg]           = useState<{ ok: boolean; texto: string } | null>(null)

    async function recargar() {
        const v = await api.getVentas()
        setVentas(v)
    }
    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    async function guardarEdicion() {
        if (editando === null) return
        try {
            await api.actualizarVenta(editando, editVal)
            mostrarMsg(true, "✅ Venta actualizada")
            setEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function eliminarVenta(id: number) {
        if (!confirm("¿Eliminar esta venta permanentemente?")) return
        try {
            await api.eliminarVenta(id)
            mostrarMsg(true, "🗑️ Venta eliminada")
            setEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    const totalVentas    = ventas.reduce((a, v) => a + v.total_venta, 0)
    const totalGanancia  = ventas.reduce((a, v) => a + v.ganancia_bruta, 0)
    const margenPromedio = totalVentas > 0 ? (totalGanancia / totalVentas) * 100 : 0
    const numVentas      = ventas.length

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* Hero con gradiente oscuro para resaltar gráficas (estilo Argon) */}
            <div style={{ background: "linear-gradient(135deg, #172b4d 0%, #1a174d 100%)", padding: "32px 24px 90px" }}>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" }}>RENDIMIENTO</p>
                <h1 style={{ color: "#fff", fontSize: "1.7rem", fontWeight: 800, margin: 0 }}>📊 Estadísticas</h1>
                
                {/* Visualización rápida (Mini gráfico simulado) */}
                <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: 60, gap: 4 }}>
                        {[40, 70, 45, 90, 65, 80, 50, 85, 60, 95].map((h, i) => (
                            <div key={i} style={{ flex: 1, background: "var(--pink-mid)", height: `${h}%`, borderRadius: "4px 4px 0 0", opacity: 0.3 + (h/100)*0.7 }} />
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ padding: "0 16px", marginTop: -60 }}>
                {/* Stats cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }} className="md:grid-cols-4">
                    {[
                        { label: "Ventas Totales",  valor: `$${totalVentas.toFixed(0)}`, icon: "💰", color: "pink" },
                        { label: "Ganancia Bruta",  valor: `$${totalGanancia.toFixed(0)}`, icon: "📈", color: "green" },
                        { label: "Margen Prom.",    valor: `${margenPromedio.toFixed(1)}%`, icon: "🎯", color: "blue" },
                        { label: "Núm. Operaciones", valor: numVentas, icon: "🧾", color: "orange" },
                    ].map(st => (
                        <div key={st.label} className="card fade-up" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ background: "var(--pink-pale)", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>{st.icon}</div>
                            <div>
                                <p style={{ margin: 0, fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{st.label}</p>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)" }}>{st.valor}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {msg && (
                    <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 12, borderLeft: "4px solid #4caf50", color: "#2e7d32", fontSize: "0.875rem", fontWeight: 700 }}>
                        {msg.texto}
                    </div>
                )}

                {/* Tabla de ventas */}
                <div className="card fade-up" style={{ overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #fce4ec", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Historial de Ventas</h2>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                            <thead>
                                <tr style={{ background: "#f8f9fe", color: "var(--text-muted)", borderBottom: "1px solid #fce4ec" }}>
                                    {["ID", "Fecha", "Productos", "Total", "Ganancia", "Acciones"].map(h => (
                                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ventas.map(v => (
                                    <tr key={v.id_venta} style={{ borderBottom: "1px solid #fdf6f9" }} className="hover:bg-pink-50/30">
                                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>#{v.id_venta}</td>
                                        <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{new Date(v.fecha_venta).toLocaleDateString()}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                {v.detalles?.map((d, i) => (
                                                    <Pill key={i} color="gray">{d.cantidad}x {d.producto}</Pill>
                                                )) || v.producto}
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--pink-dark)" }}>
                                            {editando === v.id_venta ? (
                                                <input type="number" step="0.01" value={editVal.total_venta}
                                                    onChange={e => setEditVal(p => ({ ...p, total_venta: +e.target.value }))}
                                                    className="input-pink" style={{ width: 80, padding: 4 }} />
                                            ) : `$${v.total_venta.toFixed(2)}`}
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            {editando === v.id_venta ? (
                                                <input type="number" step="0.01" value={editVal.ganancia_bruta}
                                                    onChange={e => setEditVal(p => ({ ...p, ganancia_bruta: +e.target.value }))}
                                                    className="input-pink" style={{ width: 80, padding: 4 }} />
                                            ) : <Pill color="green">${v.ganancia_bruta.toFixed(2)}</Pill>}
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            {editando === v.id_venta ? (
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <button onClick={guardarEdicion} style={{ color: "#2e7d32", background: "none", border: "none", fontWeight: 800, cursor: "pointer" }}>💾</button>
                                                    <button onClick={() => setEditando(null)} style={{ color: "#b71c1c", background: "none", border: "none", fontWeight: 800, cursor: "pointer" }}>✕</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", gap: 12 }}>
                                                    <button onClick={() => { setEditando(v.id_venta); setEditVal({ total_venta: v.total_venta, ganancia_bruta: v.ganancia_bruta }) }}
                                                        style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>✏️</button>
                                                    <button onClick={() => eliminarVenta(v.id_venta)}
                                                        style={{ color: "#ffcdd2", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>🗑️</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {ventas.length === 0 && !cargando && (
                    <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                        <p>No hay ventas registradas todavía.</p>
                    </div>
                )}
                
                <div style={{ height: 32 }} />
            </div>
        </div>
    )
}
