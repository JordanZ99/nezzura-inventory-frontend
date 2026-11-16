// ==============================================================================
// src/components/personalizacion/CardConectarMuse.tsx
// Tarjeta "Conectar mi IA" (tab Mi Negocio): gestión de las claves API del
// servidor MCP — el conector que permite a un agente IA (como Muse de Meta)
// trabajar con el negocio según los ROLES que el dueño activa (toggles):
// publicar en redes, analizar el negocio, cuidar las fotos o crear/editar
// productos. El agente ve la UNIÓN de las tools de sus roles — nunca costos
// salvo el permiso explícito 'ver costos'.
//
// Flujo:
//   1. Activar los roles del agente y generar la clave (se muestra UNA sola
//      vez — el backend solo guarda su hash)
//   2. Copiar el prompt e insertarlo en un chat del agente: crea el custom
//      connector con la URL del /mcp y la clave
//   3. Cambiar roles o revocar afecta al agente al instante (sin reconexión)
// ==============================================================================

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import ModalConfirmacion from "@/components/ui/ModalConfirmacion"
import { api, BASE_URL, type ClaveMcp, ROLES_CLAVE, ROLES_ORDEN, DEFAULTS_LIMITES } from "@/lib/api"
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
 *  de crearla, porque después ya no se puede recuperar. El brief varía según
 *  los ROLES activos de la clave. */
function promptConector(clave: string, roles: string[]): string {
    const set = new Set(roles)
    const lineas = [
        "Crea un custom connector para mi servidor MCP con estos datos:",
        "",
        `- URL: ${BASE_URL}/mcp`,
        "- Transporte: streamable HTTP",
        `- Autenticación: header "X-API-Key" con el valor: ${clave}`,
        "",
    ]
    if (set.has("publicador")) {
        lineas.push(
            "Conector del inventario de mi negocio (productos físicos, precios de venta, descripciones, tamaños, stock y fotos; sin costos internos).",
            "Cuando te pida publicar un producto en Marketplace o redes sociales, busca el producto y usa datos_para_publicar para obtener los datos en lugar de pedírmelos a mí.",
        )
    }
    if (set.has("analista")) {
        lineas.push(
            "Cuando te pregunte cómo va mi negocio (ganancias, gastos, stock en riesgo, cobros pendientes), usa resumen_negocio y hallazgos_inteligentes: son cálculos reales de mi gestor, así que NUNCA inventes cifras.",
        )
    }
    if (set.has("disenador")) {
        lineas.push(
            "También cuido las fotos del catálogo: antes de generar o pegar una imagen, consulta config_catalogo para conocer la proporción (1:1 o 4:5) y el fondo del catálogo. Usa adjuntar_imagen para ponerla (el gestor la reduce de peso y la encaja), eliminar_imagen para quitar la que se ve mal y reordenar_imagenes para decidir cuál va primero.",
        )
    }
    if (set.has("inventario")) {
        lineas.push(
            "Puedo pedirte crear productos nuevos: SIEMPRE usa primero proponer_producto (valida y guarda el borrador) y después confirmar_producto con el borrador_id que devuelva. Si un dato falta o es inválido, proponer_producto te dirá exactamente qué corregir.",
        )
    }
    if (set.has("cajero")) {
        lineas.push(
            "También REGISTRAS VENTAS: cuando te diga qué vendió o te pase la FOTO de un ticket, identifica cada producto con buscar_productos y arma la venta con proponer_venta (envía el producto_id de cada renglón). Muéstrame el desglose que te devuelva y espera mi aprobación antes de confirmar_venta. Si un renglón del ticket no lo puedes leer con certeza, pregúntame: nunca lo adivines ni lo omitas en silencio. Si vendí algo que no está en el inventario, regístralo como venta libre con su motivo.",
        )
    }
    if (!set.has("publicador")) {
        lineas.push("Conector del inventario de mi negocio: productos físicos, precios de venta, stock y fotos.")
    }
    return lineas.join("\n")
}

/** Nombres legibles de los roles de una clave (badge de la lista). */
function nombresDeRoles(roles: string[] | null): string {
    const ids = roles?.filter(r => ROLES_CLAVE[r]) ?? [...ROLES_ORDEN]
    return ids.map(r => ROLES_CLAVE[r].nombre).join(" + ") || "Publicador"
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
    // ROLES del agente nuevo: todos OFF por defecto (mínimo 1 para generar).
    const [rolesNueva, setRolesNueva] = useState<string[]>([])
    // Modal de advertencia al activar un rol de ESCRITURA: sirve para la
    // clave NUEVA (claveId null) y para cambiar los roles de una EXISTENTE.
    const [modalRol, setModalRol] = useState<{ claveId: number | null; rol: string } | null>(null)
    // Modal de confirmación para eliminar una clave definitivamente.
    const [modalEliminar, setModalEliminar] = useState<{ id: number; nombre: string } | null>(null)
    // Sección avanzada de límites abierta por clave (id de la clave).
    const [limitesAbiertos, setLimitesAbiertos] = useState<number | null>(null)
    const [ocupado, setOcupado] = useState(false)
    // Clave recién creada (se muestra una sola vez junto con su prompt)
    const [claveNueva, setClaveNueva] = useState<string | null>(null)
    const [rolesNuevaCreada, setRolesNuevaCreada] = useState<string[]>([])
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

    function alternarRolNueva(rol: string) {
        const activo = rolesNueva.includes(rol)
        if (activo) {
            setRolesNueva(prev => prev.filter(r => r !== rol))
            return
        }
        if (ROLES_CLAVE[rol]?.escritura) {
            setModalRol({ claveId: null, rol })
            return
        }
        setRolesNueva(prev => [...prev, rol])
    }

    async function generar() {
        setOcupado(true)
        try {
            const r = await api.crearClave(nombre || undefined, rolesNueva)
            setClaveNueva(r.clave)
            setRolesNuevaCreada(rolesNueva)
            setRolesNueva([])
            setNombre("")
            invalidar()
            mostrarMsg(true, "Clave creada. Cópiala ahora: no se volverá a mostrar.")
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    async function eliminar(c: ClaveMcp) {
        if (!modalEliminar) return
        setOcupado(true)
        try {
            await api.eliminarClave(c.id)
            mostrarMsg(true, `Clave "${c.nombre}" eliminada: el agente queda desconectado`)
            setModalEliminar(null)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    async function cambiarVerCostos(c: ClaveMcp, ver: boolean) {
        setOcupado(true)
        try {
            await api.editarClave(c.id, { ver_costos: ver })
            mostrarMsg(
                true,
                ver
                    ? "El agente de esta clave ahora ve costos internos y márgenes"
                    : "El agente de esta clave ya no ve costos internos",
            )
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    /** Activar/desactivar un rol de una clave EXISTENTE. El agente no se
     *  reconecta: tools/list se ajusta en el próximo request. 'confirmado'
     *  salta el modal de advertencia: lo manda confirmarModalRol cuando el
     *  dueño YA aceptó (sin él, el Aceptar re-evaluaría la misma condición
     *  del rol de escritura y reabriría el modal en bucle sin guardar). */
    async function alternarRolDeClave(c: ClaveMcp, rol: string, confirmado = false) {
        const actuales = c.roles ?? [...ROLES_ORDEN]  // legacy pre-081 = todas
        const activo = actuales.includes(rol)
        if (!activo && ROLES_CLAVE[rol]?.escritura && !confirmado) {
            setModalRol({ claveId: c.id, rol })
            return
        }
        const nuevos = activo ? actuales.filter(r => r !== rol) : [...actuales, rol]
        if (nuevos.length === 0) {
            mostrarMsg(false, "La clave necesita al menos un rol activo")
            return
        }
        setOcupado(true)
        try {
            await api.editarClave(c.id, { roles: nuevos })
            mostrarMsg(true, `Roles actualizados: el agente no necesita reconectarse`)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    async function confirmarModalRol() {
        if (!modalRol) return
        const { claveId, rol } = modalRol
        setModalRol(null)
        if (claveId === null) {
            setRolesNueva(prev => (prev.includes(rol) ? prev : [...prev, rol]))
            return
        }
        const c = claves.find(k => k.id === claveId)
        if (c) await alternarRolDeClave(c, rol, true)
    }

    async function guardarLimites(c: ClaveMcp, llamadas: HTMLInputElement, escrituras: HTMLInputElement) {
        // Vacío = volver al default del nivel derivado (el backend interpreta 0 así).
        const parsear = (input: HTMLInputElement) => {
            const v = input.value.trim()
            return v === "" ? 0 : Math.max(0, parseInt(v, 10) || 0)
        }
        setOcupado(true)
        try {
            await api.editarClave(c.id, {
                limite_llamadas: parsear(llamadas),
                limite_escrituras: parsear(escrituras),
            })
            setLimitesAbiertos(null)  // cierre visible del editor = guardado
            mostrarMsg(true, "Límites actualizados")
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    async function copiarYavisar(que: "clave" | "prompt") {
        const texto = que === "clave" ? claveNueva : promptConector(claveNueva || "", rolesNuevaCreada)
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
                Conecta un agente IA (como <strong>Muse</strong>) y elige QUÉ TRABAJO hace activando sus roles:
                publicar en redes, analizar el negocio, cuidar las fotos o crear productos. El agente solo ve las
                herramientas de los roles activos. <strong>Nunca ve tus costos unitarios</strong> salvo el permiso
                explícito 'ver costos'. Puedes crear una clave por agente/rol.
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
                        <pre style={{ flex: 1, margin: 0, fontSize: "0.66rem", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", background: "var(--bg-card)", padding: "8px 10px", borderRadius: 6, maxHeight: 170, overflow: "auto" }}>
                            {promptConector(claveNueva, rolesNuevaCreada)}
                        </pre>
                        <button onClick={() => copiarYavisar("prompt")} title="Copiar prompt completo" style={botonIcono}>
                            <Icon name={copiado === "prompt" ? "Check" : "Copy"} size={16} color="var(--primary-dark)" />
                        </button>
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Por seguridad la clave no se vuelve a mostrar. Si la pierdes, elimínala y genera otra.
                    </p>
                </div>
            )}

            {/* ── Lista de claves ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {claves.length === 0 && (
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Sin agentes conectados. Activa los roles y genera una clave para conectar el primero.
                    </p>
                )}
                {claves.map(c => {
                    const activos = c.roles ?? [...ROLES_ORDEN]
                    const escritura = activos.some(r => ROLES_CLAVE[r]?.escritura)
                    const defaults = DEFAULTS_LIMITES[c.nivel] ?? DEFAULTS_LIMITES[1]
                    return (
                        <div key={c.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.85rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        {c.nombre}
                                        <span style={{
                                            fontSize: "0.6rem", fontWeight: 800, padding: "1px 7px", borderRadius: 20,
                                            background: escritura ? "var(--primary-alter)" : "var(--primary-mid)", color: "white",
                                        }}>
                                            {nombresDeRoles(c.roles)}
                                        </span>
                                    </p>
                                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, fontFamily: "monospace" }}>
                                        {c.key_prefix}
                                    </p>
                                    <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                        {c.llamadas_hoy} llamadas hoy{escritura ? ` · ${c.escrituras_hoy} escrituras` : ""} · último uso {formatearFecha(c.ultimo_uso_en)}
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                                    <button
                                        onClick={() => setLimitesAbiertos(limitesAbiertos === c.id ? null : c.id)}
                                        title="Límites avanzados"
                                        style={botonIcono}
                                    >
                                        <Icon name="Settings2" size={15} color="var(--text-muted)" />
                                    </button>
                                    <button onClick={() => setModalEliminar({ id: c.id, nombre: c.nombre })} title="Eliminar (desconecta a la IA)" style={botonIcono}>
                                        <Icon name="Trash2" size={15} color="#b71c1c" />
                                    </button>
                                </div>
                            </div>

                            {/* Toggles de rol de la clave existente */}
                            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                                {ROLES_ORDEN.map(rol => {
                                    const info = ROLES_CLAVE[rol]
                                    const activo = activos.includes(rol)
                                    return (
                                        <button
                                            key={rol}
                                            type="button"
                                            onClick={() => alternarRolDeClave(c, rol)}
                                            style={{
                                                fontSize: "0.64rem", fontWeight: 800, cursor: "pointer",
                                                padding: "3px 10px", borderRadius: 20,
                                                border: activo ? "none" : "1px solid var(--border-primary)",
                                                background: activo ? "var(--primary-mid)" : "var(--bg-card)",
                                                color: activo ? "white" : "var(--text-muted)",
                                            }}
                                        >
                                            {info.nombre}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Límites avanzados (colapsable) */}
                            {limitesAbiertos === c.id && (
                                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 6 }}>
                                    <p style={{ margin: 0, fontSize: "0.66rem", fontWeight: 700, color: "var(--text-muted)" }}>
                                        Límites por día de ESTA clave (vacío = default de sus roles:
                                        {` ${defaults.llamadas} llamadas / ${defaults.escrituras} escrituras`})
                                    </p>
                                    <form
                                        onSubmit={e => {
                                            e.preventDefault()
                                            const form = e.currentTarget
                                            guardarLimites(
                                                c,
                                                form.elements.namedItem("lim-lam") as HTMLInputElement,
                                                form.elements.namedItem("lim-esc") as HTMLInputElement,
                                            )
                                        }}
                                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                                    >
                                        <input name="lim-lam" type="number" min={0}
                                            defaultValue={c.limite_llamadas_diarias ?? ""}
                                            placeholder={`Llamadas (${defaults.llamadas})`}
                                            style={{ ...inputStyle, width: 130, fontWeight: 500 }} />
                                        <input name="lim-esc" type="number" min={0}
                                            defaultValue={c.limite_escrituras_diarias ?? ""}
                                            placeholder={`Escrituras (${defaults.escrituras})`}
                                            style={{ ...inputStyle, width: 130, fontWeight: 500 }} />
                                        <button type="submit" disabled={ocupado} className="btn-primary"
                                            style={{ padding: "6px 12px", fontSize: "0.7rem" }}>
                                            Guardar
                                        </button>
                                    </form>

                                    {/* Permiso de costos: dato sensible, decisión por clave */}
                                    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", marginTop: 2 }}>
                                        <input
                                            type="checkbox"
                                            checked={c.ver_costos}
                                            disabled={ocupado}
                                            onChange={e => cambiarVerCostos(c, e.target.checked)}
                                            style={{ marginTop: 2, accentColor: "var(--primary-alter)" }}
                                        />
                                        <span>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-main)", display: "block" }}>
                                                El agente puede ver costos internos
                                            </span>
                                            <span style={{ fontSize: "0.64rem", fontWeight: 600, color: "var(--text-muted)", display: "block", lineHeight: 1.4 }}>
                                                Le muestra el costo promedio y el margen de cada producto/venta. Actívalo solo en una clave de tu máxima confianza — el agente nunca lo pone en publicaciones (datos_para_publicar jamás lo incluye).
                                            </span>
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* ── Alta de clave: toggles de rol + nombre ── */}
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Conectar un agente — activa los roles de su clave
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {ROLES_ORDEN.map(rol => {
                    const info = ROLES_CLAVE[rol]
                    const elegido = rolesNueva.includes(rol)
                    return (
                        <button
                            key={rol}
                            type="button"
                            onClick={() => alternarRolNueva(rol)}
                            style={{
                                textAlign: "left", cursor: "pointer", padding: "10px 12px", borderRadius: 10,
                                border: elegido ? "2px solid var(--primary-mid)" : "1px solid var(--border-primary)",
                                background: elegido ? "var(--bg-card2)" : "var(--bg-card)",
                                display: "flex", gap: 10, alignItems: "flex-start",
                            }}
                        >
                            <span style={{
                                width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
                                border: elegido ? "none" : "2px solid var(--border-primary)",
                                background: elegido ? "var(--primary-mid)" : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                {elegido && <Icon name="Check" size={11} color="white" />}
                            </span>
                            <span style={{ minWidth: 0 }}>
                                <span style={{
                                    margin: 0, fontWeight: 800, fontSize: "0.8rem", display: "flex", gap: 6, alignItems: "center",
                                    color: elegido ? "var(--primary-dark)" : "var(--text-main)",
                                }}>
                                    {info.nombre}
                                    {info.escritura && (
                                        <span style={{
                                            fontSize: "0.56rem", fontWeight: 800, padding: "1px 6px", borderRadius: 20,
                                            background: "var(--primary-alter)", color: "white", textTransform: "uppercase",
                                        }}>
                                            modifica datos
                                        </span>
                                    )}
                                </span>
                                <span style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, display: "block" }}>
                                    {info.descripcion}
                                </span>
                            </span>
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
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button onClick={generar} disabled={ocupado || rolesNueva.length === 0} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="KeyRound" size={15} /> Generar clave
                </button>
                {rolesNueva.length === 0 && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)" }}>
                        Activa al menos un rol: una clave sin roles no ve ninguna herramienta
                    </span>
                )}
            </div>

            {/* ── Modal: advertencia al activar un rol que MODIFICA datos ──
                Sirve para la clave NUEVA (claveId null) y para cambiar los
                roles de una EXISTENTE (el agente no se reconecta). */}
            {modalRol !== null && (
                <ModalConfirmacion
                    icon="ShieldAlert"
                    iconBg="#fff3e0"
                    iconColor="#e65100"
                    titulo={`Rol ${ROLES_CLAVE[modalRol.rol].nombre}`}
                    mensaje={
                        modalRol.claveId
                            ? `La clave "${claves.find(c => c.id === modalRol.claveId)?.nombre ?? ""}" no cambia (el agente sigue conectado), pero al activar este rol el agente podrá:`
                            : "Al activar este rol el agente IA podrá:"
                    }
                    contenido={
                        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                            {ROLES_CLAVE[modalRol.rol].permisos.map((p, i) => (
                                <li key={i} style={{ fontSize: "0.78rem", color: "var(--text-main)", lineHeight: 1.4 }}>
                                    {p}
                                </li>
                            ))}
                        </ul>
                    }
                    aviso={ROLES_CLAVE[modalRol.rol].advertencia}
                    btnConfirmar="Aceptar y activar el rol"
                    btnCancelar="Rechazar"
                    btnColor="#e65100"
                    onCancelar={() => setModalRol(null)}
                    onConfirmar={confirmarModalRol}
                />
            )}

            {/* ── Modal: eliminar una clave definitivamente ── */}
            {modalEliminar !== null && (
                <ModalConfirmacion
                    icon="Trash2"
                    iconBg="#ffebee"
                    iconColor="#b71c1c"
                    titulo={`¿Eliminar la clave "${modalEliminar.nombre}"?`}
                    mensaje="El agente que la usa queda desconectado al instante y la clave desaparece de esta lista."
                    aviso="Lo que el agente ya creó queda en el Historial con su atribución. Para reconectar necesitarás generar otra clave y pegar su prompt de nuevo en el chat."
                    btnConfirmar="Eliminar definitivamente"
                    btnColor="#b71c1c"
                    onCancelar={() => setModalEliminar(null)}
                    onConfirmar={() => eliminar(claves.find(c => c.id === modalEliminar.id) as ClaveMcp)}
                />
            )}
        </div>
    )
}
