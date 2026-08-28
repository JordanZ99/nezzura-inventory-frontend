// ==============================================================================
// src/components/estadisticas/ResumenCobros.tsx
// Desglose de cobros del período por método de pago (Fase A): efectivo,
// tarjeta débito/crédito, propinas aparte y órdenes legadas sin método
// ("No registrado"). Solo muestra los rubros con monto mayor a cero.
// ==============================================================================

import type { Orden } from "@/lib/api"
import Icon from "@/components/ui/Icon"

interface Props {
    cobrosPorMetodo: { efectivo: number; tarjeta_debito: number; tarjeta_credito: number; no_registrado: number }
    propinasPeriodo: number
    ordenes: Orden[]
}

const RUBROS: { key: keyof Props["cobrosPorMetodo"]; label: string; icon: string }[] = [
    { key: "efectivo", label: "Efectivo", icon: "Banknote" },
    { key: "tarjeta_debito", label: "Débito", icon: "CreditCard" },
    { key: "tarjeta_credito", label: "Crédito", icon: "CreditCard" },
    { key: "no_registrado", label: "No registrado", icon: "CircleHelp" },
] as const

export default function ResumenCobros({ cobrosPorMetodo, propinasPeriodo, ordenes }: Props) {
    const conMetodo = ordenes.some(o => o.metodo_pago)
    const activos = RUBROS.filter(r => cobrosPorMetodo[r.key] > 0)

    // Desglose por terminal (Fase B): cobrado vs comisión = depósito esperado
    const porTerminal = new Map<string, { nombre: string; cobrado: number; comision: number }>()
    for (const o of ordenes) {
        if (o.estado === "Anulada" || !o.pagos) continue
        for (const p of o.pagos) {
            if (p.comision && p.comision > 0 && p.terminal_nombre) {
                const e = porTerminal.get(p.terminal_nombre) ?? { nombre: p.terminal_nombre, cobrado: 0, comision: 0 }
                e.cobrado += p.monto
                e.comision += p.comision
                porTerminal.set(p.terminal_nombre, e)
            }
        }
    }
    const lineasTerminal = [...porTerminal.values()].sort((a, b) => b.cobrado - a.cobrado)

    if (activos.length === 0 && propinasPeriodo <= 0 && !conMetodo) return null

    return (
        <div style={{
            display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
            padding: "12px 16px", borderRadius: 12, background: "var(--bg-card2)",
            border: "1px solid var(--border-primary)", marginBottom: 16,
        }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Cobros del período
            </span>
            {activos.map(r => (
                <span key={r.key} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 999,
                    background: "var(--bg-card)", border: "1px solid var(--border-primary)",
                    fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)",
                }}>
                    <Icon name={r.icon as never} size={13} color="var(--primary-alter)" />
                    {r.label}: ${cobrosPorMetodo[r.key].toFixed(2)}
                </span>
            ))}
            {propinasPeriodo > 0 && (
                <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 999,
                    background: "var(--bg-card)", border: "1px solid var(--border-primary)",
                    fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)",
                }}>
                    <Icon name="HandCoins" size={13} color="var(--primary-alter)" />
                    Propinas: ${propinasPeriodo.toFixed(2)}
                </span>
            )}
            {lineasTerminal.map(e => (
                <span key={e.nombre} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 999,
                    background: "var(--bg-card)", border: "1px solid var(--border-primary)",
                    fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)",
                }}>
                    <Icon name="Landmark" size={13} color="var(--primary-alter)" />
                    {e.nombre}: ${e.cobrado.toFixed(2)} − ${e.comision.toFixed(2)} = depósito ${(e.cobrado - e.comision).toFixed(2)}
                </span>
            ))}
        </div>
    )
}
