// ==============================================================================
// src/components/pos/ModalClientePos.tsx
// Identificación del cliente en el POS (Fase B del sistema de puntos):
//  - BUSCAR: número o correo exactos → api.verificarCliente (valida la
//    contraseña SOLO si el cliente la tiene configurada; hash en backend).
//  - LISTA: resultados por nombre/número/correo de la cartera.
//  - REGISTRAR: alta al vuelo con los campos configurados del negocio
//    (nombre obligatorio; correo/número/contraseña según Ajustes → Mi Negocio).
// Muestra el saldo de puntos (1 pt = valor del punto configurado).
// ==============================================================================

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import Icon from "@/components/ui/Icon"
import type { ClientePos } from "@/hooks/usePosCarrito"
import type { ClienteCampos } from "@/types"

interface Props {
    campos: ClienteCampos
    valorPunto: number
    onSeleccionar: (cliente: ClientePos) => void
    onCancelar: () => void
}

const inputStyle = {
    width: "100%",
    fontSize: "0.8rem",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border-primary)",
    background: "var(--bg-card2)",
    color: "var(--text-main)",
    outline: "none",
    fontWeight: 600,
} as const

export function ModalClientePos({ campos, valorPunto, onSeleccionar, onCancelar }: Props) {
    const [modo, setModo] = useState<"buscar" | "registrar">("buscar")

    // ── Modo buscar: identificación por número/correo (+ contraseña si hay config)
    const [identificador, setIdentificador] = useState("")
    const [pin, setPin] = useState("")
    const [error, setError] = useState("")
    const [verificando, setVerificando] = useState(false)

    // Lista viva de la cartera para elegir por nombre (debounce simple)
    const [filtrosBusqueda, setFiltrosBusqueda] = useState("")
    const [busquedaDebounced, setBusquedaDebounced] = useState("")
    useEffect(() => {
        const t = setTimeout(() => setBusquedaDebounced(filtrosBusqueda), 300)
        return () => clearTimeout(t)
    }, [filtrosBusqueda])
    const clientesQuery = useQuery({
        queryKey: ["clientes-pos", busquedaDebounced],
        queryFn: () => api.getClientes({ q: busquedaDebounced || undefined }),
        enabled: modo === "buscar",
    })

    // ── Modo registrar: alta al vuelo con campos dinámicos
    const [form, setForm] = useState({ nombre: "", email: "", telefono: "", pin: "" })
    const [registrando, setRegistrando] = useState(false)

    const refIdentificador = useRef<HTMLInputElement>(null)
    useEffect(() => {
        refIdentificador.current?.focus()
        function manejarEscape(e: KeyboardEvent) {
            if (e.key === "Escape") onCancelar()
        }
        document.addEventListener("keydown", manejarEscape)
        return () => document.removeEventListener("keydown", manejarEscape)
    }, [onCancelar])

    const resultados = useMemo(() => (clientesQuery.data ?? []).slice(0, 6), [clientesQuery.data])

    function aIdentificador(c: { telefono?: string | null; email?: string | null }): string | null {
        return c.telefono || c.email || null
    }

    async function identificarDesde(dato: string, pinAUsar: string) {
        setError("")
        setVerificando(true)
        try {
            const res = await api.verificarCliente(dato, pinAUsar || undefined)
            onSeleccionar({
                id: res.cliente.id,
                nombre: res.cliente.nombre,
                saldo: res.cliente.saldo_puntos,
            })
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "No se pudo identificar al cliente")
        } finally {
            setVerificando(false)
        }
    }

    function faltantesRegistro(): string[] {
        const f: string[] = []
        if (!form.nombre.trim()) f.push("nombre")
        if (campos.email.requerido && !form.email.trim()) f.push("correo")
        if (campos.telefono.requerido && !form.telefono.trim()) f.push("número")
        if (campos.pin.requerido && !form.pin.trim()) f.push("contraseña")
        return f
    }

    async function registrar() {
        const faltan = faltantesRegistro()
        if (faltan.length > 0) {
            setError(`Campos obligatorios: ${faltan.join(", ")}`)
            return
        }
        setError("")
        setRegistrando(true)
        try {
            const res = await api.crearCliente({
                nombre: form.nombre.trim(),
                email: form.email.trim() || undefined,
                telefono: form.telefono.trim() || undefined,
                pin: campos.pin.activo && form.pin.trim() ? form.pin.trim() : undefined,
            })
            onSeleccionar({ id: res.cliente.id, nombre: res.cliente.nombre, saldo: 0 })
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al registrar el cliente")
        } finally {
            setRegistrando(false)
        }
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
                padding: "26px 24px 22px",
                maxWidth: 420,
                width: "90%",
                maxHeight: "86vh",
                overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                border: "1px solid var(--border-primary)",
            }}>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                    Cliente en el ticket
                </h3>
                <p style={{ margin: "0 0 14px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Identifica al cliente para canjear y ganar puntos{campos.pin.activo ? " (pide su contraseña si la configuró)" : ""}.
                </p>

                {/* Toggle buscar / registrar */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <button onClick={() => setModo("buscar")} style={{
                        flex: 1, padding: "7px 10px", borderRadius: 10, fontWeight: 700, fontSize: "0.74rem", cursor: "pointer",
                        border: modo === "buscar" ? "1px solid transparent" : "1px solid var(--border-primary)",
                        background: modo === "buscar" ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: modo === "buscar" ? "#fff" : "var(--text-muted)",
                    }}>Buscar en cartera</button>
                    <button onClick={() => setModo("registrar")} style={{
                        flex: 1, padding: "7px 10px", borderRadius: 10, fontWeight: 700, fontSize: "0.74rem", cursor: "pointer",
                        border: modo === "registrar" ? "1px solid transparent" : "1px solid var(--border-primary)",
                        background: modo === "registrar" ? "var(--primary-mid)" : "var(--bg-card2)",
                        color: modo === "registrar" ? "#fff" : "var(--text-muted)",
                    }}>Registrar nuevo</button>
                </div>

                {modo === "buscar" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                Número o correo del cliente *
                            </label>
                            <input
                                ref={refIdentificador}
                                type="text"
                                value={identificador}
                                onChange={e => setIdentificador(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && identificador.trim() && identificarDesde(identificador, pin)}
                                placeholder="998 123 4567"
                                style={inputStyle}
                            />
                        </div>
                        {campos.pin.activo && (
                            <div>
                                <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                    Contraseña {campos.pin.requerido ? "(si el cliente la configuró)" : "(opcional)"}
                                </label>
                                <input
                                    type="password"
                                    value={pin}
                                    onChange={e => setPin(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && identificador.trim() && identificarDesde(identificador, pin)}
                                    placeholder="••••"
                                    style={inputStyle}
                                />
                            </div>
                        )}
                        <button
                            className="btn-primary"
                            onClick={() => identificarDesde(identificador, pin)}
                            disabled={!identificador.trim() || verificando}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                        >
                            <Icon name="BadgeCheck" size={16} /> {verificando ? "Verificando…" : "Identificar cliente"}
                        </button>

                        {/* Resultados de la cartera para elegir por nombre */}
                        <div>
                            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                O elige de la cartera
                            </label>
                            <input
                                type="text" value={filtrosBusqueda}
                                onChange={e => setFiltrosBusqueda(e.target.value)}
                                placeholder="Buscar por nombre…" style={inputStyle}
                            />
                            <div style={{ marginTop: 8, maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                                {clientesQuery.isPending && (
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>Buscando…</p>
                                )}
                                {!clientesQuery.isPending && resultados.length === 0 && (
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        {busquedaDebounced ? "Sin resultados." : "Cartera vacía — registra al primer cliente."}
                                    </p>
                                )}
                                {resultados.map(c => {
                                    const dato = aIdentificador(c)
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => dato ? identificarDesde(dato, pin) : setError("Este cliente no tiene número ni correo para identificarse; regístralo de nuevo o quita la contraseña")}
                                            style={{
                                                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                                                padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                                                border: "1px solid var(--border-primary)", background: "var(--bg-card2)", textAlign: "left",
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 800, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</p>
                                                <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                                    {c.telefono || c.email || "sin contacto"}
                                                </p>
                                            </div>
                                            <span style={{ fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>{c.saldo_puntos} pts</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                            <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nombre *</label>
                            <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. María López" style={inputStyle} />
                        </div>
                        {campos.email.activo && (
                            <div>
                                <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Correo {campos.email.requerido ? "*" : "(opcional)"}</label>
                                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="cliente@correo.com" style={inputStyle} />
                            </div>
                        )}
                        {campos.telefono.activo && (
                            <div>
                                <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Número {campos.telefono.requerido ? "*" : "(opcional)"}</label>
                                <input type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="998 123 4567" style={inputStyle} />
                            </div>
                        )}
                        {campos.pin.activo && (
                            <div>
                                <label style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Contraseña {campos.pin.requerido ? "*" : "(opcional)"}</label>
                                <input type="password" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })}                                     placeholder="La usará en el POS para identificarse" style={inputStyle} />
                            </div>
                        )}
                        <button className="btn-primary" onClick={registrando ? undefined : registrar} disabled={registrando}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
                            <Icon name="UserRoundPlus" size={16} /> {registrando ? "Registrando…" : "Registrar y usar"}
                        </button>
                    </div>
                )}

                {error && <p style={{ margin: "10px 0 0", fontSize: "0.75rem", fontWeight: 700, color: "#b71c1c" }}>{error}</p>}

                <button className="btn-ghost" onClick={onCancelar} style={{ width: "100%", marginTop: 14 }}>
                    Cancelar
                </button>
            </div>
        </div>
    )
}
