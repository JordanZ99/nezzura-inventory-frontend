"use client"
// ==============================================================================
// src/app/estadisticas/page.tsx
// Estadísticas de ventas: métricas, gráficas, tabla y edición de ventas.
// ==============================================================================

import { useState, useEffect, useMemo } from "react"
import { api, Venta, Gasto } from "@/lib/api"

// Colores de config — ajusta a los del negocio
const COLOR_VENTAS = "#d74e80"
const COLOR_GANANCIA = "#2a9d8f"
const COLOR_GASTOS = "#f4a261"

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-bold text-gray-800">{value}</p>
            {sub && <p className="text-xs text-green-600 mt-0.5">{sub}</p>}
        </div>
    )
}

// Gráfica de barras simple sin librerías externas
function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
    if (data.length === 0) return <p className="text-sm text-gray-400">Sin datos</p>
    const max = Math.max(...data.map(d => d.value), 1)
    return (
        <div className="flex items-end gap-2 h-40">
            {data.map(d => (
                <div key={d.label} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-xs text-gray-500">${d.value.toFixed(0)}</span>
                    <div className="w-full rounded-t-lg transition-all"
                        style={{ backgroundColor: color, height: `${(d.value / max) * 120}px` }} />
                    <span className="text-xs text-gray-400 truncate w-full text-center">{d.label}</span>
                </div>
            ))}
        </div>
    )
}

export default function Estadisticas() {
    const [ventas, setVentas] = useState<Venta[]>([])
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [cargando, setCargando] = useState(true)
    const [fechaIni, setFechaIni] = useState("")
    const [fechaFin, setFechaFin] = useState("")
    const [editando, setEditando] = useState<Venta | null>(null)
    const [editForm, setEditForm] = useState({ cantidad: 0, precio_real: 0 })
    const [filtroDia, setFiltroDia] = useState("")
    const [filtroProd, setFiltroProd] = useState("Todos")
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

    useEffect(() => {
        Promise.all([api.getVentas(), api.getGastos()])
            .then(([v, g]) => { setVentas(v); setGastos(g) })
            .finally(() => setCargando(false))
    }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto })
        setTimeout(() => setMsg(null), 3000)
    }

    // Filtrar por período
    const vFilt = useMemo(() => ventas.filter(v => {
        const fecha = new Date(v.fecha)
        const ini = fechaIni ? new Date(fechaIni) : null
        const fin = fechaFin ? new Date(fechaFin + "T23:59:59") : null
        return (!ini || fecha >= ini) && (!fin || fecha <= fin)
    }), [ventas, fechaIni, fechaFin])

    const gFilt = useMemo(() => gastos.filter(g => {
        const fecha = new Date(g.fecha)
        const ini = fechaIni ? new Date(fechaIni) : null
        const fin = fechaFin ? new Date(fechaFin + "T23:59:59") : null
        return (!ini || fecha >= ini) && (!fin || fecha <= fin)
    }), [gastos, fechaIni, fechaFin])

    // Métricas
    const totalVendido = vFilt.reduce((a, v) => a + v.total_venta, 0)
    const ganBruta = vFilt.reduce((a, v) => a + v.ganancia_bruta, 0)
    const totalGastos = gFilt.reduce((a, g) => a + g.monto, 0)
    const ganNeta = ganBruta - totalGastos
    const margen = totalVendido > 0 ? (ganNeta / totalVendido * 100).toFixed(1) : "0"

    // Datos para gráficas mensuales
    const porMes = useMemo(() => {
        const meses: Record<string, { ventas: number; ganancia: number }> = {}
        vFilt.forEach(v => {
            const mes = v.fecha.slice(0, 7)
            if (!meses[mes]) meses[mes] = { ventas: 0, ganancia: 0 }
            meses[mes].ventas += v.total_venta
            meses[mes].ganancia += v.ganancia_bruta
        })
        return Object.entries(meses).sort().map(([mes, d]) => ({
            label: mes,
            ventas: d.ventas,
            ganancia: d.ganancia,
        }))
    }, [vFilt])

    // Margen por producto
    const porProducto = useMemo(() => {
        const prods: Record<string, { total: number; ganancia: number }> = {}
        vFilt.forEach(v => {
            if (!prods[v.producto]) prods[v.producto] = { total: 0, ganancia: 0 }
            prods[v.producto].total += v.total_venta
            prods[v.producto].ganancia += v.ganancia_bruta
        })
        return Object.entries(prods)
            .map(([prod, d]) => ({ label: prod, value: d.total > 0 ? (d.ganancia / d.total * 100) : 0 }))
            .sort((a, b) => b.value - a.value)
    }, [vFilt])

    // Días disponibles para filtro de edición
    const diasDisponibles = Array.from(new Set(vFilt.map(v => v.fecha.slice(0, 10)))).sort().reverse()
    const ventasDia = vFilt.filter(v => v.fecha.startsWith(filtroDia))
    const ventasFiltradas = filtroProd === "Todos" ? ventasDia : ventasDia.filter(v => v.producto === filtroProd)
    const productosDelDia = ["Todos"].concat(Array.from(new Set(ventasDia.map(v => v.producto))))

    async function guardarEdicion() {
        if (!editando) return
        const nuevoTotal = editForm.cantidad * editForm.precio_real
        const nuevaGanancia = (editForm.precio_real - editando.costo_unitario) * editForm.cantidad
        try {
            await api.actualizarVenta(editando.id, { cantidad: editForm.cantidad, precio_real: editForm.precio_real, total_venta: nuevoTotal, ganancia_bruta: nuevaGanancia })
            mostrarMsg(true, "✅ Venta corregida")
            setEditando(null)
            const v = await api.getVentas()
            setVentas(v)
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    async function eliminarVenta(id: number) {
        if (!confirm("¿Eliminar esta venta?")) return
        try {
            await api.eliminarVenta(id)
            mostrarMsg(true, "✅ Venta eliminada")
            const v = await api.getVentas()
            setVentas(v)
            setEditando(null)
        } catch (e: unknown) { mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error"}`) }
    }

    if (cargando) return <div className="p-8 text-center text-gray-500">Cargando estadísticas...</div>

    return (
        <div className="p-6 max-w-5xl">
            <h1 className="text-2xl font-bold text-pink-600 mb-4">📊 Estadísticas</h1>

            {/* Filtro de período */}
            <div className="flex gap-3 mb-6 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Desde</label>
                    <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Hasta</label>
                    <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
                {(fechaIni || fechaFin) && (
                    <button onClick={() => { setFechaIni(""); setFechaFin("") }}
                        className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2">
                        Limpiar filtro
                    </button>
                )}
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-4 gap-3 mb-8">
                <MetricCard label="Total vendido" value={`$${totalVendido.toFixed(2)}`} />
                <MetricCard label="Ganancia bruta" value={`$${ganBruta.toFixed(2)}`} />
                <MetricCard label="Gastos del período" value={`$${totalGastos.toFixed(2)}`} />
                <MetricCard label="Ganancia neta" value={`$${ganNeta.toFixed(2)}`} sub={`${margen}% margen`} />
            </div>

            {msg && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {msg.texto}
                </div>
            )}

            {/* Gráficas */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="border border-gray-100 rounded-2xl p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">📈 Ventas por Mes</h2>
                    <BarChart data={porMes.map(m => ({ label: m.label, value: m.ventas }))} color={COLOR_VENTAS} />
                </div>
                <div className="border border-gray-100 rounded-2xl p-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">🏷️ Margen por Producto (%)</h2>
                    <BarChart data={porProducto} color={COLOR_GANANCIA} />
                </div>
            </div>

            {/* Tabla de ventas */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-gray-700">🧾 Registro de Ventas</h2>
                    <span className="text-xs text-gray-400">{vFilt.length} ventas</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-400 border-b border-gray-100">
                            <tr>
                                {["Fecha", "Producto", "Cant.", "Precio Real", "Costo", "Total", "Ganancia"].map(h => (
                                    <th key={h} className="text-left px-4 py-2">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {vFilt.slice(0, 50).map(v => (
                                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-500">{new Date(v.fecha).toLocaleDateString("es-MX")}</td>
                                    <td className="px-4 py-2 font-medium">{v.producto}</td>
                                    <td className="px-4 py-2">{v.cantidad}</td>
                                    <td className="px-4 py-2">${v.precio_real.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-gray-400">${v.costo_unitario.toFixed(2)}</td>
                                    <td className="px-4 py-2">${v.total_venta.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-green-600">${v.ganancia_bruta.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Corregir / eliminar venta */}
            <div className="border border-gray-100 rounded-2xl p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">✏️ Corregir o eliminar una venta</h2>
                <p className="text-xs text-gray-400 mb-3">Filtra por día y producto para encontrar la venta.</p>

                <div className="flex gap-3 mb-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400">Día</label>
                        <select value={filtroDia} onChange={e => { setFiltroDia(e.target.value); setFiltroProd("Todos"); setEditando(null) }}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                            <option value="">— Selecciona día —</option>
                            {diasDisponibles.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    {filtroDia && (
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400">Producto</label>
                            <select value={filtroProd} onChange={e => { setFiltroProd(e.target.value); setEditando(null) }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                                {productosDelDia.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {filtroDia && ventasFiltradas.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {ventasFiltradas.map(v => (
                            <div key={v.id}
                                onClick={() => { setEditando(v); setEditForm({ cantidad: v.cantidad, precio_real: v.precio_real }) }}
                                className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-colors ${editando?.id === v.id ? "border-pink-300 bg-pink-50" : "border-gray-100 hover:border-gray-200"}`}>
                                <span className="text-sm">{new Date(v.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {v.producto} × {v.cantidad}</span>
                                <span className="text-sm font-medium">${v.total_venta.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {editando && (
                    <div className="border border-pink-200 rounded-2xl p-4 bg-pink-50 space-y-3">
                        <p className="text-sm font-medium text-pink-700">{editando.producto}</p>
                        <p className="text-xs text-pink-500">Costo unitario: ${editando.costo_unitario.toFixed(2)}</p>
                        <div className="flex gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-500">Cantidad</label>
                                <input type="number" min={1} value={editForm.cantidad}
                                    onChange={e => setEditForm(f => ({ ...f, cantidad: +e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-pink-300" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-500">Precio real</label>
                                <input type="number" min={0} step="0.01" value={editForm.precio_real}
                                    onChange={e => setEditForm(f => ({ ...f, precio_real: +e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-pink-300" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Total recalculado: ${(editForm.cantidad * editForm.precio_real).toFixed(2)} ·
                            Ganancia: ${((editForm.precio_real - editando.costo_unitario) * editForm.cantidad).toFixed(2)}
                        </p>
                        <div className="flex gap-2">
                            <button onClick={guardarEdicion} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm rounded-xl">💾 Guardar</button>
                            <button onClick={() => eliminarVenta(editando.id)} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-xl">🗑 Eliminar</button>
                            <button onClick={() => setEditando(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-xl">Cancelar</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
