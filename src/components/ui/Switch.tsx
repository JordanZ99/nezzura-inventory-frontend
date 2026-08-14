"use client"
// ==============================================================================
// src/components/ui/Switch.tsx
// Toggle switch (52×28 con knob) para formularios de configuración.
// Encapsula el patrón que se repetía 7 veces en personalizacion/page.tsx.
// ==============================================================================

interface SwitchProps {
    checked: boolean
    onChange: () => void
    disabled?: boolean
}

export default function Switch({ checked, onChange, disabled }: SwitchProps) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            disabled={disabled}
            style={{
                position: "relative",
                width: 52,
                height: 28,
                borderRadius: 14,
                border: "none",
                cursor: disabled ? "not-allowed" : "pointer",
                background: checked ? "var(--primary-mid)" : "var(--border-primary)",
                transition: "background 0.25s",
                flexShrink: 0,
            }}
        >
            <div style={{
                position: "absolute",
                top: 3,
                left: checked ? 26 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                transition: "left 0.25s",
            }} />
        </button>
    )
}
