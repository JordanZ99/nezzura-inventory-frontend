// ==============================================================================
// src/components/gastos/TablaMovimientos.tsx
// Card "Movimientos": header + tabla con FilaGasto + estado vacío. Recibe las
// acciones de la fila (AccionesFilaGasto) para pasarlas a cada fila.
// ==============================================================================

import type { Gasto } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import FilaGasto from "./FilaGasto"
import type { AccionesFilaGasto } from "./tipos"

interface Props extends AccionesFilaGasto {
    gastosVisibles: Gasto[]
    cargando: boolean
    filtroPendientes: boolean
}

export default function TablaMovimientos({ gastosVisibles, cargando, filtroPendientes, ...fila }: Props) {
    return (
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
                        {gastosVisibles.map(g => (
                            <FilaGasto key={g.id} g={g} {...fila} />
                        ))}
                        {gastosVisibles.length === 0 && !cargando && (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{filtroPendientes ? "No hay gastos pendientes." : "No hay gastos registrados."}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
