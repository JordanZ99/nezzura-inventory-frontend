// ==============================================================================
// src/components/personalizacion/CardMiNegocio.tsx
// Tarjeta "Mi Negocio" (tab de Personalización): configuración de la zona
// horaria IANA del negocio. La zona define el DÍA CONTABLE de ventas, gastos
// y cortes de caja — no la zona del dispositivo del que se revise.
// ==============================================================================

import { useEffect, useMemo, useState } from "react"
import Icon from "@/components/ui/Icon"

interface Props {
    zonaHoraria: string
    setZonaHoraria: (v: string) => void
    guardarZonaHoraria: () => void
    guardando: boolean
    cargandoTenant: boolean
    gastoComision: boolean
    toggleGastoComision: (v: boolean) => void
    // Días en que el negocio NO abre (migración 051): el Análisis Inteligente
    // los descuenta de la concentración de ventas y no sugiere promos ahí.
    diasCerrados: string[]
    toggleDiaCerrado: (dia: string) => void
    guardandoDias: boolean
}

/** Días de la semana en orden natural; sin acento (mismas claves del backend). */
const DIAS_SEMANA: { valor: string; etiqueta: string }[] = [
    { valor: "lunes", etiqueta: "Lun" },
    { valor: "martes", etiqueta: "Mar" },
    { valor: "miercoles", etiqueta: "Mié" },
    { valor: "jueves", etiqueta: "Jue" },
    { valor: "viernes", etiqueta: "Vie" },
    { valor: "sabado", etiqueta: "Sáb" },
    { valor: "domingo", etiqueta: "Dom" },
]

// Zonas IANA curadas (las más relevantes para negocios de LATAM + referencia).
const GRUPOS_ZONAS: { grupo: string; zonas: string[] }[] = [
    {
        grupo: "México",
        zonas: [
            "America/Cancun", "America/Mexico_City", "America/Merida", "America/Monterrey",
            "America/Matamoros", "America/Reynosa", "America/Tijuana", "America/Mazatlan",
            "America/Chihuahua", "America/Ojinaga", "America/Ciudad_Juarez", "America/Hermosillo",
            "America/Bahia_Banderas",
        ],
    },
    {
        grupo: "Centroamérica y Caribe",
        zonas: [
            "America/Guatemala", "America/Belize", "America/El_Salvador", "America/Tegucigalpa",
            "America/Managua", "America/Costa_Rica", "America/Panama", "America/Havana",
            "America/Jamaica", "America/Santo_Domingo", "America/Puerto_Rico",
        ],
    },
    {
        grupo: "Sudamérica",
        zonas: [
            "America/Bogota", "America/Caracas", "America/Guayaquil", "America/Lima",
            "America/La_Paz", "America/Santiago", "America/Asuncion", "America/Montevideo",
            "America/Argentina/Buenos_Aires", "America/Sao_Paulo",
        ],
    },
    {
        grupo: "Norteamérica",
        zonas: [
            "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
            "America/Los_Angeles", "America/Anchorage", "America/Toronto", "America/Vancouver",
        ],
    },
    {
        grupo: "Europa",
        zonas: ["Europe/Madrid", "Europe/Canary"],
    },
    {
        grupo: "Otro",
        zonas: ["UTC"],
    },
]

/** Etiqueta de UTC offset de una zona IANA (ej. "GMT-5"). "" si el navegador no soporta. */
function etiquetaOffset(zona: string): string {
    try {
        const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "shortOffset" })
            .formatToParts(new Date())
        return partes.find(p => p.type === "timeZoneName")?.value ?? ""
    } catch {
        return ""
    }
}

/** Hora actual formateada en la zona indicada (es-MX, 12h). */
function horaEnZona(zona: string): string {
    try {
        return new Intl.DateTimeFormat("es-MX", {
            timeZone: zona, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
        }).format(new Date())
    } catch {
        return "—"
    }
}

export function CardMiNegocio({
    zonaHoraria,
    setZonaHoraria,
    guardarZonaHoraria,
    guardando,
    cargandoTenant,
    gastoComision,
    toggleGastoComision,
    diasCerrados,
    toggleDiaCerrado,
    guardandoDias,
}: Props) {
    const [reloj, setReloj] = useState(() => horaEnZona(zonaHoraria))

    // Reloj vivo: la hora del NEGOCIO en la zona seleccionada (no la del dispositivo)
    useEffect(() => {
        setReloj(horaEnZona(zonaHoraria))
        const t = setInterval(() => setReloj(horaEnZona(zonaHoraria)), 1000)
        return () => clearInterval(t)
    }, [zonaHoraria])

    // Opciones con su offset calculado una sola vez por render de la lista
    const opciones = useMemo(() =>
        GRUPOS_ZONAS.map(g => ({
            grupo: g.grupo,
            zonas: g.zonas.map(z => ({ valor: z, offset: etiquetaOffset(z) })),
        })), [])

    // Si la zona guardada no está en la lista curada, se muestra como opción extra
    const zonaExtra = !GRUPOS_ZONAS.some(g => g.zonas.includes(zonaHoraria))

    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 320px", maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Mi Negocio</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>
                Configuración general de tu negocio.
            </p>

            {/* Zona horaria del negocio */}
            <div>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Zona horaria del negocio
                </span>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 0 8px", fontWeight: 500 }}>
                    Define el día contable de tus ventas, gastos y cortes de caja, sin importar
                    desde qué dispositivo o país se revise el sistema.
                </p>

                <select
                    value={zonaHoraria}
                    onChange={e => setZonaHoraria(e.target.value)}
                    style={{
                        width: "100%",
                        fontSize: "0.8rem",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-card2)",
                        color: "var(--text-main)",
                        outline: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                    }}
                >
                    {zonaExtra && <option value={zonaHoraria}>{zonaHoraria}</option>}
                    {opciones.map(g => (
                        <optgroup key={g.grupo} label={g.grupo}>
                            {g.zonas.map(z => (
                                <option key={z.valor} value={z.valor}>
                                    {z.valor}{z.offset ? ` (${z.offset})` : ""}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>

                {/* Reloj del negocio en la zona elegida */}
                <div style={{
                    marginTop: 12, display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10, background: "var(--bg-card2)",
                    border: "1px solid var(--border-primary)",
                }}>
                    <Icon name="Clock" size={20} color="var(--primary-alter)" />
                    <div>
                        <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                            Hora en tu negocio
                        </p>
                        <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                            {reloj}
                        </p>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--text-muted)", textAlign: "right" }}>
                        {zonaHoraria}
                        <br />
                        {etiquetaOffset(zonaHoraria)}
                    </span>
                </div>

                <button
                    className="btn-primary"
                    onClick={guardarZonaHoraria}
                    disabled={guardando || cargandoTenant}
                    style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}
                >
                    <Icon name="Save" size={16} />
                    {guardando ? "Guardando..." : "Guardar Zona Horaria"}
                </button>

                {/* Gasto automático de comisiones de terminal (Fase B) */}
                <div style={{ marginTop: 20 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                        Comisiones de terminal
                    </span>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.78rem", fontWeight: 500, color: "var(--text-main)", cursor: "pointer" }}>
                        <input type="checkbox" checked={gastoComision} onChange={e => toggleGastoComision(e.target.checked)} style={{ marginTop: 2 }} />
                        <span>
                            Registrar automáticamente cada comisión como gasto ("Comisiones bancarias") al cobrar con tarjeta. Recomendado para que la ganancia neta cuadre contra el depósito del banco.
                        </span>
                    </label>
                </div>

                {/* Días de descanso (migración 051) */}
                <div style={{ marginTop: 20 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                        Días de descanso
                    </span>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 0 10px", fontWeight: 500 }}>
                        Los días en que NO abres. El análisis inteligente los descuenta al
                        buscar tu día más flojo y nunca sugiere promos ahí.
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {DIAS_SEMANA.map(d => {
                            const activo = diasCerrados.includes(d.valor)
                            return (
                                <button
                                    key={d.valor}
                                    type="button"
                                    onClick={() => toggleDiaCerrado(d.valor)}
                                    disabled={guardandoDias || cargandoTenant}
                                    style={{
                                        padding: "7px 14px", borderRadius: 999, cursor: guardandoDias ? "wait" : "pointer",
                                        fontSize: "0.78rem", fontWeight: 800, transition: "all 0.15s",
                                        border: `1.5px solid ${activo ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                        background: activo ? "var(--primary-soft)" : "var(--bg-card2)",
                                        color: activo ? "var(--primary-dark)" : "var(--text-muted)",
                                    }}
                                >
                                    {d.etiqueta}
                                </button>
                            )
                        })}
                    </div>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: "8px 0 0", fontWeight: 600 }}>
                        {diasCerrados.length === 0
                            ? "Abre los 7 días — no hay días de descanso marcados."
                            : `Sin abrir: ${DIAS_SEMANA.filter(d => diasCerrados.includes(d.valor)).map(d => d.etiqueta).join(", ")}.`}
                    </p>
                </div>
            </div>
        </div>
    )
}
