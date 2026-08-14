import { useEffect, useState } from "react"
import Icon from "@/components/ui/Icon"
import type { MaterialReceta } from "@/lib/api"

/**
 * Fila editable de un material de la receta: nombre (fijo) + cantidad editable
 * (permite fracciones: 0.5, 150, 0.25...) con botones Guardar y Eliminar.
 */
export default function MaterialRecetaRow({ material, disabled, onGuardar, onEliminar }: {
    material: MaterialReceta
    disabled: boolean
    onGuardar: (cantidad: number) => void
    onEliminar: () => void
}) {
    const [cantidad, setCantidad] = useState(material.cantidad.toString())

    // Al cambiar de producto (o recargar), sincronizar con el material recibido
    useEffect(() => {
        setCantidad(material.cantidad.toString())
    }, [material])

    return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 120, fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>
                {material.material}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                    className="input-primary"
                    style={{ width: 90 }}
                    type="number" min="0" step="any"
                    value={cantidad}
                    placeholder="1"
                    onChange={e => setCantidad(e.target.value)}
                />
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>por unidad</span>
            </div>
            <button
                className="btn-primary"
                disabled={disabled}
                onClick={() => onGuardar(Number(cantidad === "" ? 0 : cantidad))}
                title="Guardar cantidad"
            >
                <Icon name="Check" size={14} />
            </button>
            <button
                onClick={onEliminar}
                disabled={disabled}
                title="Quitar material"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", fontSize: "1rem", padding: 6 }}
            >
                <Icon name="Trash" size={16} />
            </button>
        </div>
    )
}
