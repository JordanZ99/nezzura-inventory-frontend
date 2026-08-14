// ==============================================================================
// src/components/estadisticas/KpisReporte.tsx
// Las 4 cards KPI del reporte (Total Vendido, Margen Bruto, Gastos del Periodo
// y Ganancia Neta condicional verde/roja con Pill de margen neto).
// ==============================================================================

import Pill from "@/components/ui/Pill"

interface Props {
    totalVendido: number
    gananciaBruta: number
    totalGastos: number
    gananciaNeta: number
}

export default function KpisReporte({ totalVendido, gananciaBruta, totalGastos, gananciaNeta }: Props) {
    return (
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
    )
}
