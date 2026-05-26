"use client"
// ==============================================================================
// src/app/estadisticas/page.tsx — Rediseño Tremor + Antigravity Hero + PDF
// ==============================================================================

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { api, Venta, Gasto } from "@/lib/api"
import { DateRangePicker, DateRangePickerValue, DonutChart, LineChart, BarChart } from "@tremor/react"
import Icon from "@/components/ui/Icon"
import { useChartColors } from "@/components/hooks/useChartColors"
import { useTenant } from "@/contexts/TenantContext"

// Dynamic import to avoid SSR issues with Three.js
const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

function Pill({ children, color = "primary" }: { children: React.ReactNode; color?: "primary" | "green" | "red" | "gray" }) {
    const map = { primary: "stat-pill-primary", green: "stat-pill-green", red: "stat-pill-red", gray: "stat-pill-gray" }
    return (
        <span className={map[color]} style={{ fontSize: "0.7rem", fontWeight: 700, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>
            {children}
        </span>
    )
}

export default function Estadisticas() {
    const [ventas, setVentas] = useState<Venta[]>([])
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [cargando, setCargando] = useState(true)
    const [editando, setEditando] = useState<number | null>(null)
    const [editVal, setEditVal] = useState({ fecha: "", cantidad: 0, precio_real: 0, total_venta: 0, ganancia_bruta: 0, costo_unitario: 0 })
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [dates, setDates] = useState<DateRangePickerValue>({ from: undefined, to: undefined })
    const chartColors = useChartColors();

    const [guardando, setGuardando] = useState(false)
    const { tenant } = useTenant()
    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "..."

    async function recargar() {
        try {
            const [v, g] = await Promise.all([api.getVentas(), api.getGastos()])
            setVentas(v)
            setGastos(g)
        } catch (e) {
            console.error(e)
        }
    }
    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    async function guardarEdicion() {
        if (editando === null || guardando) return
        setGuardando(true)
        try {
            await api.actualizarVenta(editando, editVal)
            mostrarMsg(true, "✅ Venta actualizada")
            setEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function anularVenta(id: number) {
        if (!confirm("¿Anular esta venta permanentemente? El stock será devuelto al inventario y dejará de contar en las estadísticas.")) return
        try {
            await api.eliminarVenta(id)
            mostrarMsg(true, "🚫 Venta anulada")
            setEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    // --- Filtrado ---
    const ventasFiltradas = ventas.filter(v => {
        const f = new Date(v.fecha)
        if (dates.from && f < dates.from) return false
        if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
        return true
    })

    const gastosFiltrados = gastos.filter(g => {
        const f = new Date(g.fecha)
        if (dates.from && f < dates.from) return false
        if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
        return true
    })

    // --- KPIs ---
    const ventasActivas = ventasFiltradas.filter(v => v.estado !== "Inactivo")

    const totalVendido = ventasActivas.reduce((a, v) => a + v.total_venta, 0)
    const gananciaBruta = ventasActivas.reduce((a, v) => a + v.ganancia_bruta, 0)
    const totalGastos = gastosFiltrados.reduce((a, g) => a + g.monto, 0)
    const gananciaNeta = gananciaBruta - totalGastos
    const costoTotalGlobal = totalVendido - gananciaBruta

    // --- Transformación de datos para Gráficas ---
    const globalCostProfit = [
        { name: "Costo de Productos", value: costoTotalGlobal },
        { name: "Ganancia Bruta", value: gananciaBruta }
    ]

    const productSales = ventasActivas.reduce((acc, v) => {
        acc[v.producto] = (acc[v.producto] || 0) + v.total_venta
        return acc
    }, {} as Record<string, number>)
    const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1])
    const top5 = sortedProducts.slice(0, 5).map(p => ({ name: p[0], value: p[1] }))
    const otros = sortedProducts.slice(5).reduce((a, p) => a + p[1], 0)
    if (otros > 0) top5.push({ name: "Otros", value: otros })

    const salesByDate = ventasActivas.reduce((acc, v) => {
        const d = v.fecha.substring(0, 10)
        acc[d] = (acc[d] || 0) + v.total_venta
        return acc
    }, {} as Record<string, number>)
    const chartDataLine = Object.entries(salesByDate).sort((a, b) => a[0].localeCompare(b[0])).map(d => ({ date: d[0], "Ventas": d[1] }))

    const productCostProfit = ventasActivas.reduce((acc, v) => {
        if (!acc[v.producto]) acc[v.producto] = { name: v.producto, "Costo Lotes": 0, "Ganancia": 0, total: 0 }
        acc[v.producto]["Costo Lotes"] += (v.total_venta - v.ganancia_bruta)
        acc[v.producto]["Ganancia"] += v.ganancia_bruta
        acc[v.producto].total += v.total_venta
        return acc
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as Record<string, any>)
    const chartDataBar = Object.values(productCostProfit).sort((a, b) => b.total - a.total)



    const valFormatter = (number: number) => `$${Intl.NumberFormat("us").format(number).toString()}`

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>


            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-3)", padding: "32px 24px 90px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={800}
                        magnetRadius={12}
                        ringRadius={8}
                        waveSpeed={0.5}
                        waveAmplitude={1.2}
                        particleSize={1.5}
                        lerpSpeed={0.08}
                        color="var(--ag-color-3)"
                        autoAnimate={true}
                        particleVariance={0.8}
                        rotationSpeed={0.3}
                        depthFactor={0.5}
                        pulseSpeed={2}
                        particleShape="capsule"
                        fieldStrength={8} />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" }}>RENDIMIENTO EXPERTO</p>

                    {/*Panel Estadístico*/}
                    <h1 className="hidden md:flex" style={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}>
                        <Icon name="ChartPie" size={32} color="var(--primary-soft)" />
                        Panel Estadístico
                    </h1>
                </div>
            </div>

            {/* ── Controls: Date Picker + PDF Button ── */}
            <div style={{ padding: "0 24px", marginTop: -60 }}>
                <div className="card fade-up" style={{ padding: "20px 24px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
                            <DateRangePicker className="w-full" value={dates} onValueChange={setDates} selectPlaceholder="Filtrar por período" />
                        </div>
                    </div>
                </div>

                {msg && (
                    <div className="fade-up" style={{
                        position: "fixed",
                        bottom: 24,
                        right: 24,
                        zIndex: 9999,
                        padding: "16px 24px",
                        borderRadius: 12,
                        background: "var(--bg-card)",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                        borderLeft: `6px solid ${msg.ok ? "#4caf50" : "#f44336"}`,
                        color: msg.ok ? "#2e7d32" : "#b71c1c",
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 12
                    }}>
                        <span style={{ fontSize: "1.2rem" }}>{msg.ok ? "✅" : "⚠️"}</span>
                        {msg.texto}
                    </div>
                )}

                {/* ── CONTENEDOR PARA EL PDF ── */}
                <div id="report-container" style={{ padding: 16, background: "var(--bg-card)", borderRadius: 12, overflow: "hidden", maxWidth: "100%" }}>

                    <div className="flex md:hidden" style={{ alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid var(--border-primary)" }}>
                        <img src={logoSrc} alt={empresa} style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 16, background: "#fff", padding: 4, border: "1px solid var(--border-primary" }} />
                        <div>
                            <h2 style={{ margin: "0 0 6px", fontWeight: 800, fontSize: "1.4rem", color: "var(--primary-dark)", textTransform: "uppercase", lineHeight: 1.1 }}>Reporte de Ventas</h2>
                            <p style={{ margin: "0 0 4px", fontSize: "0.95rem", color: "var(--text-main)", fontWeight: 600 }}>{empresa}</p>
                            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                Período: {dates.from ? dates.from.toLocaleDateString() : "Inicio"} {" — "} {dates.to ? dates.to.toLocaleDateString() : new Date().toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    {/* KPIs con la clase agregada */}
                    <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
                        <div style={{ padding: "16px 20px", borderLeft: "4px solid rgb(var(--chart-1))", borderRadius: 12, background: "var(--bg-card2)" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Total Vendido</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.3rem", color: "var(--text-main)" }}>${totalVendido.toFixed(2)}</p>
                        </div>
                        <div style={{ padding: "16px 20px", borderLeft: "4px solid rgb(var(--chart-2))", borderRadius: 12, background: "var(--bg-card2)" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Margen Bruto (%)</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.3rem", color: "var(--text-main)" }}>{totalVendido > 0 ? ((gananciaBruta / totalVendido) * 100).toFixed(1) : "0.0"}%</p>
                        </div>
                        <div style={{ padding: "16px 20px", borderLeft: "4px solid rgb(var(--chart-3))", borderRadius: 12, background: "var(--bg-card2)" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Gastos del Periodo</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.3rem", color: "var(--text-main)" }}>${totalGastos.toFixed(2)}</p>
                        </div>
                        <div style={{ padding: "16px 20px", borderLeft: gananciaNeta >= 0 ? "4px solid var(--success-main)" : "4px solid var(--error-main)", borderRadius: 12, background: gananciaNeta >= 0 ? "var(--success-bg)" : "var(--error-bg)" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Ganancia Neta</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem", color: gananciaNeta >= 0 ? "var(--success-text)" : "var(--error-text)" }}>${gananciaNeta.toFixed(2)}</p>
                            {gananciaBruta > 0 && <Pill color={gananciaNeta >= 0 ? "green" : "red"}>{((gananciaNeta / gananciaBruta) * 100).toFixed(1)}% margen neto</Pill>}
                        </div>
                    </div>

                    {/* Charts */}
                    {cargando ? (
                        <p style={{ textAlign: "center", color: "#999", padding: 40 }}>Recabando datos para gráficas...</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                            {/* Row 1: Dona + Pie + Líneas con la clase agregada */}
                            <div className="charts-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                                <div style={{ padding: 16, border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
                                    <h3 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>Top Ventas por Producto</h3>
                                    {top5.length > 0 ? <DonutChart data={top5} category="value" index="name" valueFormatter={valFormatter} colors={chartColors} className="h-52" showAnimation={false} /> : <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>Sin datos.</p>}
                                </div>
                                <div style={{ padding: 16, border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
                                    <h3 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>Costo vs Ganancia</h3>
                                    {totalVendido > 0 ? <DonutChart variant="pie" data={globalCostProfit} category="value" index="name" valueFormatter={valFormatter} colors={chartColors.slice(0, 2)} className="h-52" showAnimation={false} /> : <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>Sin datos.</p>}
                                </div>
                                <div style={{ padding: 16, border: "1px solid var(--border-primary)", borderRadius: 12 }}>
                                    <h3 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>Evolución de Ventas</h3>
                                    {chartDataLine.length > 0 ? <LineChart className="h-52" data={chartDataLine} index="date" categories={["Ventas"]} colors={[chartColors[0]]} valueFormatter={valFormatter} yAxisWidth={50} showAnimation={false} /> : <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>Sin datos.</p>}
                                </div>
                            </div>

                            <div style={{ padding: 16, border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
                                <h3 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>Contribución Marginal por Producto</h3>
                                {chartDataBar.length > 0 ? (
                                    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 8 }}>
                                        <div style={{ minWidth: Math.max(400, chartDataBar.length * 120) }}>
                                            <BarChart className="h-72" data={chartDataBar} index="name" categories={["Costo Lotes", "Ganancia"]} colors={chartColors.slice(0, 2)} valueFormatter={valFormatter} stack={true} yAxisWidth={50} showAnimation={false} />
                                        </div>
                                    </div>
                                ) : <p style={{ textAlign: "center", color: "#999" }}>No hay datos suficientes.</p>}
                            </div>
                        </div>
                    )}


                </div>

                {/* ── Tabla del Historial de Ventas ── */}
                {/* [Mantuve tu tabla original intacta, va debajo del report-container] */}
                <div style={{ marginTop: 32 }}>
                    <div className="card fade-up" style={{ overflow: "hidden" }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Historial Completo de Ventas</h2>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-card2)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                        {["ID", "Fecha", "Productos", "Precio unitario", "Precio Total", "Ganancia"].map(h => (
                                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ventasFiltradas.map(v => (
                                        <tr key={v.n_ticket} style={{ borderBottom: "1px solid #fdf6f9", opacity: v.estado === "Inactivo" ? 0.6 : 1, textDecoration: v.estado === "Inactivo" ? "line-through" : "none" }} className="hover:bg-primary-50/30">
                                            <td style={{ padding: "12px 16px", fontWeight: 600 }}>#{v.id}</td>
                                            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                                                {editando === v.id ? (
                                                    <input type="date" value={editVal.fecha.substring(0, 10)} onChange={e => setEditVal(p => ({ ...p, fecha: e.target.value + "T12:00:00.000Z" }))} className="input-primary" style={{ width: 120, padding: 4 }} />
                                                ) : new Date(v.fecha).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                        <input type="number" min="1" value={editVal.cantidad} onChange={e => {
                                                            const cant = +e.target.value;
                                                            setEditVal(p => ({
                                                                ...p,
                                                                cantidad: cant,
                                                                total_venta: cant * p.precio_real,
                                                                ganancia_bruta: (p.precio_real - p.costo_unitario) * cant
                                                            }))
                                                        }} className="input-primary" style={{ width: 60, padding: 4 }} />
                                                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>x {v.producto}</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                        <Pill color="gray">{v.cantidad}x {v.producto}</Pill>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary-dark)" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>PRECIO UNIT.</span>
                                                        <input type="number" step="0.01" value={editVal.precio_real} onChange={e => {
                                                            const prec = +e.target.value;
                                                            setEditVal(p => ({
                                                                ...p,
                                                                precio_real: prec,
                                                                total_venta: prec * p.cantidad,
                                                                ganancia_bruta: (prec - p.costo_unitario) * p.cantidad
                                                            }))
                                                        }} className="input-primary" style={{ width: 80, padding: 4 }} />
                                                    </div>
                                                ) : `$${v.precio_real.toFixed(2)}`}
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary-dark)" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>TOTAL</span>
                                                        <input type="number" step="0.01" value={editVal.total_venta} disabled className="input-primary" style={{ width: 80, padding: 4, background: "#f5f5f5", cursor: "not-allowed" }} />
                                                    </div>
                                                ) : `$${(v.total_venta || 0).toFixed(2)}`}
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>GANANCIA</span>
                                                        <input type="number" step="0.01" value={editVal.ganancia_bruta} disabled className="input-primary" style={{ width: 80, padding: 4, background: "#f5f5f5", cursor: "not-allowed" }} />
                                                    </div>
                                                ) : <Pill color="green">${(v.ganancia_bruta || 0).toFixed(2)}</Pill>}
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                {v.estado === "Inactivo" ? (
                                                    <Pill color="red">Anulada</Pill>
                                                ) : editando === v.id ? (
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={guardarEdicion} disabled={guardando} style={{ color: guardando ? "#999" : "#2e7d32", background: "none", border: "none", fontWeight: 800, cursor: guardando ? "not-allowed" : "pointer" }}>
                                                            {guardando ?
                                                                (<Icon name="Hourglass" size={16} color="var(--primary-dark)" />)
                                                                :
                                                                (<Icon name="Save" size={16} color="var(--primary-dark)" />)
                                                            }
                                                        </button>
                                                        <button onClick={() => setEditando(null)} style={{ color: "#b71c1c", background: "none", border: "none", fontWeight: 800, cursor: "pointer" }}><Icon name="X" size={16} color="var(--primary-dark)" /></button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: "flex", gap: 12 }}>
                                                        <button onClick={() => { setEditando(v.id); setEditVal({ fecha: v.fecha, cantidad: v.cantidad, precio_real: v.precio_real, total_venta: v.total_venta, ganancia_bruta: v.ganancia_bruta, costo_unitario: v.costo_unitario }) }} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>
                                                            <Icon name="Pencil" size={16} color="var(--primary-dark)" />
                                                        </button>
                                                        <button onClick={() => anularVenta(v.id)} disabled={guardando} style={{ color: guardando ? "#eee" : "#ffcdd2", background: "none", border: "none", cursor: guardando ? "not-allowed" : "pointer", fontSize: "0.9rem" }}>
                                                            <Icon name="Trash2" size={16} color="var(--primary-dark)" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {ventasFiltradas.length === 0 && (
                                        <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No hay ventas registradas en este período.</td></tr>
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