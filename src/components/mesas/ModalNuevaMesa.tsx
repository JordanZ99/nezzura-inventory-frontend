// ==============================================================================
// src/components/mesas/ModalNuevaMesa.tsx
// Alta/edición de mesa: nombre y capacidad opcional. En modo edición también
// permite eliminar (solo si la mesa está Libre — lo valida el backend).
// ==============================================================================

import { useEffect, useRef, useState } from "react"
import type { Mesa } from "@/lib/api"

interface Props {
    mesa?: Mesa | null          // null/undefined = crear
    onGuardar: (nombre: string, capacidad: number | null) => void
    onEliminar?: () => void
    onCancelar: () => void
}

export function ModalNuevaMesa({ mesa, onGuardar, onEliminar, onCancelar }: Props) {
    const esEdicion = Boolean(mesa)
    const [nombre, setNombre] = useState(mesa?.nombre ?? "")
    const [capacidad, setCapacidad] = useState(mesa?.capacidad ? String(mesa.capacidad) : "")
    const [error, setError] = useState("")
    const refNombre = useRef<HTMLInputElement>(null)

    useEffect(() => {
        refNombre.current?.focus()
        function manejarEscape(e: KeyboardEvent) {
            if (e.key === "Escape") onCancelar()
        }
        document.addEventListener("keydown", manejarEscape)
        return () => document.removeEventListener("keydown", manejarEscape)
    }, [onCancelar])

    function guardar() {
        const nombreLimpio = nombre.trim()
        if (!nombreLimpio) {
            setError("Ponle un nombre a la mesa (ej. Mesa 1, Terraza A)")
            return
        }
        setError("")
        const cap = parseInt(capacidad.replace(",", "."), 10)
        onGuardar(nombreLimpio, isNaN(cap) || cap <= 0 ? null : cap)
    }

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
        }}>
            <div className="fade-up" style={{
                background: "var(--bg-card)",
                borderRadius: 20,
                padding: "28px 24px 24px",
                maxWidth: 400,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                border: "1px solid var(--border-primary)",
            }}>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                    {esEdicion ? "Editar mesa" : "Nueva mesa"}
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {esEdicion
                        ? (mesa?.estado === "Libre" ? "Actualiza el nombre o la capacidad." : "Esta mesa tiene una orden abierta: solo el nombre/capacidad.")
                        : "Agrégala al final de la parrilla; puedes arrastrarla después."}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                        <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginBottom: 4 }}>
                            Nombre *
                        </label>
                        <input
                            ref={refNombre}
                            type="text"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && guardar()}
                            placeholder="Ej. Mesa 1, Terraza A…"
                            className="input-primary"
                            style={{ width: "100%", fontSize: "0.9rem" }}
                            maxLength={40}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginBottom: 4 }}>
                            Capacidad (personas)
                        </label>
                        <input
                            type="number" min="1" step="1"
                            value={capacidad}
                            onChange={e => setCapacidad(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && guardar()}
                            placeholder="Ej. 4"
                            className="input-primary"
                            style={{ width: "100%", fontSize: "0.9rem" }}
                        />
                    </div>
                    {error && (
                        <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "#b71c1c" }}>{error}</p>
                    )}
                    <button className="btn-primary" onClick={guardar} style={{ width: "100%", marginTop: 4 }}>
                        {esEdicion ? "Guardar cambios" : "Crear mesa"}
                    </button>
                    {esEdicion && onEliminar && (
                        <button
                            onClick={onEliminar}
                            disabled={mesa?.estado !== "Libre"}
                            title={mesa?.estado !== "Libre" ? "La mesa tiene una orden abierta" : "Eliminar mesa"}
                            style={{
                                width: "100%", padding: "9px 14px", borderRadius: 10,
                                border: "1px solid #f2b8b5", background: "#fdecea", color: "#b71c1c",
                                fontWeight: 700, fontSize: "0.8rem",
                                cursor: mesa?.estado !== "Libre" ? "not-allowed" : "pointer", opacity: mesa?.estado !== "Libre" ? 0.55 : 1,
                            }}
                        >
                            Eliminar mesa
                        </button>
                    )}
                    <button className="btn-ghost" onClick={onCancelar} style={{ width: "100%" }}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}
