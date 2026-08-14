// ==============================================================================
// src/components/estadisticas/TablaHistorialVentas.tsx
// Card del historial completo de ventas: título + contador, buscador por
// producto + selector de orden, tabla con filas editables (FilaVenta) y
// paginación (PaginacionTabla).
// ==============================================================================

import type { Dispatch, SetStateAction } from "react"
import type { Venta } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import FilaVenta from "./FilaVenta"
import PaginacionTabla from "./PaginacionTabla"
import type { EditVenta } from "@/hooks/useEstadisticasUI"

interface Props {
    ventasFiltradas: Venta[]
    ventasPaginadas: Venta[]
    busquedaVentas: string
    setBusquedaVentas: Dispatch<SetStateAction<string>>
    ordenVentas: string
    setOrdenVentas: Dispatch<SetStateAction<string>>
    paginaActual: number
    setPaginaActual: Dispatch<SetStateAction<number>>
    totalPaginas: number
    isMobile: boolean
    ITEMS_POR_PAGINA: number
    getPaginationRange: (current: number, total: number, mobile: boolean) => (number | "ellipsis")[]
    editando: number | null
    setEditando: Dispatch<SetStateAction<number | null>>
    editVal: EditVenta
    setEditVal: Dispatch<SetStateAction<EditVenta>>
    guardando: boolean
    guardarEdicion: () => void
    setConfirmAnularVentaId: Dispatch<SetStateAction<number | null>>
}

export default function TablaHistorialVentas({
    ventasFiltradas,
    ventasPaginadas,
    busquedaVentas,
    setBusquedaVentas,
    ordenVentas,
    setOrdenVentas,
    paginaActual,
    setPaginaActual,
    totalPaginas,
    isMobile,
    ITEMS_POR_PAGINA,
    getPaginationRange,
    editando,
    setEditando,
    editVal,
    setEditVal,
    guardando,
    guardarEdicion,
    setConfirmAnularVentaId,
}: Props) {
    return (
        <div className="card fade-up" style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Historial Completo de Ventas</h2>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{ventasFiltradas.length} venta(s)</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card2)", borderRadius: 10, padding: "0 12px", border: "1px solid var(--border-primary)" }}>
                        <Icon name="Search" size={16} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Buscar por producto..."
                            value={busquedaVentas}
                            onChange={e => setBusquedaVentas(e.target.value)}
                            style={{
                                flex: 1,
                                border: "none",
                                background: "transparent",
                                padding: "8px 0",
                                fontSize: "0.82rem",
                                outline: "none",
                                color: "var(--text-main)"
                            }}
                        />
                        {busquedaVentas && (
                            <button onClick={() => setBusquedaVentas("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }}>
                                <Icon name="X" size={14} />
                            </button>
                        )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="ArrowUpDown" size={16} color="var(--text-muted)" />
                        <select
                            value={ordenVentas}
                            onChange={e => setOrdenVentas(e.target.value)}
                            style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: "1px solid var(--border-primary)",
                                background: "var(--bg-card2)",
                                color: "var(--text-main)",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                outline: "none",
                                cursor: "pointer"
                            }}
                        >
                            <option value="fecha-desc">Mas recientes</option>
                            <option value="fecha-asc">Mas antiguos</option>
                            <option value="monto-desc">Mayor monto</option>
                            <option value="monto-asc">Menor monto</option>
                            <option value="producto">A-Z producto</option>
                            <option value="ganancia-desc">Mayor ganancia</option>
                        </select>
                    </div>
                </div>
            </div>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-card2)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                            {["ID", "Fecha", "Productos", "Costo Total", "Precio Total", "Ganancia", "Estado"].map(h => (
                                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ventasPaginadas.map(v => (
                            <FilaVenta
                                key={v.n_ticket}
                                v={v}
                                editando={editando}
                                setEditando={setEditando}
                                editVal={editVal}
                                setEditVal={setEditVal}
                                guardando={guardando}
                                guardarEdicion={guardarEdicion}
                                setConfirmAnularVentaId={setConfirmAnularVentaId}
                            />
                        ))}
                        {ventasFiltradas.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No hay ventas registradas en este período.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <PaginacionTabla
                totalVentas={ventasFiltradas.length}
                ITEMS_POR_PAGINA={ITEMS_POR_PAGINA}
                paginaActual={paginaActual}
                setPaginaActual={setPaginaActual}
                totalPaginas={totalPaginas}
                isMobile={isMobile}
                getPaginationRange={getPaginationRange}
            />
        </div>
    )
}
