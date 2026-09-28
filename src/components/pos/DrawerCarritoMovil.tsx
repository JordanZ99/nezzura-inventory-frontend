// ==============================================================================
// src/components/pos/DrawerCarritoMovil.tsx
// Drawer inferior del carrito (móvil): overlay, header con engranaje de cobro;
// cuerpo alternando lista de ItemCarrito / PanelCobro; footer con total
// (+propina si el panel está activo) + cobrar + vaciar. Todo el estado/handlers
// vienen de usePosCarrito + usePosUI vía props.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import { ItemCarrito } from "./ItemCarrito"
import { PanelCobro } from "./PanelCobro"
import type { AccionesItemCarrito } from "./tipos"
import type { ItemCarrito as ItemCarritoType, Producto, Terminal } from "@/lib/api"
import type { MetodoCobro, MetodoPagoSimple, LineaPagoMixto, ClientePos } from "@/hooks/usePosCarrito"

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
    setCarritoAbierto: (abierto: boolean) => void
    acciones: AccionesItemCarrito
    // ── Cliente + puntos (Fase B) — pasa íntegro al PanelCobro ──
    mostrarCliente?: boolean
    cliente?: ClientePos | null
    abrirModalCliente?: () => void
    quitarCliente?: () => void
    puntosActivos?: boolean
    valorPunto?: number
    puntosCanjeNum?: number
    valorCanje?: number
    cambiarPuntosCanje?: (v: string) => void
    topeCanje?: number
    puntosGanadosEstimados?: number
    saldoTrasCobro?: number
    ajusteNum?: number
    cambiarAjustePuntos?: (v: string) => void
    conceptoAjuste?: string
    setConceptoAjuste?: (v: string) => void
    totalAPagarDinero?: number
}

export function DrawerCarritoMovil({
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
    setCarritoAbierto,
    acciones,
    mostrarCliente,
    cliente,
    abrirModalCliente,
    quitarCliente,
    puntosActivos,
    valorPunto,
    puntosCanjeNum,
    valorCanje,
    cambiarPuntosCanje,
    topeCanje,
    puntosGanadosEstimados,
    saldoTrasCobro,
    ajusteNum,
    cambiarAjustePuntos,
    conceptoAjuste,
    setConceptoAjuste,
    totalAPagarDinero,
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
                            onClick={togglePanelCobro}
                            disabled={carrito.length === 0}
                            title="Opciones de cobro"
                            style={{
                                padding: "7px", borderRadius: 10, border: "none", cursor: carrito.length === 0 ? "not-allowed" : "pointer",
                                background: panelCobro ? "var(--primary-mid)" : "var(--bg-card2)",
                                color: panelCobro ? "#fff" : "var(--text-muted)",
                                display: "flex", alignItems: "center",
                                transition: "all 0.2s", opacity: carrito.length === 0 ? 0.4 : 1
                            }}
                        >
                            <Icon name={panelCobro ? "ChevronUp" : "Settings"} size={16} />
                        </button>
                        <button onClick={() => setCarritoAbierto(false)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.2rem", padding: 4 }}>✕</button>
                    </div>
                </div>
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
                        mostrarCliente={mostrarCliente}
                        cliente={cliente}
                        abrirModalCliente={abrirModalCliente}
                        quitarCliente={quitarCliente}
                        puntosActivos={puntosActivos}
                        valorPunto={valorPunto}
                        puntosCanjeNum={puntosCanjeNum}
                        valorCanje={valorCanje}
                        cambiarPuntosCanje={cambiarPuntosCanje}
                        topeCanje={topeCanje}
                        puntosGanadosEstimados={puntosGanadosEstimados}
                        saldoTrasCobro={saldoTrasCobro}
                        ajusteNum={ajusteNum}
                        cambiarAjustePuntos={cambiarAjustePuntos}
                        conceptoAjuste={conceptoAjuste}
                        setConceptoAjuste={setConceptoAjuste}
                        totalAPagarDinero={totalAPagarDinero}
                    />
                ) : (
                    carrito.map(item => (
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
                    ))
                )}
                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.1rem", marginBottom: 16 }}>
                    <span style={{ color: "var(--text-main)" }}>{panelCobro ? (totalAPagarDinero && totalAPagarDinero < totalAPagar ? "A pagar en dinero" : "A pagar") : "Total"}</span>
                    <span style={{ color: "var(--primary-dark)" }}>${(panelCobro ? (totalAPagarDinero ?? totalAPagar) : totalCarrito).toFixed(2)}</span>
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
