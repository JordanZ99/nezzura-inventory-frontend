// ==============================================================================
// src/components/estadisticas/CardTurnos.tsx
// Corte de caja por turnos (Fase C): estado del turno abierto (esperado en
// vivo), cierre con arqueo (contar cajón vs esperado → diferencia) e historial
// de cortes cerrados.
// ==============================================================================

import { useState } from "react"
import Icon from "@/components/ui/Icon"
import { useTurnos } from "@/hooks/useTurnos"

export default function CardTurnos() {
    const { turnoAbierto, historial, cargando, abrir, cerrar } = useTurnos()
    const [apertura, setApertura] = useState("")
    const [contado, setContado] = useState("")
    const [notas, setNotas] = useState("")
    const [ocupado, setOcupado] = useState(false)

    async function manejarAbrir() {
        setOcupado(true)
        const ok = await abrir(parseFloat(apertura.replace(",", ".")) || 0)
        if (ok) setApertura("")
        setOcupado(false)
    }

    async function manejarCerrar() {
        if (!turnoAbierto) return
        const contadoNum = parseFloat(contado.replace(",", "."))
        if (isNaN(contadoNum) || contadoNum < 0) return
        setOcupado(true)
        await cerrar(turnoAbierto.id, contadoNum, notas.trim() || undefined)
        setContado(""); setNotas("")
        setOcupado(false)
    }

    return (
        <div className="card fade-up" style={{ padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="HandCoins" size={18} color="var(--primary-alter)" /> Corte de Caja (Turnos)
                </h2>
            </div>

            {cargando ? (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Cargando turnos...</p>
            ) : turnoAbierto ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 200px" }}>
                        <p style={{ margin: "0 0 4px", fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                            Turno abierto · {new Date(turnoAbierto.abierta_en).toLocaleString()}
                        </p>
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.78rem", fontWeight: 600 }}>
                            <span>Fondo: <b>${Number(turnoAbierto.monto_apertura).toFixed(2)}</b></span>
                            <span>Órdenes: <b>{turnoAbierto.num_ordenes}</b></span>
                            <span>Vendido: <b>${Number(turnoAbierto.total_turno).toFixed(2)}</b></span>
                            <span>Efectivo esperado: <b style={{ color: "var(--primary-dark)" }}>${Number(turnoAbierto.efectivo_esperado).toFixed(2)}</b></span>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input type="number" min="0" step="0.01" value={contado} onChange={e => setContado(e.target.value)}
                            placeholder="Efectivo contado $" style={{ width: 150, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", outline: "none", fontWeight: 600, fontSize: "0.8rem" }} />
                        <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas (opcional)"
                            style={{ width: 170, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", outline: "none", fontSize: "0.8rem" }} />
                        <button className="btn-primary" onClick={manejarCerrar} disabled={ocupado || contado === ""}>
                            <Icon name="Lock" size={14} /> Cerrar turno
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>No hay turno abierto. Fondo de caja:</span>
                    <input type="number" min="0" step="0.01" value={apertura} onChange={e => setApertura(e.target.value)} placeholder="0.00"
                        style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", outline: "none", fontWeight: 600, fontSize: "0.8rem" }} />
                    <button className="btn-primary" onClick={manejarAbrir} disabled={ocupado}>
                        <Icon name="Play" size={14} /> Abrir turno
                    </button>
                </div>
            )}

            {/* Historial de cortes cerrados */}
            {historial.length > 0 && (
                <div style={{ marginTop: 14, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                        <thead>
                            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                                {["Abierto", "Cerrado", "Fondo", "Efectivo esperado", "Contado", "Diferencia", "Notas"].map(h => (
                                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {historial.slice(0, 8).map(t => (
                                <tr key={t.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                    <td style={{ padding: "6px 10px" }}>{new Date(t.abierta_en).toLocaleString()}</td>
                                    <td style={{ padding: "6px 10px" }}>{t.cerrada_en ? new Date(t.cerrada_en).toLocaleString() : "—"}</td>
                                    <td style={{ padding: "6px 10px" }}>${Number(t.monto_apertura).toFixed(2)}</td>
                                    <td style={{ padding: "6px 10px" }}>${Number(t.efectivo_esperado ?? 0).toFixed(2)}</td>
                                    <td style={{ padding: "6px 10px" }}>${Number(t.efectivo_contado ?? 0).toFixed(2)}</td>
                                    <td style={{ padding: "6px 10px", fontWeight: 800, color: (t.diferencia ?? 0) === 0 ? "var(--text-muted)" : (t.diferencia ?? 0) > 0 ? "#2e7d32" : "#b71c1c" }}>
                                        {(t.diferencia ?? 0) >= 0 ? "+" : ""}${Number(t.diferencia ?? 0).toFixed(2)}
                                    </td>
                                    <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{t.notas || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
