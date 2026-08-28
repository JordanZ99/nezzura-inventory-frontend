"use client"
// ==============================================================================
// src/app/page.tsx  —  Punto de Venta (rediseño Argon primary)
// ==============================================================================
// Esta página solo compone los hooks de dominio (datos, UI y carrito) y los
// componentes de src/components/pos/. La lógica de negocio (PEPS, cobro,
// persistencia) vive en src/hooks/usePos*.ts
// ==============================================================================

import PageHeader from "@/components/ui/PageHeader"
import { ToastBanner } from "@/components/ui/Toast"
import { useTenant } from "@/contexts/TenantContext"
import { usePosDatos } from "@/hooks/usePosDatos"
import { usePosUI } from "@/hooks/usePosUI"
import { usePosCarrito } from "@/hooks/usePosCarrito"
import { GridProductos } from "@/components/pos/GridProductos"
import { CarritoDesktop } from "@/components/pos/CarritoDesktop"
import { BotonCarritoFlotante } from "@/components/pos/BotonCarritoFlotante"
import { DrawerCarritoMovil } from "@/components/pos/DrawerCarritoMovil"
import { ModalVariacion } from "@/components/pos/ModalVariacion"
import { ModalAdvertenciaStock } from "@/components/pos/ModalAdvertenciaStock"


export default function PuntoDeVenta() {
    const { tenant } = useTenant()
    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "Nezzura Digital"

    // ── Hooks de dominio (Fase 1) ──
    const datos = usePosDatos()
    const ui = usePosUI({ productos: datos.productos })
    const posCarrito = usePosCarrito({
        productos: datos.productos,
        lotes: datos.lotes,
        terminales: datos.terminales,
        recargar: datos.recargar,
        setCarritoAbierto: ui.setCarritoAbierto,
        metodoPagoInicial: tenant?.metodo_pago_default,
    })

    // Destructure con los nombres originales para que el JSX no cambie
    const { productos, terminales, cargando, relacionImagen } = datos
    const { busqueda, setBusqueda, categoriaSeleccionada, setCategoriaSeleccionada, ordenamiento, setOrdenamiento, carritoAbierto, setCarritoAbierto, categorias, productosFiltrados } = ui
    const { carrito, precios, cobrando, modoDescuento, modalAdvertencia, modalVariacion, setModalVariacion, manejarToggleDescuento, agregarAlCarrito, agregarConVariacion, cambiarVariacionCarrito, cambiarLoteCarrito, cambiarCantidad, pasoCantidad, cambiarPrecio, cambiarTotal, quitarDelCarrito, vaciarCarrito, cobrarConAdvertencia, confirmarCobroConAdvertencia, cancelarAdvertencia, keyCarrito, lotesParaProducto, nombreLote, totalCarrito, totalItems, panelCobro, togglePanelCobro, metodoPago, setMetodoPago, propina, setPropina, montoRecibido, setMontoRecibido, pagosMixtos, setLineaMixta, agregarLineaMixta, quitarLineaMixta, terminalId, setTerminalId, comisionEstimada, subtotalAlAbrir, aplicarSubtotal, totalAPagar, cambio, sumaMixta, faltanteMixto } = posCarrito

    // Handlers del carrito que comparten los componentes (flujo unidireccional)
    const accionesCarrito = {
        keyCarrito,
        lotesParaProducto,
        pasoCantidad,
        cambiarCantidad,
        cambiarPrecio,
        cambiarTotal,
        cambiarVariacionCarrito,
        cambiarLoteCarrito,
        quitarDelCarrito,
        nombreLote,
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>

            {/* ── Hero ── */}
            <PageHeader
                gradiente="var(--gradient-1)"
                agColor="var(--ag-color-1)"
                paddingBottom="80px"
                subtitulo="Te damos la bienvenida"
                subtituloClase="hidden md:block"
                subtituloStyle={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}
                titulo="Punto de Venta"
                icono="ShoppingCart"
                iconoColor="#fff"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "#fff", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
                extra={(
                    <>
                        <h1 className="flex md:hidden" style={{ color: "#fff", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 12 }}>
                            <img src={logoSrc} alt={empresa}
                                style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", background: "white", padding: 3 }} />
                            Punto de Venta
                        </h1>
                        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.875rem", margin: 0 }}>
                            {productos.length} productos disponibles hoy
                        </p>
                    </>
                )}
            />

            {/* ── Contenido sobre el hero ── */}
            <div style={{ padding: "0 16px", marginTop: -16 }}>

                {/* Mensaje de resultado (toast global) */}
                <ToastBanner />

                {/* Layout desktop: catálogo + carrito lateral */}
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

                    {/* ── Catálogo ── */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <GridProductos
                            categorias={categorias}
                            categoriaSeleccionada={categoriaSeleccionada}
                            setCategoriaSeleccionada={setCategoriaSeleccionada}
                            busqueda={busqueda}
                            setBusqueda={setBusqueda}
                            ordenamiento={ordenamiento}
                            setOrdenamiento={setOrdenamiento}
                            cargando={cargando}
                            productosFiltrados={productosFiltrados}
                            relacionImagen={relacionImagen}
                            agregarAlCarrito={agregarAlCarrito}
                        />
                    </div>

                    {/* ── Carrito desktop ── */}
                    <CarritoDesktop
                        carrito={carrito}
                        productos={productos}
                        precios={precios}
                        totalItems={totalItems}
                        totalCarrito={totalCarrito}
                        totalAPagar={totalAPagar}
                        cambio={cambio}
                        sumaMixta={sumaMixta}
                        faltanteMixto={faltanteMixto}
                        modoDescuento={modoDescuento}
                        cobrando={cobrando}
                        panelCobro={panelCobro}
                        togglePanelCobro={togglePanelCobro}
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
                        subtotalAlAbrir={subtotalAlAbrir}
                        aplicarSubtotal={aplicarSubtotal}
                        manejarToggleDescuento={manejarToggleDescuento}
                        cobrarConAdvertencia={cobrarConAdvertencia}
                        vaciarCarrito={vaciarCarrito}
                        acciones={accionesCarrito}
                    />
                </div>
            </div>

            {/* ── Botón flotante carrito (móvil) ── */}
            {carrito.length > 0 && (
                <BotonCarritoFlotante
                    totalItems={totalItems}
                    totalCarrito={totalCarrito}
                    onClick={() => setCarritoAbierto(true)}
                />
            )}

            {/* ── Drawer carrito móvil ── */}
            {carritoAbierto && (
                <DrawerCarritoMovil
                    carrito={carrito}
                    productos={productos}
                    precios={precios}
                    totalItems={totalItems}
                    totalCarrito={totalCarrito}
                    totalAPagar={totalAPagar}
                    cambio={cambio}
                    sumaMixta={sumaMixta}
                    faltanteMixto={faltanteMixto}
                    modoDescuento={modoDescuento}
                    cobrando={cobrando}
                    panelCobro={panelCobro}
                    togglePanelCobro={togglePanelCobro}
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
                    subtotalAlAbrir={subtotalAlAbrir}
                    aplicarSubtotal={aplicarSubtotal}
                    manejarToggleDescuento={manejarToggleDescuento}
                    cobrarConAdvertencia={cobrarConAdvertencia}
                    vaciarCarrito={vaciarCarrito}
                    setCarritoAbierto={setCarritoAbierto}
                    acciones={accionesCarrito}
                />
            )}

            {/* ── Modal de selección de variación ── */}
            {modalVariacion.visible && modalVariacion.prod && (
                <ModalVariacion
                    prod={modalVariacion.prod}
                    onSeleccionar={agregarConVariacion}
                    onCancelar={() => setModalVariacion({ visible: false, prod: null })}
                />
            )}

            {/* ── Modal de advertencia por stock insuficiente ── */}
            {modalAdvertencia.visible && (
                <ModalAdvertenciaStock
                    nombres={modalAdvertencia.nombres}
                    onConfirmar={confirmarCobroConAdvertencia}
                    onCancelar={cancelarAdvertencia}
                />
            )}
        </div>
    )
}
