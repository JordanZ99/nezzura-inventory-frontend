"use client"
// ==============================================================================
// src/components/mesas/PosRestaurante.tsx
// POS del preset RESTAURANTE (Fase 2). Tres vistas:
//   1. Parrilla de mesas (default) — arrastrables, con estado y totales.
//   2. Panel de mesa — orden abierta + menú para pedir (PanelMesa).
//   3. Menú / cobro — el cuerpo clásico del POS (GridProductos + carrito), que
//      se usa para ventas rápidas/takeout Y para cobrar la mesa: al cobrar, el
//      orden abierto se carga en el carrito (iniciarCobroMesa) y el ticket se
//      cobra con el flujo de cobro EXISTENTE (método, propina, mixto, turnos);
//      el backend recibe mesa_id y libera la mesa en la misma transacción.
// ==============================================================================

import { useEffect, useState } from "react"
import Icon from "@/components/ui/Icon"
import PageHeader from "@/components/ui/PageHeader"
import { ToastBanner } from "@/components/ui/Toast"
import { useTenant } from "@/contexts/TenantContext"
import { usePosDatos } from "@/hooks/usePosDatos"
import { usePosUI } from "@/hooks/usePosUI"
import { usePosCarrito } from "@/hooks/usePosCarrito"
import { useMesas } from "@/hooks/useMesas"
import { GridProductos } from "@/components/pos/GridProductos"
import { CarritoDesktop } from "@/components/pos/CarritoDesktop"
import { BotonCarritoFlotante } from "@/components/pos/BotonCarritoFlotante"
import { DrawerCarritoMovil } from "@/components/pos/DrawerCarritoMovil"
import { ModalVariacion } from "@/components/pos/ModalVariacion"
import { ModalVentaLibre } from "@/components/pos/ModalVentaLibre"
import { ModalAdvertenciaStock } from "@/components/pos/ModalAdvertenciaStock"
import { ParrillaMesas } from "./ParrillaMesas"
import { PanelMesa } from "./PanelMesa"
import { ModalNuevaMesa } from "./ModalNuevaMesa"

type Vista = "mesas" | "menu"

export default function PosRestaurante() {
    const { tenant } = useTenant()
    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "Nezzura Digital"

    // ── Hooks de dominio (mismos que el POS clásico) ──
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
    const mesas = useMesas()

    const [vista, setVista] = useState<Vista>("mesas")
    const [modalVentaLibre, setModalVentaLibre] = useState(false)
    const [modalMesa, setModalMesa] = useState<{ visible: boolean; mesaId: string | null }>({ visible: false, mesaId: null })

    // Cuando el cobro de mesa termina (bien o cancelado), refrescar la parrilla
    useEffect(() => {
        if (!posCarrito.mesaCobrando) mesas.recargar()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posCarrito.mesaCobrando])

    const cobrandoMesa = Boolean(posCarrito.mesaCobrando)
    const mesaCobrandoNombre = cobrandoMesa
        ? (mesas.mesas.find(m => m.id === posCarrito.mesaCobrando)?.nombre ?? "")
        : ""

    const ocupadas = mesas.mesas.filter(m => m.estado !== "Libre").length

    // Cobrar la mesa abierta en el panel: carga su orden en el carrito y
    // abre el panel de cobro clásico (el backend hace el resto atómicamente).
    function cobrarMesaActual() {
        const mesa = mesas.mesa
        if (!mesa || (mesa.items || []).length === 0) return
        posCarrito.iniciarCobroMesa(mesas.prepararCobro(mesa), mesa.id)
        mesas.setMesaId(null)
    }

    const mesaEditar = modalMesa.mesaId ? mesas.mesas.find(m => m.id === modalMesa.mesaId) ?? null : null

    // ── Cuerpo clásico del POS: grid del menú + carrito lateral/drawer ──
    const cuerpoMenu = (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <GridProductos
                    categorias={ui.categorias}
                    categoriaSeleccionada={ui.categoriaSeleccionada}
                    setCategoriaSeleccionada={ui.setCategoriaSeleccionada}
                    busqueda={ui.busqueda}
                    setBusqueda={ui.setBusqueda}
                    ordenamiento={ui.ordenamiento}
                    setOrdenamiento={ui.setOrdenamiento}
                    cargando={datos.cargando}
                    productosFiltrados={ui.productosFiltrados}
                    relacionImagen={datos.relacionImagen}
                    agregarAlCarrito={posCarrito.agregarAlCarrito}
                    onVentaLibre={() => setModalVentaLibre(true)}
                />
            </div>

            <CarritoDesktop
                carrito={posCarrito.carrito}
                productos={datos.productos}
                precios={posCarrito.precios}
                totalItems={posCarrito.totalItems}
                totalCarrito={posCarrito.totalCarrito}
                totalAPagar={posCarrito.totalAPagar}
                cambio={posCarrito.cambio}
                sumaMixta={posCarrito.sumaMixta}
                faltanteMixto={posCarrito.faltanteMixto}
                modoDescuento={posCarrito.modoDescuento}
                cobrando={posCarrito.cobrando}
                panelCobro={posCarrito.panelCobro}
                togglePanelCobro={posCarrito.togglePanelCobro}
                metodoPago={posCarrito.metodoPago}
                setMetodoPago={posCarrito.setMetodoPago}
                propina={posCarrito.propina}
                setPropina={posCarrito.setPropina}
                montoRecibido={posCarrito.montoRecibido}
                setMontoRecibido={posCarrito.setMontoRecibido}
                pagosMixtos={posCarrito.pagosMixtos}
                setLineaMixta={posCarrito.setLineaMixta}
                agregarLineaMixta={posCarrito.agregarLineaMixta}
                quitarLineaMixta={posCarrito.quitarLineaMixta}
                terminalId={posCarrito.terminalId}
                setTerminalId={posCarrito.setTerminalId}
                terminales={datos.terminales}
                comisionEstimada={posCarrito.comisionEstimada}
                subtotalAlAbrir={posCarrito.subtotalAlAbrir}
                aplicarSubtotal={posCarrito.aplicarSubtotal}
                manejarToggleDescuento={posCarrito.manejarToggleDescuento}
                cobrarConAdvertencia={posCarrito.cobrarConAdvertencia}
                vaciarCarrito={posCarrito.vaciarCarrito}
                acciones={{
                    keyCarrito: posCarrito.keyCarrito,
                    lotesParaProducto: posCarrito.lotesParaProducto,
                    pasoCantidad: posCarrito.pasoCantidad,
                    cambiarCantidad: posCarrito.cambiarCantidad,
                    cambiarPrecio: posCarrito.cambiarPrecio,
                    cambiarTotal: posCarrito.cambiarTotal,
                    cambiarVariacionCarrito: posCarrito.cambiarVariacionCarrito,
                    cambiarLoteCarrito: posCarrito.cambiarLoteCarrito,
                    quitarDelCarrito: posCarrito.quitarDelCarrito,
                    nombreLote: posCarrito.nombreLote,
                }}
            />
        </div>
    )

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
                            {ocupadas > 0 ? `${ocupadas} mesa(s) con orden abierta` : "Todas las mesas libres"}
                        </p>
                    </>
                )}
            />

            {/* ── Contenido sobre el hero ── */}
            <div style={{ padding: "0 16px", marginTop: -16 }}>

                <ToastBanner />

                {/* Banner de cobro de mesa (el carrito = el ticket de la mesa) */}
                {cobrandoMesa && (
                    <div className="card fade-up" style={{
                        padding: "12px 16px", marginBottom: 14,
                        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                        borderLeft: "4px solid var(--primary-mid)",
                    }}>
                        <Icon name="UtensilsCrossed" size={18} color="var(--primary-mid)" />
                        <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                            Cobrando {mesaCobrandoNombre || "mesa"}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                            Estos artículos son el ticket de la mesa; al cobrar se libera automáticamente.
                        </span>
                        <button
                            onClick={posCarrito.cancelarCobroMesa}
                            style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
                        >
                            Cancelar cobro
                        </button>
                    </div>
                )}

                {/* Toggle de vista: Mesas ↔ Menú (solo fuera del cobro) */}
                {!cobrandoMesa && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                        {([
                            { valor: "mesas" as Vista, etiqueta: "Mesas", icono: "UtensilsCrossed" as const },
                            { valor: "menu" as Vista, etiqueta: "Menú", icono: "ShoppingBag" as const },
                        ]).map(v => (
                            <button
                                key={v.valor}
                                onClick={() => setVista(v.valor)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    padding: "8px 16px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.8rem",
                                    cursor: "pointer", transition: "all 0.2s",
                                    background: vista === v.valor ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: vista === v.valor ? "#fff" : "var(--primary-dark)",
                                    boxShadow: vista === v.valor ? "0 2px 6px var(--primary-glow)" : "none",
                                }}
                            >
                                <Icon name={v.icono} size={15} /> {v.etiqueta}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Cuerpo por vista ── */}
                {cobrandoMesa
                    ? cuerpoMenu
                    : vista === "mesas"
                        ? (mesas.mesa
                            ? (
                                <PanelMesa
                                    mesa={mesas.mesa}
                                    categorias={ui.categorias}
                                    categoriaSeleccionada={ui.categoriaSeleccionada}
                                    setCategoriaSeleccionada={ui.setCategoriaSeleccionada}
                                    busqueda={ui.busqueda}
                                    setBusqueda={ui.setBusqueda}
                                    ordenamiento={ui.ordenamiento}
                                    setOrdenamiento={ui.setOrdenamiento}
                                    cargandoMenu={datos.cargando}
                                    productosFiltrados={ui.productosFiltrados}
                                    relacionImagen={datos.relacionImagen}
                                    agregarItems={mesas.agregarItems}
                                    quitarItem={mesas.quitarItem}
                                    pedirCuenta={mesas.pedirCuenta}
                                    regresarAOcupada={mesas.regresarAOcupada}
                                    cancelarOrden={mesas.cancelarOrden}
                                    onCobrar={cobrarMesaActual}
                                    onVolver={() => mesas.setMesaId(null)}
                                />
                            )
                            : (
                                <ParrillaMesas
                                    mesas={mesas.mesas}
                                    cargando={mesas.cargando}
                                    onAbrirMesa={m => mesas.setMesaId(m.id)}
                                    onNuevaMesa={() => setModalMesa({ visible: true, mesaId: null })}
                                    onEditarMesa={m => setModalMesa({ visible: true, mesaId: m.id })}
                                    onReordenar={mesas.reordenar}
                                />
                            ))
                        : cuerpoMenu}
            </div>

            {/* ── Botón flotante carrito (móvil) ── */}
            {posCarrito.carrito.length > 0 && (cobrandoMesa || vista === "menu") && (
                <BotonCarritoFlotante
                    totalItems={posCarrito.totalItems}
                    totalCarrito={posCarrito.totalCarrito}
                    onClick={() => ui.setCarritoAbierto(true)}
                />
            )}

            {/* ── Drawer carrito móvil ── */}
            {ui.carritoAbierto && (
                <DrawerCarritoMovil
                    carrito={posCarrito.carrito}
                    productos={datos.productos}
                    precios={posCarrito.precios}
                    totalItems={posCarrito.totalItems}
                    totalCarrito={posCarrito.totalCarrito}
                    totalAPagar={posCarrito.totalAPagar}
                    cambio={posCarrito.cambio}
                    sumaMixta={posCarrito.sumaMixta}
                    faltanteMixto={posCarrito.faltanteMixto}
                    modoDescuento={posCarrito.modoDescuento}
                    cobrando={posCarrito.cobrando}
                    panelCobro={posCarrito.panelCobro}
                    togglePanelCobro={posCarrito.togglePanelCobro}
                    metodoPago={posCarrito.metodoPago}
                    setMetodoPago={posCarrito.setMetodoPago}
                    propina={posCarrito.propina}
                    setPropina={posCarrito.setPropina}
                    montoRecibido={posCarrito.montoRecibido}
                    setMontoRecibido={posCarrito.setMontoRecibido}
                    pagosMixtos={posCarrito.pagosMixtos}
                    setLineaMixta={posCarrito.setLineaMixta}
                    agregarLineaMixta={posCarrito.agregarLineaMixta}
                    quitarLineaMixta={posCarrito.quitarLineaMixta}
                    terminalId={posCarrito.terminalId}
                    setTerminalId={posCarrito.setTerminalId}
                    terminales={datos.terminales}
                    comisionEstimada={posCarrito.comisionEstimada}
                    subtotalAlAbrir={posCarrito.subtotalAlAbrir}
                    aplicarSubtotal={posCarrito.aplicarSubtotal}
                    manejarToggleDescuento={posCarrito.manejarToggleDescuento}
                    cobrarConAdvertencia={posCarrito.cobrarConAdvertencia}
                    vaciarCarrito={posCarrito.vaciarCarrito}
                    setCarritoAbierto={ui.setCarritoAbierto}
                    acciones={{
                        keyCarrito: posCarrito.keyCarrito,
                        lotesParaProducto: posCarrito.lotesParaProducto,
                        pasoCantidad: posCarrito.pasoCantidad,
                        cambiarCantidad: posCarrito.cambiarCantidad,
                        cambiarPrecio: posCarrito.cambiarPrecio,
                        cambiarTotal: posCarrito.cambiarTotal,
                        cambiarVariacionCarrito: posCarrito.cambiarVariacionCarrito,
                        cambiarLoteCarrito: posCarrito.cambiarLoteCarrito,
                        quitarDelCarrito: posCarrito.quitarDelCarrito,
                        nombreLote: posCarrito.nombreLote,
                    }}
                />
            )}

            {/* ── Modales del flujo clásico ── */}
            {posCarrito.modalVariacion.visible && posCarrito.modalVariacion.prod && (
                <ModalVariacion
                    prod={posCarrito.modalVariacion.prod}
                    onSeleccionar={posCarrito.agregarConVariacion}
                    onCancelar={() => posCarrito.setModalVariacion({ visible: false, prod: null })}
                />
            )}

            {modalVentaLibre && (
                <ModalVentaLibre
                    onAgregar={(descripcion, precio, costo) => {
                        posCarrito.agregarVentaLibre(descripcion, precio, costo)
                        setModalVentaLibre(false)
                    }}
                    onCancelar={() => setModalVentaLibre(false)}
                />
            )}

            {posCarrito.modalAdvertencia.visible && (
                <ModalAdvertenciaStock
                    nombres={posCarrito.modalAdvertencia.nombres}
                    onConfirmar={posCarrito.confirmarCobroConAdvertencia}
                    onCancelar={posCarrito.cancelarAdvertencia}
                />
            )}

            {/* ── Modal alta/edición de mesa ── */}
            {modalMesa.visible && (
                <ModalNuevaMesa
                    mesa={mesaEditar}
                    onGuardar={(nombre, capacidad) => {
                        setModalMesa({ visible: false, mesaId: null })
                        if (mesaEditar) void mesas.actualizar(mesaEditar.id, nombre, capacidad)
                        else void mesas.crear(nombre, capacidad)
                    }}
                    onEliminar={mesaEditar ? (() => {
                        setModalMesa({ visible: false, mesaId: null })
                        void mesas.eliminar(mesaEditar.id)
                    }) : undefined}
                    onCancelar={() => setModalMesa({ visible: false, mesaId: null })}
                />
            )}
        </div>
    )
}
