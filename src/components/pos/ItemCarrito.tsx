// ==============================================================================
// src/components/pos/ItemCarrito.tsx
// Ítem del carrito UNIFICADO: cantidad ± (con paso fraccionable), precio
// unitario editable, selector de variación, selector de lote (PEPS) y
// subtotal editable en modo descuento. Antes existía casi duplicado en el
// panel desktop y en el drawer móvil (~200 líneas); la prop "variante"
// parametriza las únicas diferencias de estilo/estructura entre ambos.
// ==============================================================================

import type { PropsItemCarrito } from "./tipos"

export function ItemCarrito({
    item,
    prod,
    lotesProd,
    variante,
    precios,
    carrito,
    modoDescuento,
    acciones,
}: PropsItemCarrito) {
    const esMovil = variante === "movil"
    const key = acciones.keyCarrito(item)
    const fracc = !!prod?.fraccionable

    return (
        <div style={esMovil
            ? { padding: "10px 0", borderBottom: "1px solid var(--border-primary)" }
            : { padding: 10, background: "var(--bg-card)", borderRadius: 12, border: "var(--bg-card)" }
        }>
            {/* ── Encabezado: nombre + variación + quitar ── */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, alignItems: esMovil ? undefined : "flex-start" }}>
                <div style={{ display: "flex", flexDirection: esMovil ? "column" : undefined, gap: 2, minWidth: 0, flex: esMovil ? undefined : 1, marginRight: esMovil ? undefined : 6 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: esMovil ? "0.9rem" : "0.8rem", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.producto}
                    </p>
                    {item.variacion && (
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--primary-dark)", background: "var(--bg-card2)", borderRadius: 6, padding: "1px 6px", alignSelf: esMovil ? "flex-start" : undefined }}>
                            {item.variacion}
                        </span>
                    )}
                </div>
                <button onClick={() => acciones.quitarDelCarrito(key)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: esMovil ? "var(--text-muted)" : "#ccc", fontSize: esMovil ? undefined : "0.9rem", padding: esMovil ? undefined : 0, lineHeight: esMovil ? undefined : 1 }}>✕</button>
            </div>

            {/* ── Cantidad ± + precio unitario ── */}
            <div style={{ display: esMovil ? "grid" : "flex", gridTemplateColumns: esMovil ? "1fr 1fr" : undefined, gap: esMovil ? 10 : 8, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: esMovil ? 8 : 4, background: "var(--bg-card2)", borderRadius: 8, border: esMovil ? undefined : "var(--border-primary)", padding: esMovil ? "4px 10px" : "2px 4px" }}>
                    <button onClick={() => {
                        const next = acciones.pasoCantidad(item.cantidad, -1, fracc)
                        if (next <= 0) acciones.quitarDelCarrito(key)
                        else acciones.cambiarCantidad(key, next)
                    }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: esMovil ? "1rem" : "0.9rem", color: "var(--primary-mid)", width: esMovil ? undefined : 22, height: esMovil ? undefined : 22 }}>−</button>
                    <input
                        type="number"
                        min={fracc ? "0.01" : "1"}
                        step={fracc ? "0.1" : "1"}
                        value={item.cantidad}
                        onChange={e => {
                            if (!fracc) {
                                // Unidades enteras: redondea y nunca baja de 1 (no se fracciona)
                                acciones.cambiarCantidad(key, Math.max(1, Math.round(+e.target.value || 0)))
                                return
                            }
                            // Fraccionable: acepta lo que se escribe (0.05, 1.25...); NaN se ignora.
                            // No se clampa en cada tecla para poder digitar "0.0X" de corrido.
                            const v = e.target.value === "" ? 0 : +e.target.value
                            if (isNaN(v)) return
                            acciones.cambiarCantidad(key, v)
                        }}
                        onBlur={() => {
                            // Piso al salir del campo: 0 o menor a 0.01 → 0.01
                            if (fracc) {
                                const c = carrito.find(i => acciones.keyCarrito(i) === key)?.cantidad ?? 0
                                if (isNaN(c) || c < 0.01) acciones.cambiarCantidad(key, 0.01)
                            }
                        }}
                        style={{ width: esMovil ? "100%" : 40, border: "none", textAlign: "center", fontSize: esMovil ? "0.9rem" : "0.8rem", fontWeight: 700, outline: "none", background: "transparent", color: esMovil ? "var(--text-main)" : undefined }}
                    />
                    <button onClick={() => acciones.cambiarCantidad(key, acciones.pasoCantidad(item.cantidad, 1, fracc))}
                        style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: esMovil ? "1rem" : "0.9rem", color: "var(--primary-mid)", width: esMovil ? undefined : 22, height: esMovil ? undefined : 22 }}>+</button>
                </div>

                {esMovil ? (
                    <input type="text" inputMode="decimal"
                        value={precios[key] ?? item.precio_real.toString()}
                        onChange={e => acciones.cambiarPrecio(key, e.target.value)}
                        style={{ width: "100%", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "6px 10px", fontSize: "0.9rem", textAlign: "right", outline: "none", background: "var(--bg-card2)", color: "var(--text-main)" }}
                    />
                ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>UNIT.</span>
                        <input
                            type="text" inputMode="decimal"
                            value={precios[key] ?? item.precio_real.toString()}
                            onChange={e => acciones.cambiarPrecio(key, e.target.value)}
                            style={{ width: "100%", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "4px 8px", fontSize: "0.8rem", textAlign: "right", outline: "none", background: "var(--bg-card2)" }}
                        />
                    </div>
                )}
            </div>

            {/* ── Selector de variación (si el producto tiene) ── */}
            {(prod?.variaciones || []).length > 0 && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: esMovil ? "0.65rem" : "0.6rem", fontWeight: 700, color: esMovil ? "var(--text-muted)" : "#999", whiteSpace: "nowrap" }}>VAR.:</span>
                    <select
                        value={item.variacion || ""}
                        onChange={e => acciones.cambiarVariacionCarrito(key, e.target.value)}
                        style={{
                            flex: 1,
                            fontSize: esMovil ? "0.75rem" : "0.65rem",
                            padding: esMovil ? "4px 8px" : "3px 6px",
                            borderRadius: esMovil ? 8 : 6,
                            border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)",
                            color: "var(--text-main)",
                            outline: "none",
                            cursor: "pointer",
                            fontWeight: 600
                        }}
                    >
                        {!item.variacion && <option value="">Elegir variación</option>}
                        {(prod?.variaciones || []).map(v => (
                            <option key={v.id} value={v.nombre}>
                                {v.nombre} — ${v.precio.toFixed(2)}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* ── Selector de lote (solo productos con stock) ── */}
            {(prod?.tipo_producto ?? "stock") === "stock" && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: esMovil ? "0.65rem" : "0.6rem", fontWeight: 700, color: esMovil ? "var(--text-muted)" : "#999", whiteSpace: "nowrap" }}>LOTE:</span>
                    <select
                        value={item.id_lote || ""}
                        onChange={e => acciones.cambiarLoteCarrito(key, e.target.value || undefined)}
                        style={{
                            flex: 1,
                            fontSize: esMovil ? "0.75rem" : "0.65rem",
                            padding: esMovil ? "4px 8px" : "3px 6px",
                            borderRadius: esMovil ? 8 : 6,
                            border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)",
                            color: "var(--text-main)",
                            outline: "none",
                            cursor: "pointer",
                            fontWeight: 600
                        }}
                    >
                        <option value="">Más antiguo</option>
                        {lotesProd.map(l => (
                            <option key={l.id_lote} value={l.id_lote}>
                                {acciones.nombreLote(l)}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* ── Subtotal (editable en modo descuento) ── */}
            <div style={{ marginTop: 6, display: "flex", flexDirection: esMovil ? "row" : "column", gap: 2, justifyContent: esMovil ? "space-between" : undefined, alignItems: esMovil ? "center" : undefined }}>
                <span style={{ fontSize: esMovil ? "0.7rem" : "0.6rem", color: esMovil ? "var(--text-muted)" : "#999", fontWeight: 700, textAlign: esMovil ? undefined : "right" }}>
                    {esMovil ? (modoDescuento ? "EDITAR TOTAL:" : "SUBTOTAL:") : "SUBTOTAL"}
                </span>
                {modoDescuento ? (
                    <input
                        type="text" inputMode="decimal"
                        defaultValue={(item.cantidad * item.precio_real).toFixed(2)}
                        onBlur={e => acciones.cambiarTotal(key, e.target.value)}
                        onKeyDown={esMovil ? undefined : e => e.key === "Enter" && acciones.cambiarTotal(key, (e.target as HTMLInputElement).value)}
                        style={{ width: esMovil ? "100px" : "100%", border: "1px solid var(--primary-mid)", borderRadius: 8, padding: esMovil ? "6px 10px" : "4px 8px", fontSize: esMovil ? "0.9rem" : "0.85rem", textAlign: "right", outline: "none", background: esMovil ? "var(--bg-card2)" : "#fff", fontWeight: 800, color: "var(--primary-dark)" }}
                    />
                ) : (
                    <span style={{ textAlign: esMovil ? undefined : "right", fontSize: esMovil ? "1rem" : "0.85rem", color: "var(--primary-dark)", fontWeight: 800 }}>
                        ${(item.cantidad * item.precio_real).toFixed(2)}
                    </span>
                )}
            </div>
        </div>
    )
}
