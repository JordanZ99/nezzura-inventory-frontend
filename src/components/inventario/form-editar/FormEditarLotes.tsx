import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import Pill from "@/components/ui/Pill"
import ScrollableTable from "@/components/ui/ScrollableTable"
import type { Lote, Variacion } from "@/types"
import type { FormEditLote } from "@/hooks/useInventarioForm"

export interface FormEditarLotesProps {
    prodEditar: string
    tipoProducto: string
    lotes: Lote[]
    editVariaciones: Variacion[]
    guardando: boolean
    loteEditandoId: string | null
    setLoteEditandoId: Dispatch<SetStateAction<string | null>>
    editLoteVal: FormEditLote
    setEditLoteVal: Dispatch<SetStateAction<FormEditLote>>
    loteEliminarConfirm: string | null
    setLoteEliminarConfirm: Dispatch<SetStateAction<string | null>>
    guardarLoteIndividual: () => Promise<void>
    eliminarLoteHandler: (id: string) => Promise<void>
}

export default function FormEditarLotes({
    prodEditar,
    tipoProducto,
    lotes,
    editVariaciones,
    guardando,
    loteEditandoId,
    setLoteEditandoId,
    editLoteVal,
    setEditLoteVal,
    loteEliminarConfirm,
    setLoteEliminarConfirm,
    guardarLoteIndividual,
    eliminarLoteHandler,
}: FormEditarLotesProps) {
    if (tipoProducto === "servicio") {
        return (
            <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                    <Icon name="Package" size={20} color="var(--primary-mid)" /> Servicio sin inventario
                </h2>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                    Este es un servicio: no tiene lotes ni stock. Se vende sin límite y no descuenta inventario.
                </p>
            </div>
        )
    }

    if (tipoProducto === "compuesto") {
        return (
            <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="Layers" size={20} color="var(--primary-mid)" /> Compuesto sin inventario propio
                </h2>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                    Este producto no tiene lotes: al venderlo, el gestor descuenta automáticamente el stock de los materiales definidos en su receta (ver "Materiales" arriba).
                </p>
            </div>
        )
    }

    const lotesDelProducto = lotes.filter((l) => l.producto === prodEditar)
    const esUltimoLote = lotesDelProducto.length <= 1

    return (
        <>
            <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
                <h2
                    style={{
                        margin: "0 0 4px",
                        fontSize: "1rem",
                        fontWeight: 800,
                        color: "var(--text-main)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <Icon name="Package" size={20} color="var(--primary-mid)" />
                    Lotes de {prodEditar}
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "auto" }}>
                        {lotesDelProducto.length} lote(s)
                    </span>
                </h2>
                <ScrollableTable>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                        <thead>
                            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                                {["ID", "Variación", "Etiqueta", "Costo unit.", "Precio venta", "Stock", "Margen", ""].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: "8px 12px",
                                            textAlign: "left",
                                            fontWeight: 600,
                                            fontSize: "0.72rem",
                                            textTransform: "uppercase",
                                            letterSpacing: 0.5,
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {lotesDelProducto.map((lote) => {
                                const editando = loteEditandoId === lote.id_lote
                                const margen =
                                    lote.precio_venta > 0
                                        ? ((lote.precio_venta - lote.costo) / lote.precio_venta) * 100
                                        : 0
                                return (
                                    <tr
                                        key={lote.id_lote}
                                        style={{ borderBottom: "1px solid var(--border-light)" }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card2)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                                    >
                                        <td style={{ padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                            #{lote.id_lote}
                                        </td>
                                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                                            {editando ? (
                                                <select
                                                    className="input-primary"
                                                    style={{ width: 130, padding: 4 }}
                                                    value={editLoteVal.variacion}
                                                    onChange={(e) => setEditLoteVal((l) => ({ ...l, variacion: e.target.value }))}
                                                    title="Asigna a qué variación pertenece este lote ('' = stock base)"
                                                >
                                                    <option value="">Base (sin variación)</option>
                                                    {editVariaciones.map((v) => (
                                                        <option key={v.id} value={v.nombre}>
                                                            {v.nombre}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : lote.variacion ? (
                                                <span style={{ fontWeight: 700, color: "var(--primary-dark)" }}>
                                                    {lote.variacion}
                                                </span>
                                            ) : (
                                                <span style={{ color: "var(--text-muted)" }}>Base</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            {editando ? (
                                                <input
                                                    type="text"
                                                    value={editLoteVal.etiqueta}
                                                    placeholder="20cm, Premium..."
                                                    onChange={(e) => setEditLoteVal((l) => ({ ...l, etiqueta: e.target.value }))}
                                                    className="input-primary"
                                                    style={{ width: 110, padding: 4 }}
                                                />
                                            ) : (
                                                lote.etiqueta || "—"
                                            )}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            {editando ? (
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={editLoteVal.costo}
                                                    placeholder="0.00"
                                                    onChange={(e) =>
                                                        setEditLoteVal((l) => ({
                                                            ...l,
                                                            costo: e.target.value === "" ? "" : Number(e.target.value),
                                                        }))
                                                    }
                                                    className="input-primary"
                                                    style={{ width: 80, padding: 4 }}
                                                />
                                            ) : (
                                                `$${lote.costo.toFixed(2)}`
                                            )}
                                        </td>
                                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-main)" }}>
                                            {editando ? (
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={editLoteVal.precio_venta}
                                                    placeholder="0.00"
                                                    onChange={(e) =>
                                                        setEditLoteVal((l) => ({
                                                            ...l,
                                                            precio_venta:
                                                                e.target.value === "" ? "" : Number(e.target.value),
                                                        }))
                                                    }
                                                    className="input-primary"
                                                    style={{ width: 80, padding: 4 }}
                                                />
                                            ) : (
                                                `$${lote.precio_venta.toFixed(2)}`
                                            )}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            {editando ? (
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.1"
                                                    value={editLoteVal.stock}
                                                    placeholder="0"
                                                    onChange={(e) =>
                                                        setEditLoteVal((l) => ({
                                                            ...l,
                                                            stock: e.target.value === "" ? "" : Number(e.target.value),
                                                        }))
                                                    }
                                                    className="input-primary"
                                                    style={{ width: 80, padding: 4 }}
                                                />
                                            ) : (
                                                lote.stock_lote
                                            )}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            <Pill color={margen > 0 ? "green" : "red"}>
                                                {lote.precio_venta > 0 ? `${margen.toFixed(0)}%` : "—"}
                                            </Pill>
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            {editando ? (
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button
                                                        onClick={guardarLoteIndividual}
                                                        disabled={guardando}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            fontWeight: 800,
                                                            cursor: guardando ? "not-allowed" : "pointer",
                                                            padding: 4,
                                                        }}
                                                    >
                                                        {guardando ? (
                                                            <Icon name="Hourglass" size={16} color="var(--primary-dark)" />
                                                        ) : (
                                                            <Icon name="Save" size={16} color="var(--primary-dark)" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setLoteEditandoId(null)
                                                            setLoteEliminarConfirm(null)
                                                        }}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            cursor: "pointer",
                                                            padding: 4,
                                                            color: "var(--text-muted)",
                                                        }}
                                                    >
                                                        <Icon name="X" size={16} color="var(--text-muted)" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                    <button
                                                        onClick={() => {
                                                            setLoteEditandoId(lote.id_lote)
                                                            setEditLoteVal({
                                                                costo: lote.costo,
                                                                precio_venta: lote.precio_venta,
                                                                stock: lote.stock_lote,
                                                                etiqueta: lote.etiqueta || "",
                                                                variacion: lote.variacion || "",
                                                            })
                                                        }}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            color: "var(--primary-mid)",
                                                            fontWeight: 700,
                                                            fontSize: "0.78rem",
                                                            cursor: "pointer",
                                                            padding: 4,
                                                        }}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => setLoteEliminarConfirm(lote.id_lote)}
                                                        title={`Dar de baja lote #${lote.id_lote}`}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            color: "#ad4955ff",
                                                            fontWeight: 700,
                                                            fontSize: "0.78rem",
                                                            cursor: "pointer",
                                                            padding: 4,
                                                        }}
                                                    >
                                                        <Icon name="Trash2" size={14} color="#ad4955ff" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {lotesDelProducto.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        style={{
                                            textAlign: "center",
                                            padding: "24px 12px",
                                            color: "var(--text-muted)",
                                            fontSize: "0.8rem",
                                        }}
                                    >
                                        No hay lotes registrados para este producto.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </ScrollableTable>
            </div>

            {/* Modal de confirmación para dar de baja un lote */}
            {loteEliminarConfirm && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(4px)",
                        padding: 24,
                    }}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: 440,
                            width: "100%",
                            padding: 28,
                            gap: 20,
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                            border: "1px solid var(--border-light)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    background: "#ffeef0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <Icon name="TriangleAlert" size={24} color="#ad4955ff" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                    Dar de baja lote
                                </h3>
                                <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    #{loteEliminarConfirm}
                                </p>
                            </div>
                        </div>

                        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                            ¿Estás seguro de que quieres dar de baja este lote? Esta acción marcará el lote como inactivo y pondrá
                            su stock en 0.
                        </p>

                        {esUltimoLote && (
                            <div
                                style={{
                                    padding: "12px 16px",
                                    borderRadius: 10,
                                    background: "#fff4e5",
                                    border: "1px solid #ffd699",
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "flex-start",
                                }}
                            >
                                <div style={{ flexShrink: 0, marginTop: 2 }}>
                                    <Icon name="TriangleAlert" size={20} color="#cc7a00" />
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#8a5e00" }}>
                                        Último lote activo
                                    </p>
                                    <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#8a5e00", fontWeight: 500 }}>
                                        Este es el único lote activo de <strong>{prodEditar}</strong>. Al dar de baja este lote, el
                                        producto también será desactivado automáticamente.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                            <button
                                onClick={() => setLoteEliminarConfirm(null)}
                                disabled={guardando}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: 10,
                                    border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)",
                                    color: "var(--text-main)",
                                    fontWeight: 700,
                                    fontSize: "0.82rem",
                                    cursor: guardando ? "not-allowed" : "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => eliminarLoteHandler(loteEliminarConfirm)}
                                disabled={guardando}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: 10,
                                    border: "none",
                                    background: guardando ? "#ccc" : "#ad4955ff",
                                    color: guardando ? "#999" : "#fff",
                                    fontWeight: 700,
                                    fontSize: "0.82rem",
                                    cursor: guardando ? "not-allowed" : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    transition: "all 0.15s",
                                }}
                            >
                                {guardando ? (
                                    <>
                                        <Icon name="Hourglass" size={16} color="#999" /> Procesando...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="Trash2" size={16} color="#fff" /> Sí, dar de baja
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
