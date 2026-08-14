"use client"
// ==============================================================================
// src/app/gastos/programados/page.tsx
// Página independiente: Hero + componente compartido de gastos programados.
// ==============================================================================

import PageHeader from "@/components/ui/PageHeader"
import GestionGastosProgramados from "@/components/GestionGastosProgramados"

export default function GastosProgramadosPage() {
    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero ── */}
            <PageHeader
                gradiente="var(--gradient-4)"
                agColor="var(--ag-color-4)"
                agOpciones={{
                    count: 300, magnetRadius: 10, ringRadius: 6,
                    waveSpeed: 0.4, waveAmplitude: 1, particleSize: 1.2,
                    lerpSpeed: 0.06, particleVariance: 0.7, rotationSpeed: 0.2,
                    depthFactor: 0.4, pulseSpeed: 1.5, fieldStrength: 6,
                }}
                subtitulo="GASTOS PROGRAMADOS"
                subtituloStyle={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}
                titulo="Gastos Programados"
                icono="CalendarClock"
                iconoEncerrado
                iconoColor="var(--primary-soft)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
            />

            <div style={{ padding: "0 16px", marginTop: -60, position: "relative", zIndex: 1 }}>
                <GestionGastosProgramados />
                <div style={{ height: 48 }} />
            </div>
        </div>
    )
}
