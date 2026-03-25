"use client"
// ==============================================================================
// src/app/estadisticas/page.tsx — Rediseño Tremor + PDF
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Venta, Gasto } from "@/lib/api"
import { DateRangePicker, DateRangePickerValue, DonutChart, LineChart, BarChart } from "@tremor/react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

function Pill({ children, color = "pink" }: { children: React.ReactNode; color?: "pink" | "green" | "red" | "gray" }) {
    const map = { pink: "stat-pill-pink", green: "stat-pill-green", red: "stat-pill-red", gray: "stat-pill-gray" }
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
    const [editVal, setEditVal] = useState({ total_venta: 0, ganancia_bruta: 0 })
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [dates, setDates] = useState<DateRangePickerValue>({ from: undefined, to: undefined })
    const [generandoPDF, setGenerandoPDF] = useState(false)

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

    // --- Filtrado ---
    const ventasFiltradas = ventas.filter(v => {
        const f = new Date(v.fecha)
        if (dates.from && f < dates.from) return false
        if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false // incluye todo el día final
        return true
    })

    const gastosFiltrados = gastos.filter(g => {
        const f = new Date(g.fecha)
        if (dates.from && f < dates.from) return false
        if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
        return true
    })

    // --- KPIs ---
    const totalVendido = ventasFiltradas.reduce((a, v) => a + v.total_venta, 0)
    const gananciaBruta = ventasFiltradas.reduce((a, v) => a + v.ganancia_bruta, 0)
    const totalGastos = gastosFiltrados.reduce((a, g) => a + g.monto, 0)
    const gananciaNeta = gananciaBruta - totalGastos

    // --- Transformación de datos para Gráficas Tremor ---
    
    // Pie: Costo Total vs Ganancia Bruta
    const costoTotalGlobal = totalVendido - gananciaBruta
    const globalCostProfit = [
        { name: "Costo de Productos", value: costoTotalGlobal },
        { name: "Ganancia Bruta", value: gananciaBruta }
    ]

    // Dona: Top 5 + Otros
    const productSales = ventasFiltradas.reduce((acc, v) => {
        acc[v.producto] = (acc[v.producto] || 0) + v.total_venta
        return acc
    }, {} as Record<string, number>)
    const sortedProducts = Object.entries(productSales).sort((a,b) => b[1] - a[1])
    const top5 = sortedProducts.slice(0, 5).map(p => ({ name: p[0], value: p[1] }))
    const otros = sortedProducts.slice(5).reduce((a, p) => a + p[1], 0)
    if (otros > 0) top5.push({ name: "Otros", value: otros })

    // Líneas: Ventas en el tiempo
    const salesByDate = ventasFiltradas.reduce((acc, v) => {
        const d = v.fecha.substring(0, 10)
        acc[d] = (acc[d] || 0) + v.total_venta
        return acc
    }, {} as Record<string, number>)
    const chartDataLine = Object.entries(salesByDate).sort((a,b) => a[0].localeCompare(b[0])).map(d => ({ date: d[0], "Ventas": d[1] }))

    // Barras Apiladas: Productos vs (Costo + Ganancia)
    const productCostProfit = ventasFiltradas.reduce((acc, v) => {
        if (!acc[v.producto]) acc[v.producto] = { name: v.producto, "Costo Lotes": 0, "Ganancia Bruta": 0, total: 0 }
        acc[v.producto]["Costo Lotes"] += (v.total_venta - v.ganancia_bruta)
        acc[v.producto]["Ganancia Bruta"] += v.ganancia_bruta
        acc[v.producto].total += v.total_venta
        return acc
    }, {} as Record<string, any>)
    const chartDataBar = Object.values(productCostProfit).sort((a,b) => b.total - a.total)

    // --- Exportar a PDF ---
    async function exportarPDF() {
        setGenerandoPDF(true)
        await new Promise(r => setTimeout(r, 200)) // Dale tiempo a React de aplicar clases de PDF (mostrar logo, etc.)
        try {
            const el = document.getElementById("report-container")
            if (!el) return
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" })
            const imgData = canvas.toDataURL("image/png")
            const pdf = new jsPDF("p", "mm", "letter") // Tamaño carta
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const margin = 12 // 12mm de margen impreso real (más cerrado)
            const printWidth = pdfWidth - (margin * 2)
            const printHeight = (canvas.height * printWidth) / canvas.width
            pdf.addImage(imgData, "PNG", margin, margin, printWidth, printHeight)
            pdf.save(`Goyangi_Reporte_${new Date().toISOString().substring(0,10)}.pdf`)
            mostrarMsg(true, "✅ Reporte descargado")
        } catch(e) {
            mostrarMsg(false, "❌ Error generando PDF")
        } finally {
            setGenerandoPDF(false)
        }
    }

    const valFormatter = (number: number) => `$${Intl.NumberFormat("us").format(number).toString()}`

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>
            
            {/* Header / Configuración */}
            <div style={{ padding: "32px 24px", background: "#fff", borderBottom: "1px solid #fce4ec", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, margin: "0 0 4px", textTransform: "uppercase" }}>RENDIMIENTO EXPERTO</p>
                        <h1 style={{ color: "var(--text-main)", fontSize: "1.7rem", fontWeight: 800, margin: 0 }}>📊 Panel Estadístico</h1>
                    </div>
                    
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ minWidth: 280, maxWidth: "100%" }}>
                            <DateRangePicker 
                                className="mx-auto max-w-md w-full"
                                value={dates}
                                onValueChange={setDates}
                                selectPlaceholder="Seleccionar fechas"
                            />
                        </div>
                        <button className="btn-pink" onClick={exportarPDF} disabled={generandoPDF || cargando}>
                            {generandoPDF ? "Procesando..." : "📄 Descargar Reporte PDF"}
                        </button>
                    </div>
                </div>
                
                {msg && (
                    <div className="card fade-up mt-4" style={{ padding: "12px 16px", borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`, color: msg.ok ? "#2e7d32" : "#b71c1c", fontSize: "0.875rem", fontWeight: 700 }}>
                        {msg.texto}
                    </div>
                )}
            </div>

            <div style={{ padding: "0 24px" }}>
                
                {/* ── CONTENEDOR PARA EL PDF (Métricas + Gráficas Tremor) ── */}
                <div id="report-container" style={{ padding: 16, background: "var(--bg-app)", borderRadius: 12 }}>
                    
                    {/* Header para PDF (Visible en PDF o teléfono, oculto en Desktop normal para no repetir) */}
                    <div className={generandoPDF ? "flex" : "flex md:hidden"} style={{ alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #fce4ec" }}>
                        <img src="/logo.png" alt="Goyangi" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 16, background: "#fff", padding: 4, border: "1px solid #fce4ec" }} />
                        <div>
                            <h2 style={{ margin: "0 0 6px", fontWeight: 800, fontSize: "1.6rem", color: "var(--pink-dark)", textTransform: "uppercase", lineHeight: 1.1 }}>Reporte de Ventas</h2>
                            <p style={{ margin: "0 0 4px", fontSize: "0.95rem", color: "var(--text-main)", fontWeight: 600 }}>Goyangi Store</p>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                Período: {dates.from ? dates.from.toLocaleDateString() : "Inicio de los tiempos"} 
                                {" - "} 
                                {dates.to ? dates.to.toLocaleDateString() : new Date().toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                        <div className="card" style={{ padding: "20px 24px", borderLeft: "4px solid #f48fb1" }}>
                            <p style={{ margin: "0 0 6px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Total Vendido</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem", color: "var(--text-main)" }}>${totalVendido.toFixed(2)}</p>
                        </div>
                        <div className="card" style={{ padding: "20px 24px", borderLeft: "4px solid #66bb6a" }}>
                            <p style={{ margin: "0 0 6px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Margen Bruto (%)</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem", color: "var(--text-main)" }}>
                                {totalVendido > 0 ? ((gananciaBruta / totalVendido) * 100).toFixed(1) : "0.0"}%
                            </p>
                        </div>
                        <div className="card" style={{ padding: "20px 24px", borderLeft: "4px solid #ef5350" }}>
                            <p style={{ margin: "0 0 6px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Gastos del Periodo</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem", color: "var(--text-main)" }}>${totalGastos.toFixed(2)}</p>
                        </div>
                        <div className="card" style={{ padding: "20px 24px", borderLeft: "4px solid #ce93d8", background: "linear-gradient(135deg, #fdf6f9, #fff)" }}>
                            <p style={{ margin: "0 0 6px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Ganancia Neta (Libre)</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.8rem", color: gananciaNeta >= 0 ? "#2e7d32" : "#b71c1c" }}>
                                ${gananciaNeta.toFixed(2)}
                            </p>
                            {gananciaBruta > 0 && <Pill color={gananciaNeta >= 0 ? "green" : "red"}>{((gananciaNeta / gananciaBruta) * 100).toFixed(1)}% margen neto</Pill>}
                        </div>
                    </div>

                    {/* Tremor Charts Grid */}
                    {cargando ? (
                        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Recabando datos para gráficas...</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                            
                            {/* Pastel - Top Productos */}
                            <div className="card" style={{ padding: 20 }}>
                                <h3 style={{ margin: "0 0 16px", fontWeight: 700, fontSize: "1rem" }}>Top Ventas por Producto</h3>
                                {top5.length > 0 ? (
                                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 250 }}>
                                        <DonutChart
                                            data={top5}
                                            category="value"
                                            index="name"
                                            valueFormatter={valFormatter}
                                            colors={["pink", "rose", "fuchsia", "purple", "violet", "gray"]}
                                            className="h-60"
                                            showAnimation={false}
                                        />
                                    </div>
                                ) : <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 40 }}>No hay ventas en este rango.</p>}
                            </div>

                            {/* Nueva Pie Chart - Costo vs Ganancia */}
                            <div className="card" style={{ padding: 20 }}>
                                <h3 style={{ margin: "0 0 16px", fontWeight: 700, fontSize: "1rem" }}>Costo vs Ganancia Total</h3>
                                {totalVendido > 0 ? (
                                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 250 }}>
                                        <DonutChart
                                            variant="pie"
                                            data={globalCostProfit}
                                            category="value"
                                            index="name"
                                            valueFormatter={valFormatter}
                                            colors={["palepink", "rose"]}
                                            className="h-60"
                                            showAnimation={false}
                                        />
                                    </div>
                                ) : <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 40 }}>No hay ventas en este rango.</p>}
                            </div>

                            {/* Temporal - Líneas */}
                            <div className="card" style={{ padding: 20 }}>
                                <h3 style={{ margin: "0 0 16px", fontWeight: 700, fontSize: "1rem" }}>Evolución de Ventas </h3>
                                {chartDataLine.length > 0 ? (
                                    <LineChart
                                        className="h-60 mt-4"
                                        data={chartDataLine}
                                        index="date"
                                        categories={["Ventas"]}
                                        colors={["lila"]}
                                        valueFormatter={valFormatter}
                                        yAxisWidth={60}
                                        showAnimation={false}
                                    />
                                ) : <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 40 }}>No hay ventas en este rango.</p>}
                            </div>

                            {/* Barras Apiladas - Costo vs Ganancia */}
                            <div className="card" style={{ padding: 20, gridColumn: "1/-1" }}>
                                <h3 style={{ margin: "0 0 16px", fontWeight: 700, fontSize: "1rem" }}>Contribución Marginal por Producto</h3>
                                {chartDataBar.length > 0 ? (
                                    <div style={{ width: "100%", overflowX: "hidden" }}>
                                        <BarChart
                                            className="h-72 mt-4"
                                            data={chartDataBar}
                                            index="name"
                                            categories={["Costo Lotes", "Ganancia Bruta"]}
                                            colors={["palepink", "pink"]}
                                            valueFormatter={valFormatter}
                                            stack={true}
                                            yAxisWidth={60}
                                            showAnimation={false}
                                        />
                                    </div>
                                ) : <p style={{ textAlign: "center", color: "var(--text-muted)" }}>No hay datos suficientes.</p>}
                            </div>

                        </div>
                    )}
                </div>

                {/* ── Tabla del Historial de Ventas (fuera del PDF) ── */}
                <div style={{ marginTop: 32 }}>
                    <div className="card fade-up" style={{ overflow: "hidden" }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid #fce4ec", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Historial Completo de Ventas</h2>
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
                                    {ventasFiltradas.map(v => (
                                        <tr key={v.id} style={{ borderBottom: "1px solid #fdf6f9" }} className="hover:bg-pink-50/30">
                                            <td style={{ padding: "12px 16px", fontWeight: 600 }}>#{v.id}</td>
                                            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{new Date(v.fecha).toLocaleDateString()}</td>
                                            <td style={{ padding: "12px 16px" }}>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                    <Pill color="gray">{v.cantidad}x {v.producto}</Pill>
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--pink-dark)" }}>
                                                {editando === v.id ? (
                                                    <input type="number" step="0.01" value={editVal.total_venta}
                                                        onChange={e => setEditVal(p => ({ ...p, total_venta: +e.target.value }))}
                                                        className="input-pink" style={{ width: 80, padding: 4 }} />
                                                ) : `$${v.total_venta.toFixed(2)}`}
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                {editando === v.id ? (
                                                    <input type="number" step="0.01" value={editVal.ganancia_bruta}
                                                        onChange={e => setEditVal(p => ({ ...p, ganancia_bruta: +e.target.value }))}
                                                        className="input-pink" style={{ width: 80, padding: 4 }} />
                                                ) : <Pill color="green">${v.ganancia_bruta.toFixed(2)}</Pill>}
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={guardarEdicion} style={{ color: "#2e7d32", background: "none", border: "none", fontWeight: 800, cursor: "pointer" }}>💾</button>
                                                        <button onClick={() => setEditando(null)} style={{ color: "#b71c1c", background: "none", border: "none", fontWeight: 800, cursor: "pointer" }}>✕</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: "flex", gap: 12 }}>
                                                        <button onClick={() => { setEditando(v.id); setEditVal({ total_venta: v.total_venta, ganancia_bruta: v.ganancia_bruta }) }}
                                                            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>✏️</button>
                                                        <button onClick={() => eliminarVenta(v.id)}
                                                            style={{ color: "#ffcdd2", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>🗑️</button>
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
