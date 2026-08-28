// ==============================================================================
// src/components/estadisticas/TablaHistorialVentas.tsx
// Card del historial de ventas AGRUPADO POR TICKET (orden): cada fila es un
// cobro con su folio, total y ganancia; se expande para ver/editar/anular sus
// renglones (FilaVenta). Incluye buscador (producto o folio), selector de
// orden y paginación.
// ==============================================================================

import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { Orden } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import Pill from "@/components/ui/Pill"
import FilaVenta from "./FilaVenta"
import PaginacionTabla from "./PaginacionTabla"
import type { EditVenta } from "@/hooks/useEstadisticasUI"

interface Props {
    ordenesFiltradas: Orden[]
    ordenesPaginadas: Orden[]
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
    ordenEditando: string | null
    setOrdenEditando: Dispatch<SetStateAction<string | null>>
    ordenFecha: string
    setOrdenFecha: Dispatch<SetStateAction<string>>
    iniciarEdicionOrden: (o: Orden) => void
    guardarEdicionOrden: () => void
    setConfirmAnularOrdenId: Dispatch<SetStateAction<string | null>>
}

/** Resume los renglones de una orden en pills "2x Producto" (máx 3 + "+N"). */
function resumenProductos(orden: Orden) {
    const porProducto = new Map<string, number>()
    for (const v of orden.ventas || []) {
        if (v.estado === "Inactivo") continue
        porProducto.set(v.producto, (porProducto.get(v.producto) || 0) + (v.cantidad || 0))
    }
    const items = [...porProducto.entries()].map(([producto, cantidad]) => ({
        producto,
        cantidad,
        label: `${cantidad % 1 === 0 ? cantidad : cantidad.toFixed(3)}x ${producto}`,
    }))
    return { visibles: items.slice(0, 3), ocultos: Math.max(0, items.length - 3) }
}

export default function TablaHistorialVentas({
    ordenesFiltradas,
    ordenesPaginadas,
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
    ordenEditando,
    setOrdenEditando,
    ordenFecha,
    setOrdenFecha,
    iniciarEdicionOrden,
    guardarEdicionOrden,
    setConfirmAnularOrdenId,
}: Props) {
    const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null)

    return (
        <div className="card fade-up" style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Historial de Tickets</h2>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{ordenesFiltradas.length} ticket(s)</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card2)", borderRadius: 10, padding: "0 12px", border: "1px solid var(--border-primary)" }}>
                        <Icon name="Search" size={16} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Buscar por producto o folio..."
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
                            <option value="ganancia-desc">Mayor ganancia</option>
                        </select>
                    </div>
                </div>
            </div>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-card2)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                            {["Ticket", "Fecha", "Productos", "Total", "Ganancia", "Estado", ""].map(h => (
                                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ordenesPaginadas.map(o => {
                            const anulada = o.estado === "Anulada"
                            const abierta = ordenAbierta === o.id
                            const { visibles, ocultos } = resumenProductos(o)
                            return (
                                <>
                                    <tr
                                        key={o.id}
                                        onClick={() => setOrdenAbierta(abierta ? null : o.id)}
                                        style={{ borderBottom: "1px solid var(--border-light)", cursor: "pointer", opacity: anulada ? 0.6 : 1, background: abierta ? "var(--bg-card2)" : "transparent" }}
                                        className="hover:bg-primary-50/30"
                                    >
                                        <td style={{ padding: "12px 16px", fontWeight: 700 }}>#{o.n_ticket}</td>
                                        <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{new Date(o.fecha).toLocaleDateString()}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                {visibles.map(it => (
                                                    <Pill key={it.producto} color="gray">{it.label}</Pill>
                                                ))}
                                                {ocultos > 0 && <Pill color="gray">+{ocultos} más</Pill>}
                                                {visibles.length === 0 && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Sin renglones activos</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary-dark)" }}>${(o.total || 0).toFixed(2)}</td>
                                        <td style={{ padding: "12px 16px" }}><Pill color="green">${(o.ganancia || 0).toFixed(2)}</Pill></td>
                                        <td style={{ padding: "12px 16px" }}>
                                            {anulada ? <Pill color="red">Anulada</Pill> : <Pill color="green">Activa</Pill>}
                                        </td>
                                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                            <Icon name={abierta ? "ChevronUp" : "ChevronDown"} size={16} color="var(--text-muted)" />
                                        </td>
                                    </tr>
                                    {abierta && (
                                        <tr key={`${o.id}-detalle`}>
                                            <td colSpan={7} style={{ padding: "0 16px 16px", background: "var(--bg-card2)" }}>
                                                {/* Barra de acciones del ticket: editar fecha + anular */}
                                                <div style={{
                                                    display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10,
                                                    padding: "10px 14px", borderRadius: 10,
                                                    border: "1px solid var(--border-primary)",
                                                    background: "var(--bg-card)", marginTop: 4, marginBottom: 8,
                                                }}>
                                                    <Icon name="ReceiptText" size={18} color="var(--primary-alter)" />
                                                    {ordenEditando === o.id ? (
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <input
                                                                type="date"
                                                                value={ordenFecha}
                                                                onChange={e => setOrdenFecha(e.target.value)}
                                                                className="input-primary"
                                                                style={{ width: 150, padding: "6px 8px", fontSize: "0.8rem" }}
                                                            />
                                                            <button onClick={guardarEdicionOrden} disabled={guardando} title="Guardar fecha" style={{ background: "none", border: "none", cursor: guardando ? "not-allowed" : "pointer" }}>
                                                                <Icon name="Save" size={16} color="var(--primary-dark)" />
                                                            </button>
                                                            <button onClick={() => setOrdenEditando(null)} disabled={guardando} title="Cancelar" style={{ background: "none", border: "none", cursor: "pointer" }}>
                                                                <Icon name="X" size={16} color="#b71c1c" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                                                                {new Date(o.fecha).toLocaleDateString()}
                                                            </span>
                                                            {!anulada && (
                                                                <button onClick={() => iniciarEdicionOrden(o)} title="Editar fecha del ticket" style={{ background: "none", border: "none", cursor: "pointer" }}>
                                                                    <Icon name="Pencil" size={15} color="var(--text-muted)" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                                        {(o.cantidad_items || 0)} unidad(es)
                                                    </span>
                                                    {!anulada && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setConfirmAnularOrdenId(o.id) }}
                                                            disabled={guardando}
                                                            style={{
                                                                display: "flex", alignItems: "center", gap: 6,
                                                                padding: "6px 12px", borderRadius: 8, border: "1px solid #f2b8b5",
                                                                background: "#fdecea", color: "#b71c1c",
                                                                fontWeight: 700, fontSize: "0.75rem", cursor: guardando ? "not-allowed" : "pointer",
                                                            }}
                                                        >
                                                            <Icon name="Trash2" size={14} /> Anular ticket
                                                        </button>
                                                    )}
                                                </div>

                                                <div style={{ border: "1px solid var(--border-primary)", borderRadius: 10, overflow: "hidden" }}>
                                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                                                        <thead>
                                                            <tr style={{ color: "var(--text-muted)" }}>
                                                                {["Renglón", "Fecha", "Producto", "Costo", "Precio", "Ganancia", "Acciones"].map(h => (
                                                                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", borderBottom: "1px solid var(--border-primary)" }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(o.ventas || []).map(v => (
                                                                <FilaVenta
                                                                    key={v.id}
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
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )
                        })}
                        {ordenesFiltradas.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No hay tickets registrados en este período.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <PaginacionTabla
                totalVentas={ordenesFiltradas.length}
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
