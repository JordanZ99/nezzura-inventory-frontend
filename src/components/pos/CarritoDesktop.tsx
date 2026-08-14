// ==============================================================================
// src/components/pos/CarritoDesktop.tsx
// Panel lateral del carrito (desktop, sticky): header con badge de ítems y
// toggle de descuento, lista de ItemCarrito y footer con total + cobrar +
// vaciar. Todo el estado/handlers vienen de usePosCarrito vía props.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import { ItemCarrito } from "./ItemCarrito"
import type { AccionesItemCarrito } from "./tipos"
import type { ItemCarrito as ItemCarritoType, Producto } from "@/lib/api"

interface Props {
    carrito: ItemCarritoType[]
    productos: Producto[]
    precios: Record<string, string>
    totalItems: number
    totalCarrito: number
    modoDescuento: boolean
    cobrando: boolean
    manejarToggleDescuento: () => void
    cobrarConAdvertencia: () => void
    vaciarCarrito: () => void
    acciones: AccionesItemCarrito
}

export function CarritoDesktop({
    carrito,
    productos,
    precios,
    totalItems,
    totalCarrito,
    modoDescuento,
    cobrando,
    manejarToggleDescuento,
    cobrarConAdvertencia,
    vaciarCarrito,
    acciones,
}: Props) {
    return (
        <div className="card hidden md:flex" style={{
            width: 280, flexDirection: "column",
            position: "sticky", top: 16, maxHeight: "calc(100vh - 80px)"
        }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{
                    margin: 0,
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                    display: "flex",          // Activa Flexbox
                    alignItems: "center",     // Alinea verticalmente al centro
                    gap: "8px"                // Separa el icono, el texto y la burbuja uniformemente
                }}>
                    <Icon name="ShoppingCart" size={18} /> Carrito
                    {totalItems > 0 && (
                        <span style={{
                            background: "var(--primary-mid)",
                            color: "#fff",
                            borderRadius: "50%",
                            padding: "2px 7px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            display: "inline-flex",   // Asegura que el número también se centre en su burbuja
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            {totalItems}
                        </span>
                    )}
                </h2>
                <button
                    onClick={manejarToggleDescuento}
                    style={{
                        fontSize: "0.65rem", fontWeight: 800, padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: modoDescuento ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: modoDescuento ? "#fff" : "#999",
                        transition: "all 0.2s"
                    }}
                >
                    {modoDescuento ? "CON DESCUENTO" : "SIN DESCUENTO"}
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {carrito.length === 0 ? (
                    <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", padding: "24px 0" }}>
                        Agrega productos
                    </p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {carrito.map(item => (
                            <ItemCarrito
                                key={acciones.keyCarrito(item)}
                                item={item}
                                prod={productos.find(p => p.producto === item.producto)}
                                lotesProd={acciones.lotesParaProducto(item.producto)}
                                variante="desktop"
                                precios={precios}
                                carrito={carrito}
                                modoDescuento={modoDescuento}
                                acciones={acciones}
                            />
                        ))}
                    </div>
                )}
            </div>

            {carrito.length > 0 && (
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1rem", color: "var(--text-main)", marginBottom: 12 }}>
                        <span>Total</span>
                        <span style={{ color: "var(--primary-dark)" }}>${totalCarrito.toFixed(2)}</span>
                    </div>
                    <button className="btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={cobrarConAdvertencia} disabled={cobrando}>
                        {cobrando ? "Procesando..." : "Cobrar"}
                    </button>
                    <button className="btn-ghost" style={{ width: "100%" }} onClick={vaciarCarrito}>
                        Vaciar carrito
                    </button>
                </div>
            )}
        </div>
    )
}
