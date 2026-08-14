// ==============================================================================
// src/components/personalizacion/SeccionEstado.tsx
// Sección "Estado": activar/desactivar el catálogo público (switch).
// ==============================================================================

import SeccionHeader from "@/components/ui/SeccionHeader"
import Switch from "@/components/ui/Switch"
import type { PropsSeccionConfig } from "./tipos"

export function SeccionEstado({ catalogoConfig, setCatalogoConfig, autoguardar, campoGuardando, renderGuardado }: PropsSeccionConfig) {
    return (
        <>
            <SeccionHeader icono="Power" titulo="Estado" />
            {/* Activar / Desactivar */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", background: "var(--bg-card2)", borderRadius: 12,
            }}>
                <div>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>Catálogo público</span>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                        {catalogoConfig?.activo ? "Tu catálogo es visible para cualquier persona con el link." : "Actívalo para que tus clientes puedan verlo."}
                    </p>
                    {renderGuardado("activo")}
                </div>
                <Switch
                    checked={!!catalogoConfig?.activo}
                    onChange={() => {
                        const nuevo = !catalogoConfig?.activo
                        setCatalogoConfig(prev => prev ? { ...prev, activo: nuevo } : prev)
                        autoguardar("activo", { activo: nuevo })
                    }}
                    disabled={campoGuardando === "activo"}
                />
            </div>
        </>
    )
}
