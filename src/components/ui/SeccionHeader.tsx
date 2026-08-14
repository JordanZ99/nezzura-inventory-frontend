"use client"
// ==============================================================================
// src/components/ui/SeccionHeader.tsx
// Encabezado de sección: ícono + etiqueta en mayúsculas + línea separadora.
// Encapsula el patrón que se repetía 5 veces en personalizacion/page.tsx.
// ==============================================================================

import Icon from "@/components/ui/Icon"

interface SeccionHeaderProps {
    icono: string
    titulo: string
}

export default function SeccionHeader({ icono, titulo }: SeccionHeaderProps) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Icon name={icono as any} size={15} color="var(--primary-mid)" />
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-mid)", textTransform: "uppercase", letterSpacing: 1.2 }}>
                {titulo}
            </span>
            <div style={{ flex: 1, height: 1.5, background: "var(--border-primary)", borderRadius: 1 }} />
        </div>
    )
}
