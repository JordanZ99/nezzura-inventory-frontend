"use client"
// ==============================================================================
// src/app/gastos/programados/page.tsx
// Página independiente: Hero + componente compartido de gastos programados.
// ==============================================================================

import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"
import GestionGastosProgramados from "@/components/GestionGastosProgramados"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

export default function GastosProgramadosPage() {
    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero ── */}
            <div style={{
                position: "relative", overflow: "hidden",
                background: "var(--gradient-4)", padding: "32px 24px 90px"
            }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                    <Antigravity
                        count={300} magnetRadius={10} ringRadius={6}
                        waveSpeed={0.4} waveAmplitude={1} particleSize={1.2}
                        lerpSpeed={0.06} color="var(--ag-color-4)" autoAnimate={true}
                        particleVariance={0.7} rotationSpeed={0.2} depthFactor={0.4}
                        pulseSpeed={1.5} particleShape="capsule" fieldStrength={6}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>
                        GASTOS PROGRAMADOS
                    </p>
                    <h1 className="hidden md:flex" style={{
                        color: "var(--primary-soft)", fontSize: "1.7rem",
                        fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10
                    }}>
                        <div style={{ marginLeft: "-5px" }}>
                            <Icon name="CalendarClock" size={32} color="var(--primary-soft)" />
                        </div>
                        Gastos Programados
                    </h1>
                </div>
            </div>

            <div style={{ padding: "0 16px", marginTop: -60 }}>
                <GestionGastosProgramados />
                <div style={{ height: 48 }} />
            </div>
        </div>
    )
}
