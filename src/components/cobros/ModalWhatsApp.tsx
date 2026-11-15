"use client"
// ==============================================================================
// src/components/cobros/ModalWhatsApp.tsx
// Mini-modal compartido de envío por WhatsApp: muestra el texto YA redactado,
// editable, y abre wa.me al confirmar ("tú decides si se manda", patrón
// Kobsi/CobrApp). Sin teléfono válido → toast claro, nunca se rompe.
// ==============================================================================

import { useState } from "react"
import Icon from "@/components/ui/Icon"
import { abrirWhatsApp } from "@/lib/whatsapp"
import { useToast } from "@/components/ui/Toast"

interface Props {
    telefono: string | null | undefined
    texto: string
    onClose: () => void
}

export default function ModalWhatsApp({ telefono, texto, onClose }: Props) {
    const { mostrarMsg } = useToast()
    const [txt, setTxt] = useState(texto)

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 20,
        }}>
            <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--border-light)" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                    Mensaje por WhatsApp
                </h3>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Revísalo y edítalo como quieras; se abre con el texto listo.
                </p>
                <textarea value={txt}
                    onChange={e => setTxt(e.target.value)}
                    rows={6}
                    style={{
                        width: "100%", padding: "10px 12px", borderRadius: 10,
                        border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                        color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 600,
                        boxSizing: "border-box", resize: "vertical", lineHeight: 1.5,
                    }} />
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={onClose}
                        style={{
                            padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer",
                        }}>
                        Cancelar
                    </button>
                    <button onClick={() => {
                        const ok = abrirWhatsApp(telefono, txt)
                        if (!ok) mostrarMsg(false, "Este cliente no tiene un teléfono válido guardado")
                        onClose()
                    }}
                        style={{
                            padding: "10px 18px", borderRadius: 10, border: "none",
                            background: "#128C7E", color: "#fff", fontWeight: 800, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", gap: 8,
                        }}>
                        <Icon name="MessageCircle" size={16} />
                        Abrir WhatsApp
                    </button>
                </div>
            </div>
        </div>
    )
}
