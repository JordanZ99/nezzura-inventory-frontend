"use client"
// ==============================================================================
// src/app/estadisticas/page.tsx — Rediseño Tremor + Antigravity Hero + PDF
// Orquestador: hooks de dominio (datos, cálculos, UI) + componentes de sección.
// ==============================================================================

import { DateRangePicker } from "@tremor/react"
import PageHeader from "@/components/ui/PageHeader"
import Icon from "@/components/ui/Icon"
import { ToastBanner } from "@/components/ui/Toast"
import CardTurnos from "@/components/estadisticas/CardTurnos"
import { useChartColors } from "@/hooks/useChartColors"
import { useTenant } from "@/contexts/TenantContext"
import { useEstadisticasDatos } from "@/hooks/useEstadisticasDatos"
import { rangoDeDates, useEstadisticasRango } from "@/hooks/useEstadisticasRango"
import { useEstadisticasCalculos } from "@/hooks/useEstadisticasCalculos"
import { useEstadisticasUI, type PresetPeriodo } from "@/hooks/useEstadisticasUI"
import ReporteHeader from "@/components/estadisticas/ReporteHeader"
import KpisReporte from "@/components/estadisticas/KpisReporte"
import ResumenCobros from "@/components/estadisticas/ResumenCobros"
import GraficasReporte from "@/components/estadisticas/GraficasReporte"
import TablaHistorialVentas from "@/components/estadisticas/TablaHistorialVentas"
import CatalogoProductosEstadisticas from "@/components/estadisticas/CatalogoProductosEstadisticas"
import ModalDetalleProducto from "@/components/estadisticas/ModalDetalleProducto"
import ModalConfirmarAnular from "@/components/estadisticas/ModalConfirmarAnular"
import ModalConfirmarAnularOrden from "@/components/estadisticas/ModalConfirmarAnularOrden"

const ETIQUETAS_PRESET: Record<PresetPeriodo, string> = {
    mtd: "Desde este mes",
    "mes-anterior": "Mes anterior",
    "ultimos-30": "Últimos 30 días",
    ytd: "Año hasta la fecha",
    todo: "Desde el principio",
    custom: "Rango personalizado",
}

export default function Estadisticas() {
    const { productos, cargando: cargandoBase, recargar, relacionImagen, isMobile } = useEstadisticasDatos()
    const { dates, setDates, preset, setPreset, paginaActual, setPaginaActual, busquedaVentas, setBusquedaVentas, busquedaVentasDebounced, ordenVentas, setOrdenVentas, busquedaProd, setBusquedaProd, busquedaProdDebounced, catSelecProd, setCatSelecProd, ordenProd, setOrdenProd, prodSeleccionado, setProdSeleccionado, fotosModal, indiceFoto, setIndiceFoto, editando, setEditando, editVal, setEditVal, guardando, confirmAnularVentaId, setConfirmAnularVentaId, confirmAnularOrdenId, setConfirmAnularOrdenId, ordenEditando, setOrdenEditando, ordenFecha, setOrdenFecha, ordenMetodo, setOrdenMetodo, guardarEdicion, anularVenta, iniciarEdicionOrden, guardarEdicionOrden, anularOrden, descargarImagen } = useEstadisticasUI(recargar)

    // Rango contable elegido en el picker → métricas "respuestas de la BDD".
    // El preset "todo" pide el histórico completo vía ?todo=true.
    const rango = rangoDeDates(dates)
    const todo = preset === "todo"
    const { resumen, serie, statsProductos, historial, ventasProducto, cargando: cargandoStats } = useEstadisticasRango({
        rango,
        todo,
        pagina: paginaActual,
        busqueda: busquedaVentasDebounced,
        orden: ordenVentas,
        productoDetalle: prodSeleccionado?.producto ?? null,
    })
    const { ITEMS_POR_PAGINA, ordenesPaginadas, totalTickets, totalPaginas, categoriasCatalogo, productosFiltrados, getVentasProducto, totalVendido, totalGastos, gananciaNeta, ticketPromedio, cobrosPorMetodo, propinasPeriodo, conMetodo, porTerminal, globalCostProfit, top5, chartDataLine, chartDataBar, valFormatter, getPaginationRange } = useEstadisticasCalculos({ resumen, serie, statsProductos, historial, productos, busquedaProdDebounced, catSelecProd, ordenProd })
    const cargando = cargandoBase || cargandoStats
    const chartColors = useChartColors();
    const { tenant } = useTenant()
    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "..."
    const periodoLabel = preset === "custom" && dates.from
        ? `${ETIQUETAS_PRESET.custom}: ${dates.from.toLocaleDateString()} — ${(dates.to ?? new Date()).toLocaleDateString()}`
        : ETIQUETAS_PRESET[preset]

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

            {/* ── Controls: Período (presets en español) + rango personalizado ── */}
            <div style={{ padding: "0 24px", marginTop: -60 }}>
                <div className="card fade-up" style={{ padding: "20px 24px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Icon name="Calendar" size={16} color="var(--text-muted)" />
                                <select
                                    value={preset}
                                    onChange={e => setPreset(e.target.value as PresetPeriodo)}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 10,
                                        border: "1px solid var(--border-primary)",
                                        background: "var(--bg-card2)",
                                        color: "var(--text-main)",
                                        fontSize: "0.82rem",
                                        fontWeight: 600,
                                        outline: "none",
                                        cursor: "pointer"
                                    }}
                                >
                                    <option value="mtd">Desde este mes</option>
                                    <option value="mes-anterior">Mes anterior</option>
                                    <option value="ultimos-30">Últimos 30 días</option>
                                    <option value="ytd">Año hasta la fecha</option>
                                    <option value="todo">Desde el principio</option>
                                    <option value="custom">Rango personalizado…</option>
                                </select>
                            </div>
                            {preset === "custom" && (
                                <div style={{ minWidth: 220, maxWidth: 360 }}>
                                    <DateRangePicker className="w-full" value={dates} onValueChange={setDates} selectPlaceholder="Rango personalizado" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <ToastBanner />

                {/* ── Corte de caja por turnos (Fase C) ── */}
                <CardTurnos />

                {/* ── CONTENEDOR PARA EL PDF ── */}
                <div id="report-container" style={{ padding: 16, background: "var(--bg-card)", borderRadius: 12, overflow: "hidden", maxWidth: "100%" }}>
                    <ReporteHeader logoSrc={logoSrc} empresa={empresa} dates={dates} periodoLabel={periodoLabel} />
                    <KpisReporte totalVendido={totalVendido} totalGastos={totalGastos} gananciaNeta={gananciaNeta} ticketPromedio={ticketPromedio} />
                    <ResumenCobros cobrosPorMetodo={cobrosPorMetodo} propinasPeriodo={propinasPeriodo} conMetodo={conMetodo} porTerminal={porTerminal} />
                    <GraficasReporte cargando={cargando} totalVendido={totalVendido} top5={top5} globalCostProfit={globalCostProfit} chartDataLine={chartDataLine} chartDataBar={chartDataBar} chartColors={chartColors} valFormatter={valFormatter} />
                </div>

                {/* ── Tabla del Historial de Ventas ── */}
                <div style={{ marginTop: 32 }}>
                    <TablaHistorialVentas
                        totalTickets={totalTickets}
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
                        ordenMetodo={ordenMetodo}
                        setOrdenMetodo={setOrdenMetodo}
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
                    ventas={ventasProducto}
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
                    nTicket={ordenesPaginadas.find(o => o.id === confirmAnularOrdenId)?.n_ticket ?? null}
                    onCancel={() => setConfirmAnularOrdenId(null)}
                    onConfirm={anularOrden}
                />

                <div style={{ height: 32 }} />
            </div>
        </div>
    )
}
