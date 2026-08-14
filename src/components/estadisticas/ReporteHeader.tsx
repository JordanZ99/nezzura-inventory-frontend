// ==============================================================================
// src/components/estadisticas/ReporteHeader.tsx
// Header móvil del reporte (logo + empresa + período). Vive dentro del
// #report-container — target del PDF — así que su estructura no puede cambiar.
// ==============================================================================

import type { DateRangePickerValue } from "@tremor/react"

interface Props {
    logoSrc: string
    empresa: string
    dates: DateRangePickerValue
}

export default function ReporteHeader({ logoSrc, empresa, dates }: Props) {
    return (
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
    )
}
