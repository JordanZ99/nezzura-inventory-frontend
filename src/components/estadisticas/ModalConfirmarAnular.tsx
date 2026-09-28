// ==============================================================================
// src/components/estadisticas/ModalConfirmarAnular.tsx
// Modal de confirmación para anular una venta (overlay + card de advertencia).
// ==============================================================================

import Icon from "@/components/ui/Icon"

interface Props {
    confirmAnularVentaId: number | null
    onCancel: () => void
    onConfirm: (id: number) => void
}

export default function ModalConfirmarAnular({ confirmAnularVentaId, onCancel, onConfirm }: Props) {
    if (confirmAnularVentaId === null) return null
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
                        background: "#ffeef0", display: "flex",
                        alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                        <Icon name="TriangleAlert" size={24} color="#ad4955ff" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                            Anular venta
                        </h3>
                    </div>
                </div>

                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                    ¿Anular esta venta permanentemente? El stock será devuelto al inventario y dejará de contar en las estadísticas.
                </p>

                <div style={{
                    padding: "12px 16px", borderRadius: 10,
                    background: "#fff4e5", border: "1px solid #ffd699",
                    display: "flex", gap: 10, alignItems: "flex-start"
                }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                        <Icon name="TriangleAlert" size={20} color="#cc7a00" />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#8a5e00" }}>
                            Esta acción no se puede deshacer
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#8a5e00", fontWeight: 500 }}>
                            La venta se eliminará del historial. Si quieres mantener el registro, puedes editar la venta en lugar de anularla.
                        </p>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={onCancel}
                        style={{
                            padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)", color: "var(--text-main)",
                            fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                            transition: "all 0.15s"
                        }}
                    >
                        Cancelar
                    </button>
                    <button onClick={() => onConfirm(confirmAnularVentaId)}
                        style={{
                            padding: "10px 20px", borderRadius: 10, border: "none",
                            background: "#ad4955ff",
                            color: "#fff",
                            fontWeight: 700, fontSize: "0.82rem",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 8,
                            transition: "all 0.15s"
                        }}
                    >
                        <Icon name="Trash2" size={16} color="#fff" /> Sí, anular venta
                    </button>
                </div>
            </div>
        </div>
    )
}
