// ==============================================================================
// src/components/pos/CarritoDesktop.tsx
// Panel lateral del carrito (desktop, sticky): header con badge de ítems y
// engranaje de cobro; cuerpo alternando lista de ItemCarrito / PanelCobro;
// footer con total (+propina si el panel está activo) + cobrar + vaciar.
// Todo el estado/handlers vienen de usePosCarrito vía props.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import { ItemCarrito } from "./ItemCarrito"
import { PanelCobro } from "./PanelCobro"
import type { AccionesItemCarrito } from "./tipos"
import type { ItemCarrito as ItemCarritoType, Producto } from "@/lib/api"
import type { MetodoCobro, MetodoPagoSimple, LineaPagoMixto } from "@/hooks/usePosCarrito"
import type { Terminal } from "@/lib/api"

interface Props {
    carrito: ItemCarritoType[]
    productos: Producto[]
    precios: Record<string, string>
    totalItems: number
    totalCarrito: number
    totalAPagar: number
    cambio: number
    sumaMixta: number
    faltanteMixto: number
    modoDescuento: boolean
    cobrando: boolean
    panelCobro: boolean
    togglePanelCobro: () => void
    metodoPago: MetodoCobro
    setMetodoPago: (m: MetodoCobro) => void
    propina: string
    setPropina: (v: string) => void
    montoRecibido: string
    setMontoRecibido: (v: string) => void
    pagosMixtos: LineaPagoMixto[]
    setLineaMixta: (idx: number, campo: "metodo" | "monto" | "terminal_id", valor: string) => void
    agregarLineaMixta: () => void
    quitarLineaMixta: (idx: number) => void
    terminalId: string
    setTerminalId: (v: string) => void
    terminales: Terminal[]
    comisionEstimada: (metodo: MetodoPagoSimple, monto: number, terminalId: string) => number
    subtotalAlAbrir: number
    aplicarSubtotal: (texto: string) => void
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
    totalAPagar,
    cambio,
    sumaMixta,
    faltanteMixto,
    modoDescuento,
    cobrando,
    panelCobro,
    togglePanelCobro,
    metodoPago,
    setMetodoPago,
    propina,
    setPropina,
    montoRecibido,
    setMontoRecibido,
    pagosMixtos,
    setLineaMixta,
    agregarLineaMixta,
    quitarLineaMixta,
    terminalId,
    setTerminalId,
    terminales,
    comisionEstimada,
    subtotalAlAbrir,
    aplicarSubtotal,
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
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
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
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            {totalItems}
                        </span>
                    )}
                </h2>
                <button
                    onClick={togglePanelCobro}
                    disabled={carrito.length === 0}
                    title="Opciones de cobro"
                    style={{
                        padding: "6px", borderRadius: 8, border: "none", cursor: carrito.length === 0 ? "not-allowed" : "pointer",
                        background: panelCobro ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: panelCobro ? "#fff" : "var(--text-muted)",
                        display: "flex", alignItems: "center",
                        transition: "all 0.2s", opacity: carrito.length === 0 ? 0.4 : 1
                    }}
                >
                    <Icon name={panelCobro ? "ChevronUp" : "Settings"} size={16} />
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {carrito.length === 0 ? (
                    <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", padding: "24px 0" }}>
                        Agrega productos
                    </p>
                ) : panelCobro ? (
                    <PanelCobro
                        abierto={panelCobro}
                        totalCarrito={totalCarrito}
                        subtotalAlAbrir={subtotalAlAbrir}
                        totalAPagar={totalAPagar}
                        cambio={cambio}
                        sumaMixta={sumaMixta}
                        faltanteMixto={faltanteMixto}
                        metodoPago={metodoPago}
                        setMetodoPago={setMetodoPago}
                        propina={propina}
                        setPropina={setPropina}
                        montoRecibido={montoRecibido}
                        setMontoRecibido={setMontoRecibido}
                        pagosMixtos={pagosMixtos}
                        setLineaMixta={setLineaMixta}
                        agregarLineaMixta={agregarLineaMixta}
                        quitarLineaMixta={quitarLineaMixta}
                        terminalId={terminalId}
                        setTerminalId={setTerminalId}
                        terminales={terminales}
                        comisionEstimada={comisionEstimada}
                        aplicarSubtotal={aplicarSubtotal}
                        modoDescuento={modoDescuento}
                        manejarToggleDescuento={manejarToggleDescuento}
                        volver={togglePanelCobro}
                    />
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
                        <span>{panelCobro ? "A pagar" : "Total"}</span>
                        <span style={{ color: "var(--primary-dark)" }}>${(panelCobro ? totalAPagar : totalCarrito).toFixed(2)}</span>
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
