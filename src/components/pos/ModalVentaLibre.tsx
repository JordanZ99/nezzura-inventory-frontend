// ==============================================================================
// src/components/pos/ModalVentaLibre.tsx
// Mini-form de la Venta libre (migración 036): se abre desde el tile fijo
// "＋ Venta libre" del POS. Cobra algo que NO está registrado en inventario:
// descripción opcional (aparece en el ticket y en el historial), costo
// opcional (0 = la ganancia del renglón es el precio completo) y precio
// requerido. Migración 060: además puede llevar la CATEGORÍA del tenant —
// contablemente el renglón sigue siendo la línea única 'Venta libre', la
// categoría solo clasifica la venta (chips en historial y mesa/cocina).
// El renglón entra al carrito como el producto genérico 'Venta libre'.
// ==============================================================================

import { useEffect, useRef, useState } from "react"

interface Props {
    categorias?: string[]
    onAgregar: (descripcion: string, precio: number, costo: number, categoria?: string) => void
    onCancelar: () => void
}

function aNumero(texto: string): number {
    const n = parseFloat(texto.replace(",", "."))
    return isNaN(n) ? 0 : n
}

export function ModalVentaLibre({ categorias = [], onAgregar, onCancelar }: Props) {
    const [descripcion, setDescripcion] = useState("")
    const [precio, setPrecio] = useState("")
    const [costo, setCosto] = useState("")
    const [categoria, setCategoria] = useState("")
    const [error, setError] = useState("")
    const refDescripcion = useRef<HTMLInputElement>(null)

    // Escape cierra (igual que los otros modales del POS); autofocus al abrir.
    useEffect(() => {
        refDescripcion.current?.focus()
        function manejarEscape(e: KeyboardEvent) {
            if (e.key === "Escape") onCancelar()
        }
        document.addEventListener("keydown", manejarEscape)
        return () => document.removeEventListener("keydown", manejarEscape)
    }, [onCancelar])

    function agregar() {
        const precioNum = aNumero(precio)
        if (precioNum <= 0) {
            setError("Captura el precio de lo que estás cobrando")
            return
        }
        setError("")
        onAgregar(descripcion, precioNum, aNumero(costo), categoria || undefined)
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
                    Venta libre
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Cobra algo que no está en tu inventario (ej. cereal, un platillo sin registrar o un artículo usado).
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                        <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginBottom: 4 }}>
                            ¿Qué es? (opcional)
                        </label>
                        <input
                            ref={refDescripcion}
                            type="text"
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && agregar()}
                            placeholder="Ej. Cereal, silla usada…"
                            className="input-primary"
                            style={{ width: "100%", fontSize: "0.9rem" }}
                            maxLength={80}
                        />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {/* Costo a la izquierda (opcional), precio a la derecha (requerido) */}
                        <div>
                            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginBottom: 4 }}>
                                Costo (opcional)
                            </label>
                            <input
                                type="text" inputMode="decimal"
                                value={costo}
                                onChange={e => setCosto(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && agregar()}
                                placeholder="0.00"
                                className="input-primary"
                                style={{ width: "100%", fontSize: "0.9rem", textAlign: "right" }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginBottom: 4 }}>
                                Precio *
                            </label>
                            <input
                                type="text" inputMode="decimal"
                                value={precio}
                                onChange={e => setPrecio(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && agregar()}
                                placeholder="0.00"
                                className="input-primary"
                                style={{ width: "100%", fontSize: "0.9rem", textAlign: "right" }}
                            />
                        </div>
                    </div>
                    {categorias.length > 0 && (
                        <div>
                            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginBottom: 4 }}>
                                Categoría (opcional)
                            </label>
                            <select
                                value={categoria}
                                onChange={e => setCategoria(e.target.value)}
                                className="input-primary"
                                style={{ width: "100%", fontSize: "0.88rem" }}
                            >
                                <option value="">Sin categoría</option>
                                {categorias.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {error && (
                        <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "#b71c1c" }}>{error}</p>
                    )}
                    <button className="btn-primary" onClick={agregar} style={{ width: "100%", marginTop: 4 }}>
                        Agregar al carrito
                    </button>
                    <button className="btn-ghost" onClick={onCancelar} style={{ width: "100%" }}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}
