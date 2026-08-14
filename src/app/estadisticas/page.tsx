"use client"
// ==============================================================================
// src/app/estadisticas/page.tsx — Rediseño Tremor + Antigravity Hero + PDF
// ==============================================================================

import { useState, useEffect } from "react"
import { api, Venta, Gasto, Producto } from "@/lib/api"
import { DateRangePicker, DateRangePickerValue, DonutChart, LineChart, BarChart } from "@tremor/react"
import Icon from "@/components/ui/Icon"
import PageHeader from "@/components/ui/PageHeader"
import { useChartColors } from "@/components/hooks/useChartColors"
import { useTenant } from "@/contexts/TenantContext"


/** Descarga una imagen desde una URL con el nombre del producto */
function descargarImagen(url: string, nombre: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = nombre.replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, "").trim() || "imagen"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}

function Pill({ children, color = "primary" }: { children: React.ReactNode; color?: "primary" | "green" | "red" | "gray" }) {
    const map = { primary: "stat-pill-primary", green: "stat-pill-green", red: "stat-pill-red", gray: "stat-pill-gray" }
    return (
        <span className={map[color]} style={{ fontSize: "0.7rem", fontWeight: 700, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>
            {children}
        </span>
    )
}

export default function Estadisticas() {
    const [ventas, setVentas] = useState<Venta[]>([])
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [cargando, setCargando] = useState(true)
    const [editando, setEditando] = useState<number | null>(null)
    const [editVal, setEditVal] = useState({ fecha: "", cantidad: 0, precio_real: 0, total_venta: 0, ganancia_bruta: 0, costo_unitario: 0 })
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [dates, setDates] = useState<DateRangePickerValue>({ from: undefined, to: undefined })
    const chartColors = useChartColors();

    const [guardando, setGuardando] = useState(false)
    const [confirmAnularVentaId, setConfirmAnularVentaId] = useState<number | null>(null)
    const { tenant } = useTenant()

    // Responsive
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 899px)")
        setIsMobile(mq.matches)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Paginación
    const ITEMS_POR_PAGINA = 10
    const [paginaActual, setPaginaActual] = useState(1)
    const [busquedaVentas, setBusquedaVentas] = useState("")
    const [ordenVentas, setOrdenVentas] = useState("fecha-desc")

    // Catálogo de productos en estadísticas
    const [productos, setProductos] = useState<Producto[]>([])
    const [busquedaProd, setBusquedaProd] = useState("")
    const [busquedaProdDebounced, setBusquedaProdDebounced] = useState("")
    useEffect(() => {
        const timer = setTimeout(() => setBusquedaProdDebounced(busquedaProd), 300)
        return () => clearTimeout(timer)
    }, [busquedaProd])
    // Relación global de las fotos de producto ('1' | '4 / 5') — config del catálogo
    const [relacionImagen, setRelacionImagen] = useState("1")
    useEffect(() => {
        api.getConfigCatalogo()
            .then(c => setRelacionImagen(c?.relacion_imagen === "4:5" ? "4 / 5" : "1"))
            .catch(() => {})
    }, [])
    const [catSelecProd, setCatSelecProd] = useState("Todas")
    const [ordenProd, setOrdenProd] = useState("ventas-desc")
    const [prodSeleccionado, setProdSeleccionado] = useState<Producto | null>(null)
    const [fotosModal, setFotosModal] = useState<{ url: string; orden: number }[]>([])
    const [indiceFoto, setIndiceFoto] = useState(0)
    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "..."

    async function recargar() {
        try {
            const [v, g, p] = await Promise.all([api.getVentas(), api.getGastos(), api.getInventario()])
            setVentas(v)
            setGastos(g)
            setProductos(p)
        } catch (e) {
            console.error(e)
        }
    }
    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    // Cargar todas las imágenes del producto al abrir el modal
    useEffect(() => {
        if (!prodSeleccionado) {
            setFotosModal([])
            setIndiceFoto(0)
            return
        }
        setIndiceFoto(0)
        const fotos: { url: string; orden: number }[] = []
        if (prodSeleccionado.imagen && prodSeleccionado.imagen !== "No hay foto") {
            fotos.push({ url: prodSeleccionado.imagen, orden: 1 })
        }
        api.getImagenesProducto(prodSeleccionado.producto)
            .then(extras => {
                setFotosModal([...fotos, ...extras.map(e => ({ url: e.url, orden: e.orden }))])
            })
            .catch(() => setFotosModal(fotos))
    }, [prodSeleccionado])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    async function guardarEdicion() {
        if (editando === null || guardando) return
        setGuardando(true)
        try {
            await api.actualizarVenta(editando, editVal)
            mostrarMsg(true, "Venta actualizada")
            setEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
        finally { setGuardando(false) }
    }

    async function anularVenta(id: number) {
        setConfirmAnularVentaId(null)
        try {
            await api.eliminarVenta(id)
            mostrarMsg(true, "Venta anulada")
            setEditando(null); recargar()
        } catch (e: unknown) { mostrarMsg(false, `${e instanceof Error ? e.message : "Error"}`) }
    }

    // --- Filtrado ---
    const ventasFiltradas = ventas.filter(v => {
        const f = new Date(v.fecha)
        if (dates.from && f < dates.from) return false
        if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
        // Buscador por nombre o descripción del producto
        if (busquedaVentas.trim()) {
            const q = busquedaVentas.toLowerCase()
            const prod = v.producto?.toLowerCase().includes(q)
            if (!prod) return false
        }
        return true
    }).sort((a, b) => {
        switch (ordenVentas) {
            case "fecha-asc": return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
            case "monto-desc": return (b.total_venta || 0) - (a.total_venta || 0)
            case "monto-asc": return (a.total_venta || 0) - (b.total_venta || 0)
            case "producto": return (a.producto || "").localeCompare(b.producto || "")
            case "ganancia-desc": return (b.ganancia_bruta || 0) - (a.ganancia_bruta || 0)
            case "fecha-desc":
            default: return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        }
    })

    const gastosFiltrados = gastos.filter(g => {
        const f = new Date(g.fecha)
        if (dates.from && f < dates.from) return false
        if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
        return true
    })

    // --- Catálogo de productos ---
    const categoriasCatalogo = ["Todas", ...Array.from(new Set(productos.flatMap(p => (p.categoria || ["General"]).map(c => c.trim())))).sort()]

    // Unidades totales vendidas por producto (suma de cantidades)
    const unidadesPorProducto = ventas
        .filter(v => v.estado !== "Inactivo")
        .reduce((acc, v) => {
            acc[v.producto] = (acc[v.producto] || 0) + v.cantidad
            return acc
        }, {} as Record<string, number>)
    // Ganancia bruta total por producto
    const gananciaPorProducto = ventas
        .filter(v => v.estado !== "Inactivo")
        .reduce((acc, v) => {
            acc[v.producto] = (acc[v.producto] || 0) + v.ganancia_bruta
            return acc
        }, {} as Record<string, number>)

    const productosFiltrados = productos.filter(p => {
        const q = busquedaProdDebounced.toLowerCase()
        const porBusqueda = !q || p.producto.toLowerCase().includes(q) ||
            p.descripcion?.toLowerCase().includes(q) ||
            p.codigo_interno?.toLowerCase().includes(q) ||
            p.codigo_barras?.toLowerCase().includes(q) ||
            (p.categoria || ["General"]).join(" ").toLowerCase().includes(q)
        const porCategoria = catSelecProd === "Todas" || (p.categoria || ["General"]).includes(catSelecProd)
        return porBusqueda && porCategoria
    }).sort((a, b) => {
        switch (ordenProd) {
            case "alfabetico-desc": return b.producto.localeCompare(a.producto, "es", { sensitivity: "base" })
            case "precio-desc": return b.precio_venta - a.precio_venta
            case "precio-asc": return a.precio_venta - b.precio_venta
            case "stock-desc": return b.stock_total - a.stock_total
            case "stock-asc": return a.stock_total - b.stock_total
            case "ventas-desc": return (unidadesPorProducto[b.producto] || 0) - (unidadesPorProducto[a.producto] || 0)
            case "ventas-asc": return (unidadesPorProducto[a.producto] || 0) - (unidadesPorProducto[b.producto] || 0)
            case "ganancia-desc": return (gananciaPorProducto[b.producto] || 0) - (gananciaPorProducto[a.producto] || 0)
            case "ganancia-asc": return (gananciaPorProducto[a.producto] || 0) - (gananciaPorProducto[b.producto] || 0)
            case "alfabetico":
            default: return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
        }
    })

    function getVentasProducto(prod: Producto) {
        const ventasProd = ventas.filter(v => v.producto === prod.producto && v.estado !== "Inactivo")
        const ventasEnRango = ventasProd.filter(v => {
            const f = new Date(v.fecha)
            if (dates.from && f < dates.from) return false
            if (dates.to && f > new Date(dates.to.getTime() + 86400000)) return false
            return true
        })
        const totalVendido = ventasEnRango.reduce((a, v) => a + v.total_venta, 0)
        const totalGanancia = ventasEnRango.reduce((a, v) => a + v.ganancia_bruta, 0)
        const totalUnidades = ventasEnRango.reduce((a, v) => a + v.cantidad, 0)
        return { totalVentas: ventasEnRango.length, totalVendido, totalGanancia, totalUnidades }
    }

    // Reiniciar paginación cuando cambian los filtros
    useEffect(() => {
        setPaginaActual(1)
    }, [dates.from, dates.to, busquedaVentas, ordenVentas])

    // --- Paginación ---
    const totalPaginas = Math.max(1, Math.ceil(ventasFiltradas.length / ITEMS_POR_PAGINA))
    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA
    const ventasPaginadas = ventasFiltradas.slice(inicio, inicio + ITEMS_POR_PAGINA)

    // --- KPIs ---
    const ventasActivas = ventasFiltradas.filter(v => v.estado !== "Inactivo")

    const totalVendido = ventasActivas.reduce((a, v) => a + v.total_venta, 0)
    const gananciaBruta = ventasActivas.reduce((a, v) => a + v.ganancia_bruta, 0)
    const totalGastos = gastosFiltrados.reduce((a, g) => a + g.monto, 0)
    const gananciaNeta = gananciaBruta - totalGastos
    const costoTotalGlobal = totalVendido - gananciaBruta

    // --- Transformación de datos para Gráficas ---
    const globalCostProfit = [
        { name: "Costo de Productos", value: costoTotalGlobal },
        { name: "Ganancia Bruta", value: gananciaBruta }
    ]

    const productSales = ventasActivas.reduce((acc, v) => {
        acc[v.producto] = (acc[v.producto] || 0) + v.total_venta
        return acc
    }, {} as Record<string, number>)
    const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1])
    const top5 = sortedProducts.slice(0, 5).map(p => ({ name: p[0], value: p[1] }))
    const otros = sortedProducts.slice(5).reduce((a, p) => a + p[1], 0)
    if (otros > 0) top5.push({ name: "Otros", value: otros })

    const salesByDate = ventasActivas.reduce((acc, v) => {
        const d = v.fecha.substring(0, 10)
        acc[d] = (acc[d] || 0) + v.total_venta
        return acc
    }, {} as Record<string, number>)
    const chartDataLine = Object.entries(salesByDate).sort((a, b) => a[0].localeCompare(b[0])).map(d => ({ date: d[0], "Ventas": d[1] }))

    const productCostProfit = ventasActivas.reduce((acc, v) => {
        if (!acc[v.producto]) acc[v.producto] = { name: v.producto, "Costo Lotes": 0, "Ganancia": 0, total: 0 }
        acc[v.producto]["Costo Lotes"] += (v.total_venta - v.ganancia_bruta)
        acc[v.producto]["Ganancia"] += v.ganancia_bruta
        acc[v.producto].total += v.total_venta
        return acc
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as Record<string, any>)
    const chartDataBar = Object.values(productCostProfit).sort((a, b) => b.total - a.total)



    const valFormatter = (number: number) => `$${Intl.NumberFormat("us").format(number).toString()}`

    /**
     * Genera el rango de páginas con truncado inteligente.
     * - Móvil (< 900px): máximo 3 números de página
     * - Escritorio (>= 900px): máximo 9 números de página (casillas)
     * Siempre muestra primera y última página.
     */
    function getPaginationRange(current: number, total: number, mobile: boolean): (number | "ellipsis")[] {
        if (mobile) {
            if (total <= 3) {
                return Array.from({ length: total }, (_, i) => i + 1)
            }
            if (current <= 2) {
                return [1, 2, "ellipsis", total]
            }
            if (current >= total - 1) {
                return [1, "ellipsis", total - 1, total]
            }
            return [1, "ellipsis", current, "ellipsis", total]
        }

        // Desktop: hasta 9 casillas
        if (total <= 9) {
            return Array.from({ length: total }, (_, i) => i + 1)
        }

        if (current <= 4) {
            return [1, 2, 3, 4, 5, "ellipsis", total]
        }

        if (current >= total - 3) {
            return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total]
        }

        return [1, "ellipsis", current - 2, current - 1, current, current + 1, current + 2, "ellipsis", total]
    }

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

                {msg && (
                    <div className="fade-up" style={{
                        position: "fixed",
                        bottom: 24,
                        right: 24,
                        zIndex: 9999,
                        padding: "16px 24px",
                        borderRadius: 12,
                        background: "var(--bg-card)",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                        borderLeft: `6px solid ${msg.ok ? "#4caf50" : "#f44336"}`,
                        color: msg.ok ? "#2e7d32" : "#b71c1c",
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 12
                    }}>
                        <Icon name={msg.ok ? "CircleCheck" : "TriangleAlert"} size={20} color={msg.ok ? "#2e7d32" : "#d97706"} />
                        {msg.texto}
                    </div>
                )}

                {/* ── CONTENEDOR PARA EL PDF ── */}
                <div id="report-container" style={{ padding: 16, background: "var(--bg-card)", borderRadius: 12, overflow: "hidden", maxWidth: "100%" }}>

                    <div className="flex md:hidden" style={{ alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid var(--border-primary)" }}>
                        <img src={logoSrc} alt={empresa} style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 16, background: "#fff", padding: 4, border: "1px solid var(--border-primary" }} />
                        <div>
                            <h2 style={{ margin: "0 0 6px", fontWeight: 800, fontSize: "1.4rem", color: "var(--primary-dark)", textTransform: "uppercase", lineHeight: 1.1 }}>Reporte de Ventas</h2>
                            <p style={{ margin: "0 0 4px", fontSize: "0.95rem", color: "var(--text-main)", fontWeight: 600 }}>{empresa}</p>
                            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                Período: {dates.from ? dates.from.toLocaleDateString() : "Inicio"} {" — "} {dates.to ? dates.to.toLocaleDateString() : new Date().toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    {/* KPIs con la clase agregada */}
                    <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
                        <div style={{ padding: "16px 20px", borderLeft: "4px solid rgb(var(--chart-1))", borderRadius: 12, background: "var(--bg-card2)" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Total Vendido</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.3rem", color: "var(--text-main)" }}>${totalVendido.toFixed(2)}</p>
                        </div>
                        <div style={{ padding: "16px 20px", borderLeft: "4px solid rgb(var(--chart-2))", borderRadius: 12, background: "var(--bg-card2)" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Margen Bruto (%)</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.3rem", color: "var(--text-main)" }}>{totalVendido > 0 ? ((gananciaBruta / totalVendido) * 100).toFixed(1) : "0.0"}%</p>
                        </div>
                        <div style={{ padding: "16px 20px", borderLeft: "4px solid rgb(var(--chart-3))", borderRadius: 12, background: "var(--bg-card2)" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Gastos del Periodo</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.3rem", color: "var(--text-main)" }}>${totalGastos.toFixed(2)}</p>
                        </div>
                        <div style={{ padding: "16px 20px", borderLeft: gananciaNeta >= 0 ? "4px solid var(--success-main)" : "4px solid var(--error-main)", borderRadius: 12, background: gananciaNeta >= 0 ? "var(--success-bg)" : "var(--error-bg)" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Ganancia Neta</p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem", color: gananciaNeta >= 0 ? "var(--success-text)" : "var(--error-text)" }}>${gananciaNeta.toFixed(2)}</p>
                            {gananciaBruta > 0 && <Pill color={gananciaNeta >= 0 ? "green" : "red"}>{((gananciaNeta / gananciaBruta) * 100).toFixed(1)}% margen neto</Pill>}
                        </div>
                    </div>

                    {/* Charts */}
                    {cargando ? (
                        <p style={{ textAlign: "center", color: "#999", padding: 40 }}>Recabando datos para gráficas...</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                            {/* Row 1: Dona + Pie + Líneas con la clase agregada */}
                            <div className="charts-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                                <div style={{ padding: 16, border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
                                    <h3 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>Top Ventas por Producto</h3>
                                    {top5.length > 0 ? <DonutChart data={top5} category="value" index="name" valueFormatter={valFormatter} colors={chartColors} className="h-52" showAnimation={false} /> : <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>Sin datos.</p>}
                                </div>
                                <div style={{ padding: 16, border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
                                    <h3 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>Costo vs Ganancia</h3>
                                    {totalVendido > 0 ? <DonutChart variant="pie" data={globalCostProfit} category="value" index="name" valueFormatter={valFormatter} colors={chartColors.slice(0, 2)} className="h-52" showAnimation={false} /> : <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>Sin datos.</p>}
                                </div>
                                <div style={{ padding: 16, border: "1px solid var(--border-primary)", borderRadius: 12 }}>
                                    <h3 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>Evolución de Ventas</h3>
                                    {chartDataLine.length > 0 ? <LineChart className="h-52" data={chartDataLine} index="date" categories={["Ventas"]} colors={[chartColors[0]]} valueFormatter={valFormatter} yAxisWidth={50} showAnimation={false} /> : <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>Sin datos.</p>}
                                </div>
                            </div>

                            <div style={{ padding: 16, border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
                                <h3 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>Contribución Marginal por Producto</h3>
                                {chartDataBar.length > 0 ? (
                                    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 8 }}>
                                        <div style={{ minWidth: Math.max(400, chartDataBar.length * 120) }}>
                                            <BarChart className="h-72" data={chartDataBar} index="name" categories={["Costo Lotes", "Ganancia"]} colors={chartColors.slice(0, 2)} valueFormatter={valFormatter} stack={true} yAxisWidth={50} showAnimation={false} />
                                        </div>
                                    </div>
                                ) : <p style={{ textAlign: "center", color: "#999" }}>No hay datos suficientes.</p>}
                            </div>
                        </div>
                    )}


                </div>

                {/* ── Tabla del Historial de Ventas ── */}
                {/* [Mantuve tu tabla original intacta, va debajo del report-container] */}
                <div style={{ marginTop: 32 }}>
                    <div className="card fade-up" style={{ overflow: "hidden" }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Historial Completo de Ventas</h2>
                                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{ventasFiltradas.length} venta(s)</span>
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card2)", borderRadius: 10, padding: "0 12px", border: "1px solid var(--border-primary)" }}>
                                    <Icon name="Search" size={16} color="var(--text-muted)" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por producto..."
                                        value={busquedaVentas}
                                        onChange={e => setBusquedaVentas(e.target.value)}
                                        style={{
                                            flex: 1,
                                            border: "none",
                                            background: "transparent",
                                            padding: "8px 0",
                                            fontSize: "0.82rem",
                                            outline: "none",
                                            color: "var(--text-main)"
                                        }}
                                    />
                                    {busquedaVentas && (
                                        <button onClick={() => setBusquedaVentas("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }}>
                                            <Icon name="X" size={14} />
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <Icon name="ArrowUpDown" size={16} color="var(--text-muted)" />
                                    <select
                                        value={ordenVentas}
                                        onChange={e => setOrdenVentas(e.target.value)}
                                        style={{
                                            padding: "8px 12px",
                                            borderRadius: 10,
                                            border: "1px solid var(--border-primary)",
                                            background: "var(--bg-card2)",
                                            color: "var(--text-main)",
                                            fontSize: "0.78rem",
                                            fontWeight: 600,
                                            outline: "none",
                                            cursor: "pointer"
                                        }}
                                    >
                                        <option value="fecha-desc">Mas recientes</option>
                                        <option value="fecha-asc">Mas antiguos</option>
                                        <option value="monto-desc">Mayor monto</option>
                                        <option value="monto-asc">Menor monto</option>
                                        <option value="producto">A-Z producto</option>
                                        <option value="ganancia-desc">Mayor ganancia</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-card2)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                        {["ID", "Fecha", "Productos", "Costo Total", "Precio Total", "Ganancia", "Estado"].map(h => (
                                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ventasPaginadas.map(v => (
                                        <tr key={v.n_ticket} style={{ borderBottom: "1px solid var(--border-light)", opacity: v.estado === "Inactivo" ? 0.6 : 1, textDecoration: v.estado === "Inactivo" ? "line-through" : "none" }} className="hover:bg-primary-50/30">
                                            <td style={{ padding: "12px 16px", fontWeight: 600 }}>#{v.n_ticket || v.id}</td>
                                            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                                                {editando === v.id ? (
                                                    <input type="date" value={editVal.fecha.substring(0, 10)} onChange={e => setEditVal(p => ({ ...p, fecha: e.target.value + "T12:00:00.000Z" }))} className="input-primary" style={{ width: 120, padding: 4, background: "var(--bg-card2)" }} />
                                                ) : new Date(v.fecha).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                        <input type="number" min="1" value={editVal.cantidad} onChange={e => {
                                                            const cant = +e.target.value;
                                                            setEditVal(p => ({
                                                                ...p,
                                                                cantidad: cant,
                                                                total_venta: cant * p.precio_real,
                                                                ganancia_bruta: (p.precio_real - p.costo_unitario) * cant
                                                            }))
                                                        }} className="input-primary" style={{ width: 60, padding: 4, background: "var(--bg-card2)" }} />
                                                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>x {v.producto}</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                        <Pill color="gray">{v.cantidad}x {v.producto}</Pill>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary-dark)" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>COSTO TOTAL</span>
                                                        <input type="number" step="0.01" value={(editVal.costo_unitario * editVal.cantidad) || 0} onChange={e => {
                                                            const nuevoCostoTotal = +e.target.value;
                                                            setEditVal(p => ({
                                                                ...p,
                                                                costo_unitario: p.cantidad > 0 ? nuevoCostoTotal / p.cantidad : 0,
                                                                ganancia_bruta: p.total_venta - nuevoCostoTotal
                                                            }))
                                                        }} className="input-primary" style={{ width: 80, padding: 4, background: "var(--bg-card2)" }} />
                                                    </div>
                                                ) : `$${((v.total_venta || 0) - (v.ganancia_bruta || 0)).toFixed(2)}`}
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary-dark)" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>PRECIO TOTAL</span>
                                                        <input type="number" step="0.01" value={editVal.total_venta} onChange={e => {
                                                            const nuevoPrecioTotal = +e.target.value;
                                                            setEditVal(p => ({
                                                                ...p,
                                                                precio_real: p.cantidad > 0 ? nuevoPrecioTotal / p.cantidad : 0,
                                                                total_venta: nuevoPrecioTotal,
                                                                ganancia_bruta: nuevoPrecioTotal - (p.costo_unitario * p.cantidad)
                                                            }))
                                                        }} className="input-primary" style={{ width: 80, padding: 4, background: "var(--bg-card2)" }} />
                                                    </div>
                                                ) : `$${(v.total_venta || 0).toFixed(2)}`}
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                {editando === v.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        <span style={{ fontSize: "0.6rem", color: "#999", fontWeight: 700 }}>GANANCIA</span>
                                                        <input type="number" step="0.01" value={editVal.ganancia_bruta} disabled className="input-primary" style={{ width: 80, padding: 4 }} />
                                                    </div>
                                                ) : <Pill color="green">${(v.ganancia_bruta || 0).toFixed(2)}</Pill>}
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                {v.estado === "Inactivo" ? (
                                                    <Pill color="red">Anulada</Pill>
                                                ) : editando === v.id ? (
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={guardarEdicion} disabled={guardando} style={{ color: guardando ? "#999" : "#2e7d32", background: "none", border: "none", fontWeight: 800, cursor: guardando ? "not-allowed" : "pointer" }}>
                                                            {guardando ?
                                                                (<Icon name="Hourglass" size={16} color="var(--primary-dark)" />)
                                                                :
                                                                (<Icon name="Save" size={16} color="var(--primary-dark)" />)
                                                            }
                                                        </button>
                                                        <button onClick={() => setEditando(null)} style={{ color: "#b71c1c", background: "none", border: "none", fontWeight: 800, cursor: "pointer" }}><Icon name="X" size={16} color="var(--primary-dark)" /></button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: "flex", gap: 12 }}>
                                                        <button onClick={() => { setEditando(v.id); setEditVal({ fecha: v.fecha, cantidad: v.cantidad, precio_real: v.precio_real, total_venta: v.total_venta, ganancia_bruta: v.ganancia_bruta, costo_unitario: v.costo_unitario }) }} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>
                                                            <Icon name="Pencil" size={16} color="var(--primary-dark)" />
                                                        </button>
                                                        <button onClick={() => setConfirmAnularVentaId(v.id)} disabled={guardando} style={{ color: guardando ? "#eee" : "#ffcdd2", background: "none", border: "none", cursor: guardando ? "not-allowed" : "pointer", fontSize: "0.9rem" }}>
                                                            <Icon name="Trash2" size={16} color="var(--primary-dark)" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {ventasFiltradas.length === 0 && (
                                        <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No hay ventas registradas en este período.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Paginación */}
                        {ventasFiltradas.length > ITEMS_POR_PAGINA && (
                            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                    Mostrando {Math.min(paginaActual * ITEMS_POR_PAGINA, ventasFiltradas.length)} de {ventasFiltradas.length} ventas
                                </span>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <button
                                        onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                        disabled={paginaActual <= 1}
                                        style={{
                                            padding: "6px 14px",
                                            borderRadius: 8,
                                            border: "1px solid var(--border-primary)",
                                            background: paginaActual <= 1 ? "var(--bg-card2)" : "var(--bg-card)",
                                            color: paginaActual <= 1 ? "var(--text-muted)" : "var(--text-main)",
                                            cursor: paginaActual <= 1 ? "not-allowed" : "pointer",
                                            fontWeight: 600,
                                            fontSize: "0.8rem",
                                            transition: "all 0.15s",
                                            opacity: paginaActual <= 1 ? 0.5 : 1
                                        }}
                                        onMouseOver={e => { if (paginaActual > 1) e.currentTarget.style.background = "var(--bg-card2)" }}
                                        onMouseOut={e => e.currentTarget.style.background = "var(--bg-card)"}
                                    >
                                        ← Anterior
                                    </button>
                                    {getPaginationRange(paginaActual, totalPaginas, isMobile).map((item, idx) =>
                                        item === "ellipsis" ? (
                                            <span key={`ellipsis-${idx}`} style={{ padding: "0 4px", color: "var(--text-muted)", fontSize: "0.8rem" }}>…</span>
                                        ) : (
                                            <button
                                                key={item}
                                                onClick={() => setPaginaActual(item)}
                                                style={{
                                                    padding: "6px 12px",
                                                    borderRadius: 6,
                                                    border: item === paginaActual ? "2px solid var(--primary-main)" : "1px solid var(--border-primary)",
                                                    background: item === paginaActual ? "var(--primary-bg)" : "var(--bg-card)",
                                                    color: item === paginaActual ? "var(--primary-main)" : "var(--text-main)",
                                                    cursor: "pointer",
                                                    fontWeight: item === paginaActual ? 800 : 600,
                                                    fontSize: "0.8rem",
                                                    transition: "all 0.15s"
                                                }}
                                            >
                                                {item}
                                            </button>
                                        )
                                    )}
                                    <button
                                        onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                                        disabled={paginaActual >= totalPaginas}
                                        style={{
                                            padding: "6px 14px",
                                            borderRadius: 8,
                                            border: "1px solid var(--border-primary)",
                                            background: paginaActual >= totalPaginas ? "var(--bg-card2)" : "var(--bg-card)",
                                            color: paginaActual >= totalPaginas ? "var(--text-muted)" : "var(--text-main)",
                                            cursor: paginaActual >= totalPaginas ? "not-allowed" : "pointer",
                                            fontWeight: 600,
                                            fontSize: "0.8rem",
                                            transition: "all 0.15s",
                                            opacity: paginaActual >= totalPaginas ? 0.5 : 1
                                        }}
                                        onMouseOver={e => { if (paginaActual < totalPaginas) e.currentTarget.style.background = "var(--bg-card2)" }}
                                        onMouseOut={e => e.currentTarget.style.background = "var(--bg-card)"}
                                    >
                                        Siguiente →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Estadísticas por Producto ── */}
                <div style={{ marginTop: 32 }}>
                    {/* Heading */}
                    <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                            <Icon name="ChartBar" size={20} color="var(--primary-mid)" />
                            Estadísticas por Producto
                        </h2>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>{productosFiltrados.length} producto(s)</span>
                    </div>

                    {/* Pills de categorías */}
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
                        {categoriasCatalogo.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCatSelecProd(cat)}
                                style={{
                                    padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.78rem",
                                    whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                                    background: catSelecProd === cat ? "var(--primary-mid)" : "var(--bg-card2)",
                                    color: catSelecProd === cat ? "#fff" : "var(--primary-dark)",
                                    boxShadow: catSelecProd === cat ? "0 2px 6px var(--primary-glow)" : "none"
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Buscador + Orden — réplica del diseño de Restock */}
                    <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 200 }}>
                            <Icon name="Search" size={20} color="var(--text-muted)" />
                            <input
                                className="input-primary"
                                style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                                placeholder="Buscar por nombre, código o categoría..."
                                value={busquedaProd}
                                onChange={e => setBusquedaProd(e.target.value)}
                            />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                            <button
                                onClick={() => {
                                    setOrdenProd(prev => {
                                        if (prev === "alfabetico") return "alfabetico-desc"
                                        if (prev === "alfabetico-desc") return "alfabetico"
                                        if (prev.endsWith("-asc")) return prev.replace("-asc", "-desc")
                                        if (prev.endsWith("-desc")) return prev.replace("-desc", "-asc")
                                        return prev
                                    })
                                }}
                                title="Invertir orden"
                                style={{
                                    background: "none", border: "none",
                                    cursor: "pointer", padding: 4,
                                    borderRadius: 6, display: "flex", alignItems: "center",
                                    transition: "all 0.15s"
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card2)" }}
                                onMouseLeave={e => { e.currentTarget.style.background = "none" }}
                            >
                                <Icon name="ArrowUpDown" size={20} color="var(--text-muted)" />
                            </button>
                            <select
                                className="input-primary"
                                style={{ border: "none", padding: "4px 8px", fontSize: "0.85rem", background: "transparent", cursor: "pointer", fontWeight: 700, color: "var(--primary-dark)" }}
                                value={ordenProd}
                                onChange={e => setOrdenProd(e.target.value)}
                            >
                                <option value="stock-desc">Mayor stock</option>
                                <option value="stock-asc">Menor stock</option>
                                <option value="precio-desc">Mayor precio</option>
                                <option value="precio-asc">Menor precio</option>                                        <option value="ventas-desc">Más ventas</option>
                                        <option value="ventas-asc">Menos ventas</option>
                                        <option value="ganancia-desc">Más ganancia</option>
                                        <option value="ganancia-asc">Menos ganancia</option>
                                        <option value="alfabetico">Alfabético A-Z</option>
                                        <option value="alfabetico-desc">Alfabético Z-A</option>
                            </select>
                        </div>
                    </div>

                    {/* Grid de productos */}
                    {productosFiltrados.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)" }}>
                            <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
                            <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                            <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>
                                {cargando ? "Cargando productos..." : "Intenta con otra búsqueda o categoría"}
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                            gap: 12,
                        }}>
                            {productosFiltrados.map(prod => (
                                <div
                                    key={prod.producto}
                                    className="card fade-up"
                                    style={{
                                        padding: 12,
                                        cursor: "pointer",
                                        transition: "transform 0.15s, box-shadow 0.15s",
                                    }}
                                    onClick={() => setProdSeleccionado(prod)}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = "translateY(-3px)"
                                        e.currentTarget.style.boxShadow = "0 8px 30px var(--primary-glow)"
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = ""
                                        e.currentTarget.style.boxShadow = ""
                                    }}
                                >
                                    <div style={{
                                        aspectRatio: relacionImagen, borderRadius: 12,
                                        background: "var(--gradient-bg-login)",
                                        marginBottom: 10, overflow: "hidden",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        {prod.imagen && prod.imagen !== "No hay foto" ? (
                                            <img
                                                src={prod.imagen.startsWith("http") ? prod.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${prod.imagen}`}
                                                alt={prod.producto}
                                                style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8, borderRadius: 12 }}
                                            />
                                        ) : (
                                            <Icon name="Package" size={32} color="var(--text-muted)" />
                                        )}
                                    </div>
                                    <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {prod.producto}
                                    </p>
                                    <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-dark)", margin: 0 }}>
                                        ${(prod.precio_venta ?? 0).toFixed(2)}
                                    </p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px" }}>
                                            {(prod.categoria || ["General"]).join(", ")}
                                        </span>
                                        <span style={{
                                            fontSize: "0.62rem", fontWeight: 700,
                                            color: prod.stock_total <= 0 ? "#b71c1c" : "#2e7d32",
                                            background: prod.stock_total <= 0 ? "#ffeef0" : "#e8f5e9",
                                            borderRadius: 6, padding: "2px 6px"
                                        }}>
                                            Stock: {prod.stock_total}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Modal de detalle del producto ── */}
                {prodSeleccionado && (() => {
                    const prod = prodSeleccionado
                    const stats = getVentasProducto(prod)
                    const costoProm = prod.costo_promedio ?? 0
                    const precioVenta = prod.precio_venta ?? 0
                    const margen = precioVenta > 0 ? ((precioVenta - costoProm) / precioVenta) * 100 : 0
                    return (
                        <div style={{
                            position: "fixed", inset: 0, zIndex: 9999,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "var(--overlay-bg)",
                            backdropFilter: "blur(4px)",
                            WebkitBackdropFilter: "blur(4px)",
                            padding: 24
                        }} onClick={() => setProdSeleccionado(null)}>
                            <div
                                className="fade-up"
                                onClick={e => e.stopPropagation()}
                                style={{
                                    background: "var(--bg-card)",
                                    borderRadius: 20,
                                    maxWidth: 500,
                                    width: "100%",
                                    maxHeight: "90vh",
                                    overflowY: "auto",
                                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                                    border: "1px solid var(--border-primary)",
                                }}
                            >
                                {/* Header con foto */}
                                <div style={{
                                    position: "relative",
                                    height: 200,
                                    background: "var(--gradient-bg-login)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    overflow: "hidden",
                                    borderRadius: "20px 20px 0 0"
                                }}>
                                    {fotosModal.length > 0 ? (
                                        <>
                                            <img
                                                src={fotosModal[indiceFoto].url.startsWith("http") ? fotosModal[indiceFoto].url : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${fotosModal[indiceFoto].url}`}
                                                alt={prod.producto}
                                                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: 16 }}
                                            />
                                            {/* Flecha izquierda */}
                                            {indiceFoto > 0 && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setIndiceFoto(i => i - 1) }}
                                                    style={{
                                                        position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                                                        width: 32, height: 32, borderRadius: "50%",
                                                        background: "rgba(0,0,0,0.5)", border: "none",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        cursor: "pointer", backdropFilter: "blur(4px)",
                                                        transition: "all 0.15s"
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.5)" }}
                                                >
                                                    <Icon name="ChevronLeft" size={18} color="#fff" />
                                                </button>
                                            )}
                                            {/* Flecha derecha */}
                                            {indiceFoto < fotosModal.length - 1 && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setIndiceFoto(i => i + 1) }}
                                                    style={{
                                                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                                        width: 32, height: 32, borderRadius: "50%",
                                                        background: "rgba(0,0,0,0.5)", border: "none",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        cursor: "pointer", backdropFilter: "blur(4px)",
                                                        transition: "all 0.15s"
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)" }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.5)" }}
                                                >
                                                    <Icon name="ChevronRight" size={18} color="#fff" />
                                                </button>
                                            )}
                                            {/* Contador */}
                                            {fotosModal.length > 1 && (
                                                <div style={{
                                                    position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
                                                    background: "rgba(0,0,0,0.5)", borderRadius: 10,
                                                    padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700,
                                                    color: "#fff", backdropFilter: "blur(4px)"
                                                }}>
                                                    {indiceFoto + 1} / {fotosModal.length}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <Icon name="Package" size={64} color="var(--text-muted)" />
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (fotosModal.length > 0) {
                                                descargarImagen(fotosModal[indiceFoto].url, prod.producto)
                                            } else if (prod.imagen && prod.imagen !== "No hay foto") {
                                                descargarImagen(prod.imagen, prod.producto)
                                            }
                                        }}
                                        title="Descargar imagen"
                                        style={{
                                            position: "absolute", top: 12, left: 12,
                                            width: 32, height: 32,
                                            borderRadius: "50%",
                                            background: "rgba(0,0,0,0.4)",
                                            border: "none",
                                            color: "#fff",
                                            fontSize: "1.1rem",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backdropFilter: "blur(4px)"
                                        }}
                                    >
                                        <Icon name="Download" size={15} color="#fff" />
                                    </button>
                                    <button
                                        onClick={() => setProdSeleccionado(null)}
                                        style={{
                                            position: "absolute", top: 12, right: 12,
                                            width: 32, height: 32,
                                            borderRadius: "50%",
                                            background: "rgba(0,0,0,0.4)",
                                            border: "none",
                                            color: "#fff",
                                            fontSize: "1.1rem",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backdropFilter: "blur(4px)"
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                                    {/* Nombre y categorías */}
                                    <div>
                                        <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)" }}>
                                            {prod.producto}
                                        </h2>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {(prod.categoria || ["General"]).map(c => (
                                                <span key={c} style={{
                                                    fontSize: "0.65rem", fontWeight: 700,
                                                    background: "var(--primary-bg)",
                                                    color: "var(--primary-main)",
                                                    borderRadius: 8, padding: "2px 8px"
                                                }}>{c}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {prod.descripcion && (
                                        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                            {prod.descripcion}
                                        </p>
                                    )}

                                    {/* Métricas principales */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                                            <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Costo promedio</p>
                                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: "var(--text-main)" }}>${costoProm.toFixed(2)}</p>
                                        </div>
                                        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                                            <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Precio venta</p>
                                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: "var(--text-main)" }}>${precioVenta.toFixed(2)}</p>
                                        </div>
                                        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                                            <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Stock Actual</p>
                                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: prod.stock_total <= 0 ? "#b71c1c" : "var(--text-main)" }}>{prod.stock_total}</p>
                                        </div>
                                        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                                            <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Margen</p>
                                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: margen > 0 ? "#2e7d32" : "#b71c1c" }}>{margen.toFixed(1)}%</p>
                                        </div>
                                    </div>

                                    {/* Códigos */}
                                    {(prod.codigo_interno || prod.codigo_barras || prod.ubicacion) && (
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                            {prod.codigo_interno && (
                                                <div>
                                                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Código interno</p>
                                                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>{prod.codigo_interno}</p>
                                                </div>
                                            )}
                                            {prod.codigo_barras && (
                                                <div>
                                                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Código barras</p>
                                                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>{prod.codigo_barras}</p>
                                                </div>
                                            )}
                                            {prod.ubicacion && (
                                                <div>
                                                    <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Ubicación</p>
                                                    <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>{prod.ubicacion}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Separador */}
                                    <div style={{ height: 1, background: "var(--border-light)", margin: "4px 0" }} />

                                    {/* Estadísticas de ventas */}
                                    <div>
                                        <h3 style={{ margin: "0 0 12px", fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                                            <Icon name="TrendingUp" size={18} color="var(--primary-mid)" />
                                            Rendimiento de Ventas
                                        </h3>
                                        {stats.totalVentas > 0 ? (
                                            <>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                                                    <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, borderLeft: "3px solid var(--primary-mid)" }}>
                                                        <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Unidades vendidas</p>
                                                        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>{stats.totalUnidades}</p>
                                                    </div>
                                                    <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, borderLeft: "3px solid rgb(var(--chart-1))" }}>
                                                        <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Total vendido</p>
                                                        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>${stats.totalVendido.toFixed(2)}</p>
                                                    </div>
                                                    <div style={{ padding: "12px 16px", background: stats.totalGanancia >= 0 ? "var(--success-bg)" : "var(--error-bg)", borderRadius: 12, borderLeft: `3px solid ${stats.totalGanancia >= 0 ? "var(--success-main)" : "var(--error-main)"}` }}>
                                                        <p style={{ margin: "0 0 2px", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Ganancia total</p>
                                                        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: stats.totalGanancia >= 0 ? "var(--success-text)" : "var(--error-text)" }}>${stats.totalGanancia.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                {/* Tabla de ventas del producto */}
                                                <div style={{ overflowX: "auto" }}>
                                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                                                        <thead>
                                                            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                                                {["Ticket", "Fecha", "Cant.", "Costo", "Total", "Ganancia"].map(h => (
                                                                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {ventas
                                                                .filter(v => v.producto === prod.producto && v.estado !== "Inactivo")
                                                                .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                                                                .map(v => (
                                                                    <tr key={v.n_ticket} style={{ borderBottom: "1px solid var(--border-light)" }}
                                                                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card2)"}
                                                                        onMouseLeave={e => e.currentTarget.style.background = ""}>
                                                                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>#{v.n_ticket || v.id}</td>
                                                                        <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{new Date(v.fecha).toLocaleDateString()}</td>
                                                                        <td style={{ padding: "6px 10px" }}>{v.cantidad}</td>
                                                                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>${(v.costo_unitario || 0).toFixed(2)}</td>
                                                                        <td style={{ padding: "6px 10px", fontWeight: 700, color: "var(--primary-dark)" }}>${(v.total_venta || 0).toFixed(2)}</td>
                                                                        <td style={{ padding: "6px 10px" }}><Pill color={v.ganancia_bruta >= 0 ? "green" : "red"}>${(v.ganancia_bruta || 0).toFixed(2)}</Pill></td>
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: "center", padding: "24px 16px", background: "var(--bg-card2)", borderRadius: 12 }}>
                                                <Icon name="ShoppingBag" size={32} color="var(--text-muted)" />
                                                <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                                    Este producto no tiene ventas registradas en el período seleccionado.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* ── Modal: Confirmar anular venta ── */}
                {confirmAnularVentaId !== null && (
                    <div style={{
                        position: "fixed", inset: 0, zIndex: 9999,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                        padding: 24
                    }}>
                        <div className="card" style={{
                            maxWidth: 440, width: "100%", padding: 28, gap: 20,
                            display: "flex", flexDirection: "column",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                            border: "1px solid var(--border-light)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: "#ffeef0", display: "flex",
                                    alignItems: "center", justifyContent: "center", flexShrink: 0
                                }}>
                                    <Icon name="TriangleAlert" size={24} color="#ad4955ff" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                        Anular venta
                                    </h3>
                                </div>
                            </div>

                            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                                ¿Anular esta venta permanentemente? El stock será devuelto al inventario y dejará de contar en las estadísticas.
                            </p>

                            <div style={{
                                padding: "12px 16px", borderRadius: 10,
                                background: "#fff4e5", border: "1px solid #ffd699",
                                display: "flex", gap: 10, alignItems: "flex-start"
                            }}>
                                <div style={{ flexShrink: 0, marginTop: 2 }}>
                                    <Icon name="TriangleAlert" size={20} color="#cc7a00" />
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#8a5e00" }}>
                                        Esta acción no se puede deshacer
                                    </p>
                                    <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#8a5e00", fontWeight: 500 }}>
                                        La venta se eliminará del historial. Si quieres mantener el registro, puedes editar la venta en lugar de anularla.
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                                <button onClick={() => setConfirmAnularVentaId(null)}
                                    style={{
                                        padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                        background: "var(--bg-card2)", color: "var(--text-main)",
                                        fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                                        transition: "all 0.15s"
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button onClick={() => anularVenta(confirmAnularVentaId)}
                                    style={{
                                        padding: "10px 20px", borderRadius: 10, border: "none",
                                        background: "#ad4955ff",
                                        color: "#fff",
                                        fontWeight: 700, fontSize: "0.82rem",
                                        cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 8,
                                        transition: "all 0.15s"
                                    }}
                                >
                                    <Icon name="Trash2" size={16} color="#fff" /> Sí, anular venta
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ height: 32 }} />
            </div>
        </div>
    )
}