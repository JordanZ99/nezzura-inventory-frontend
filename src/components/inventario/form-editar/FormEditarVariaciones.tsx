import type { Dispatch, SetStateAction } from "react"
import Icon from "@/components/ui/Icon"
import type { Variacion } from "@/types"
import VariacionRow from "../VariacionRow"

export interface FormEditarVariacionesProps {
    tipoProducto: string
    editVariaciones: Variacion[]
    guardando: boolean
    guardandoVar: boolean
    registrarCambioVariacion: (id: number, nombre: string, precio: number) => void
    eliminarVariacionItem: (id: number) => Promise<void>
    solicitarFotoVariacion: (v: Variacion, file: File) => void
    quitarFotoVariacionItem: (v: Variacion) => Promise<void>
    ajustarStockVariacion: (v: Variacion) => void
    nuevaVarNombre: string
    setNuevaVarNombre: Dispatch<SetStateAction<string>>
    nuevaVarPrecio: number | string
    setNuevaVarPrecio: Dispatch<SetStateAction<number | string>>
    nuevaVarStock: string
    setNuevaVarStock: Dispatch<SetStateAction<string>>
    agregarVariacion: () => Promise<void>
}

export default function FormEditarVariaciones({
    tipoProducto,
    editVariaciones,
    guardando,
    guardandoVar,
    registrarCambioVariacion,
    eliminarVariacionItem,
    solicitarFotoVariacion,
    quitarFotoVariacionItem,
    ajustarStockVariacion,
    nuevaVarNombre,
    setNuevaVarNombre,
    nuevaVarPrecio,
    setNuevaVarPrecio,
    nuevaVarStock,
    setNuevaVarStock,
    agregarVariacion,
}: FormEditarVariacionesProps) {
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
                <Icon name="Layers" size={20} color="var(--primary-mid)" />
                Variaciones
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                Presentaciones con su propio precio para este producto (ej. Sencilla $60 / Doble $95, talla S/M/L, Corte Caballero/Dama).
                Aparecen como selector en el POS, en el catálogo ("desde $X") y se registran en cada venta.
            </p>

            {editVariaciones.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {editVariaciones.map((v) => (
                        <VariacionRow
                            key={v.id}
                            variacion={v}
                            disabled={guardando || guardandoVar}
                            stockVisible={tipoProducto === "stock"}
                            onCambiar={registrarCambioVariacion}
                            onEliminar={() => eliminarVariacionItem(v.id)}
                            onCambiarFoto={(file) => solicitarFotoVariacion(v, file)}
                            onQuitarFoto={() => quitarFotoVariacionItem(v)}
                            onAjustarStock={ajustarStockVariacion}
                        />
                    ))}
                </div>
            )}
            {editVariaciones.length === 0 && (
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                    Sin variaciones todavía. Este producto se vende con un solo precio.
                </p>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 4 }}>
                    <label
                        style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                        }}
                    >
                        Nombre
                    </label>
                    <input
                        className="input-primary"
                        placeholder="Ej: Doble, S, Premium"
                        value={nuevaVarNombre}
                        onChange={(e) => setNuevaVarNombre(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") agregarVariacion()
                        }}
                    />
                </div>

                {tipoProducto === "stock" && (
                    <div style={{ width: 100, display: "flex", flexDirection: "column", gap: 4 }}>
                        <label
                            style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                color: "var(--text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: 0.8,
                            }}
                        >
                            Cant. inicial
                        </label>
                        <input
                            className="input-primary"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="1"
                            title="Stock inicial de la variación: crea su lote (0 = agotada desde el inicio)"
                            value={nuevaVarStock}
                            onChange={(e) => setNuevaVarStock(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") agregarVariacion()
                            }}
                        />
                    </div>
                )}

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
                        Precio $
                    </label>
                    <input
                        className="input-primary"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={nuevaVarPrecio}
                        onChange={(e) => setNuevaVarPrecio(e.target.value === "" ? "" : Number(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") agregarVariacion()
                        }}
                    />
                </div>
                <button
                    className="btn-primary"
                    onClick={agregarVariacion}
                    disabled={guardandoVar}
                    style={{ whiteSpace: "nowrap" }}
                >
                    {guardandoVar ? "Guardando..." : "Agregar variación"}
                </button>
            </div>
            {tipoProducto === "stock" && (
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
                    La cantidad inicial crea el lote propio de la variación; pon <strong>0</strong> si la quieres agotada desde el inicio.
                </p>
            )}
        </div>
    )
}
