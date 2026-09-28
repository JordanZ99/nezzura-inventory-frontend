// ==============================================================================
// src/components/estadisticas/PaginacionTabla.tsx
// Pie de paginación de la tabla de ventas: "Mostrando X de Y" + botones
// Anterior/Siguiente + rango de páginas con truncado inteligente (getPaginationRange).
// Se oculta cuando no hay más de una página.
// ==============================================================================

import type { Dispatch, SetStateAction } from "react"

interface Props {
    totalVentas: number
    ITEMS_POR_PAGINA: number
    paginaActual: number
    setPaginaActual: Dispatch<SetStateAction<number>>
    totalPaginas: number
    isMobile: boolean
    getPaginationRange: (current: number, total: number, mobile: boolean) => (number | "ellipsis")[]
}

export default function PaginacionTabla({ totalVentas, ITEMS_POR_PAGINA, paginaActual, setPaginaActual, totalPaginas, isMobile, getPaginationRange }: Props) {
    if (totalVentas <= ITEMS_POR_PAGINA) return null
    return (
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Mostrando {Math.min(paginaActual * ITEMS_POR_PAGINA, totalVentas)} de {totalVentas} ventas
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual <= 1}
                    style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--border-primary)",
                        background: paginaActual <= 1 ? "var(--bg-card2)" : "var(--bg-card)",
                        color: paginaActual <= 1 ? "var(--text-muted)" : "var(--text-main)",
                        cursor: paginaActual <= 1 ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        transition: "all 0.15s",
                        opacity: paginaActual <= 1 ? 0.5 : 1
                    }}
                    onMouseOver={e => { if (paginaActual > 1) e.currentTarget.style.background = "var(--bg-card2)" }}
                    onMouseOut={e => e.currentTarget.style.background = "var(--bg-card)"}
                >
                    ← Anterior
                </button>
                {getPaginationRange(paginaActual, totalPaginas, isMobile).map((item, idx) =>
                    item === "ellipsis" ? (
                        <span key={`ellipsis-${idx}`} style={{ padding: "0 4px", color: "var(--text-muted)", fontSize: "0.8rem" }}>…</span>
                    ) : (
                        <button
                            key={item}
                            onClick={() => setPaginaActual(item)}
                            style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: item === paginaActual ? "2px solid var(--primary-main)" : "1px solid var(--border-primary)",
                                background: item === paginaActual ? "var(--primary-bg)" : "var(--bg-card)",
                                color: item === paginaActual ? "var(--primary-main)" : "var(--text-main)",
                                cursor: "pointer",
                                fontWeight: item === paginaActual ? 800 : 600,
                                fontSize: "0.8rem",
                                transition: "all 0.15s"
                            }}
                        >
                            {item}
                        </button>
                    )
                )}
                <button
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual >= totalPaginas}
                    style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--border-primary)",
                        background: paginaActual >= totalPaginas ? "var(--bg-card2)" : "var(--bg-card)",
                        color: paginaActual >= totalPaginas ? "var(--text-muted)" : "var(--text-main)",
                        cursor: paginaActual >= totalPaginas ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        transition: "all 0.15s",
                        opacity: paginaActual >= totalPaginas ? 0.5 : 1
                    }}
                    onMouseOver={e => { if (paginaActual < totalPaginas) e.currentTarget.style.background = "var(--bg-card2)" }}
                    onMouseOut={e => e.currentTarget.style.background = "var(--bg-card)"}
                >
                    Siguiente →
                </button>
            </div>
        </div>
    )
}
