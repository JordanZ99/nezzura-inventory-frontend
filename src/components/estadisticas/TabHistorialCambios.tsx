// ==============================================================================
// src/components/estadisticas/TabHistorialCambios.tsx
// Tab "Historial de cambios" del panel estadístico (ledger de inventario,
// migración 040): cada entrada/salida/ajuste de stock queda registrada de
// forma INMUTABLE con su origen (venta, restock, ajuste manual, edición de
// venta, anulación, baja de lote) y el stock que quedó en el lote.
// Lectura pura: el ledger no admite edición ni borrado (append-only en BDD).
// ==============================================================================

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import { api } from "@/lib/api"
import type { MovimientoInventario, OrigenMovimiento, TipoMovimiento } from "@/types"
import { useTenant } from "@/contexts/TenantContext"

const ELEMENTOS_POR_PAGINA = 50

const ETIQUETAS_ORIGEN: Record<OrigenMovimiento, string> = {
    venta: "Venta",
    restock: "Restock / alta",
    ajuste_manual: "Ajuste manual",
    edicion_venta: "Edición de venta",
    anulacion: "Anulación",
    baja_lote: "Baja de lote",
}

const COLOR_TIPO: Record<TipoMovimiento, string> = {
    entrada: "var(--success-text)",
    salida: "#b71c1c",
    ajuste: "#b45309",
}

const fmtCantidad = (n: number) => {
    const limpio = Math.round(Number(n) * 1000) / 1000
    return `${limpio > 0 ? "+" : ""}${new Intl.NumberFormat("us").format(limpio)}`
}

const fmtStock = (n: number | null) =>
    n === null || n === undefined
        ? "—"
        : new Intl.NumberFormat("us").format(Math.round(Number(n) * 1000) / 1000)

const fmtFechaHora = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", {
        day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
    })

export default function TabHistorialCambios() {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id

    // ── Filtros (búsqueda con debounce, como en Clientes) ──
    const [busqueda, setBusqueda] = useState("")
    const [busquedaDebounced, setBusquedaDebounced] = useState("")
    const [tipoFiltro, setTipoFiltro] = useState<"" | TipoMovimiento>("")
    const [pagina, setPagina] = useState(1)
    useEffect(() => {
        const t = setTimeout(() => setBusquedaDebounced(busqueda), 350)
        return () => clearTimeout(t)
    }, [busqueda])
    // Al cambiar un filtro, volver a la primera página
    useEffect(() => { setPagina(1) }, [busquedaDebounced, tipoFiltro])

    const movimientosQuery = useQuery({
        queryKey: ["movimientos-inventario", tenantId, pagina, tipoFiltro, busquedaDebounced],
        queryFn: () =>
            api.getMovimientos({
                limit: ELEMENTOS_POR_PAGINA,
                offset: (pagina - 1) * ELEMENTOS_POR_PAGINA,
                tipo: tipoFiltro || undefined,
                producto: busquedaDebounced || undefined,
            }),
        enabled: Boolean(tenantId),
    })

    const movimientos: MovimientoInventario[] = movimientosQuery.data?.movimientos ?? []
    const total = movimientosQuery.data?.total ?? 0
    const totalPaginas = Math.max(1, Math.ceil(total / ELEMENTOS_POR_PAGINA))

    return (
        <div>
            {/* ── Encabezado + filtros ── */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="History" size={16} color="var(--primary-alter)" />
                        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>Historial de cambios de inventario</h3>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select
                            value={tipoFiltro}
                            onChange={e => setTipoFiltro(e.target.value as "" | TipoMovimiento)}
                            style={{
                                padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                background: "var(--bg-card2)", color: "var(--text-main)", fontSize: "0.8rem",
                                fontWeight: 600, outline: "none", cursor: "pointer",
                            }}
                        >
                            <option value="">Todos los movimientos</option>
                            <option value="entrada">Entradas</option>
                            <option value="salida">Salidas</option>
                            <option value="ajuste">Ajustes</option>
                        </select>
                        <input
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar producto…"
                            style={{
                                padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                background: "var(--bg-card2)", color: "var(--text-main)", fontSize: "0.8rem",
                                fontWeight: 600, outline: "none", minWidth: 180,
                            }}
                        />
                    </div>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Registro inmutable de cada cambio de stock: qué entró, qué salió y por qué. Útil para reconciliar
                    conteos físicos (ej. ventas de un evento que no se registraron a tiempo).
                </p>
            </div>

            {/* ── Tabla del ledger ── */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 720 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-card2)" }}>
                                {["Fecha", "Producto", "Movimiento", "Cantidad", "Stock en lote", "Detalle"].map(h => (
                                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "0.68rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {movimientosQuery.isPending && (
                                <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Cargando historial…</td></tr>
                            )}
                            {!movimientosQuery.isPending && movimientos.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                                        {busquedaDebounced || tipoFiltro
                                            ? "Sin movimientos que coincidan con el filtro."
                                            : "Aún no hay movimientos: aparecerán al vender, restockear o ajustar inventario."}
                                    </td>
                                </tr>
                            )}
                            {movimientos.map(m => (
                                <tr key={m.id} style={{ borderTop: "1px solid var(--border-primary)" }}>
                                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtFechaHora(m.fecha)}</td>
                                    <td style={{ padding: "10px 14px", fontWeight: 800 }}>
                                        {m.producto}
                                        {m.variacion && <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> · {m.variacion}</span>}
                                    </td>
                                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                        <span style={{ fontWeight: 800, color: COLOR_TIPO[m.tipo] }}>
                                            {m.tipo === "entrada" ? "Entrada" : m.tipo === "salida" ? "Salida" : "Ajuste"}
                                        </span>
                                        <span style={{ color: "var(--text-muted)", fontWeight: 600, marginLeft: 8 }}>
                                            · {ETIQUETAS_ORIGEN[m.origen] ?? m.origen}
                                        </span>
                                    </td>
                                    <td style={{ padding: "10px 14px", fontWeight: 800, color: COLOR_TIPO[m.tipo], whiteSpace: "nowrap" }}>
                                        {fmtCantidad(Number(m.cantidad))}
                                    </td>
                                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{fmtStock(m.stock_resultante === null ? null : Number(m.stock_resultante))}</td>
                                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600 }}>
                                        {m.concepto || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Paginación ── */}
                {total > ELEMENTOS_POR_PAGINA && (
                    <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Mostrando {Math.min((pagina - 1) * ELEMENTOS_POR_PAGINA + movimientos.length, total)} de {total} movimientos
                        </span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button
                                onClick={() => setPagina(p => Math.max(1, p - 1))}
                                disabled={pagina <= 1}
                                style={{
                                    padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-primary)",
                                    background: pagina <= 1 ? "var(--bg-card2)" : "var(--bg-card)",
                                    color: pagina <= 1 ? "var(--text-muted)" : "var(--text-main)",
                                    cursor: pagina <= 1 ? "not-allowed" : "pointer",
                                    fontWeight: 600, fontSize: "0.8rem", opacity: pagina <= 1 ? 0.5 : 1,
                                }}
                            >
                                ← Anterior
                            </button>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700 }}>Página {pagina} de {totalPaginas}</span>
                            <button
                                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                                disabled={pagina >= totalPaginas}
                                style={{
                                    padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-primary)",
                                    background: pagina >= totalPaginas ? "var(--bg-card2)" : "var(--bg-card)",
                                    color: pagina >= totalPaginas ? "var(--text-muted)" : "var(--text-main)",
                                    cursor: pagina >= totalPaginas ? "not-allowed" : "pointer",
                                    fontWeight: 600, fontSize: "0.8rem", opacity: pagina >= totalPaginas ? 0.5 : 1,
                                }}
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
