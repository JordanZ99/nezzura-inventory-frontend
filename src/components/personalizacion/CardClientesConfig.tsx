// ==============================================================================
// src/components/personalizacion/CardClientesConfig.tsx
// Tarjeta "Cartera de clientes" (tab Mi Negocio): activa la cartera y define
// qué datos se le piden a cada cliente (correo, número, contraseña) y si son
// obligatorios u opcionales. El nombre SIEMPRE es obligatorio y no es editable.
// La config vive en el backend (tenants.cliente_campos, migración 038).
// ==============================================================================

import { useEffect, useState } from "react"
import Icon from "@/components/ui/Icon"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"
import type { ClienteCampos } from "@/types"

type EstadoCampo = "obligatorio" | "opcional" | "no_pedir"

interface Props {
    cargandoTenant: boolean
}

const ETIQUETAS_CAMPO: { clave: keyof Omit<ClienteCampos, never>; label: string; hint: string }[] = [
    { clave: "email", label: "Correo", hint: "Único por cliente cuando se captura" },
    { clave: "telefono", label: "Número", hint: "Único por cliente cuando se captura" },
    { clave: "pin", label: "Contraseña", hint: "El cliente la dice en el POS para identificarse" },
]

function estadoDeCfg(cfg: { activo: boolean; requerido: boolean }): EstadoCampo {
    if (cfg.requerido) return "obligatorio"
    return cfg.activo ? "opcional" : "no_pedir"
}

function cfgDeEstado(e: EstadoCampo): { activo: boolean; requerido: boolean } {
    if (e === "obligatorio") return { activo: true, requerido: true }
    if (e === "opcional") return { activo: true, requerido: false }
    return { activo: false, requerido: false }
}

export function CardClientesConfig({ cargandoTenant }: Props) {
    const { tenant, actualizar } = useTenant()
    const { mostrarMsg } = useToast()

    const [activo, setActivo] = useState(false)
    const [estados, setEstados] = useState<Record<string, EstadoCampo>>({
        email: "obligatorio", telefono: "obligatorio", pin: "no_pedir",
    })
    const [guardando, setGuardando] = useState(false)

    // Sincronizar con la config cargada del backend
    useEffect(() => {
        if (tenant) {
            setActivo(tenant.clientes_activos)
            setEstados({
                email: estadoDeCfg(tenant.cliente_campos.email),
                telefono: estadoDeCfg(tenant.cliente_campos.telefono),
                pin: estadoDeCfg(tenant.cliente_campos.pin),
            })
        }
    }, [tenant])

    async function guardar() {
        setGuardando(true)
        try {
            await actualizar({
                clientes_activos: activo,
                cliente_campos: {
                    email: cfgDeEstado(estados.email),
                    telefono: cfgDeEstado(estados.telefono),
                    pin: cfgDeEstado(estados.pin),
                },
            })
            mostrarMsg(true, activo ? "✅ Cartera de clientes actualizada" : "Cartera de clientes desactivada")
        } catch (e: unknown) {
            mostrarMsg(false, `❌ ${e instanceof Error ? e.message : "Error al guardar"}`)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 320px", maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Cartera de Clientes</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>
                Organiza tu clientela, gana y canjea puntos con el POS y mide su impacto en Estadísticas → Clientes.
            </p>

            {/* Toggle maestro */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", marginBottom: 18 }}>
                <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} style={{ marginTop: 2 }} />
                <span>
                    Activar cartera de clientes. Añade el botón «Cliente» en el punto de venta y la tab «Clientes» en Estadísticas.
                </span>
            </label>

            {/* Campos pedidos al registrar un cliente */}
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Datos que se piden al registrar
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "var(--bg-card2)", border: "1px solid var(--border-primary)" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>Nombre</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)" }}>Siempre obligatorio</span>
                </div>
                {ETIQUETAS_CAMPO.map(c => (
                    <div key={c.clave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "var(--bg-card2)", border: "1px solid var(--border-primary)" }}>
                        <div>
                            <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700 }}>{c.label}</p>
                            <p style={{ margin: 0, fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 600 }}>{c.hint}</p>
                        </div>
                        <select
                            value={estados[c.clave]}
                            onChange={e => setEstados(prev => ({ ...prev, [c.clave]: e.target.value as EstadoCampo }))}
                            style={{
                                fontSize: "0.72rem", padding: "6px 8px", borderRadius: 8,
                                border: "1px solid var(--border-primary)", background: "var(--bg-card)",
                                color: "var(--text-main)", outline: "none", cursor: "pointer", fontWeight: 600,
                            }}
                        >
                            <option value="obligatorio">Obligatorio</option>
                            <option value="opcional">Opcional</option>
                            <option value="no_pedir">No pedir</option>
                        </select>
                    </div>
                ))}
            </div>

            <button className="btn-primary" onClick={guardar} disabled={guardando || cargandoTenant}
                style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}>
                <Icon name="Save" size={16} /> {guardando ? "Guardando..." : "Guardar configuración"}
            </button>
        </div>
    )
}
