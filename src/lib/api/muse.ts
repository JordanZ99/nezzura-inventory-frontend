// ==============================================================================
// src/lib/api/muse.ts — Claves del servidor MCP (conector IA / Muse).
//
// Cada negocio genera claves desde Ajustes → Negocio → "Conectar mi IA".
// La clave se pega UNA vez en el agente (custom connector) y le da acceso a
// los ROLES funcionales que el dueño activó (toggles): publicar en redes,
// analizar el negocio, cuidar las fotos o crear/editar productos. El agente
// ve la UNIÓN de las tools de sus roles — nada más. Nunca costos salvo el
// permiso explícito 'ver costos'.
// ==============================================================================

import { request } from "./client"

export interface ClaveMcp {
    id: number
    nombre: string
    /** Prefijo identificador (ej. "nezzura_mcp_1a2b…"); la clave completa no se guarda */
    key_prefix: string
    /** ROLES funcionales activos (081). null = clave legacy pre-081 (todas las tools) */
    roles: string[] | null
    /** Derivado de los roles (máximo): alimenta los límites por defecto */
    nivel: number
    creada_en: string
    ultimo_uso_en: string | null
    llamadas_hoy: number
    dia_uso: string | null
    escrituras_hoy: number
    /** Override por clave (null = default del nivel derivado) */
    limite_llamadas_diarias: number | null
    limite_escrituras_diarias: number | null
    /** Permiso de ESTA clave para que el agente lea costos internos (068) */
    ver_costos: boolean
}

/** Catálogo de ROLES activables por clave (espejo de muse/roles.py).
 *  Cada rol es un toggle independiente: el agente ve la UNIÓN de las tools
 *  de los roles activos. Los roles de escritura disparan el modal de
 *  advertencia al activarse. */
export interface RolClave {
    nombre: string
    descripcion: string
    /** Qué GANA el agente al activar este rol (alimenta el modal) */
    permisos: string[]
    advertencia: string
    /** Al activarlo el agente puede MODIFICAR datos (requiere confirmación) */
    escritura: boolean
    /** La herramienta requiere plan Plus para funcionar */
    planPlus: boolean
}

export const ROLES_CLAVE: Record<string, RolClave> = {
    publicador: {
        nombre: "Publicador",
        descripcion: "Para publicar en Marketplace y redes: lee tu catálogo completo (productos, precios de venta, stock, descripciones y fotos) y arma la publicación sola.",
        permisos: [
            "Leer el catálogo: productos, precios de venta, stock, descripciones y fotos",
            "Listados con filtros: stock bajo, agotados, sin foto, por categoría",
            "Armar publicaciones con datos_para_publicar (ficha completa + fotos en una llamada)",
        ],
        advertencia: "Solo lectura de tu catálogo: no ve costos internos ni datos financieros.",
        escritura: false,
        planPlus: false,
    },
    analista: {
        nombre: "Analista",
        descripcion: "Para preguntar cómo va el negocio: métricas, hallazgos con consejos, ventas recientes y top vendido, calculados sobre tus datos reales.",
        permisos: [
            "Ver métricas del negocio: ingresos, ganancia bruta, margen, gastos y utilidad",
            "Ver hallazgos con consejos calculados: stock en riesgo, dinero dormido, cobros pendientes, márgenes bajos",
            "Ver las ventas recientes una por una y el top vendido (con qué se agotó o está por agotarse)",
            "Ver el stock en tiempo real de todo el inventario",
        ],
        advertencia: "Ve métricas financieras de tu negocio (nunca costos por producto, salvo que actives 'ver costos'). Solo dáselo a un agente de tu confianza.",
        escritura: false,
        planPlus: true,
    },
    disenador: {
        nombre: "Diseñador",
        descripcion: "Para cuidar las fotos del catálogo: consulta la configuración visual, adjunta imágenes encajadas a la proporción de tu catálogo, elimina las que se ven mal y reordena cuál va primero.",
        permisos: [
            "Leer la configuración visual del catálogo (proporción, fondo, tema)",
            "Adjuntar imágenes a productos: el gestor las reduce de peso y las encaja (principal o galería)",
            "Eliminar fotos de la galería o la principal (la siguiente asciende sola)",
            "Reordenar la galería: la primera foto pasa a ser la principal",
            "Leer el catálogo para encontrar los productos (ids de las fotos incluidos)",
        ],
        advertencia: "Puede MODIFICAR las fotos de tus productos (agregar, eliminar, reordenar). Cada acción queda en el Historial como hecha por el agente IA, con cuota diaria de escrituras. La galería requiere plan Plus.",
        escritura: true,
        planPlus: true,
    },
    inventario: {
        nombre: "Inventario",
        descripcion: "Para crear y mantener productos: propone borradores, tú los confirmas en el chat, y puede adjuntar fotos a lo que cree o edite.",
        permisos: [
            "Proponer productos nuevos (borradores que se revisan antes de crear nada)",
            "Editar productos: descripción, precio, nombre, estado, códigos, categorías…",
            "Adjuntar imágenes a los productos que crea o edita",
            "Cada cambio lo confirmas tú en el chat y queda en el Historial como hecho por el agente IA",
        ],
        advertencia: "Puede CREAR y EDITAR productos (tras tu confirmación en el chat). Requiere plan Plus para la galería. Solo dáselo a un agente de tu máxima confianza.",
        escritura: true,
        planPlus: true,
    },
}

/** Orden de presentación de los toggles. */
export const ROLES_ORDEN = ["publicador", "analista", "disenador", "inventario"] as const
export type RolId = (typeof ROLES_ORDEN)[number]

/** Límites por defecto según el nivel DERIVADO de los roles (espejo de
 *  database/mcp_claves.py): más roles = menos llamadas diarias. */
export const DEFAULTS_LIMITES: Record<number, { llamadas: number; escrituras: number }> = {
    1: { llamadas: 1000, escrituras: 1000 },
    2: { llamadas: 300, escrituras: 1000 },
    3: { llamadas: 100, escrituras: 1000 },
}

export const museApi = {
    getClaves: () => request<{ claves: ClaveMcp[] }>("/mcp-conexion/claves"),

    /** Devuelve la clave en claro UNA sola vez: el backend solo guarda su hash.
     *  roles vacío u omitido = publicador (el backend lo normaliza). */
    crearClave: (nombre?: string, roles: string[] = []) =>
        request<{ ok: boolean; clave: string }>("/mcp-conexion/claves", {
            method: "POST",
            body: JSON.stringify({ nombre: nombre?.trim() || null, roles }),
        }),

    /** Edita roles, límites o el permiso de costos de una clave ACTIVA sin
     *  tocar su hash: el agente no se reconecta. Omitir un campo = no cambiar. */
    editarClave: (id: number, datos: {
        roles?: string[]
        limite_llamadas?: number | null
        limite_escrituras?: number | null
        ver_costos?: boolean
    }) =>
        request<{ ok: boolean; cambiado: string[] }>(`/mcp-conexion/claves/${id}`, {
            method: "PATCH",
            body: JSON.stringify(datos),
        }),

    /** ELIMINA la clave definitivamente: desconecta al agente al instante
     *  y la fila desaparece de la lista. El Historial no se toca. */
    eliminarClave: (id: number) =>
        request<{ ok: boolean }>(`/mcp-conexion/claves/${id}`, { method: "DELETE" }),
}
