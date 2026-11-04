"use client"
// ==============================================================================
// src/components/servicios/DashboardServicios.tsx
// HOME del giro 'servicios' (en lugar del POS de productos). Dashboard
// financiero: cobrado del mes, pendiente total, aging del saldo vencido y los
// deudores al frente — lo primero que ves es el dinero que falta entrar.
// El detalle (abonos, altas, cuotas) vive en /cobros.
// ==============================================================================

import { useEffect, useState } from "react"
import Link from "next/link"
import Icon from "@/components/ui/Icon"
import PageHeader from "@/components/ui/PageHeader"
import { periodoActual, useAccionesCobros, useResumenCobros } from "@/hooks/useCobros"
import { useTenant } from "@/contexts/TenantContext"

const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0)

/** Fecha corta para la card de próximos: '12 nov' (vencimiento 'YYYY-MM-DD'). */
const fmtFechaCorta = (v: string | null) => {
    if (!v) return "—"
    const d = new Date(`${v}T00:00:00`)
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

const AGING: { clave: keyof NonNullable<NonNullable<ReturnType<typeof useResumenCobros>["resumen"]>["aging"]>; etiqueta: string; color: string }[] = [
    { clave: "actual", etiqueta: "Por vencer", color: "var(--primary-alter)" },
    { clave: "d30", etiqueta: "1–30 días", color: "#f9a825" },
    { clave: "d60", etiqueta: "31–60 días", color: "#fb8c00" },
    { clave: "d90", etiqueta: "61–90 días", color: "#e53935" },
    { clave: "mas90", etiqueta: "+90 días", color: "#b71c1c" },
]

export default function DashboardServicios() {
    const { tenant } = useTenant()
    const { resumen, cargando } = useResumenCobros() // mes en curso
    const acciones = useAccionesCobros()
    const [generarIntentado, setGenerarIntentado] = useState(false)

    // Auto-emite el mes en curso al abrir el panel: la cuota recién creada
    // se convierte en cobro sin paso manual ("Generar mes" solo queda en
    // /cobros para regenerar periodos pasados). Idempotente en el backend
    // (omite lo ya existente); en fallo de red NO bloquea el dashboard.
    useEffect(() => {
        if (!tenant?.tenant_id || generarIntentado) return
        setGenerarIntentado(true)
        acciones.generar(periodoActual()).catch(() => {})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenant?.tenant_id])

    const totalVencido = resumen
        ? (resumen.aging.d30 + resumen.aging.d60 + resumen.aging.d90 + resumen.aging.mas90)
        : 0
    const base = Math.max((resumen?.aging.actual ?? 0) + totalVencido, 0.01)

    return (
        <div style={{ minHeight: "100vh" }}>
            <PageHeader
                gradiente="var(--gradient-1)"
                agColor="var(--ag-color-1)"
                subtitulo="PANEL FINANCIERO"
                subtituloStyle={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}
                titulo="Mis servicios"
                icono="Wallet"
                iconoEncerrado
                iconoColor="var(--primary-soft)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
                extra={undefined}
            />

            <div style={{ padding: "0 16px", marginTop: -60, position: "relative", zIndex: 1, paddingBottom: 40 }}>
                {cargando ? (
                    <div style={{ height: 160, borderRadius: 16, background: "var(--bg-card)", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }} />
                ) : !resumen ? (
                    <div style={{ padding: 30, borderRadius: 16, background: "var(--bg-card)", color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>
                        No se pudo cargar el resumen.
                    </div>
                ) : (
                    <>
                        {/* KPIs */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
                            <div style={kpiStyle}>
                                <p style={kpiLabel}>Cobrado {resumen.periodo}</p>
                                <p style={{ ...kpiValor, color: "var(--primary-alter)" }}>{fmt(resumen.cobrado_periodo)}</p>
                            </div>
                            <div style={kpiStyle}>
                                <p style={kpiLabel}>Clientes con saldo</p>
                                <p style={{ ...kpiValor, color: "var(--text-main)" }}>{resumen.deudores.length}</p>
                                <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)" }}>
                                    {resumen.num_pendientes} cobro(s) abierto(s)
                                </p>
                            </div>
                        </div>

                        {/* Aging + deudores */}
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                            <div style={{ flex: "1 1 300px", borderRadius: 16, background: "var(--bg-card)", padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", minWidth: 0 }}>
                                <h3 style={{ margin: "0 0 12px", fontSize: "0.8rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: 0.4 }}>
                                    Antigüedad de lo pendiente
                                </h3>
                                {AGING.map(a => {
                                    const monto = (resumen.aging[a.clave] as number) || 0
                                    return (
                                        <div key={a.clave} style={{ marginBottom: 10 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)" }}>{a.etiqueta}</span>
                                                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)" }}>{fmt(monto)}</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 3, background: "var(--bg-card2)", overflow: "hidden" }}>
                                                <div style={{ height: "100%", width: `${Math.min(100, (monto / base) * 100)}%`, background: a.color, borderRadius: 3, transition: "width 0.3s" }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Próximos pagos (requiere backend con 'proximos' en resumen) */}
                            {resumen.proximos && (
                                <div style={{ flex: "1 1 300px", borderRadius: 16, background: "var(--bg-card)", padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", minWidth: 0 }}>
                                    <h3 style={{ margin: "0 0 12px", fontSize: "0.8rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: 0.4 }}>
                                        Próximos pagos
                                    </h3>
                                    {resumen.proximos.length === 0 ? (
                                        <div style={{ padding: "18px 0", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>
                                            <Icon name="CalendarCheck" size={30} color="var(--primary-alter)" />
                                            <p style={{ margin: "8px 0 0" }}>Nada por vencer</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {resumen.proximos.map((p, i) => (
                                                <div key={`${p.cliente_id}-${p.concepto}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <span style={{
                                                        minWidth: 56, padding: "4px 8px", borderRadius: 8,
                                                        background: "var(--bg-card2)", fontWeight: 800, fontSize: "0.7rem",
                                                        color: "var(--text-main)", textAlign: "center", whiteSpace: "nowrap",
                                                    }}>
                                                        {fmtFechaCorta(p.vencimiento)}
                                                    </span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {p.cliente_nombre}
                                                        </p>
                                                        <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {p.concepto}
                                                        </p>
                                                    </div>
                                                    <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-main)", whiteSpace: "nowrap" }}>
                                                        {fmt(p.saldo)}
                                                    </span>
                                                </div>
                                            ))}
                                            <Link href="/cobros"
                                                style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--primary-mid)", textDecoration: "none", textAlign: "center" }}>
                                                Ver y abonar en Cobros →
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Accesos rápidos */}
                        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
                            <Link href="/cobros" style={linkStyle}>
                                <Icon name="Wallet" size={18} color="#fff" />
                                Ir a Cobros
                            </Link>
                            <Link href="/estadisticas" style={{ ...linkStyle, background: "var(--bg-card)", color: "var(--text-main)" }}>
                                <Icon name="Users" size={18} color="var(--primary-mid)" />
                                Cartera (CRM)
                            </Link>
                            <Link href="/gastos" style={{ ...linkStyle, background: "var(--bg-card)", color: "var(--text-main)" }}>
                                <Icon name="Receipt" size={18} color="var(--primary-mid)" />
                                Gastos
                            </Link>
                        </div>

                        {tenant && <p style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginTop: 18, fontWeight: 600 }}>
                            {tenant.empresa} — giro servicios
                        </p>}
                    </>
                )}
            </div>
        </div>
    )
}

const kpiStyle: React.CSSProperties = {
    background: "var(--bg-card)", borderRadius: 16, padding: "16px 18px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
}

const kpiLabel: React.CSSProperties = {
    margin: 0, fontSize: "0.68rem", fontWeight: 700, letterSpacing: 1,
    textTransform: "uppercase", color: "var(--text-muted)",
}

const kpiValor: React.CSSProperties = {
    margin: "6px 0 2px", fontSize: "1.5rem", fontWeight: 800,
}

const linkStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "var(--primary-mid)", color: "#fff", fontWeight: 800,
    fontSize: "0.85rem", padding: "12px 20px", borderRadius: 12,
    textDecoration: "none",
}
