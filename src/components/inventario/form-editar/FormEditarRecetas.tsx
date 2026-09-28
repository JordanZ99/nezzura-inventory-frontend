import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import type { MaterialReceta, Producto, Variacion } from "@/types"
import MaterialRecetaRow from "../MaterialRecetaRow"

export interface FormEditarRecetasProps {
    prodEditar: string
    editVariaciones: Variacion[]
    editRecetas: MaterialReceta[]
    matVariacionSel: number | null
    setMatVariacionSel: Dispatch<SetStateAction<number | null>>
    guardandoReceta: boolean
    editarMaterialItem: (id: number, cantidad: number) => Promise<void>
    eliminarMaterialItem: (id: number) => Promise<void>
    matBuscador: string
    setMatBuscador: Dispatch<SetStateAction<string>>
    matSeleccionado: string
    setMatSeleccionado: Dispatch<SetStateAction<string>>
    matCantidad: number | string
    setMatCantidad: Dispatch<SetStateAction<number | string>>
    matSugerencias: Producto[]
    agregarMaterialItem: () => Promise<void>
}

export default function FormEditarRecetas({
    prodEditar,
    editVariaciones,
    editRecetas,
    matVariacionSel,
    setMatVariacionSel,
    guardandoReceta,
    editarMaterialItem,
    eliminarMaterialItem,
    matBuscador,
    setMatBuscador,
    matSeleccionado,
    setMatSeleccionado,
    matCantidad,
    setMatCantidad,
    matSugerencias,
    agregarMaterialItem,
}: FormEditarRecetasProps) {
    const recetasContexto = editRecetas.filter((r) =>
        matVariacionSel === null
            ? r.variacion_id === null || r.variacion_id === undefined
            : r.variacion_id === matVariacionSel
    )

    return (
        <div className="card fade-up" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <h2
                style={{
                    margin: "0 0 2px",
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <Icon name="Boxes" size={20} color="var(--primary-mid)" />
                Materiales (receta)
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                Al vender 1 unidad de <strong>{prodEditar}</strong>, el gestor descuenta la cantidad indicada de cada material. Se
                permiten fracciones (0.5, 150, 0.25...).
            </p>

            {editVariaciones.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                        style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                        }}
                    >
                        Receta para:
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setMatVariacionSel(null)
                            setMatBuscador("")
                            setMatSeleccionado("")
                            setMatCantidad("")
                        }}
                        style={{
                            padding: "6px 14px",
                            borderRadius: 14,
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            transition: "all 0.15s",
                            background: matVariacionSel === null ? "var(--primary-mid)" : "var(--bg-card2)",
                            color: matVariacionSel === null ? "#fff" : "var(--text-main)",
                        }}
                    >
                        Base (todas)
                    </button>
                    {editVariaciones.map((v) => {
                        const activa = matVariacionSel === v.id
                        return (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                    setMatVariacionSel(v.id)
                                    setMatBuscador("")
                                    setMatSeleccionado("")
                                    setMatCantidad("")
                                }}
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: 14,
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    transition: "all 0.15s",
                                    background: activa ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: activa ? "#fff" : "var(--text-main)",
                                }}
                            >
                                {v.nombre}
                            </button>
                        )
                    })}
                </div>
            )}
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>
                {matVariacionSel === null
                    ? "La receta BASE se usa cuando la variación vendida no tiene receta propia."
                    : `La variación '${
                          editVariaciones.find((v) => v.id === matVariacionSel)?.nombre ?? ""
                      }' gastará estos materiales (si vacía, se usa la Base).`}
            </p>

            {recetasContexto.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recetasContexto.map((r) => (
                        <MaterialRecetaRow
                            key={r.id}
                            material={r}
                            disabled={guardandoReceta}
                            onGuardar={(cantidad) => editarMaterialItem(r.id, cantidad)}
                            onEliminar={() => eliminarMaterialItem(r.id)}
                        />
                    ))}
                </div>
            ) : (
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                    {matVariacionSel === null
                        ? "Sin materiales en la receta base. Agrega los productos de stock que este compuesto consume."
                        : "Esta variación no tiene receta propia: usará la Base. Agrega materiales aquí si gasta cantidades distintas."}
                </p>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 4 }}>
                    <label
                        style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                        }}
                    >
                        Material (búscalo)
                    </label>
                    <input
                        className="input-primary"
                        placeholder="Buscar producto de stock..."
                        value={matBuscador}
                        onChange={(e) => setMatBuscador(e.target.value)}
                    />
                    {matSugerencias.length > 0 && matBuscador.trim() && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                            {matSugerencias.map((s) => {
                                const activo = s.producto === matSeleccionado
                                return (
                                    <button
                                        key={s.producto}
                                        type="button"
                                        onClick={() => {
                                            setMatSeleccionado(s.producto)
                                            setMatBuscador(s.producto)
                                        }}
                                        style={{
                                            background: activo ? "var(--primary-mid)" : "var(--bg-card2)",
                                            color: activo ? "#fff" : "var(--text-main)",
                                            border: "none",
                                            borderRadius: 10,
                                            padding: "5px 10px",
                                            fontSize: "0.7rem",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {activo && <Icon name="Check" size={12} />} {s.producto}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {matSeleccionado && (
                        <p
                            style={{
                                fontSize: "0.68rem",
                                color: "var(--primary-dark)",
                                fontWeight: 700,
                                margin: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <Icon name="Check" size={14} /> {matSeleccionado}
                        </p>
                    )}
                </div>
                <div style={{ width: 110, display: "flex", flexDirection: "column", gap: 4 }}>
                    <label
                        style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                        }}
                    >
                        Cantidad
                    </label>
                    <input
                        className="input-primary"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="1"
                        value={matCantidad}
                        onChange={(e) => setMatCantidad(e.target.value === "" ? "" : Number(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") agregarMaterialItem()
                        }}
                    />
                </div>
                <button
                    className="btn-primary"
                    onClick={agregarMaterialItem}
                    disabled={guardandoReceta || !matSeleccionado}
                    style={{ whiteSpace: "nowrap" }}
                >
                    {guardandoReceta ? "Guardando..." : "Agregar material"}
                </button>
            </div>
        </div>
    )
}
