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
}

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
            </div>
        </div>
    )
}
