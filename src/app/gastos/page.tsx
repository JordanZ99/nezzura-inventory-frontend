"use client"
import { useState, useEffect } from "react"
import { api, Gasto } from "@/lib/api"

const CATEGORIAS = [
    "Gasto de evento (bazar, renta)",
    "Decoración / utilería",
    "Envíos y paquetería",
    "Otro gasto",
]

const COLORES: Record<string, string> = {
    "Gasto de evento (bazar, renta)": "#d74e80",
    "Decoración / utilería": "#f4a261",
    "Envíos y paquetería": "#457b9d",
    "Otro gasto": "#2a9d8f",
}

export default function Gastos() {
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [cargando, setCargando] = useState(true)
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    const [form, setForm] = useState({
        fecha: new Date().toISOString().slice(0, 10),
        categoria: CATEGORIAS[0], descripcion: "", monto: "",
    })

    async function recargar() {
        const g = await api.getGastos()
        setGastos(g)
    }

    useEffect(() => { recargar().finally(() => setCargando(false)) }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto })
        setTimeout(() => setMsg(null), 3000)
    }

    async function guardar() {
        const monto = parseFloat(form.monto)
        if (!monto || monto <= 0) { mostrarMsg(false, "❌ Monto inválido"); return }
        try {
            await api.crearGasto({ ...form, monto, fecha: form.fecha + "T00:00:00" })
            mostrarMsg(true, `✅ $${monto.toFixed(2)} registrado`)
            setForm(f => ({ ...f, descripcion: "", monto: "" }))
            recargar()
        } catch (e: any) { mostrarMsg(false, `❌ ${e.message}`) }
    }

    async function eliminar(id: number) {
        if (!confirm("¿Eliminar este gasto?")) return
        try {
            await api.eliminarGasto(id)
            mostrarMsg(true, "✅ Eliminado")
            recargar()
        } catch (e: any) { mostrarMsg(false, `❌ ${e.message}`) }
    }

    const total = gastos.reduce((a, g) => a + g.monto, 0)
    const mayor = gastos.reduce((m, g) => g.monto > m.monto ? g : m, gastos[0] ?? { monto: 0, descripcion: "—" })
    const porCat = CATEGORIAS.map(c => ({ c, t: gastos.filter(g => g.categoria === c).reduce((a, g) => a + g.monto, 0) })).filter(x => x.t > 0)
    const maxCat = Math.max(...porCat.map(x => x.t), 1)

    if (cargando) return <div className="p-8 text-center text-gray-500">Cargando...</div>

    return (
        <div className="p-6 max-w-3xl">
            <h1 className="text-2xl font-bold text-pink-600 mb-6">💸 Gastos</h1>

            {/* Formulario */}
            <div className="border border-gray-100 rounded-2xl p-5 mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">➕ Registrar Nuevo Gasto</h2>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400">Fecha</label>
                        <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400">Categoría</label>
                        <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 items-end">
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs text-gray-400">Descripción</label>
                        <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                            placeholder="Ej: Stand en Bazar Chopo"
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    </div>
                    <div className="flex flex-col gap-1 w-28">
                        <label className="text-xs text-gray-400">Monto ($)</label>
                        <input type="text" inputMode="decimal" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                            placeholder="0.00"
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    </div>
                    <button onClick={guardar}
                        className="px-5 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-xl transition-colors">
                        Registrar
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {msg.texto}
                </div>
            )}

            {gastos.length > 0 && <>
                {/* Métricas */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { label: "Total gastado", valor: `$${total.toFixed(2)}` },
                        { label: "Mayor gasto", valor: `$${mayor.monto.toFixed(2)}` },
                        { label: "Concepto", valor: mayor.descripcion?.slice(0, 20) ?? "—" },
                    ].map(m => (
                        <div key={m.label} className="bg-gray-50 rounded-2xl p-4">
                            <p className="text-xs text-gray-400 mb-1">{m.label}</p>
                            <p className="text-lg font-bold text-gray-800 truncate">{m.valor}</p>
                        </div>
                    ))}
                </div>

                {/* Gráfica horizontal por categoría */}
                <div className="border border-gray-100 rounded-2xl p-4 mb-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">📊 Por Categoría</h2>
                    <div className="space-y-3">
                        {porCat.map(({ c, t }) => (
                            <div key={c}>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>{c}</span><span>${t.toFixed(2)}</span>
                                </div>
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${(t / maxCat) * 100}%`, backgroundColor: COLORES[c] ?? "#888" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Historial */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50">
                        <h2 className="text-sm font-semibold text-gray-700">🧾 Historial</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {gastos.map(g => (
                            <div key={g.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{g.descripcion || g.categoria}</p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(g.fecha).toLocaleDateString("es-MX")} · {g.categoria}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-gray-700">${g.monto.toFixed(2)}</span>
                                    <button onClick={() => eliminar(g.id)} className="text-gray-300 hover:text-red-400 text-xs">🗑</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>}

            {gastos.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Aún no hay gastos registrados.</p>}
        </div>
    )
}
