import { useEffect, useRef, useState } from "react"
import Icon from "@/components/ui/Icon"
import type { Variacion } from "@/lib/api"

/**
 * Fila editable de una variación: nombre + precio propios. Los cambios se
 * registran y se persisten con el botón global "Guardar Cambios" (guardado
 * unificado; ya no hay botón de guardado individual por fila).
 */
export default function VariacionRow({ variacion, disabled, stockVisible = false, onCambiar, onEliminar, onCambiarFoto, onQuitarFoto, onAjustarStock }: {
    variacion: Variacion
    disabled: boolean
    // Fase 6: muestra el stock propio de la variación (solo si el producto
    // maneja stock por variación) y permite ajustarlo desde aquí
    stockVisible?: boolean
    // Registra cambios pendientes de nombre/precio (se guardan con "Guardar Cambios")
    onCambiar: (id: number, nombre: string, precio: number) => void
    onEliminar: () => void
    onCambiarFoto: (file: File) => void
    onQuitarFoto: () => void
    // Abre el restock precargado con esta variación (crea/llena su lote)
    onAjustarStock: (v: Variacion) => void
}) {
    const [nombre, setNombre] = useState(variacion.nombre)
    const [precio, setPrecio] = useState(variacion.precio.toString())
    const inputFotoRef = useRef<HTMLInputElement>(null)

    // Al cambiar de producto (o recargar), sincronizar con la variación recibida
    useEffect(() => {
        setNombre(variacion.nombre)
        setPrecio(variacion.precio.toString())
    }, [variacion])

    const tieneFoto = !!variacion.foto && variacion.foto !== "No hay foto"
    // Cambios locales pendientes de persistir con "Guardar Cambios"
    const pendiente = nombre !== variacion.nombre || Number(precio === "" ? 0 : precio) !== variacion.precio

    return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Foto de la variación: miniatura clicable para subir/reemplazar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                    onClick={() => { if (!disabled) inputFotoRef.current?.click() }}
                    title={tieneFoto ? "Cambiar foto de esta variación" : "Subir foto de esta variación"}
                    style={{
                        width: 44, height: 44, borderRadius: 10, cursor: disabled ? "default" : "pointer",
                        background: "var(--bg-card2)", border: "1px dashed var(--border-color, #d0d5dd)",
                        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                    }}
                >
                    {tieneFoto ? (
                        <img src={variacion.foto} alt={variacion.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                        <Icon name="Image" size={18} color="var(--text-muted)" />
                    )}
                </div>
                {tieneFoto && (
                    <button
                        onClick={onQuitarFoto}
                        disabled={disabled}
                        title="Quitar foto"
                        style={{
                            position: "absolute", top: -6, right: -6,
                            width: 18, height: 18, borderRadius: "50%", border: "none", cursor: disabled ? "default" : "pointer",
                            background: "#e53935", color: "#fff", fontSize: "0.6rem", lineHeight: 1,
                            display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                        }}
                    >
                        ✕
                    </button>
                )}
                <input
                    ref={inputFotoRef}
                    type="file" accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) onCambiarFoto(f)
                        e.target.value = ""
                    }}
                />
            </div>
            <input
                className="input-primary"
                style={{ flex: 1, minWidth: 120 }}
                value={nombre}
                placeholder="Nombre"
                onChange={e => { setNombre(e.target.value); onCambiar(variacion.id, e.target.value, Number(precio === "" ? 0 : precio)) }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>$</span>
                <input
                    className="input-primary"
                    style={{ width: 90 }}
                    type="number" min="0" step="0.01"
                    value={precio}
                    placeholder="0.00"
                    onChange={e => { setPrecio(e.target.value); onCambiar(variacion.id, nombre, Number(e.target.value === "" ? 0 : e.target.value)) }}
                />
            </div>
            {stockVisible && (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAjustarStock(variacion)}
                    title="Agregar stock a esta variación (crea o llena su lote)"
                    style={{
                        display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                        fontSize: "0.68rem", fontWeight: 800,
                        borderRadius: 10, padding: "5px 10px",
                        border: "1.5px dashed var(--border-color, #d0d5dd)",
                        background: "var(--bg-card2)",
                        color: (variacion.stock ?? 0) > 0 ? "#2e7d32" : "#ad4955ff",
                        cursor: disabled ? "default" : "pointer",
                        transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "var(--border-light)" }}
                    onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = "var(--bg-card2)" }}
                >
                    <Icon name="Plus" size={12} />
                    Ajustar stock {(variacion.stock ?? 0) > 0 ? `(${variacion.stock} uds)` : "(Agotado)"}
                </button>
            )}
            <button
                onClick={onEliminar}
                disabled={disabled}
                title="Eliminar variación"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", fontSize: "1rem", padding: 6 }}
            >
                <Icon name="Trash" size={16} />
            </button>
            {/* Indicador de cambios pendientes (se guardan con "Guardar Cambios") */}
            {pendiente && (
                <span
                    title="Cambios sin guardar en esta variación"
                    style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary-mid)", flexShrink: 0 }}
                />
            )}
        </div>
    )
}
