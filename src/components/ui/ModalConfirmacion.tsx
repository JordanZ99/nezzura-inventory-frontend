// ==============================================================================
// src/components/ui/ModalConfirmacion.tsx
// Modal de confirmación genérico: overlay + card con ícono, título, mensaje,
// botones Cancelar/Confirmar. Punto ÚNICO para confirmaciones y advertencias
// de la app (regla: modal de confirmación = este componente; componente propio
// solo si es un formulario con campos).
//
// Comportamiento garantizado en cualquier pantalla:
//   - Se monta por createPortal en document.body: el overlay y el card se
//     centran en el VIEWPORT aunque algún ancestro tenga transform/animación
//     (un transform convierte el position:fixed en relativo a ese ancestro).
//   - Cierra con Escape y bloquea el scroll del fondo mientras está abierto.
//
// Contenido:
//   - mensaje: texto plano (compatibilidad con todos los callers existentes).
//   - contenido: JSX libre (listas, grids, ...) para cuando el texto no basta
//     — así nadie arma overlays a mano para mostrar una lista.
//   - aviso: nota discreta al pie (advertencia secundaria, no bloqueante).
// ==============================================================================

import { useEffect } from "react"
import type { ReactNode } from "react"
import Icon from "@/components/ui/Icon"

interface Props {
    icon: string
    iconBg: string
    iconColor: string
    titulo: string
    /** Texto plano. Opcional si se pasa `contenido`. */
    mensaje?: string
    /** JSX libre (lista de puntos, detalles, etc.) debajo del mensaje. */
    contenido?: ReactNode
    /** Nota discreta al pie del card (advertencia secundaria). */
    aviso?: string
    btnConfirmar: string
    /** Texto del botón de cancelar (default "Cancelar"). */
    btnCancelar?: string
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
    contenido,
    aviso,
    btnConfirmar,
    btnCancelar = "Cancelar",
    btnColor,
    onCancelar,
    onConfirmar,
}: Props) {
    // Escape cierra + el fondo no scrollea mientras el modal vive.
    useEffect(() => {
        const alEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancelar()
        }
        window.addEventListener("keydown", alEscape)
        const overflowPrevio = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            window.removeEventListener("keydown", alEscape)
            document.body.style.overflow = overflowPrevio
        }
    }, [onCancelar])

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            padding: 24
        }}>
            <div className="card" style={{
                maxWidth: 460, width: "100%", padding: 28, gap: 18,
                display: "flex", flexDirection: "column",
                maxHeight: "calc(100vh - 48px)", overflowY: "auto",
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

                {mensaje && (
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                        {mensaje}
                    </p>
                )}

                {contenido}

                {aviso && (
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        {aviso}
                    </p>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={onCancelar}
                        style={{
                            padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)", color: "var(--text-main)",
                            fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                            transition: "all 0.15s"
                        }}
                    >
                        {btnCancelar}
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
