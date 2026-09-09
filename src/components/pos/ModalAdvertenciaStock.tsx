// ==============================================================================
// src/components/pos/ModalAdvertenciaStock.tsx
// Modal de advertencia por stock insuficiente: se muestra antes de cobrar
// cuando hay productos sin stock suficiente; el vendedor decide si procede
// (el inventario quedará en negativo).
// ==============================================================================

import Icon from "@/components/ui/Icon"

interface Props {
    nombres: string
    onConfirmar: () => void
    onCancelar: () => void
}

export function ModalAdvertenciaStock({ nombres, onConfirmar, onCancelar }: Props) {
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
        }}>
            {/**
             * Card flotante con los colores del tema actual.
             * Usa las variables CSS del tema dinámico para mantener
             * la coherencia visual con Midnight Black, Steel Slate,
             * Strawberry y Cozy Yellow.
             */}
            <div className="fade-up" style={{
                background: "var(--bg-card)",
                borderRadius: 20,
                padding: "32px 28px 24px",
                maxWidth: 400,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                border: "1px solid var(--border-primary)",
                textAlign: "center",
            }}>
                {/* Icono de advertencia */}
                <div style={{
                    width: 64, height: 64,
                    borderRadius: "50%",
                    background: "var(--error-bg)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px",
                    fontSize: "2rem",
                }}>
                    <Icon name="TriangleAlert" size={32} color="var(--error-text)" />
                </div>

                <h3 style={{
                    margin: "0 0 8px",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    color: "var(--text-main)",
                }}>
                    Stock insuficiente
                </h3>

                <p style={{
                    margin: "0 0 6px",
                    fontSize: "0.85rem",
                    color: "var(--primary-dark)",
                    lineHeight: 1.5,
                }}>
                    No hay stock suficiente de:
                </p>

                <p style={{
                    margin: "0 0 16px",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "var(--error-text)",
                    padding: "8px 12px",
                    background: "var(--error-bg)",
                    borderRadius: 10,
                    wordBreak: "break-word",
                }}>
                    {nombres}
                </p>

                <p style={{
                    margin: "0 0 20px",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                }}>
                    ¿Deseas proceder con la venta de todas formas?
                    El inventario quedará en <strong style={{ color: "var(--error-text)" }}>negativo</strong>.
                </p>

                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button
                        className="btn-primary"
                        onClick={onConfirmar}
                        style={{ flex: 1 }}
                    >
                        Sí, cobrar
                    </button>
                    <button
                        className="btn-ghost"
                        onClick={onCancelar}
                        style={{ flex: 1 }}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}
