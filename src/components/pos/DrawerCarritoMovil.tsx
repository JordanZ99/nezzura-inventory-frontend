// ==============================================================================
// src/components/pos/DrawerCarritoMovil.tsx
// Drawer inferior del carrito (móvil): overlay, header con toggle de descuento,
// lista de ItemCarrito (variante movil) y footer con total + cobrar + vaciar.
// Todo el estado/handlers vienen de usePosCarrito + usePosUI vía props.
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
    setCarritoAbierto: (abierto: boolean) => void
    acciones: AccionesItemCarrito
}

export function DrawerCarritoMovil({
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
    setCarritoAbierto,
    acciones,
}: Props) {
    return (
        <div className="flex md:hidden" style={{
            position: "fixed", inset: 0, zIndex: 300,
            flexDirection: "column", justifyContent: "flex-end",
        }}>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={() => setCarritoAbierto(false)} />
            <div className="card" style={{ borderRadius: "20px 20px 0 0", padding: 20, maxHeight: "80vh", overflowY: "auto", border: "none", margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="ShoppingCart" size={20} /> Tu Carrito ({totalItems})
                    </h2>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                            onClick={manejarToggleDescuento}
                            style={{
                                fontSize: "0.7rem", fontWeight: 800, padding: "5px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                                background: modoDescuento ? "var(--primary-mid)" : "var(--bg-card2)",
                                color: modoDescuento ? "#fff" : "var(--text-muted)",
                                display: "flex", alignItems: "center", gap: 4,
                                transition: "all 0.2s"
                            }}
                        >
                            {modoDescuento ? (
                                <><Icon name="Sparkles" size={14} color="#fff" /> DESC. ON</>
                            ) : (
                                <><Icon name="Tag" size={14} /> DESCUENTO</>
                            )}
                        </button>
                        <button onClick={() => setCarritoAbierto(false)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.2rem", padding: 4 }}>✕</button>
                    </div>
                </div>
                {carrito.map(item => (
                    <ItemCarrito
                        key={acciones.keyCarrito(item)}
                        item={item}
                        prod={productos.find(p => p.producto === item.producto)}
                        lotesProd={acciones.lotesParaProducto(item.producto)}
                        variante="movil"
                        precios={precios}
                        carrito={carrito}
                        modoDescuento={modoDescuento}
                        acciones={acciones}
                    />
                ))}
                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.1rem", marginBottom: 16 }}>
                    <span style={{ color: "var(--text-main)" }}>Total</span>
                    <span style={{ color: "var(--primary-dark)" }}>${totalCarrito.toFixed(2)}</span>
                </div>
                <button className="btn-primary" style={{ width: "100%", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={cobrarConAdvertencia} disabled={cobrando}>
                    {cobrando ? "Procesando..." : <><Icon name="Check" size={18} /> Cobrar</>}
                </button>
                <button className="btn-ghost" style={{ width: "100%" }} onClick={vaciarCarrito}>
                    Vaciar carrito
                </button>
            </div>
        </div>
    )
}
