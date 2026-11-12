// ==============================================================================
// src/components/personalizacion/CardConectarMuse.tsx
// Tarjeta "Conectar mi IA" (tab Mi Negocio): gestión de las claves API del
// servidor MCP — el conector que permite a un agente IA (como Muse de Meta)
// leer el catálogo del negocio: productos, precios de venta, stock,
// descripciones y fotos. Nunca costos.
//
// Flujo:
//   1. Generar clave (se muestra UNA sola vez — el backend solo guarda su hash)
//   2. Copiar el prompt e insertarlo en un chat del agente: crea el custom
//      connector con la URL del /mcp y la clave
//   3. Revocar desconecta el agente al instante
// ==============================================================================

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import { api, BASE_URL, type ClaveMcp } from "@/lib/api"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"

const inputStyle = {
    width: "100%",
    fontSize: "0.75rem",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid var(--border-primary)",
    background: "var(--bg-card2)",
    color: "var(--text-main)",
    outline: "none",
    fontWeight: 600,
} as const

const botonIcono = { background: "none", border: "none", cursor: "pointer", padding: 4 } as const

/** Prompt que se pega en el chat del agente (Muse) para crear el custom
 *  connector. Lleva la clave embebida: solo se puede armar en el momento
 *  de crearla, porque después ya no se puede recuperar. */
function promptConector(clave: string): string {
    return [
        "Crea un custom connector para mi servidor MCP con estos datos:",
        "",
        `- URL: ${BASE_URL}/mcp`,
        "- Transporte: streamable HTTP",
        `- Autenticación: header "X-API-Key" con el valor: ${clave}`,
        "",
        "Es un conector de SOLO LECTURA del catálogo de mi negocio (productos físicos, precios de venta, descripciones, tamaños, stock y fotos; sin costos internos).",
        "Cuando te pida publicar un producto en Marketplace o redes sociales, usa estos tools para obtener los datos (busca el producto y usa datos_para_publicar) en lugar de pedírmelos a mí.",
    ].join("\n")
}

function formatearFecha(iso: string | null): string {
    if (!iso) return "—"
    try {
        return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    } catch {
        return iso
    }
}

async function copiar(texto: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(texto)
        return true
    } catch {
        // Fallback para navegadores sin Clipboard API (contextos no seguros)
        try {
            const ta = document.createElement("textarea")
            ta.value = texto
            ta.style.position = "fixed"
            ta.style.opacity = "0"
            document.body.appendChild(ta)
            ta.select()
            document.execCommand("copy")
            document.body.removeChild(ta)
            return true
        } catch {
            return false
        }
    }
}

export function CardConectarMuse() {
    const { tenant } = useTenant()
    const tenantId = tenant?.tenant_id
    const { mostrarMsg } = useToast()
    const queryClient = useQueryClient()

    const [nombre, setNombre] = useState("")
    const [ocupado, setOcupado] = useState(false)
    // Clave recién creada (se muestra una sola vez junto con su prompt)
    const [claveNueva, setClaveNueva] = useState<string | null>(null)
    const [copiado, setCopiado] = useState<"clave" | "prompt" | null>(null)

    const clavesQuery = useQuery({
        queryKey: ["muse-claves", tenantId ?? "sin-tenant"],
        queryFn: api.getClaves,
        enabled: Boolean(tenantId),
    })
    const claves: ClaveMcp[] = clavesQuery.data?.claves ?? []

    function invalidar() {
        queryClient.invalidateQueries({ queryKey: ["muse-claves", tenantId ?? "sin-tenant"] })
    }

    async function generar() {
        setOcupado(true)
        try {
            const r = await api.crearClave(nombre || undefined)
            setClaveNueva(r.clave)
            setNombre("")
            invalidar()
            mostrarMsg(true, "Clave creada. Cópiala ahora: no se volverá a mostrar.")
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    async function revocar(c: ClaveMcp) {
        if (!confirm(`¿Revocar la clave "${c.nombre}"? El agente que la usa quedará desconectado de inmediato.`)) return
        try {
            await api.revocarClave(c.id)
            mostrarMsg(true, `Clave "${c.nombre}" revocada`)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        }
    }

    async function copiarYavisar(que: "clave" | "prompt") {
        const texto = que === "clave" ? claveNueva : promptConector(claveNueva || "")
        if (!texto) return
        const ok = await copiar(texto)
        if (ok) {
            setCopiado(que)
            setTimeout(() => setCopiado(null), 2000)
        } else {
            mostrarMsg(false, "No se pudo copiar; selecciona el texto manualmente")
        }
    }

    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 380px", maxWidth: 560 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="Bot" size={20} color="var(--primary-dark)" /> Conectar mi IA
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>
                Conecta un agente IA (como <strong>Muse</strong>) para que lea tu catálogo: precios de venta, stock,
                descripciones y fotos. Así puedes decirle “publica en Marketplace el producto X” y él saca los datos solo.
                <strong> Nunca ve tus costos</strong> y no puede modificar nada (solo lectura).
            </p>

            {/* ── Clave recién creada: se muestra UNA sola vez ── */}
            {claveNueva && (
                <div style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid var(--primary-mid)", background: "var(--bg-card2)", marginBottom: 16 }}>
                    <p style={{ margin: "0 0 6px", fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-dark)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Tu nueva clave — guárdala ahora
                    </p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <code style={{ flex: 1, fontSize: "0.72rem", wordBreak: "break-all", fontFamily: "monospace", background: "var(--bg-card)", padding: "6px 8px", borderRadius: 6 }}>
                            {claveNueva}
                        </code>
                        <button onClick={() => copiarYavisar("clave")} title="Copiar clave" style={botonIcono}>
                            <Icon name={copiado === "clave" ? "Check" : "Copy"} size={16} color="var(--primary-dark)" />
                        </button>
                    </div>
                    <p style={{ margin: "0 0 6px", fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-dark)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Pega esto en un chat de tu IA para conectarla
                    </p>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <pre style={{ flex: 1, margin: 0, fontSize: "0.66rem", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", background: "var(--bg-card)", padding: "8px 10px", borderRadius: 6, maxHeight: 150, overflow: "auto" }}>
                            {promptConector(claveNueva)}
                        </pre>
                        <button onClick={() => copiarYavisar("prompt")} title="Copiar prompt completo" style={botonIcono}>
                            <Icon name={copiado === "prompt" ? "Check" : "Copy"} size={16} color="var(--primary-dark)" />
                        </button>
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Por seguridad la clave no se vuelve a mostrar. Si la pierdes, revoca y genera otra.
                    </p>
                </div>
            )}

            {/* ── Lista de claves ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {claves.length === 0 && (
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Sin agentes conectados. Genera una clave para conectar el primero.
                    </p>
                )}
                {claves.map(c => {
                    const activa = !c.revocada_en
                    return (
                        <div key={c.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", opacity: activa ? 1 : 0.6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.85rem", color: activa ? "var(--text-main)" : "var(--text-muted)" }}>
                                        {c.nombre}{!activa && " (revocada)"}
                                    </p>
                                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, fontFamily: "monospace" }}>
                                        {c.key_prefix}
                                    </p>
                                    <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                        {activa
                                            ? `${c.llamadas_hoy} llamadas hoy · último uso ${formatearFecha(c.ultimo_uso_en)}`
                                            : `revocada el ${formatearFecha(c.revocada_en)}`}
                                    </p>
                                </div>
                                {activa && (
                                    <button onClick={() => revocar(c)} title="Revocar (desconecta a la IA)" style={botonIcono}>
                                        <Icon name="Trash2" size={15} color="#b71c1c" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Alta de clave ── */}
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Conectar un agente
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                <input
                    placeholder="Nombre (ej. Muse de mi celular)"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    maxLength={40}
                    style={inputStyle}
                />
            </div>
            <button onClick={generar} disabled={ocupado} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="KeyRound" size={15} /> Generar clave
            </button>
        </div>
    )
}
