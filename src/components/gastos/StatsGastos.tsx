// ==============================================================================
// src/components/gastos/StatsGastos.tsx
// Las 3 cards de stats: Total Pagado, Pagados y Pendientes (clickeable = filtro
// con "✕ Quitar filtro"). En mobile el grid es 1fr 1fr y Pendientes ocupa todo
// el ancho (gridColumn 1 / -1).
// ==============================================================================

import type { Gasto } from "@/lib/api"
import Icon from "@/components/ui/Icon"

interface Props {
    esMobile: boolean
    totalPagado: number
    numPagados: number
    pendientes: Gasto[]
    totalPendiente: number
    filtroPendientes: boolean
    onToggleFiltro: () => void
}

export default function StatsGastos({ esMobile, totalPagado, numPagados, pendientes, totalPendiente, filtroPendientes, onToggleFiltro }: Props) {
    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: esMobile ? "1fr 1fr" : "1fr 1fr 1fr",
            gap: 12,
            marginBottom: 20
        }}>
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
            {/* Pendientes: en mobile ocupa todo el ancho debajo */}
            <div
                className="card fade-up"
                onClick={onToggleFiltro}
                style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    gridColumn: esMobile ? "1 / -1" : undefined,
                    border: filtroPendientes ? "2px solid var(--primary-dark)" : "2px solid transparent",
                    transition: "all 0.2s",
                    background: filtroPendientes ? "var(--bg-warning)" : undefined
                }}
            >
                <Icon name="Clock" size={32} color="var(--primary-dark)" />
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                        Pendientes {filtroPendientes ? "(filtrado)" : ""}
                    </p>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-dark)" }}>
                        {pendientes.length > 0 ? `${pendientes.length} ($${totalPendiente.toFixed(0)})` : "0"}
                    </p>
                </div>
                {filtroPendientes && (
                    <span style={{
                        fontSize: "0.65rem", fontWeight: 700, color: "var(--primary-dark)",
                        background: "rgba(0,0,0,0.08)", borderRadius: 8,
                        padding: "4px 8px", whiteSpace: "nowrap"
                    }}>
                        ✕ Quitar filtro
                    </span>
                )}
            </div>
        </div>
    )
}
