// ==============================================================================
// src/components/ui/ModalConfirmacion.tsx
// Modal de confirmación genérico (overlay + card con ícono, título, mensaje y
// botones Cancelar/Confirmar). Se extrajo del monolito de gastos — el mismo
// patrón que usaban inventario/estadisticas inline.
// ==============================================================================

import Icon from "@/components/ui/Icon"

interface Props {
    icon: string
    iconBg: string
    iconColor: string
    titulo: string
    mensaje: string
    btnConfirmar: string
    btnColor: string
    onCancelar: () => void
    onConfirmar: () => void
}

export default function ModalConfirmacion({
    icon,
    iconBg,
    iconColor,
    titulo,
    mensaje,
    btnConfirmar,
    btnColor,
    onCancelar,
    onConfirmar,
}: Props) {
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            padding: 24
        }}>
            <div className="card" style={{
                maxWidth: 440, width: "100%", padding: 28, gap: 20,
                display: "flex", flexDirection: "column",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                border: "1px solid var(--border-light)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: iconBg, display: "flex",
                        alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                        <Icon name={icon as any} size={24} color={iconColor} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                            {titulo}
                        </h3>
                    </div>
                </div>

                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                    {mensaje}
                </p>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={onCancelar}
                        style={{
                            padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)", color: "var(--text-main)",
                            fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                            transition: "all 0.15s"
                        }}
                    >
                        Cancelar
                    </button>
                    <button onClick={onConfirmar}
                        style={{
                            padding: "10px 20px", borderRadius: 10, border: "none",
                            background: btnColor,
                            color: "#fff",
                            fontWeight: 700, fontSize: "0.82rem",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 8,
                            transition: "all 0.15s"
                        }}
                    >
                        <Icon name={icon as any} size={16} color="#fff" /> {btnConfirmar}
                    </button>
                </div>
            </div>
        </div>
    )
}
