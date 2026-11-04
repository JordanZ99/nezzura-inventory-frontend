"use client"
// ==============================================================================
// src/components/cobros/StatsCobros.tsx
// KPIs del tab Cobros: pendiente total, cobrado del periodo y aging del saldo
// vencido (0-30/31-60/61-90/+90). El aging es LA lectura que nadie te da de
// gratis: el dinero que ya está en riesgo se despega del que aún no vence.
// ==============================================================================

import type { ResumenCobros } from "@/types"

interface Props {
    resumen: ResumenCobros | undefined
    cargando: boolean
    onToggleFiltroPendientes: () => void
    filtroPendientes: boolean
}

const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

const AGING: { clave: keyof NonNullable<ResumenCobros["aging"]>; etiqueta: string; color: string }[] = [
    { clave: "actual", etiqueta: "Por vencer", color: "var(--primary-alter)" },
    { clave: "d30", etiqueta: "1–30 días", color: "#f9a825" },
    { clave: "d60", etiqueta: "31–60 días", color: "#fb8c00" },
    { clave: "d90", etiqueta: "61–90 días", color: "#e53935" },
    { clave: "mas90", etiqueta: "+90 días", color: "#b71c1c" },
]

export default function StatsCobros({ resumen, cargando, filtroPendientes, onToggleFiltroPendientes }: Props) {
    if (cargando || !resumen) {
        return <div style={{ height: 120, borderRadius: 16, background: "var(--bg-card)", marginBottom: 20 }} />
    }

    const aging = AGING.map(a => ({ ...a, monto: resumen.aging[a.clave] || 0 }))
    const totalVencido = aging.slice(1).reduce((s, a) => s + a.monto, 0)
    const base = Math.max(resumen.aging.actual + totalVencido, 0.01)

    return (
        <div style={{ marginBottom: 20 }}>
            {/* KPIs principales */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 12 }}>
                <button onClick={onToggleFiltroPendientes} style={{
                    textAlign: "left", border: "none", borderRadius: 16, padding: "16px 18px", cursor: "pointer",
                    background: filtroPendientes ? "var(--primary-mid)" : "var(--bg-card)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                    transition: "background 0.15s",
                }}>
                    <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, letterSpacing: 1, color: filtroPendientes ? "rgba(255,255,255,0.8)" : "var(--text-muted)", textTransform: "uppercase" }}>
                        Pendiente (filtrar)
                    </p>
                    <p style={{ margin: "6px 0 2px", fontSize: "1.35rem", fontWeight: 800, color: filtroPendientes ? "#fff" : "var(--text-main)" }}>
                        {fmt(resumen.pendiente_total)}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, color: filtroPendientes ? "rgba(255,255,255,0.8)" : "var(--text-muted)" }}>
                        {resumen.num_pendientes} cobro(s) abierto(s)
                    </p>
                </button>

                <div style={{ borderRadius: 16, padding: "16px 18px", background: "var(--bg-card)", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                    <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, letterSpacing: 1, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Cobrado {resumen.periodo}
                    </p>
                    <p style={{ margin: "6px 0 2px", fontSize: "1.35rem", fontWeight: 800, color: "var(--primary-alter)" }}>
                        {fmt(resumen.cobrado_periodo)}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)" }}>
                        {resumen.deudores.length} cliente(s) con saldo
                    </p>
                </div>
            </div>

            {/* Aging del saldo vencido */}
            <div style={{ borderRadius: 16, padding: "14px 18px", background: "var(--bg-card)", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
                    {aging.map(a => (
                        <div key={a.clave} style={{ flex: "1 1 110px", minWidth: 110 }}>
                            <p style={{ margin: "0 0 5px", fontSize: "0.68rem", fontWeight: 700, letterSpacing: 0.5, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                {a.etiqueta}
                            </p>
                            <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)" }}>
                                {fmt(a.monto)}
                            </p>
                            <div style={{ height: 5, borderRadius: 3, background: "var(--bg-card2)", marginTop: 6, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, (a.monto / base) * 100)}%`, background: a.color, borderRadius: 3, transition: "width 0.3s" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
