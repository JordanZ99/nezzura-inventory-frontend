"use client"
// ==============================================================================
// src/components/ui/StorageMeter.tsx
// Medidor de almacenamiento estilo Google Photos (cuota por plan, migración
// 071): barra usados/límite con estados visual. Informativo — el bloqueo real
// de subidas vive en el backend.
//
//   modo "completo" → barra con números (sidebar desktop).
//   modo "alerta"   → solo se renderiza al cruzar 80% o exceder el límite
//                     (aviso flotante sobre el bottom-nav en móvil).
//
// Nunca estorba: si el backend falla o el dato no carga, no se dibuja nada.
// ==============================================================================

import Link from "next/link"
import { useAlmacenamiento } from "@/hooks/useAlmacenamiento"
import { fmtPeso } from "@/lib/api/almacenamiento"

function estadoVisual(porcentaje: number, excedido: boolean) {
    if (excedido || porcentaje >= 95) return { color: "#e53935", etiqueta: "Espacio lleno" }
    if (porcentaje >= 80) return { color: "#fb8c00", etiqueta: "Espacio por llenarse" }
    return { color: "var(--primary-icons, #777)", etiqueta: "Espacio disponible" }
}

export default function StorageMeter({ modo = "completo" }: { modo?: "completo" | "alerta" }) {
    const { data, isError, isLoading } = useAlmacenamiento()

    // Informativo: sin dato (cargando o error) no se dibuja nada.
    if (isError || isLoading || !data) return null

    const pct = Math.min(100, Math.max(0, data.porcentaje))
    const { color, etiqueta } = estadoVisual(pct, data.excedido)

    if (modo === "alerta") {
        if (pct < 80) return null
        return (
            <Link href="/almacenamiento" style={{
                position: "fixed",
                bottom: 68,
                left: 12,
                right: 12,
                zIndex: 190,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 12,
                background: data.excedido ? "#fdecea" : "#fff3e0",
                border: `1px solid ${color}`,
                textDecoration: "none",
            }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#3c2c1e" }}>
                    {etiqueta}: {fmtPeso(data.bytes_usados)} de {fmtPeso(data.limite_bytes)}
                </span>
                <span style={{ fontSize: "0.7rem", fontWeight: 800, color }}>
                    {data.excedido ? "Libera espacio →" : "Ver uso →"}
                </span>
            </Link>
        )
    }

    return (
        <div title={`${fmtPeso(data.bytes_usados)} de ${fmtPeso(data.limite_bytes)} (plan ${data.nombre})`}
            style={{ padding: "0 16px", marginBottom: 8 }}>
            <Link href="/almacenamiento" style={{ textDecoration: "none", display: "block" }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.62rem",
                fontWeight: 600,
                color: "var(--primary-light)",
                marginBottom: 4,
                letterSpacing: 0.3,
            }}>
                <span>{etiqueta}</span>
                <span>{fmtPeso(data.bytes_usados)} / {fmtPeso(data.limite_bytes)}</span>
            </div>
            <div style={{
                height: 6,
                borderRadius: 3,
                background: "var(--primary-soft, rgba(0,0,0,0.08))",
                overflow: "hidden",
            }}>
                <div style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: color,
                    transition: "width 0.4s ease",
                }} />
            </div>
            </Link>
        </div>
    )
}
