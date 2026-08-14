"use client"
// ==============================================================================
// src/components/ui/PageHeader.tsx
// Hero de página: fondo con gradiente + partículas Antigravity + subtítulo +
// título con ícono. Reemplaza el bloque hero (con Antigravity) que se repetía
// en las 6 páginas del gestor (POS, inventario, gastos, gastos programados,
// estadísticas y personalización).
// ==============================================================================

import dynamic from "next/dynamic"
import type { CSSProperties, ReactNode } from "react"
import Icon from "@/components/ui/Icon"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

interface AntigravityOpciones {
    count?: number
    magnetRadius?: number
    ringRadius?: number
    waveSpeed?: number
    waveAmplitude?: number
    particleSize?: number
    lerpSpeed?: number
    color?: string
    autoAnimate?: boolean
    particleVariance?: number
    rotationSpeed?: number
    depthFactor?: number
    pulseSpeed?: number
    particleShape?: "capsule" | "sphere" | "box" | "tetrahedron"
    fieldStrength?: number
}

interface PageHeaderProps {
    gradiente: string
    agColor: string
    /** Overrides del Antigravity (default = configuración estándar de 400 partículas) */
    agOpciones?: AntigravityOpciones
    /** Padding inferior del hero (por defecto "90px"; el POS usa "80px") */
    paddingBottom?: string
    subtitulo?: string
    subtituloClase?: string
    subtituloStyle?: CSSProperties
    titulo: string
    icono?: string
    /** Envuelve el ícono en un div con marginLeft -5px (patrón de gastos/personalización) */
    iconoEncerrado?: boolean
    iconoColor?: string
    tituloClase?: string
    tituloStyle?: CSSProperties
    /** Contenido adicional bajo el título (p. ej. el h1 móvil y el párrafo del POS) */
    extra?: ReactNode
}

const ANTIGRAVITY_DEFAULT: AntigravityOpciones = {
    count: 400,
    magnetRadius: 12,
    ringRadius: 8,
    waveSpeed: 0.5,
    waveAmplitude: 1.2,
    particleSize: 1.5,
    lerpSpeed: 0.08,
    autoAnimate: true,
    particleVariance: 0.8,
    rotationSpeed: 0.3,
    depthFactor: 0.5,
    pulseSpeed: 2,
    particleShape: "capsule",
    fieldStrength: 8,
}

export default function PageHeader({
    gradiente,
    agColor,
    agOpciones,
    paddingBottom = "90px",
    subtitulo,
    subtituloClase,
    subtituloStyle,
    titulo,
    icono,
    iconoEncerrado,
    iconoColor,
    tituloClase = "hidden md:flex",
    tituloStyle,
    extra,
}: PageHeaderProps) {
    const ag = { ...ANTIGRAVITY_DEFAULT, color: agColor, ...agOpciones }
    return (
        <div style={{ position: "relative", overflow: "hidden", background: gradiente, padding: `32px 24px ${paddingBottom}` }}>
            <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                <Antigravity {...ag} />
            </div>
            <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                {subtitulo && (
                    <p className={subtituloClase} style={subtituloStyle}>{subtitulo}</p>
                )}
                <h1 className={tituloClase || undefined} style={tituloStyle}>
                    {icono && (iconoEncerrado ? (
                        <div style={{ marginLeft: -5 }}>
                            <Icon name={icono as any} size={32} color={iconoColor} />
                        </div>
                    ) : (
                        <Icon name={icono as any} size={32} color={iconoColor} />
                    ))}
                    {titulo}
                </h1>
                {extra}
            </div>
        </div>
    )
}
