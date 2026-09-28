// ==============================================================================
// src/components/personalizacion/CardPuntosConfig.tsx
// Tarjeta "Sistema de puntos" (tab Mi Negocio):
//  - Valor del punto (1 punto = $X al canjear; default 1. Editable: 100 pts
//    = $1 → poner 0.01).
//  - Regla de ganancia: "X puntos por cada $Y de compra" o puntos fijos por
//    venta, con preview en vivo de una venta de ejemplo.
// Config en el backend (tenants.*, migración 039). El ledger de movimientos
// es la única fuente del saldo (database/puntos.py).
// ==============================================================================

import { useEffect, useState } from "react"
import Icon from "@/components/ui/Icon"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"

interface Props {
    cargandoTenant: boolean
}

const VENTA_PREVIEW = 300

export function CardPuntosConfig({ cargandoTenant }: Props) {
    const { tenant, actualizar, } = useTenant()
    const { mostrarMsg } = useToast()

    const [activo, setActivo] = useState(false)
    const [modo, setModo] = useState<"por_gasto" | "fijo">("por_gasto")
    const [valorPunto, setValorPunto] = useState("1")
    const [gastoMonto, setGastoMonto] = useState("10")
    const [gastoPts, setGastoPts] = useState("1")
    const [fijos, setFijos] = useState("5")
    const [guardando, setGuardando] = useState(false)

    useEffect(() => {
        if (tenant) {
            setActivo(tenant.puntos_activos)
            setModo(tenant.puntos_modo)
            setValorPunto(String(tenant.puntos_valor_punto))
            setGastoMonto(String(tenant.puntos_gasto_monto))
            setGastoPts(String(tenant.puntos_gasto_pts))
            setFijos(String(tenant.puntos_fijos ?? 5))
        }
    }, [tenant])

    // ── Preview de la regla de ganancia (redondeo al entero más cercano) ──
    const previewValorPunto = parseFloat(valorPunto) || 0
    const previewGanancia = modo === "fijo"
        ? Math.round(parseFloat(fijos) || 0)
        : Math.round(((parseFloat(gastoPts) || 0) * VENTA_PREVIEW) / (parseFloat(gastoMonto) || 1))
    const previewValorCanje = Math.round(previewGanancia * previewValorPunto * 100) / 100

    const errores: string[] = []
    if (previewValorPunto <= 0) errores.push("El valor del punto debe ser mayor a 0")
    if (modo === "por_gasto") {
        if ((parseFloat(gastoMonto) || 0) <= 0) errores.push("El monto por gasto debe ser mayor a 0")
        if ((parseInt(gastoPts, 10) || 0) < 1) errores.push("Debes dar al menos 1 punto por gasto")
    }
    if (modo === "fijo" && (parseInt(fijos, 10) || 0) < 0) errores.push("Los puntos fijos no pueden ser negativos")

    async function guardar() {
        if (errores.length > 0) {
            mostrarMsg(false, `❌ ${errores[0]}`)
            return
        }
        setGuardando(true)
        try {
            await actualizar({
                puntos_activos: activo,
                puntos_valor_punto: parseFloat(valorPunto),
                puntos_modo: modo,
                puntos_gasto_monto: parseFloat(gastoMonto),
                puntos_gasto_pts: parseInt(gastoPts, 10),
                puntos_fijos: modo === "fijo" ? parseInt(fijos, 10) : null,
            })
            mostrarMsg(true, activo ? "✅ Sistema de puntos actualizado" : "Sistema de puntos desactivado")
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al guardar"}`)
        } finally {
            setGuardando(false)
        }
    }

    const inputStyle = {
        width: "100%", fontSize: "0.78rem", padding: "8px 10px", borderRadius: 8,
        border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
        color: "var(--text-main)", outline: "none", fontWeight: 600,
    } as const

    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 340px", maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Sistema de Puntos</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>
                Recompensa a tus clientes: los puntos que ganan se usan como dinero en el POS.
            </p>

            {/* Toggle maestro */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", marginBottom: 18 }}>
                <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} style={{ marginTop: 2 }} />
                <span>Activar puntos de fidelidad (requiere tener la cartera de clientes activa).</span>
            </label>

            {/* Valor del punto */}
            <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                    Cuánto vale 1 punto
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 800, whiteSpace: "nowrap" }}>1 punto = $</span>
                    <input
                        inputMode="decimal" value={valorPunto}
                        onChange={e => setValorPunto(e.target.value.replace(/[^0-9.]/g, ""))}
                        style={{ ...inputStyle, maxWidth: 120 }}
                    />
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    ¿Quieres inflar los puntos? Para que 100 puntos valgan $1, escribe 0.01.
                </p>
            </div>

            {/* Regla de ganancia */}
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Cómo ganan puntos tus clientes
            </span>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button onClick={() => setModo("por_gasto")} style={chip(modo === "por_gasto")}>
                    <Icon name="TrendingUp" size={14} /> Por gasto
                </button>
                <button onClick={() => setModo("fijo")} style={chip(modo === "fijo")}>
                    <Icon name="Hash" size={14} /> Fijos por venta
                </button>
            </div>

            {modo === "por_gasto" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input inputMode="numeric" value={gastoPts} onChange={e => setGastoPts(e.target.value.replace(/[^0-9]/g, ""))} style={{ ...inputStyle, maxWidth: 64 }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>puntos por cada $</span>
                    <input inputMode="decimal" value={gastoMonto} onChange={e => setGastoMonto(e.target.value.replace(/[^0-9.]/g, ""))} style={{ ...inputStyle, maxWidth: 90 }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>de compra</span>
                </div>
            ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input inputMode="numeric" value={fijos} onChange={e => setFijos(e.target.value.replace(/[^0-9]/g, ""))} style={{ ...inputStyle, maxWidth: 80 }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>puntos por cada venta, sin importar el monto</span>
                </div>
            )}

            {/* Preview en vivo */}
            <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "var(--bg-card2)", border: "1px solid var(--border-primary)" }}>
                <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Ejemplo: una venta de ${VENTA_PREVIEW} daría <strong>{previewGanancia} pts</strong>
                    {previewValorPunto > 0 && <> (valen ≈<strong>${previewValorCanje}</strong> al canjear)</>}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Los puntos se ganan sobre el dinero pagado (si paga parte con puntos, gana solo la parte en dinero).
                </p>
            </div>

            {errores.length > 0 && (
                <p style={{ margin: "10px 0 0", fontSize: "0.75rem", fontWeight: 700, color: "#b71c1c" }}>⚠ {errores[0]}</p>
            )}

            <button className="btn-primary" onClick={guardar} disabled={guardando || cargandoTenant}
                style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}>
                <Icon name="Save" size={16} /> {guardando ? "Guardando..." : "Guardar configuración"}
            </button>
        </div>
    )
}

function chip(seleccionado: boolean): React.CSSProperties {
    return {
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderRadius: 10, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
        border: seleccionado ? "1px solid transparent" : "1px solid var(--border-primary)",
        background: seleccionado ? "var(--primary-mid)" : "var(--bg-card2)",
        color: seleccionado ? "#fff" : "var(--text-muted)",
    }
}
