// ==============================================================================
// src/lib/api/muse.ts — Claves del servidor MCP (conector IA / Muse).
//
// Cada negocio genera claves desde Ajustes → Negocio → "Conectar mi IA".
// La clave se pega UNA vez en el agente (custom connector) y le da acceso
// de SOLO LECTURA al catálogo propio: productos, precios de venta, stock,
// descripciones y fotos. Nunca costos.
// ==============================================================================

import { request } from "./client"

export interface ClaveMcp {
    id: number
    nombre: string
    /** Prefijo identificador (ej. "nezzura_mcp_1a2b…"); la clave completa no se guarda */
    key_prefix: string
    /** 1 lectura básica · 2 lectura avanzada (análisis) · 3 escritura básica */
    nivel: number
    creada_en: string
    ultimo_uso_en: string | null
    llamadas_hoy: number
    dia_uso: string | null
    escrituras_hoy: number
    /** Override por clave (null = default del nivel) */
    limite_llamadas_diarias: number | null
    limite_escrituras_diarias: number | null
    /** Permiso de ESTA clave para que el agente lea costos internos (068) */
    ver_costos: boolean
}

/** Nombre, descripción y PERMISOS NUEVOS de cada nivel (los que gana el
 *  agente al subir a ese nivel). La lista alimenta el modal de advertencia
 *  que se muestra al elegir un nivel superior al ya seleccionado. */
export const NIVELES_CLAVE: Record<number, {
    nombre: string
    descripcion: string
    advertencia: string
    permisosNuevos: string[]
}> = {
    1: {
        nombre: "Lectura básica",
        descripcion: "El agente puede leer tu catálogo completo: productos, precios de venta, stock, descripciones y fotos, con listados filtrados (stock bajo, sin foto, por categoría).",
        advertencia: "No ve costos internos ni datos financieros. Ideal para publicar en Marketplace.",
        permisosNuevos: [],
    },
    2: {
        nombre: "Lectura avanzada",
        descripcion: "Además del catálogo, puede leer el análisis de tu negocio, las ventas una por una y el top vendido.",
        advertencia: "Ve métricas financieras de tu negocio (nunca costos por producto, salvo que actives 'ver costos'). Solo se la des a un agente de tu confianza. Requiere plan Plus.",
        permisosNuevos: [
            "Ver métricas del negocio: ingresos, ganancia bruta, margen, gastos y utilidad",
            "Ver hallazgos con consejos calculados: stock en riesgo, dinero dormido, cobros pendientes, márgenes bajos",
            "Ver las ventas recientes una por una y el top vendido (con qué se agotó o está por agotarse)",
            "Todo basado en datos reales de tu gestor (nunca inventados) · requiere plan Plus",
        ],
    },
    3: {
        nombre: "Escritura básica",
        descripcion: "Además de todo lo anterior, puede crear y EDITAR productos, ventas y gastos: lo propone en borrador, tú lo revisas y confirma cada cambio.",
        advertencia: "Puede CREAR y EDITAR en tu inventario. Cada cambio pasa por borrador que tú confirmas en el chat, y queda registrado en el Historial como hecho por el agente IA.",
        permisosNuevos: [
            "Proponer productos nuevos (borradores que se revisan antes de crear nada)",
            "Editar productos: descripción, precio, nombre, estado, códigos, categorías…",
            "Editar ventas (cantidad, precio, fecha — el stock se recalcula solo) y gastos (monto, categoría)",
            "Cada cambio lo confirmas tú en el chat y queda en el Historial como hecho por el agente IA",
        ],
    },
}

/** Límites por defecto según nivel (espejo de database/mcp_claves.py). */
export const DEFAULTS_LIMITES: Record<number, { llamadas: number; escrituras: number }> = {
    1: { llamadas: 1000, escrituras: 1000 },
    2: { llamadas: 300, escrituras: 1000 },
    3: { llamadas: 100, escrituras: 1000 },
}

export const museApi = {
    getClaves: () => request<{ claves: ClaveMcp[] }>("/mcp-conexion/claves"),

    /** Devuelve la clave en claro UNA sola vez: el backend solo guarda su hash. */
    crearClave: (nombre?: string, nivel: number = 1) =>
        request<{ ok: boolean; clave: string }>("/mcp-conexion/claves", {
            method: "POST",
            body: JSON.stringify({ nombre: nombre?.trim() || null, nivel }),
        }),

    /** Edita nivel, límites o el permiso de costos de una clave ACTIVA sin
     *  tocar su hash: el agente no se reconecta. Omitir un campo = no cambiar. */
    editarClave: (id: number, datos: {
        nivel?: number
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
