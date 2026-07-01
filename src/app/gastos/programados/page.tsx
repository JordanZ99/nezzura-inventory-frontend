"use client"
// ==============================================================================
// src/app/gastos/programados/page.tsx
// Gestión de gastos programados: form de creación + listado de reglas activas.
// ==============================================================================

import { useState, useEffect } from "react"
import { api, GastoProgramado } from "@/lib/api"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

const TIPOS = ["fijo", "porcentaje"]
const FRECUENCIAS = ["semanal", "mensual", "anual"]

const ETIQUETAS: Record<string, string> = {
    fijo: "Fijo ($)",
    porcentaje: "Porcentaje (%)",
    semanal: "Semanal",
    mensual: "Mensual",
    anual: "Anual",
}

export default function GastosProgramados() {
    const [reglas, setReglas] = useState<GastoProgramado[]>([])
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [ejecutando, setEjecutando] = useState<string | null>(null)
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

    const [form, setForm] = useState({
        nombre: "",
        tipo: "fijo",
        valor: "",
        frecuencia: "mensual",
        proxima_fecha: new Date().toISOString().substring(0, 10),
    })

    async function recargar() {
        const r = await api.getGastosProgramados()
        setReglas(r)
    }

    useEffect(() => {
        recargar()
            .catch(e => {
                console.error("Error al cargar reglas programadas:", e)
                mostrarMsg(false, `Error al cargar reglas: ${e.message}`)
            })
            .finally(() => setCargando(false))
    }, [])

    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto }); setTimeout(() => setMsg(null), 3500)
    }

    async function ejecutarRegla(id: string, nombre: string) {
        if (ejecutando) return
        setEjecutando(id)
        try {
            const res = await api.ejecutarGastoProgramado(id)
            if (res.ok) {
                mostrarMsg(true, `✅ ${res.mensaje}`)
            } else {
                mostrarMsg(false, `❌ ${res.mensaje || "Error al ejecutar"}`)
            }
            await recargar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al ejecutar la regla"}`)
        } finally {
            setEjecutando(null)
        }
    }

    async function guardar() {
        const valor = parseFloat(form.valor)
        if (!form.nombre || isNaN(valor) || valor <= 0 || guardando) return

        setGuardando(true)
        try {
            await api.crearGastoProgramado({
                nombre: form.nombre,
                tipo: form.tipo,
                valor,
                frecuencia: form.frecuencia,
                proxima_fecha: form.proxima_fecha,
            })
            mostrarMsg(true, `✅ Regla "${form.nombre}" creada correctamente`)
            setForm(f => ({
                ...f,
                nombre: "",
                valor: "",
                proxima_fecha: new Date().toISOString().substring(0, 10),
            }))
            await recargar()
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al crear la regla"}`)
        } finally {
            setGuardando(false)
        }
    }

    // ---- Calcular valor mostrado según el tipo ----
    function valorMostrado(g: GastoProgramado) {
        if (g.tipo === "porcentaje") return `${g.valor}%`
        return `$${g.valor.toFixed(2)}`
    }

    // ---- Frecuencia en español ----
    function frecuenciaLabel(f: string) {
        return ETIQUETAS[f] || f
    }

    const totalMensual = reglas
        .reduce((acc, r) => {
            if (r.tipo === "fijo") return acc + r.valor
            return acc // los porcentajes no se suman aquí
        }, 0)

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero ── */}
            <div style={{
                position: "relative", overflow: "hidden",
                background: "var(--gradient-4)", padding: "32px 24px 90px"
            }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                    <Antigravity
                        count={300} magnetRadius={10} ringRadius={6}
                        waveSpeed={0.4} waveAmplitude={1} particleSize={1.2}
                        lerpSpeed={0.06} color="var(--ag-color-4)" autoAnimate={true}
                        particleVariance={0.7} rotationSpeed={0.2} depthFactor={0.4}
                        pulseSpeed={1.5} particleShape="capsule" fieldStrength={6}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>
                        GASTOS PROGRAMADOS
                    </p>
                    <h1 className="hidden md:flex" style={{
                        color: "var(--primary-soft)", fontSize: "1.7rem",
                        fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10
                    }}>
                        <div style={{ marginLeft: "-5px" }}>
                            <Icon name="CalendarClock" size={32} color="var(--primary-soft)" />
                        </div>
                        Gastos Programados
                    </h1>
                </div>
            </div>

            <div style={{ padding: "0 16px", marginTop: -60 }}>
                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="Repeat" size={32} color="var(--primary-alter)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                                Reglas Creadas
                            </p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-alter)" }}>
                                {reglas.length}
                            </p>
                        </div>
                    </div>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="BanknoteArrowDown" size={32} color="var(--primary-pale)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                                Total Fijo/Mes
                            </p>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.25rem", color: "var(--primary-pale)" }}>
                                ${totalMensual.toFixed(0)}
                            </p>
                        </div>
                    </div>
                </div>

                {msg && (
                    <div className="card fade-up" style={{
                        padding: "12px 16px", marginBottom: 16,
                        borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#ef4444"}`,
                        color: msg.ok ? "#2e7d32" : "#b91c1c",
                        fontSize: "0.9rem", fontWeight: 700
                    }}>
                        {msg.texto}
                    </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>

                    {/* ── Formulario ── */}
                    <div className="card fade-up" style={{ padding: 20, flex: "1 1 320px", maxWidth: 420 }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 800 }}>
                            <span style={{ marginRight: 6, verticalAlign: "middle", display: "inline-flex" }}>
                                <Icon name="CirclePlus" size={18} />
                            </span>
                            Nueva Regla
                        </h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {/* Nombre */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Nombre
                                </label>
                                <input
                                    className="input-primary"
                                    placeholder="Ej: Renta, luz, agua..."
                                    value={form.nombre}
                                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                                />
                            </div>

                            {/* Tipo */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Tipo
                                </label>
                                <select
                                    className="input-primary"
                                    value={form.tipo}
                                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                                >
                                    {TIPOS.map(t => <option key={t} value={t}>{ETIQUETAS[t]}</option>)}
                                </select>
                            </div>

                            {/* Valor */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    {form.tipo === "porcentaje" ? "Porcentaje (%)" : "Monto ($)"}
                                </label>
                                <input
                                    type="number"
                                    step={form.tipo === "porcentaje" ? "1" : "0.01"}
                                    min="0"
                                    className="input-primary"
                                    placeholder={form.tipo === "porcentaje" ? "Ej: 10" : "Ej: 500.00"}
                                    value={form.valor}
                                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                                />
                                {form.tipo === "porcentaje" && (
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                                        El porcentaje se calcula sobre la ganancia neta del período.
                                    </span>
                                )}
                            </div>

                            {/* Frecuencia */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Frecuencia
                                </label>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {FRECUENCIAS.map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, frecuencia: f }))}
                                            style={{
                                                flex: 1,
                                                padding: "8px 0",
                                                borderRadius: 10,
                                                border: form.frecuencia === f
                                                    ? "2px solid var(--primary-mid)"
                                                    : "1.5px solid var(--border-primary)",
                                                background: form.frecuencia === f
                                                    ? "var(--primary-pale)"
                                                    : "transparent",
                                                color: form.frecuencia === f
                                                    ? "var(--primary-dark)"
                                                    : "var(--text-muted)",
                                                fontWeight: 700,
                                                fontSize: "0.75rem",
                                                cursor: "pointer",
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {ETIQUETAS[f]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fecha de inicio */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Próxima Fecha
                                </label>
                                <input
                                    type="date"
                                    className="input-primary"
                                    value={form.proxima_fecha}
                                    onChange={e => setForm(f => ({ ...f, proxima_fecha: e.target.value }))}
                                />
                            </div>

                            <button
                                className="btn-primary"
                                style={{ marginTop: 8 }}
                                onClick={guardar}
                                disabled={!form.nombre || !form.valor || parseFloat(form.valor) <= 0 || !form.proxima_fecha || guardando}
                            >
                                <span style={{ marginRight: 6, verticalAlign: "middle", display: "inline-flex" }}>
                                    <Icon name={guardando ? "Loader" : "Save"} size={16} className={guardando ? "animate-spin" : ""} />
                                </span>
                                {guardando ? "Guardando..." : "Guardar Regla"}
                            </button>
                        </div>
                    </div>

                    {/* ── Listado ── */}
                    <div className="card fade-up" style={{ flex: "1 1 420px", overflow: "hidden" }}>
                        <div style={{
                            padding: "14px 20px",
                            borderBottom: "1px solid var(--border-primary)",
                            backgroundColor: "var(--bg-card)",
                        }}>
                            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>
                                <span style={{ marginRight: 6, verticalAlign: "middle", display: "inline-flex" }}>
                                    <Icon name="ListChecks" size={18} />
                                </span>
                                Reglas Configuradas
                            </h3>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                    <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                        {["Nombre", "Tipo", "Valor", "Frecuencia", "Próx. Fecha", "Acciones"].map(h => (
                                            <th key={h} style={{
                                                padding: "10px 14px", textAlign: "left",
                                                fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase"
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reglas.map(g => (
                                        <tr key={g.id} style={{ borderBottom: "1px solid var(--bg-card)" }} className="hover:bg-primary-50/20">
                                            <td style={{ padding: "12px 14px", fontWeight: 600 }}>{g.nombre}</td>
                                            <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                                                {ETIQUETAS[g.tipo] || g.tipo}
                                            </td>
                                            <td style={{ padding: "12px 14px", fontWeight: 700 }}>
                                                {valorMostrado(g)}
                                            </td>
                                            <td style={{ padding: "12px 14px" }}>
                                                <span style={{
                                                    fontSize: "0.7rem", fontWeight: 700,
                                                    background: "#ede9fe", color: "#6d28d9",
                                                    padding: "3px 8px", borderRadius: 12,
                                                }}>
                                                    {frecuenciaLabel(g.frecuencia)}
                                                </span>
                                            </td>
                                            <td style={{ padding: "12px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                                {g.proxima_fecha.split('-').reverse().join('/')}
                                            </td>
                                            <td style={{ padding: "12px 14px" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => ejecutarRegla(g.id, g.nombre)}
                                                    disabled={ejecutando === g.id}
                                                    title={g.tipo === "porcentaje"
                                                        ? "Calcular porcentaje sobre la ganancia neta del período"
                                                        : "Registrar pago de monto fijo"}
                                                    style={{
                                                        display: "inline-flex", alignItems: "center", gap: 4,
                                                        padding: "6px 12px", borderRadius: 8,
                                                        border: "none",
                                                        background: ejecutando === g.id
                                                            ? "var(--border-primary)"
                                                            : "var(--primary-pale)",
                                                        color: ejecutando === g.id
                                                            ? "var(--text-muted)"
                                                            : "var(--primary-dark)",
                                                        fontWeight: 700, fontSize: "0.75rem",
                                                        cursor: ejecutando === g.id ? "not-allowed" : "pointer",
                                                        transition: "all 0.15s",
                                                    }}
                                                >
                                                    <Icon
                                                        name={ejecutando === g.id ? "Loader" : "DollarSign"}
                                                        size={14}
                                                        className={ejecutando === g.id ? "animate-spin" : ""}
                                                    />
                                                    {ejecutando === g.id ? "Calculando..." : "Pagar"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {reglas.length === 0 && !cargando && (
                                        <tr>
                                            <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                                                <span style={{ display: "block", margin: "0 auto 8px", opacity: 0.4, textAlign: "center" }}>
                                                    <Icon name="CalendarX" size={32} />
                                                </span>
                                                No hay reglas de gastos programados.<br />
                                                Crea una usando el formulario de la izquierda.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div style={{ height: 48 }} />
            </div>
        </div>
    )
}
