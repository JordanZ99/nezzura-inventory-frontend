"use client"
// ==============================================================================
// src/app/estadisticas/page.tsx — Rediseño Tremor + Antigravity Hero + PDF
// Orquestador: hooks de dominio (datos, cálculos, UI) + componentes de sección.
// ==============================================================================

import { DateRangePicker } from "@tremor/react"
import PageHeader from "@/components/ui/PageHeader"
import { ToastBanner } from "@/components/ui/Toast"
import CardTurnos from "@/components/estadisticas/CardTurnos"
import { useChartColors } from "@/components/hooks/useChartColors"
import { useTenant } from "@/contexts/TenantContext"
import { useEstadisticasDatos } from "@/hooks/useEstadisticasDatos"
import { useEstadisticasCalculos } from "@/hooks/useEstadisticasCalculos"
import { useEstadisticasUI } from "@/hooks/useEstadisticasUI"
import ReporteHeader from "@/components/estadisticas/ReporteHeader"
import KpisReporte from "@/components/estadisticas/KpisReporte"
import ResumenCobros from "@/components/estadisticas/ResumenCobros"
import GraficasReporte from "@/components/estadisticas/GraficasReporte"
import TablaHistorialVentas from "@/components/estadisticas/TablaHistorialVentas"
import CatalogoProductosEstadisticas from "@/components/estadisticas/CatalogoProductosEstadisticas"
import ModalDetalleProducto from "@/components/estadisticas/ModalDetalleProducto"
import ModalConfirmarAnular from "@/components/estadisticas/ModalConfirmarAnular"
import ModalConfirmarAnularOrden from "@/components/estadisticas/ModalConfirmarAnularOrden"

export default function Estadisticas() {
    const { ventas, ordenes, gastos, productos, cargando, recargar, relacionImagen, isMobile } = useEstadisticasDatos()
    const { dates, setDates, paginaActual, setPaginaActual, busquedaVentas, setBusquedaVentas, ordenVentas, setOrdenVentas, busquedaProd, setBusquedaProd, busquedaProdDebounced, catSelecProd, setCatSelecProd, ordenProd, setOrdenProd, prodSeleccionado, setProdSeleccionado, fotosModal, indiceFoto, setIndiceFoto, editando, setEditando, editVal, setEditVal, guardando, confirmAnularVentaId, setConfirmAnularVentaId, confirmAnularOrdenId, setConfirmAnularOrdenId, ordenEditando, setOrdenEditando, ordenFecha, setOrdenFecha, guardarEdicion, anularVenta, iniciarEdicionOrden, guardarEdicionOrden, anularOrden, descargarImagen } = useEstadisticasUI(recargar)
    const { ITEMS_POR_PAGINA, ventasFiltradas, ordenesFiltradas, ordenesPaginadas, categoriasCatalogo, productosFiltrados, getVentasProducto, totalPaginas, totalVendido, gananciaBruta, totalGastos, gananciaNeta, ticketPromedio, cobrosPorMetodo, propinasPeriodo, globalCostProfit, top5, chartDataLine, chartDataBar, valFormatter, getPaginationRange } = useEstadisticasCalculos({ ventas, ordenes, gastos, productos, dates, busquedaVentas, ordenVentas, busquedaProdDebounced, catSelecProd, ordenProd, paginaActual })
    const chartColors = useChartColors();
    const { tenant } = useTenant()
    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "..."

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>


            {/* ── Hero ── */}
            <PageHeader
                gradiente="var(--gradient-3)"
                agColor="var(--ag-color-3)"
                agOpciones={{ count: 800 }}
                subtitulo="RENDIMIENTO EXPERTO"
                subtituloStyle={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" }}
                titulo="Panel Estadístico"
                icono="ChartPie"
                iconoColor="var(--primary-soft)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
            />

            {/* ── Controls: Date Picker + PDF Button ── */}
            <div style={{ padding: "0 24px", marginTop: -60 }}>
                <div className="card fade-up" style={{ padding: "20px 24px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
                            <DateRangePicker className="w-full" value={dates} onValueChange={setDates} selectPlaceholder="Filtrar por período" />
                        </div>
                    </div>
                </div>

                <ToastBanner />

                {/* ── Corte de caja por turnos (Fase C) ── */}
                <CardTurnos />

                {/* ── CONTENEDOR PARA EL PDF ── */}
                <div id="report-container" style={{ padding: 16, background: "var(--bg-card)", borderRadius: 12, overflow: "hidden", maxWidth: "100%" }}>
                    <ReporteHeader logoSrc={logoSrc} empresa={empresa} dates={dates} />
                    <KpisReporte totalVendido={totalVendido} gananciaBruta={gananciaBruta} totalGastos={totalGastos} gananciaNeta={gananciaNeta} ticketPromedio={ticketPromedio} />
                    <ResumenCobros cobrosPorMetodo={cobrosPorMetodo} propinasPeriodo={propinasPeriodo} ordenes={ordenesFiltradas} />
                    <GraficasReporte cargando={cargando} totalVendido={totalVendido} top5={top5} globalCostProfit={globalCostProfit} chartDataLine={chartDataLine} chartDataBar={chartDataBar} chartColors={chartColors} valFormatter={valFormatter} />
                </div>

                {/* ── Tabla del Historial de Ventas ── */}
                <div style={{ marginTop: 32 }}>
                    <TablaHistorialVentas
                        ordenesFiltradas={ordenesFiltradas}
                        ordenesPaginadas={ordenesPaginadas}
                        busquedaVentas={busquedaVentas}
                        setBusquedaVentas={setBusquedaVentas}
                        ordenVentas={ordenVentas}
                        setOrdenVentas={setOrdenVentas}
                        paginaActual={paginaActual}
                        setPaginaActual={setPaginaActual}
                        totalPaginas={totalPaginas}
                        isMobile={isMobile}
                        ITEMS_POR_PAGINA={ITEMS_POR_PAGINA}
                        getPaginationRange={getPaginationRange}
                        editando={editando}
                        setEditando={setEditando}
                        editVal={editVal}
                        setEditVal={setEditVal}
                        guardando={guardando}
                        guardarEdicion={guardarEdicion}
                        setConfirmAnularVentaId={setConfirmAnularVentaId}
                        ordenEditando={ordenEditando}
                        setOrdenEditando={setOrdenEditando}
                        ordenFecha={ordenFecha}
                        setOrdenFecha={setOrdenFecha}
                        iniciarEdicionOrden={iniciarEdicionOrden}
                        guardarEdicionOrden={guardarEdicionOrden}
                        setConfirmAnularOrdenId={setConfirmAnularOrdenId}
                    />
                </div>

                {/* ── Estadísticas por Producto ── */}
                <CatalogoProductosEstadisticas
                    categoriasCatalogo={categoriasCatalogo}
                    catSelecProd={catSelecProd}
                    setCatSelecProd={setCatSelecProd}
                    busquedaProd={busquedaProd}
                    setBusquedaProd={setBusquedaProd}
                    ordenProd={ordenProd}
                    setOrdenProd={setOrdenProd}
                    productosFiltrados={productosFiltrados}
                    cargando={cargando}
                    relacionImagen={relacionImagen}
                    onSeleccionar={setProdSeleccionado}
                />

                {/* ── Modal de detalle del producto ── */}
                <ModalDetalleProducto
                    prod={prodSeleccionado}
                    fotosModal={fotosModal}
                    indiceFoto={indiceFoto}
                    setIndiceFoto={setIndiceFoto}
                    ventas={ventas}
                    getVentasProducto={getVentasProducto}
                    descargarImagen={descargarImagen}
                    onClose={() => setProdSeleccionado(null)}
                />

                {/* ── Modal: Confirmar anular venta ── */}
                <ModalConfirmarAnular
                    confirmAnularVentaId={confirmAnularVentaId}
                    onCancel={() => setConfirmAnularVentaId(null)}
                    onConfirm={anularVenta}
                />

                {/* ── Modal: Confirmar anular ticket completo ── */}
                <ModalConfirmarAnularOrden
                    confirmAnularOrdenId={confirmAnularOrdenId}
                    nTicket={ordenes.find(o => o.id === confirmAnularOrdenId)?.n_ticket ?? null}
                    onCancel={() => setConfirmAnularOrdenId(null)}
                    onConfirm={anularOrden}
                />

                <div style={{ height: 32 }} />
            </div>
        </div>
    )
}
