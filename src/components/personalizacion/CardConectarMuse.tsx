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
import { createPortal } from "react-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import { api, BASE_URL, type ClaveMcp, NIVELES_CLAVE } from "@/lib/api"
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
 *  de crearla, porque después ya no se puede recuperar. Varía según el
 *  nivel de permiso de la clave. */
function promptConector(clave: string, nivel: number): string {
    const lineas = [
        "Crea un custom connector para mi servidor MCP con estos datos:",
        "",
        `- URL: ${BASE_URL}/mcp`,
        "- Transporte: streamable HTTP",
        `- Autenticación: header "X-API-Key" con el valor: ${clave}`,
        "",
        "Conector del inventario de mi negocio (productos físicos, precios de venta, descripciones, tamaños, stock y fotos; sin costos internos).",
        "Cuando te pida publicar un producto en Marketplace o redes sociales, usa estos tools para obtener los datos (busca el producto y usa datos_para_publicar) en lugar de pedírmelos a mí.",
    ]
    if (nivel >= 2) {
        lineas.push(
            "Además, cuando te pregunte cómo va mi negocio (ganancias, gastos, stock en riesgo, cobros pendientes), usa resumen_negocio y hallazgos_inteligentes: son cálculos reales de mi gestor, así que NUNCA inventes cifras.",
        )
    }
    if (nivel >= 3) {
        lineas.push(
            "También puedo pedirte crear productos nuevos: SIEMPRE usa primero proponer_producto (valida y guarda el borrador) y después confirmar_producto con el borrador_id que devuelva. Si un dato falta o es inválido, proponer_producto te dirá exactamente qué corregir.",
        )
    }
    return lineas.join("\n")
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
    const [nivelSeleccionado, setNivelSeleccionado] = useState<1 | 2 | 3>(1)
    // Modal de advertencia: al elegir un nivel SUPERIOR al actual se pide
    // confirmación con la lista de permisos nuevos que adquirirá el agente.
    const [modalNivel, setModalNivel] = useState<1 | 2 | 3 | null>(null)
    const [ocupado, setOcupado] = useState(false)
    // Clave recién creada (se muestra una sola vez junto con su prompt)
    const [claveNueva, setClaveNueva] = useState<string | null>(null)
    const [nivelNueva, setNivelNueva] = useState<1 | 2 | 3>(1)
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
            const r = await api.crearClave(nombre || undefined, nivelSeleccionado)
            setClaveNueva(r.clave)
            setNivelNueva(nivelSeleccionado)
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
        const texto = que === "clave" ? claveNueva : promptConector(claveNueva || "", nivelNueva)
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
                <strong> Nunca ve tus costos unitarios.</strong> Elige el nivel de permiso al crear cada clave:
                análisis del negocio y creación de productos son opcionales y se activan por clave.
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
                            {promptConector(claveNueva, nivelNueva)}
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
                    const nivelInfo = NIVELES_CLAVE[c.nivel] ?? NIVELES_CLAVE[1]
                    return (
                        <div key={c.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", opacity: activa ? 1 : 0.6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.85rem", color: activa ? "var(--text-main)" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        {c.nombre}{!activa && " (revocada)"}
                                        <span style={{
                                            fontSize: "0.6rem", fontWeight: 800, padding: "1px 7px", borderRadius: 20,
                                            background: activa ? "var(--primary-mid)" : "var(--border-primary)",
                                            color: activa ? "white" : "var(--text-muted)",
                                        }}>
                                            Nivel {c.nivel} · {nivelInfo.nombre}
                                        </span>
                                    </p>
                                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, fontFamily: "monospace" }}>
                                        {c.key_prefix}
                                    </p>
                                    <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                        {activa
                                            ? `${c.llamadas_hoy} llamadas hoy${c.nivel >= 3 ? ` · ${c.escrituras_hoy} escrituras` : ""} · último uso ${formatearFecha(c.ultimo_uso_en)}`
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

            {/* ── Alta de clave: nivel + nombre ── */}
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Conectar un agente — elige su nivel de permiso
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {([1, 2, 3] as const).map(n => {
                    const info = NIVELES_CLAVE[n]
                    const elegido = nivelSeleccionado === n
                    return (
                        <button
                            key={n}
                            type="button"
                            onClick={() => (n > nivelSeleccionado ? setModalNivel(n) : setNivelSeleccionado(n))}
                            style={{
                                textAlign: "left", cursor: "pointer", padding: "10px 12px", borderRadius: 10,
                                border: elegido ? "2px solid var(--primary-mid)" : "1px solid var(--border-primary)",
                                background: elegido ? "var(--bg-card2)" : "var(--bg-card)",
                            }}
                        >
                            <p style={{ margin: 0, fontWeight: 800, fontSize: "0.8rem", color: elegido ? "var(--primary-dark)" : "var(--text-main)" }}>
                                Nivel {n} · {info.nombre}
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                {info.descripcion}
                            </p>
                        </button>
                    )
                })}
            </div>
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

            {/* ── Modal: advertencia al subir a un nivel superior ──
                Va por createPortal a document.body: position:fixed se ancla
                al viewport SIEMPRE (un ancestro con transform — la animación
                fade-up del card — convertiría el fixed en relativo al card). */}
            {modalNivel !== null && createPortal(
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 24,
                }}>
                    <div className="card" style={{
                        maxWidth: 460, width: "100%", padding: 26,
                        display: "flex", flexDirection: "column", gap: 14,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-light)",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, background: "#fff3e0",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                                <Icon name="ShieldAlert" size={24} color="#e65100" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                Nivel {modalNivel} · {NIVELES_CLAVE[modalNivel].nombre}
                            </h3>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-main)", fontWeight: 600 }}>
                            Con esta clave el agente IA además podrá:
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                            {((nivelSeleccionado < 2 && modalNivel >= 2)
                                ? NIVELES_CLAVE[2].permisosNuevos : []
                            ).concat(NIVELES_CLAVE[modalNivel].permisosNuevos).map((p, i) => (
                                <li key={i} style={{ fontSize: "0.78rem", color: "var(--text-main)", lineHeight: 1.4 }}>
                                    {p}
                                </li>
                            ))}
                        </ul>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                            {NIVELES_CLAVE[modalNivel].advertencia}
                        </p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                            <button
                                onClick={() => setModalNivel(null)}
                                style={{
                                    padding: "10px 20px", borderRadius: 10,
                                    border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                                    color: "var(--text-main)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                                }}
                            >
                                Rechazar
                            </button>
                            <button
                                onClick={() => { setNivelSeleccionado(modalNivel); setModalNivel(null) }}
                                className="btn-primary"
                                style={{ padding: "10px 20px", borderRadius: 10, border: "none", display: "flex", alignItems: "center", gap: 8 }}
                            >
                                <Icon name="Check" size={16} /> Aceptar y dar estos permisos
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
