// ==============================================================================
// src/components/personalizacion/CardConectarMuse.tsx
// Tarjeta "Conectar mi IA" (tab Mi Negocio): gestión de las claves API del
// servidor MCP — el conector que permite a un agente IA (como Muse de Meta)
// trabajar con el negocio según los ROLES que el dueño activa (toggles):
// publicar en redes, analizar el negocio, cuidar las fotos, crear/editar
// productos o cambiar la receta de un producto compuesto. El agente ve la
// UNIÓN de las tools de sus roles — nunca costos
// salvo el permiso explícito 'ver costos'.
//
// Flujo:
//   1. Activar los roles del agente y generar la clave (se muestra UNA sola
//      vez — el backend solo guarda su hash)
//   2. "Conéctalo a tu agente…": un botón por cliente abre su app/página con
//      lo necesario copiado (deep links oficiales donde existen); el prompt
//      universal queda como respaldo para cualquier otro agente
//   3. "Probar conexión" confirma qué ve el agente y si ya usó la clave;
//      cambiar roles o regenerar no requiere rehacer el conector
// ==============================================================================

import { useEffect, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import ModalConfirmacion from "@/components/ui/ModalConfirmacion"
import { api, BASE_URL, type ClaveMcp, type PresetFoto, ROLES_CLAVE, ROLES_ORDEN, DEFAULTS_LIMITES } from "@/lib/api"
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

// ==============================================================================
// CONEXIÓN POR CLIENTE ("Conéctalo a tu agente…")
//
// Cada cliente MCP tiene su propia forma de recibir un conector. Los botones
// hacen lo máximo que permite cada uno HOY (investigado 2026):
//
//   Muse      → copia el prompt + abre muse.ai. Meta NO expone una API para
//               registrar conectores: el custom connector se crea en el chat
//               (vía oficial documentada). El deep link /connect/api-key que
//               existe en su web registra credenciales REST, no el conector
//               MCP, así que no se usa aquí: prometería algo que no hace.
//   Claude    → deep link OFICIAL al modal de conector con nombre y URL ya
//               rellenados; la clave queda en el portapapeles para el paso de
//               autenticación.
//   Cursor    → deep link OFICIAL de instalación; el config (base64) ya lleva
//               la URL y el header X-API-Key, así que instala y autentica de
//               una vez.
//   ChatGPT   → abre Ajustes → Conectores (formulario manual, no hay deep
//               link de instalación) y deja la clave copiada.
//   OpenClaw  → auto-hospedado y sin deep link estándar: copia el prompt,
//               que es el mismo camino que Muse.
//
// Los formatos pueden cambiar sin aviso (sobre todo Muse): cada URL vive en
// ESTE bloque para actualizarla en un solo lugar.
// ==============================================================================

type ClienteId = "muse" | "claude" | "cursor" | "chatgpt" | "openclaw"

const CLIENTES: { id: ClienteId; nombre: string; color: string; ayuda: string }[] = [
    {
        id: "muse",
        nombre: "Muse",
        color: "#8b5cf6",
        ayuda: "Copia el prompt y abre Muse: se lo pegas en el chat y él crea el conector.",
    },
    {
        id: "claude",
        nombre: "Claude",
        color: "#d97706",
        ayuda: "Abre Claude con el conector ya rellenado; la clave queda copiada para cuando la pida.",
    },
    {
        id: "cursor",
        nombre: "Cursor",
        color: "#111827",
        ayuda: "Abre Cursor y le pide instalar el conector (la clave va incluida).",
    },
    {
        id: "chatgpt",
        nombre: "ChatGPT",
        color: "#10a37f",
        ayuda: "Abre Ajustes → Conectores; la clave queda copiada para el formulario.",
    },
    {
        id: "openclaw",
        nombre: "OpenClaw",
        color: "#6b7280",
        ayuda: "Copia el prompt para pegarlo en el chat de tu OpenClaw.",
    },
]

/** Web de Muse: si Meta cambia el dominio, se actualiza SOLO aquí. */
const MUSE_URL = "https://muse.ai"

/** Qué pasó al pulsar cada botón (el toast lo confirma al dueño). */
const AVISOS_CLIENTE: Record<ClienteId, string> = {
    muse: "Prompt copiado. Pégalo en el chat de Muse y envíalo.",
    claude: "Clave copiada. Claude te la pedirá al añadir el conector.",
    cursor: "Abriendo Cursor… si no se abre, usa el prompt de abajo.",
    chatgpt: "Clave copiada. En ChatGPT: Ajustes → Conectores → Añadir conector propio.",
    openclaw: "Prompt copiado. Pégalo en el chat de tu OpenClaw.",
}

/** Nombre con el que el conector aparece dentro del agente. */
function nombreConector(empresa?: string): string {
    const base = (empresa || "Mi negocio").replace(/\s+/g, " ").trim()
    return `Nezzura · ${base}`.slice(0, 48)
}

/** base64 de un JSON UTF-8 (el deep link de Cursor lo pide así). */
function base64DeTexto(texto: string): string {
    const bytes = new TextEncoder().encode(texto)
    let binario = ""
    bytes.forEach(b => { binario += String.fromCharCode(b) })
    return btoa(binario)
}

const pasoStyle = {
    fontSize: "0.7rem",
    fontWeight: 600,
    color: "var(--text-main)",
    lineHeight: 1.4,
} as const

/** Prompt que se pega en el chat del agente (Muse) para crear el custom
 *  connector. Lleva la clave embebida: solo se puede armar en el momento
 *  de crearla, porque después ya no se puede recuperar. El brief varía según
 *  los ROLES activos de la clave. `comandosFoto` son los comandos de foto
 *  vigentes del negocio (database/mcp_estilos): se inyectan aquí para que el
 *  agente conozca el comando desde el primer mensaje. */
function promptConector(clave: string, roles: string[], comandosFoto: string[] = []): string {
    const set = new Set(roles)
    const lineas = [
        "Conéctate a mi gestor de inventario (Nezzura) con este conector MCP.",
        "Si tu cliente necesita crear el conector, estos son sus datos:",
        "",
        `- Dirección del servidor: ${BASE_URL}/mcp`,
        "- Tipo: streamable HTTP",
        `- Clave de acceso (header X-API-Key): ${clave}`,
        "",
    ]
    if (set.has("publicador")) {
        lineas.push(
            "Conector del inventario de mi negocio (productos, precios de venta, descripciones, tamaños, stock y fotos; sin costos internos).",
            "Cuando te pida publicar un producto en Marketplace o redes sociales, busca el producto y usa datos_para_publicar para obtener los datos en lugar de pedírmelos a mí. Ojo: los productos compuestos (platillos de restaurante) no se publican en Marketplace porque su receta es interna.",
        )
    }
    if (set.has("analista")) {
        lineas.push(
            "Cuando te pregunte cómo va mi negocio (ganancias, gastos, stock en riesgo, cobros pendientes), usa resumen_negocio y hallazgos_inteligentes: son cálculos reales de mi gestor, así que NUNCA inventes cifras.",
        )
    }
    if (set.has("disenador")) {
        const comandoTxt = comandosFoto.length ? `el comando ${comandosFoto.join(" o ")}` : "un comando de foto"
        lineas.push(
            "También cuido las fotos del catálogo: antes de generar o pegar una imagen, consulta config_catalogo para conocer la proporción (1:1 o 4:5) y el fondo del catálogo. Usa adjuntar_imagen para ponerla (el gestor la reduce de peso y la encaja), eliminar_imagen para quitar la que se ve mal y reordenar_imagenes para decidir cuál va primero.",
            `Cuando te envíe una foto y escriba ${comandoTxt} —o pida quitar/limpiar el fondo, retocar la foto o ponerla en fondo de estudio—: llama estilos_foto, toma el prompt del preset y aplícalo a mi imagen SIN cambiar el producto; luego adjunta el resultado con adjuntar_imagen. Nunca inventes un prompt propio.`,
        )
    }
    if (set.has("inventario")) {
        lineas.push(
            "Puedo pedirte crear productos nuevos: SIEMPRE usa primero proponer_producto (valida y guarda el borrador) y después confirmar_producto con el borrador_id que devuelva. Si un dato falta o es inválido, proponer_producto te dirá exactamente qué corregir.",
            "También manejo productos COMPUESTOS (los platillos de un restaurante): no tienen stock propio, se venden contra los ingredientes de su RECETA. Cuando te pida cambiar los ingredientes de uno (ej. 'a la hamburguesa ponle 2 quesos en vez de 1'), primero llama a ver_receta para ver los materiales con su receta_id y la cantidad por unidad, y después proponer_receta con los cambios ({accion:'agregar', material, cantidad}, {accion:'cambiar', receta_id, cantidad} o {accion:'quitar', receta_id}). Muéstrame el resumen y espera mi aprobación antes de confirmar_receta. Nunca inventes un receta_id: salen de ver_receta. Si te pido 'cuántas hamburguesas alcanzan', usa la disponibilidad_estimada de ver_receta.",
            "Si te envío una foto para un producto y escribo un comando de foto —o pido quitar el fondo o retocarla—: llama estilos_foto, usa el prompt del preset tal cual y adjunta el resultado con adjuntar_imagen.",
        )
    }
    if (set.has("cajero")) {
        lineas.push(
            "También REGISTRAS VENTAS: cuando te diga qué vendió o te pase la FOTO de un ticket, identifica cada producto con buscar_productos y arma la venta con proponer_venta (envía el producto_id de cada renglón). Muéstrame el desglose que te devuelva y espera mi aprobación antes de confirmar_venta. PROPÓN, NO INTERROGUES: si un renglón es ambiguo, elige tu mejor interpretación con señales reales (precio del ticket = precio del inventario, nombre parcial, stock del desglose), márcala y cierra con UNA sola pregunta: '¿lo registro así o corriges algo?'. El precio del ticket es el precio por unidad, salvo que me avises lo contrario. Si vendí algo que no está en el inventario, regístralo como venta libre con su motivo. Nunca inventes un renglón, un producto_id ni un precio.",
            "También REGISTRAS GASTOS: cuando te diga que gasté algo (ej. 'gasté 80 pesos en bolsas'), arma el gasto con proponer_gasto (monto, categoría y descripción; si fue de otro día, manda la fecha 'YYYY-MM-DD'). Muéstrame el desglose y las categorías que te devuelva y cierra con UNA sola pregunta: '¿lo registro así o corriges algo?'. Solo si apruebo, llama a confirmar_gasto con el borrador_id. Si la categoría no existe en mi gestor, proponer_gasto te lo avisa: dime si la usas como nueva o elijo otra de la lista.",
        )
    }
    if (set.has("compras")) {
        lineas.push(
            "También RESTOCKEAS mi inventario: cuando te diga qué me llegó (ej. 'llegaron 10 Kuromi a $150'), identifica el producto con buscar_productos y arma la entrada con proponer_entrada (producto_id, cantidad y el COSTO real de la compra; el precio de venta sale solo si no te lo digo). Muéstrame el desglose que te devuelva (cuánto subirá el stock y a qué costo) y cierra con UNA sola pregunta: '¿aplico la entrada?'. Solo si apruebo, llama a confirmar_entrada con el borrador_id. El costo de compra es OBLIGATORIO: si no lo sabes, pregúntamelo — nunca lo inventes ni lo dejes en blanco. Solo productos físicos que ya existen: si el producto no existe, pídeme crearlo primero con el rol Inventario.",
        )
    }
    if (!set.has("publicador")) {
        lineas.push("Conector del inventario de mi negocio: productos (físicos y compuestos), precios de venta, stock, recetas y fotos.")
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

// ==============================================================================
// Sección "Fotos por comando" (082): el dueño edita el comando y el prompt
// que el agente aplica cuando escribe el comando en el chat (ej. /img) o
// pide quitar/limpiar el fondo, retocar la foto o ponerla en fondo de
// estudio. Se muestra dentro de los límites avanzados de una clave con rol
// de foto (disenador/inventario). El almacenamiento es del NEGOCIO (por
// tenant), no de la clave: se edita aquí por comodidad.
// ==============================================================================

function SeccionEstilosFoto({ mostrarMsg }: { mostrarMsg: (ok: boolean, msg: string) => void }) {
    const queryClient = useQueryClient()
    const [ocupado, setOcupado] = useState(false)
    const [anadiendo, setAnadiendo] = useState(false)
    // Borrador del prompt por preset (clave del preset → texto del textarea):
    // controlado para que "restaurar recomendado" escriba en el campo.
    const [borradores, setBorradores] = useState<Record<string, string>>({})

    const estilosQuery = useQuery({
        queryKey: ["muse-estilos"],
        queryFn: api.getEstilosFoto,
    })
    const presets: PresetFoto[] = estilosQuery.data?.presets ?? []

    // Inicializa los borradores con el prompt vigente de cada preset (sin
    // pisar lo que el dueño ya está editando).
    useEffect(() => {
        if (!estilosQuery.data) return
        setBorradores(prev => {
            const next = { ...prev }
            let faltaba = false
            for (const p of presets) {
                if (next[p.clave] === undefined) {
                    next[p.clave] = p.prompt
                    faltaba = true
                }
            }
            return faltaba ? next : prev
        })
    }, [estilosQuery.data])

    function invalidar() {
        queryClient.invalidateQueries({ queryKey: ["muse-estilos"] })
    }

    async function guardar(p: PresetFoto, comando: HTMLInputElement) {
        const prompt = (borradores[p.clave] ?? p.prompt).trim()
        setOcupado(true)
        try {
            await api.guardarEstilo({ comando: comando.value.trim(), nombre: p.nombre, prompt })
            mostrarMsg(true, `Preset "${p.nombre}" guardado`)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    async function crear(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const form = e.currentTarget
        const comando = (form.elements.namedItem("nuevo-comando") as HTMLInputElement).value.trim()
        const nombre = (form.elements.namedItem("nuevo-nombre") as HTMLInputElement).value.trim()
        const prompt = (form.elements.namedItem("nuevo-prompt") as HTMLTextAreaElement).value.trim()
        setOcupado(true)
        try {
            await api.crearEstilo({ comando, nombre, prompt })
            mostrarMsg(true, "Comando añadido")
            setAnadiendo(false)
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    async function eliminar(p: PresetFoto) {
        setOcupado(true)
        try {
            await api.eliminarEstilo(p.clave)
            mostrarMsg(
                true,
                p.es_default
                    ? "Restaurado: el agente vuelve a usar el prompt recomendado con /img"
                    : `Preset "${p.nombre}" eliminado`,
            )
            setBorradores(prev => {
                const next = { ...prev }
                delete next[p.clave]
                return next
            })
            invalidar()
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    if (estilosQuery.isLoading) {
        return <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>Cargando comandos de foto…</p>
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: "0.66rem", fontWeight: 700, color: "var(--text-muted)" }}>
                Fotos por comando: cuando le envías una foto y escribes el comando (o pides quitar el fondo /
                retocarla), el agente aplica el prompt del preset y la adjunta. Es del negocio, no de esta clave.
            </p>

            {presets.map(p => (
                <div key={p.clave} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--bg-card2)", border: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <form
                        onSubmit={e => {
                            e.preventDefault()
                            guardar(p, e.currentTarget.elements.namedItem("est-comando") as HTMLInputElement)
                        }}
                        style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}
                    >
                        <input
                            name="est-comando"
                            defaultValue={p.comando}
                            maxLength={20}
                            title="Comando que escribes en el chat"
                            style={{ ...inputStyle, width: 90, fontWeight: 700 }}
                        />
                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-main)", flex: 1 }}>
                            {p.nombre}
                            {p.es_default && p.editado && (
                                <span style={{ fontSize: "0.56rem", fontWeight: 700, color: "var(--text-muted)", marginLeft: 6 }}>
                                    (editado)
                                </span>
                            )}
                        </span>
                        <button type="submit" disabled={ocupado} className="btn-primary" style={{ padding: "5px 10px", fontSize: "0.68rem" }}>
                            Guardar
                        </button>
                        <button type="button" disabled={ocupado} onClick={() => eliminar(p)} title={p.es_default ? "Restaurar el prompt recomendado" : "Eliminar preset"} style={botonIcono}>
                            <Icon name={p.es_default ? "RotateCcw" : "Trash2"} size={14} color={p.es_default ? "var(--text-muted)" : "#b71c1c"} />
                        </button>
                    </form>
                    <textarea
                        value={borradores[p.clave] ?? p.prompt}
                        onChange={e => setBorradores(prev => ({ ...prev, [p.clave]: e.target.value }))}
                        rows={5}
                        maxLength={2000}
                        style={{ ...inputStyle, fontWeight: 500, resize: "vertical", lineHeight: 1.45 }}
                    />
                    {p.es_default && p.editado && p.prompt_recomendado && (
                        <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => setBorradores(prev => ({ ...prev, [p.clave]: p.prompt_recomendado as string }))}
                            style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.64rem", fontWeight: 700, color: "var(--primary-dark)" }}
                        >
                            Restaurar prompt recomendado
                        </button>
                    )}
                </div>
            ))}

            {anadiendo ? (
                <form onSubmit={crear} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", borderRadius: 8, background: "var(--bg-card)", border: "1px dashed var(--border-primary)" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        <input name="nuevo-comando" placeholder="/detalle" maxLength={20} style={{ ...inputStyle, width: 110, fontWeight: 700 }} />
                        <input name="nuevo-nombre" placeholder="Nombre (ej. Detalle macro)" maxLength={40} style={{ ...inputStyle, flex: 1 }} />
                    </div>
                    <textarea
                        name="nuevo-prompt"
                        placeholder="Prompt que el agente aplicará a la imagen (preserva el producto, describe la luz, termina con lo que NO debe hacer)…"
                        rows={5}
                        maxLength={2000}
                        style={{ ...inputStyle, fontWeight: 500, resize: "vertical", lineHeight: 1.45 }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                        <button type="submit" disabled={ocupado} className="btn-primary" style={{ padding: "5px 10px", fontSize: "0.68rem" }}>
                            Añadir comando
                        </button>
                        <button type="button" disabled={ocupado} onClick={() => setAnadiendo(false)} className="btn-secondary" style={{ padding: "5px 10px", fontSize: "0.68rem" }}>
                            Cancelar
                        </button>
                    </div>
                </form>
            ) : (
                <button
                    type="button"
                    onClick={() => setAnadiendo(true)}
                    style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed var(--border-primary)", borderRadius: 8, cursor: "pointer", padding: "6px 12px", fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-dark)" }}
                >
                    <Icon name="Plus" size={14} /> Añadir otro comando
                </button>
            )}
        </div>
    )
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
    // Id de la clave recién creada/regenerada: permite "Probar conexión"
    // dentro del propio panel de la clave nueva.
    const [idNueva, setIdNueva] = useState<number | null>(null)
    // Resultado de "Probar conexión" por clave (id → estado del botón).
    const [pruebas, setPruebas] = useState<Record<number, { cargando: boolean; conectado?: boolean; texto?: string }>>({})
    // Modal de confirmación para regenerar (la clave anterior deja de servir).
    const [modalRegenerar, setModalRegenerar] = useState<ClaveMcp | null>(null)

    const clavesQuery = useQuery({
        queryKey: ["muse-claves", tenantId ?? "sin-tenant"],
        queryFn: api.getClaves,
        enabled: Boolean(tenantId),
    })
    const claves: ClaveMcp[] = clavesQuery.data?.claves ?? []

    // Comandos de foto vigentes (082): entran al prompt del conector cuando
    // la clave nueva tiene roles de foto (el agente los conoce desde el
    // primer mensaje).
    const estilosQuery = useQuery({
        queryKey: ["muse-estilos"],
        queryFn: api.getEstilosFoto,
        enabled: Boolean(tenantId),
    })
    const comandosFoto = (estilosQuery.data?.presets ?? [])
        .filter(p => p.activo)
        .map(p => p.comando)

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
            setIdNueva(r.id ?? null)
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

    /** "Probar conexión": valida la clave y cuenta qué ve el agente. No es un
     *  ping al agente (imposible: el gestor ya no tiene la clave en claro),
     *  pero `conectado` dice si el conector YA usó la clave alguna vez. */
    async function probarConexion(id: number) {
        setPruebas(p => ({ ...p, [id]: { cargando: true } }))
        try {
            const r = await api.probarConexion(id)
            const roles = r.nombres_roles.join(" + ")
            const texto = r.conectado
                ? `✓ Conectado · el agente ve ${r.tools} herramientas (${roles})`
                : `Clave lista · el agente verá ${r.tools} herramientas (${roles}). Aún no la ha usado: conecta el agente y vuelve a probar.`
            setPruebas(p => ({ ...p, [id]: { cargando: false, conectado: r.conectado, texto } }))
        } catch (e: unknown) {
            setPruebas(p => ({
                ...p,
                [id]: { cargando: false, conectado: false, texto: e instanceof Error ? e.message : "Error al probar la conexión" },
            }))
        }
    }

    /** Regenera la clave conservando roles, límites y permiso de costos. La
     *  anterior deja de funcionar al instante; la nueva se muestra en el panel
     *  de arriba, lista para copiar y conectar. */
    async function regenerar(c: ClaveMcp) {
        setOcupado(true)
        try {
            const r = await api.regenerarClave(c.id)
            setClaveNueva(r.clave)
            setIdNueva(r.id ?? null)
            setRolesNuevaCreada(c.roles ?? [...ROLES_ORDEN])
            setModalRegenerar(null)
            // La prueba de la clave vieja ya no aplica (esa fila desapareció).
            setPruebas(p => {
                const next = { ...p }
                delete next[c.id]
                if (r.id) delete next[r.id]
                return next
            })
            invalidar()
            mostrarMsg(true, "Clave regenerada: la anterior ya no funciona. Copia la nueva.")
        } catch (e: unknown) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error")
        } finally {
            setOcupado(false)
        }
    }

    /** Botón de un cliente: abre su app/página y copia lo que necesita (el
     *  prompt en Muse/OpenClaw, la clave en Claude/ChatGPT; Cursor la lleva
     *  embebida en el deep link). */
    async function conectarCon(cliente: ClienteId) {
        if (!claveNueva) return
        const url = `${BASE_URL}/mcp`
        const nombre = nombreConector(tenant?.empresa)
        const prompt = promptConector(claveNueva, rolesNuevaCreada, comandosFoto)

        let portapapeles = prompt
        let destino: string | null = null

        if (cliente === "muse") {
            // Meta crea los custom connectors EN EL CHAT: se abre Muse con el
            // prompt ya copiado. (Su deep link /connect/api-key registra
            // credenciales REST, no el conector MCP — ver cabecera del bloque.)
            destino = MUSE_URL
        } else if (cliente === "claude") {
            portapapeles = claveNueva
            destino = "https://claude.ai/customize/connectors" +
                `?modal=add-custom-connector&connectorName=${encodeURIComponent(nombre)}` +
                `&connectorUrl=${encodeURIComponent(url)}`
        } else if (cliente === "cursor") {
            const config = base64DeTexto(JSON.stringify({ url, headers: { "X-API-Key": claveNueva } }))
            destino = "cursor://anysphere.cursor-deeplink/mcp/install" +
                `?name=${encodeURIComponent(nombre)}&config=${encodeURIComponent(config)}`
        } else if (cliente === "chatgpt") {
            portapapeles = claveNueva
            destino = "https://chatgpt.com/#settings/Connectors"
        }
        // openclaw: auto-hospedado y sin deep link estándar → solo el prompt.

        // window.open ANTES del await: si se abre tras una promesa, el
        // navegador lo trata como popup y lo bloquea.
        if (destino) window.open(destino, "_blank", "noopener,noreferrer")
        const ok = await copiar(portapapeles)
        mostrarMsg(
            ok,
            ok ? AVISOS_CLIENTE[cliente] : "No se pudo copiar: usa el prompt de abajo y su botón de copiar",
        )
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
        const texto = que === "clave"
            ? claveNueva
            : promptConector(claveNueva || "", rolesNuevaCreada, comandosFoto)
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
                Conecta tu agente IA (<strong>Muse</strong>, Claude, Cursor, ChatGPT u OpenClaw) y elige QUÉ TRABAJO
                hace activando sus roles:
                publicar en redes, analizar el negocio, cuidar las fotos o crear productos y recetas. El agente solo ve
                las herramientas de los roles activos. <strong>Nunca ve tus costos unitarios</strong> salvo el permiso
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

                    {/* ── Conéctalo a tu agente… ── */}
                    <p style={{ margin: "0 0 2px", fontSize: "0.92rem", fontWeight: 800, color: "var(--text-main)" }}>
                        Conéctalo a tu agente…
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)" }}>
                        Elige el tuyo: el botón copia lo necesario y lo abre. Si tu agente no está en la lista, usa el
                        prompt de abajo.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {CLIENTES.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => conectarCon(c.id)}
                                title={c.ayuda}
                                style={{
                                    display: "flex", alignItems: "center", gap: 7,
                                    padding: "7px 12px", borderRadius: 20, cursor: "pointer",
                                    border: "1px solid var(--border-primary)",
                                    background: "var(--bg-card)",
                                    fontSize: "0.74rem", fontWeight: 800, color: "var(--text-main)",
                                }}
                            >
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                                {c.nombre}
                                <Icon name="ExternalLink" size={12} color="var(--text-muted)" />
                            </button>
                        ))}
                    </div>

                    {/* Resultado de "Probar conexión" de la clave recién creada */}
                    {idNueva !== null && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                            <button
                                type="button"
                                onClick={() => probarConexion(idNueva)}
                                disabled={pruebas[idNueva]?.cargando}
                                className="btn-secondary"
                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: "0.7rem" }}
                            >
                                <Icon name="Plug" size={13} />
                                {pruebas[idNueva]?.cargando ? "Probando…" : "Probar conexión"}
                            </button>
                            {pruebas[idNueva]?.texto && (
                                <span style={{
                                    fontSize: "0.68rem", fontWeight: 700,
                                    color: pruebas[idNueva]?.conectado ? "var(--primary-dark)" : "var(--text-muted)",
                                }}>
                                    {pruebas[idNueva].texto}
                                </span>
                            )}
                        </div>
                    )}

                    {/* ── Respaldo universal: el prompt ── */}
                    <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 10 }}>
                        <p style={{ margin: "0 0 6px", fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-dark)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            O copia y pega este prompt
                        </p>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <pre style={{ flex: 1, margin: 0, fontSize: "0.66rem", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", background: "var(--bg-card)", padding: "8px 10px", borderRadius: 6, maxHeight: 170, overflow: "auto" }}>
                                {promptConector(claveNueva, rolesNuevaCreada, comandosFoto)}
                            </pre>
                            <button onClick={() => copiarYavisar("prompt")} title="Copiar prompt completo" style={botonIcono}>
                                <Icon name={copiado === "prompt" ? "Check" : "Copy"} size={16} color="var(--primary-dark)" />
                            </button>
                        </div>
                        <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                            <li style={pasoStyle}>Pega el prompt en el chat del agente y envíalo.</li>
                            <li style={pasoStyle}>Acepta el conector cuando te lo pida: tu clave va incluida.</li>
                            <li style={pasoStyle}>Vuelve aquí y toca “Probar conexión” para confirmar que ya te ve.</li>
                        </ol>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Esta clave es como una contraseña: no la compartas. Por seguridad no se vuelve a mostrar; si la
                        pierdes, usa “Regenerar”.
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
                                    <button
                                        onClick={() => setModalRegenerar(c)}
                                        title="Regenerar clave (la anterior deja de funcionar)"
                                        style={botonIcono}
                                    >
                                        <Icon name="RefreshCw" size={15} color="var(--text-muted)" />
                                    </button>
                                    <button onClick={() => setModalEliminar({ id: c.id, nombre: c.nombre })} title="Eliminar (desconecta a la IA)" style={botonIcono}>
                                        <Icon name="Trash2" size={15} color="#b71c1c" />
                                    </button>
                                </div>
                            </div>

                            {/* "Probar conexión": qué herramientas ve el agente
                                ahora mismo y si ya usó la clave alguna vez. */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                                <button
                                    type="button"
                                    onClick={() => probarConexion(c.id)}
                                    disabled={pruebas[c.id]?.cargando}
                                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.68rem", fontWeight: 800, color: "var(--primary-dark)" }}
                                >
                                    {pruebas[c.id]?.cargando ? "Probando conexión…" : "Probar conexión"}
                                </button>
                                {pruebas[c.id]?.texto && (
                                    <span style={{
                                        fontSize: "0.68rem", fontWeight: 700,
                                        color: pruebas[c.id]?.conectado ? "var(--primary-dark)" : "var(--text-muted)",
                                    }}>
                                        {pruebas[c.id].texto}
                                    </span>
                                )}
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

                                    {/* Fotos por comando (082): solo claves con
                                        rol de foto — estilos_foto no existe para
                                        las demás. El preset vive en el negocio. */}
                                    {activos.some(r => r === "disenador" || r === "inventario") && (
                                        <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 8, marginTop: 2 }}>
                                            <SeccionEstilosFoto mostrarMsg={mostrarMsg} />
                                        </div>
                                    )}
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

            {/* ── Modal: regenerar la clave (la anterior deja de funcionar) ── */}
            {modalRegenerar !== null && (
                <ModalConfirmacion
                    icon="RefreshCw"
                    iconBg="#e8eef9"
                    iconColor="var(--primary-dark)"
                    titulo={`¿Regenerar la clave "${modalRegenerar.nombre}"?`}
                    mensaje="Se crea una clave nueva con los mismos roles, límites y permisos, y la actual deja de funcionar al instante."
                    aviso="Úsalo si perdiste la clave antes de conectarla o si quieres cortar el acceso: tendrás que volver a pegarla en el agente (el resto de la configuración se conserva)."
                    btnConfirmar="Regenerar clave"
                    btnColor="var(--primary-dark)"
                    onCancelar={() => setModalRegenerar(null)}
                    onConfirmar={() => regenerar(modalRegenerar)}
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
