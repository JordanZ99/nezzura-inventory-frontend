// ==============================================================================
// src/components/estadisticas/GraficasReporte.tsx
// Las 4 gráficas del reporte (Dona Top Ventas, Pie Costo vs Ganancia, Línea
// Evolución de Ventas y Barra apilada Contribución Marginal) con sus estados
// "Sin datos". Recibe los datos ya transformados del hook de cálculos.
// ==============================================================================

import { DonutChart, LineChart, BarChart } from "@tremor/react"

export interface FilaCostoGanancia {
    name: string
    "Costo Lotes": number
    "Ganancia": number
    total: number
}

interface Props {
    cargando: boolean
    totalVendido: number
    top5: { name: string; value: number }[]
    globalCostProfit: { name: string; value: number }[]
    chartDataLine: { date: string; "Ventas": number }[]
    chartDataBar: FilaCostoGanancia[]
    chartColors: string[]
    valFormatter: (number: number) => string
}

export default function GraficasReporte({ cargando, totalVendido, top5, globalCostProfit, chartDataLine, chartDataBar, chartColors, valFormatter }: Props) {
    return (
        <>
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
        </>
    )
}
