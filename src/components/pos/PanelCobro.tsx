// ==============================================================================
// src/components/pos/PanelCobro.tsx
// Panel de cobro del carrito (Fase A): se muestra en lugar de la lista de
// productos al activar el engranaje. Subtotal editable (descuento directo),
// propina con atajos, método de pago (efectivo/débito/crédito/mixto),
// cálculo de cambio y validación de pagos mixtos. Todo el estado viene de
// usePosCarrito vía props (componente tonto).
// ==============================================================================

import Icon from "@/components/ui/Icon"
import type { MetodoCobro, MetodoPagoSimple, LineaPagoMixto, ClientePos } from "@/hooks/usePosCarrito"
import type { Terminal } from "@/lib/api"

interface Props {
    abierto: boolean
    totalCarrito: number
    subtotalAlAbrir: number
    totalAPagar: number
    cambio: number
    sumaMixta: number
    faltanteMixto: number
    metodoPago: MetodoCobro
    setMetodoPago: (m: MetodoCobro) => void
    propina: string
    setPropina: (v: string) => void
    montoRecibido: string
    setMontoRecibido: (v: string) => void
    pagosMixtos: LineaPagoMixto[]
    setLineaMixta: (idx: number, campo: "metodo" | "monto" | "terminal_id", valor: string) => void
    agregarLineaMixta: () => void
    quitarLineaMixta: (idx: number) => void
    terminalId: string
    setTerminalId: (v: string) => void
    terminales: Terminal[]
    comisionEstimada: (metodo: MetodoPagoSimple, monto: number, terminalId: string) => number
    aplicarSubtotal: (texto: string) => void
    modoDescuento: boolean
    manejarToggleDescuento: () => void
    volver: () => void
    // ── Cliente + puntos (Fase B) — opcionales: solo el POS clásico los envía ──
    mostrarCliente?: boolean
    cliente?: ClientePos | null
    abrirModalCliente?: () => void
    quitarCliente?: () => void
    puntosActivos?: boolean
    valorPunto?: number
    puntosCanjeNum?: number
    valorCanje?: number
    cambiarPuntosCanje?: (v: string) => void
    topeCanje?: number
    puntosGanadosEstimados?: number
    saldoTrasCobro?: number
    ajusteNum?: number
    cambiarAjustePuntos?: (v: string) => void
    conceptoAjuste?: string
    setConceptoAjuste?: (v: string) => void
    totalAPagarDinero?: number
}

const ETIQUETAS_METODO: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta_debito: "Débito",
    tarjeta_credito: "Crédito",
    mixto: "Mixto",
}

const inputStyle = {
    width: "100%",
    fontSize: "0.8rem",
    padding: "7px 9px",
    borderRadius: 8,
    border: "1px solid var(--border-primary)",
    background: "var(--bg-card2)",
    color: "var(--text-main)",
    outline: "none",
    fontWeight: 600,
} as const

export function PanelCobro({
    abierto,
    totalCarrito,
    subtotalAlAbrir,
    totalAPagar,
    cambio,
    sumaMixta,
    faltanteMixto,
    metodoPago,
    setMetodoPago,
    propina,
    setPropina,
    montoRecibido,
    setMontoRecibido,
    pagosMixtos,
    setLineaMixta,
    agregarLineaMixta,
    quitarLineaMixta,
    terminalId,
    setTerminalId,
    terminales,
    comisionEstimada,
    aplicarSubtotal,
    modoDescuento,
    manejarToggleDescuento,
    volver,
    // ── Cliente + puntos (Fase B) ──
    mostrarCliente = false,
    cliente = null,
    abrirModalCliente,
    quitarCliente,
    puntosActivos = false,
    valorPunto = 1,
    puntosCanjeNum = 0,
    valorCanje = 0,
    cambiarPuntosCanje,
    topeCanje = 0,
    puntosGanadosEstimados = 0,
    saldoTrasCobro = 0,
    ajusteNum = 0,
    cambiarAjustePuntos,
    conceptoAjuste = "",
    setConceptoAjuste,
    totalAPagarDinero,
}: Props) {
    if (!abierto) return null

    const propinaNum = parseFloat(propina.replace(",", ".")) || 0
    const recibidoNum = parseFloat(montoRecibido.replace(",", "."))
    // Lo que realmente queda por pagar en dinero (el canje de puntos cubre productos)
    const dineroAPagar = totalAPagarDinero ?? totalAPagar
    const efectivoInsuficiente = metodoPago === "efectivo" && montoRecibido.trim() !== "" && recibidoNum < dineroAPagar - 0.005

    /** Selector de terminal + comisión estimada para un pago con tarjeta */
    function bloqueTerminal(metodo: MetodoPagoSimple, monto: number, valor: string, onCambiar: (v: string) => void) {
        const com = comisionEstimada(metodo, monto, valor)
        return (
            <div style={{ marginTop: 4 }}>
                <select value={valor} onChange={e => onCambiar(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">Sin terminal (comisión $0)</option>
                    {terminales.map(t => (
                        <option key={t.id} value={t.id}>
                            {t.nombre}{t.banco ? ` · ${t.banco}` : ""}
                        </option>
                    ))}
                </select>
                {com > 0 && (
                    <p style={{ margin: "3px 0 0", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Comisión ≈ ${com.toFixed(2)} — depósito ≈ ${(monto - com).toFixed(2)}
                    </p>
                )}
            </div>
        )
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* ── Cliente + puntos (Fase B, migraciones 038/039) ──
                Se muestra HASTA ARRIBA de las opciones, tal como se pidió. ── */}
            {mostrarCliente && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Cliente</span>
                        {cliente && (
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)" }}>
                                {Math.round(cliente.saldo).toLocaleString("us")} pts (≈${(cliente.saldo * valorPunto).toFixed(2)})
                            </span>
                        )}
                    </div>
                    {cliente ? (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "var(--bg-card2)", border: "1px solid var(--border-primary)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                <Icon name="UserRound" size={16} color="var(--primary-alter)" />
                                <span style={{ fontSize: "0.8rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cliente.nombre}</span>
                            </div>
                            <button onClick={quitarCliente} title="Quitar cliente del ticket" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <Icon name="X" size={14} color="#b71c1c" />
                            </button>
                        </div>
                    ) : (
                        <button onClick={abrirModalCliente} className="btn-ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            <Icon name="UserRoundPlus" size={15} /> Añadir cliente
                        </button>
                    )}

                    {/* Pagar con puntos (canje) + ajuste manual */}
                    {cliente && puntosActivos && (
                        <div style={{ marginTop: 10 }}>
                            <div>
                                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                    Pagar con puntos (1 pt = ${valorPunto})
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                        type="number" min="0" max={topeCanje} step="1"
                                        value={puntosCanjeNum || ""}
                                        onChange={e => cambiarPuntosCanje?.(e.target.value)}
                                        placeholder="0 pts"
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: valorCanje > 0 ? "var(--primary-dark)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                                        −${valorCanje.toFixed(2)}
                                    </span>
                                </div>
                                <p style={{ margin: "4px 0 0", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                    Máximo {topeCanje} pts · al cobrar quedará en <strong style={{ color: "var(--text-main)" }}>{Math.max(0, Math.round(saldoTrasCobro)).toLocaleString("us")} pts</strong>
                                </p>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                    Ajuste manual (+ dar / − quitar)
                                </span>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <input
                                        type="number" step="1" value={ajusteNum || ""}
                                        onChange={e => cambiarAjustePuntos?.(e.target.value)}
                                        placeholder="Ej. −10" style={{ ...inputStyle, width: 90 }}
                                    />
                                    <input
                                        type="text" value={conceptoAjuste}
                                        onChange={e => setConceptoAjuste?.(e.target.value)}
                                        placeholder="Motivo (ej. promo 50%)" style={inputStyle}
                                    />
                                </div>
                                {ajusteNum !== 0 && puntosGanadosEstimados > 0 && (
                                    <p style={{ margin: "4px 0 0", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                        Esta venta generaría {puntosGanadosEstimados} pts por la regla de la casa.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Subtotal editable (descuento directo) */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Subtotal (productos)</span>
                    {Math.abs(totalCarrito - subtotalAlAbrir) > 0.005 && subtotalAlAbrir > 0 && (
                        <button
                            onClick={() => aplicarSubtotal(String(subtotalAlAbrir))}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", fontWeight: 700, color: "var(--primary-alter)", padding: 0 }}
                        >
                            Restaurar ${subtotalAlAbrir.toFixed(2)}
                        </button>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalCarrito ? totalCarrito.toFixed(2) : ""}
                        onChange={e => aplicarSubtotal(e.target.value)}
                        style={inputStyle}
                    />
                </div>
            </div>

            {/* Propina */}
            <div>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Propina</span>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    {["0", "10", "15", "20"].map(pct => (
                        <button
                            key={pct}
                            onClick={() => setPropina((totalCarrito * (Number(pct) / 100)).toFixed(2))}
                            style={{
                                flex: 1, padding: "5px 0", borderRadius: 8, border: "1px solid var(--border-primary)",
                                background: propina === (totalCarrito * (Number(pct) / 100)).toFixed(2) ? "var(--primary-mid)" : "var(--bg-card2)",
                                color: propina === (totalCarrito * (Number(pct) / 100)).toFixed(2) ? "#fff" : "var(--text-muted)",
                                fontWeight: 700, fontSize: "0.7rem", cursor: "pointer",
                            }}
                        >
                            {pct === "0" ? "Sin" : `${pct}%`}
                        </button>
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                    <input type="number" min="0" step="0.01" value={propina} onChange={e => setPropina(e.target.value)} style={inputStyle} />
                </div>
            </div>

            {/* Método de pago */}
            <div>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Método de pago</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {(Object.keys(ETIQUETAS_METODO) as MetodoCobro[]).map(m => (
                        <button
                            key={m}
                            onClick={() => setMetodoPago(m)}
                            style={{
                                padding: "8px 6px", borderRadius: 8, border: metodoPago === m ? "2px solid var(--primary-mid)" : "1px solid var(--border-primary)",
                                background: metodoPago === m ? "var(--primary-mid)" : "var(--bg-card2)",
                                color: metodoPago === m ? "#fff" : "var(--text-muted)",
                                fontWeight: 700, fontSize: "0.72rem", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                            }}
                        >
                            <Icon name={m === "efectivo" ? "Banknote" : m === "mixto" ? "Split" : "CreditCard"} size={13} />
                            {ETIQUETAS_METODO[m]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Específico por método */}
            {metodoPago === "efectivo" && (
                <div>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>¿Con cuánto pagó?</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                        <input type="number" min="0" step="0.01" value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)} placeholder={dineroAPagar.toFixed(2)} style={inputStyle} />
                    </div>
                    {efectivoInsuficiente ? (
                        <p style={{ margin: "6px 0 0", fontSize: "0.7rem", fontWeight: 700, color: "var(--error-text, #b71c1c)" }}>
                            Faltan ${(dineroAPagar - recibidoNum).toFixed(2)}
                        </p>
                    ) : (
                        <p style={{ margin: "6px 0 0", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                            Cambio: <span style={{ color: "var(--text-main)", fontWeight: 800 }}>${cambio.toFixed(2)}</span>
                        </p>
                    )}
                </div>
            )}

            {metodoPago === "tarjeta_debito" && bloqueTerminal("tarjeta_debito", dineroAPagar, terminalId, setTerminalId)}
            {metodoPago === "tarjeta_credito" && bloqueTerminal("tarjeta_credito", dineroAPagar, terminalId, setTerminalId)}

            {metodoPago === "mixto" && (
                <div>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Pagos</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pagosMixtos.map((linea, idx) => {
                            const montoLinea = parseFloat(linea.monto.replace(",", ".")) || 0
                            return (
                                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-card2)" }}>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <select
                                            value={linea.metodo}
                                            onChange={e => setLineaMixta(idx, "metodo", e.target.value)}
                                            style={{ ...inputStyle, width: "45%", cursor: "pointer" }}
                                        >
                                            <option value="efectivo">Efectivo</option>
                                            <option value="tarjeta_debito">Débito</option>
                                            <option value="tarjeta_credito">Crédito</option>
                                        </select>
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                                            <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                                            <input type="number" min="0" step="0.01" value={linea.monto}
                                                onChange={e => setLineaMixta(idx, "monto", e.target.value)} style={inputStyle} />
                                        </div>
                                        <button onClick={() => quitarLineaMixta(idx)} disabled={pagosMixtos.length <= 2}
                                            style={{ background: "none", border: "none", cursor: pagosMixtos.length <= 2 ? "not-allowed" : "pointer", color: "#b71c1c", opacity: pagosMixtos.length <= 2 ? 0.3 : 1 }}>
                                            <Icon name="X" size={14} />
                                        </button>
                                    </div>
                                    {(linea.metodo === "tarjeta_debito" || linea.metodo === "tarjeta_credito") &&
                                        bloqueTerminal(linea.metodo, montoLinea, linea.terminal_id, v => setLineaMixta(idx, "terminal_id", v))}
                                </div>
                            )
                        })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <button onClick={agregarLineaMixta}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700, color: "var(--primary-alter)", display: "flex", alignItems: "center", gap: 3, padding: 0 }}>
                            <Icon name="Plus" size={12} /> Agregar pago
                        </button>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: Math.abs(faltanteMixto) <= 0.01 ? "var(--text-muted)" : (faltanteMixto > 0 ? "#e65100" : "#2e7d32") }}>
                            {Math.abs(faltanteMixto) <= 0.01
                                ? "Cuadra ✓"
                                : faltanteMixto > 0
                                    ? `Faltan $${faltanteMixto.toFixed(2)}`
                                    : `Sobran $${Math.abs(faltanteMixto).toFixed(2)}`}
                        </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                        Suma: ${sumaMixta.toFixed(2)} de ${dineroAPagar.toFixed(2)}{valorCanje > 0 ? ` (${totalAPagar.toFixed(2)} con canje incluido)` : ""}
                    </p>
                </div>
            )}

            {/* Total a pagar */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: 10, background: "var(--bg-card2)", border: "1px solid var(--border-primary)",
            }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    {valorCanje > 0 ? "A pagar en dinero" : "Total a pagar"}{propinaNum > 0 ? " (con propina)" : ""}
                </span>
                <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary-dark)" }}>${dineroAPagar.toFixed(2)}</span>
            </div>
            {valorCanje > 0 && (
                <p style={{ margin: "-8px 0 0", fontSize: "0.68rem", fontWeight: 700, color: "var(--success-text, #2e7d32)", textAlign: "right" }}>
                    {puntosCanjeNum} pts cubren ${valorCanje.toFixed(2)} del ticket
                </p>
            )}

            {/* Extras: edición por renglón (la vieja función de descuento) */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}>
                <input type="checkbox" checked={modoDescuento} onChange={manejarToggleDescuento} />
                <Icon name="Tag" size={13} /> Editar precios renglón por renglón
            </label>

            <button onClick={volver} className="btn-ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="ChevronDown" size={15} /> Ver productos
            </button>
        </div>
    )
}
