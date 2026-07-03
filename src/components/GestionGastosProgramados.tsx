"use client"
// ==============================================================================
// src/components/GestionGastosProgramados.tsx
// Componente compartido: formulario + listado de reglas de gastos programados.
// Se usa tanto en /gastos/programados como en la pestania "Gastos Programados"
// dentro de /gastos.
// ==============================================================================

import { useState, useEffect } from "react"
import { api, GastoProgramado } from "@/lib/api"
import Icon from "@/components/ui/Icon"

const TIPOS = ["fijo", "porcentaje"]
const FRECUENCIAS = ["semanal", "mensual", "anual"]

const ETIQUETAS: Record<string, string> = {
    fijo: "Fijo ($)",
    porcentaje: "Porcentaje (%)",
    semanal: "Semanal",
    mensual: "Mensual",
    anual: "Anual",
}

export default function GestionGastosProgramados() {
    const [reglas, setReglas] = useState<GastoProgramado[]>([])
    // Estimaciones de monto por regla: { [regla_id]: monto_estimado }
    // Se cargan al listar reglas para mostrar siempre el valor que se descontará.
    const [estimaciones, setEstimaciones] = useState<Record<string, number>>({})
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [ejecutando, setEjecutando] = useState<string | null>(null)
    const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
    /**
     * Estado para el modal de confirmación de pago de gasto programado.
     * Cuando no es null, se muestra un modal en lugar del confirm() nativo.
     */
    const [pagoConfirmar, setPagoConfirmar] = useState<{
        id: string
        nombre: string
        montoEstimado: number
        fechaPago: string
        esAnticipado: boolean
    } | null>(null)

    const [form, setForm] = useState({
        nombre: "",
        tipo: "fijo" as string,
        valor: "",
        frecuencia: "mensual",
        proxima_fecha: new Date().toISOString().substring(0, 10),
    })

    async function recargar() {
        // Si el fetch falla, no limpiamos las reglas existentes.
        // Antes, un error 500 del backend dejaba el array vacío y las
        // reglas "desaparecían" de la UI aunque seguían en la base de datos.
        const r = await api.getGastosProgramados()
        setReglas(r)

        // Cargar estimaciones de monto para cada regla porcentual.
        // Esto permite mostrar siempre el valor que se descontará al pagar,
        // incluso si la fecha aún no ha llegado o si el monto es $0.
        const nuevasEstimaciones: Record<string, number> = {}
        await Promise.all(r.map(async (regla) => {
            try {
                const est = await api.estimarMontoGastoProgramado(regla.id)
                if (est.ok) {
                    nuevasEstimaciones[regla.id] = est.monto
                }
            } catch {
                // Si la estimación falla, usamos ultimo_monto o 0
                nuevasEstimaciones[regla.id] = regla.ultimo_monto ?? 0
            }
        }))
        setEstimaciones(nuevasEstimaciones)
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

    /**
     * Abre el modal de confirmación en lugar del confirm() nativo.
     * Prepara los datos necesarios y los guarda en el estado pagoConfirmar.
     */
    function abrirModalConfirmacion(id: string, nombre: string) {
        const regla = reglas.find(r => r.id === id)
        if (!regla) return

        const montoEstimado = estimaciones[id] ?? regla.ultimo_monto ?? 0
        const fechaPago = regla.proxima_fecha.split('-').reverse().join('/')
        const hoy = new Date().toISOString().substring(0, 10)
        const esAnticipado = regla.proxima_fecha > hoy

        setPagoConfirmar({ id, nombre, montoEstimado, fechaPago, esAnticipado })
    }

    /**
     * Ejecuta la regla luego de que el usuario confirma en el modal.
     * Llama a la API y muestra el resultado.
     */
    async function ejecutarReglaConfirmada() {
        if (ejecutando || !pagoConfirmar) return

        const { id } = pagoConfirmar
        setEjecutando(id)
        setPagoConfirmar(null) // cerrar modal
        try {
            const res = await api.ejecutarGastoProgramado(id)
            if (res.ok) {
                mostrarMsg(true, `✅ ${res.mensaje}`)
            } else {
                mostrarMsg(false, `❌ ${res.mensaje || "Error al ejecutar"}`)
            }
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al ejecutar la regla"}`)
        } finally {
            setEjecutando(null)
            // Recargar en finally para que se ejecute tanto en éxito como en error.
            // Si recargar falla, no limpiamos las reglas existentes (ya manejado en recargar()).
            recargar().catch(() => {})
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

    function valorMostrado(g: GastoProgramado) {
        if (g.tipo === "porcentaje") {
            // Mostrar siempre el monto estimado en $, nunca "Pendiente".
            // La estimación se calcula contra la ganancia neta del período actual.
            // Si es $0 (sin ganancias), mostramos $0.00 — es información útil.
            const estimado = estimaciones[g.id] ?? g.ultimo_monto ?? 0
            return `$${estimado.toFixed(2)}`
        }
        return `$${g.valor.toFixed(2)}`
    }

    // Etiqueta dinámica del tipo: incluye el valor del porcentaje si aplica.
    // Ej: "Porcentaje (10%)" en vez de solo "Porcentaje (%)"
    function tipoLabel(g: GastoProgramado) {
        if (g.tipo === "porcentaje") {
            return `Porcentaje (${g.valor}%)`
        }
        return ETIQUETAS[g.tipo] || g.tipo
    }

    function frecuenciaLabel(f: string) {
        return ETIQUETAS[f] || f
    }

    const totalMensual = reglas
        .reduce((acc, r) => {
            if (r.tipo === "fijo") return acc + r.valor
            return acc
        }, 0)

    return (
        <>
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
                                            {tipoLabel(g)}
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
                                                onClick={() => abrirModalConfirmacion(g.id, g.nombre)}
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

            {/* ── Modal de confirmación para pagar gasto programado ── */}
            {pagoConfirmar && (
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
                                background: "#e0f2fe", display: "flex",
                                alignItems: "center", justifyContent: "center", flexShrink: 0
                            }}>
                                <Icon name="DollarSign" size={24} color="#0284c7" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                    Pagar gasto programado
                                </h3>
                                <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    {pagoConfirmar.nombre}
                                </p>
                            </div>
                        </div>

                        <div style={{
                            padding: "16px 20px", borderRadius: 10,
                            background: "var(--bg-card2)", border: "1px solid var(--border-light)",
                            display: "flex", flexDirection: "column", gap: 10
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)" }}>Monto a descontar</span>
                                <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)" }}>
                                    ${pagoConfirmar.montoEstimado.toFixed(2)}
                                </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)" }}>Fecha programada</span>
                                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-main)" }}>
                                    {pagoConfirmar.fechaPago}
                                </span>
                            </div>
                        </div>

                        {/* Advertencia si es un pago anticipado */}
                        {pagoConfirmar.esAnticipado && (
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
                                        Pago anticipado
                                    </p>
                                    <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#8a5e00", fontWeight: 500 }}>
                                        La fecha programada es el <strong>{pagoConfirmar.fechaPago}</strong> (aún no llega).
                                        Se descontarán <strong>${pagoConfirmar.montoEstimado.toFixed(2)}</strong> de tu ganancia neta del período.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                            <button
                                onClick={() => setPagoConfirmar(null)}
                                disabled={ejecutando !== null}
                                style={{
                                    padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card2)", color: "var(--text-main)",
                                    fontWeight: 700, fontSize: "0.82rem", cursor: ejecutando !== null ? "not-allowed" : "pointer",
                                    transition: "all 0.15s"
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={ejecutarReglaConfirmada}
                                disabled={ejecutando !== null}
                                style={{
                                    padding: "10px 20px", borderRadius: 10, border: "none",
                                    background: ejecutando !== null ? "#ccc" : "var(--primary-mid)",
                                    color: ejecutando !== null ? "#999" : "#fff",
                                    fontWeight: 700, fontSize: "0.82rem",
                                    cursor: ejecutando !== null ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", gap: 8,
                                    transition: "all 0.15s"
                                }}
                            >
                                {ejecutando !== null ? (
                                    <><Icon name="Hourglass" size={16} color="#999" /> Procesando...</>
                                ) : (
                                    <><Icon name="DollarSign" size={16} color="#fff" /> Sí, pagar</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
