import { useState } from "react"
import Icon from "@/components/ui/Icon"

/**
 * Alta de variaciones (crear producto): lista simple de nombre + precio.
 * Se persisten en la MISMA transacción que el producto (crear_producto_completo).
 */
export default function AltaVariaciones({ lista, tipoStock = false, disabled = false, onAgregar, onQuitar, datosBase }: {
    lista: { nombre: string; precio: number; stock_inicial?: number; costo?: number }[]
    tipoStock?: boolean  // si el producto es tipo 'stock', muestra stock inicial + costo por variación
    disabled?: boolean
    onAgregar: (nombre: string, precio: number, stockInicial?: number, costo?: number) => void
    onQuitar: (i: number) => void
    // Datos del producto base (para el botón "Añadir producto base"): se
    // pre-cargan en los inputs para que el usuario confirme y presione Añadir.
    datosBase?: { nombre: string; precio: number | string; stock: number | string; costo: number | string }
}) {
    const [nombre, setNombre] = useState("")
    const [precio, setPrecio] = useState("")
    // Stock inicial con default 1: cada variación de stock crea su propio lote.
    // El usuario puede poner 0 si la quiere agotada desde el inicio.
    const [stockInicial, setStockInicial] = useState("1")
    const [costo, setCosto] = useState("")
    const puede = nombre.trim() !== "" && precio !== "" && Number(precio) > 0

    const agregar = () => {
        if (!puede) return
        onAgregar(
            nombre.trim(),
            Number(precio),
            stockInicial === "" ? undefined : Number(stockInicial),
            costo === "" ? undefined : Number(costo),
        )
        setNombre(""); setPrecio(""); setStockInicial("1"); setCosto("")
    }

    // "Añadir producto base": solo con tipo stock y cuando ya hay al menos una
    // variación (si no hay variaciones, el producto base ya se vende solo).
    // Pre-carga los datos del producto en los inputs para confirmar y añadir.
    const baseVisible = tipoStock && lista.length > 0
    const basePrecioOk = datosBase !== undefined && datosBase.precio !== "" && Number(datosBase.precio) > 0
    const baseStockOk = datosBase !== undefined && datosBase.stock !== ""
    const baseBloqueada = !basePrecioOk || !baseStockOk
    const cargarBase = () => {
        if (!datosBase || baseBloqueada) return
        setNombre(datosBase.nombre.trim() || "Producto base")
        setPrecio(String(datosBase.precio))
        // Si la cantidad del producto está vacía, el stock de la base arranca en 1.
        setStockInicial(datosBase.stock === "" ? "1" : String(datosBase.stock))
        setCosto(String(datosBase.costo))
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Variaciones
            </label>
            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
                Presentaciones con precio propio (ej. S/M/L, Sencilla/Doble). Se crean junto al producto y aparecen en el catálogo como "desde $X".
            </p>
            {tipoStock && (
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0 }}>
                    Cada variación lleva su <strong>propio lote</strong> (stock, costo y precio). El stock inicial arranca en 1; pon <strong>0</strong> si la quieres agotada desde el inicio.
                </p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                    className="input-primary"
                    style={{ flex: 1, minWidth: 140 }}
                    placeholder="Nombre (ej. Doble)"
                    value={nombre}
                    disabled={disabled}
                    onChange={e => setNombre(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") agregar() }}
                />
                {tipoStock && (
                    <input
                        className="input-primary"
                        style={{ width: 92 }}
                        type="number" min="0" step="0.01"
                        placeholder="Cantidad"
                        title="Stock inicial de esta variación (crea su propio lote)"
                        value={stockInicial}
                        disabled={disabled}
                        onChange={e => setStockInicial(e.target.value)}
                    />
                )}
                {tipoStock && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>$</span>
                        <input
                            className="input-primary"
                            style={{ width: 90 }}
                            type="number" min="0" step="0.01"
                            placeholder="Costo"
                            title="Costo del lote inicial (opcional; usa el del producto si se omite)"
                            value={costo}
                            disabled={disabled}
                            onChange={e => setCosto(e.target.value)}
                        />
                    </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>$</span>
                    <input
                        className="input-primary"
                        style={{ width: 90 }}
                        type="number" min="0" step="0.01"
                        placeholder="Precio"
                        value={precio}
                        disabled={disabled}
                        onChange={e => setPrecio(e.target.value)}
                    />
                </div>
                <button
                    onClick={agregar}
                    disabled={disabled || !puede}
                    style={{
                        background: !disabled && puede ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: !disabled && puede ? "#fff" : "var(--text-muted)",
                        border: "none", borderRadius: 10, padding: "8px 14px",
                        fontWeight: 700, fontSize: "0.75rem", cursor: !disabled && puede ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                    }}
                >
                    <Icon name="Plus" size={14} /> Añadir
                </button>
            </div>
            {baseVisible && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                        onClick={cargarBase}
                        disabled={disabled || baseBloqueada}
                        title={baseBloqueada
                            ? "Llena primero el precio y la cantidad del producto"
                            : "Carga los datos del producto como una variación más (para venderlo tal cual además de sus variaciones)"}
                        style={{
                            alignSelf: "flex-start",
                            background: "var(--bg-card2)",
                            color: !disabled && !baseBloqueada ? "var(--primary-mid)" : "var(--text-muted)",
                            border: "1px dashed " + (!disabled && !baseBloqueada ? "var(--primary-mid)" : "var(--border-primary)"),
                            borderRadius: 10, padding: "6px 12px",
                            fontWeight: 700, fontSize: "0.72rem",
                            cursor: !disabled && !baseBloqueada ? "pointer" : "not-allowed",
                            transition: "all 0.15s",
                            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                        }}
                    >
                        <Icon name="PackagePlus" size={14} /> Añadir producto base
                    </button>
                    {baseBloqueada && (
                        <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>
                            Llena primero el precio y la cantidad del producto para usar esta opción.
                        </span>
                    )}
                </div>
            )}
            {lista.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {lista.map((v, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card2)", borderRadius: 10, padding: "6px 10px" }}>
                            <span style={{ flex: 1, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>{v.nombre}</span>
                            {tipoStock && typeof v.stock_inicial === "number" && v.stock_inicial > 0 && (
                                <span style={{ fontWeight: 700, fontSize: "0.72rem", color: "#2e7d32" }}>{v.stock_inicial} uds</span>
                            )}
                            <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--primary-dark)" }}>${v.precio.toFixed(2)}</span>
                            <button onClick={() => onQuitar(i)} title="Quitar" style={{ background: "none", border: "none", cursor: "pointer", color: "#e53935", padding: 4 }}>
                                <Icon name="Trash" size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
