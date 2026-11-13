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
    /** null = activa · fecha = revocada */
    revocada_en: string | null
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
        descripcion: "El agente puede leer tu catálogo para publicar: productos, precios de venta, stock, descripciones y fotos.",
        advertencia: "No ve costos internos ni datos financieros. Ideal para publicar en Marketplace.",
        permisosNuevos: [],
    },
    2: {
        nombre: "Lectura avanzada",
        descripcion: "Además del catálogo, puede leer el análisis de tu negocio: ganancias, gastos, cobros pendientes y consejos calculados con tus datos reales.",
        advertencia: "Ve métricas financieras de tu negocio (nunca costos unitarios por producto). Solo se la des a un agente de tu confianza. Requiere plan Plus.",
        permisosNuevos: [
            "Ver métricas del negocio: ingresos, ganancia bruta, margen, gastos y utilidad",
            "Ver hallazgos con consejos calculados: stock en riesgo, dinero dormido, cobros pendientes, márgenes bajos",
            "Todo basado en datos reales de tu gestor (nunca inventados) · requiere plan Plus",
        ],
    },
    3: {
        nombre: "Escritura básica",
        descripcion: "Además de todo lo anterior, puede crear productos nuevos en tu inventario: los propone, tú los revisas y confirma cada alta.",
        advertencia: "Puede CREAR productos en tu inventario. Cada alta queda registrada en el Historial como hecha por el agente IA, y puedes revocar la clave al instante.",
        permisosNuevos: [
            "Proponer productos nuevos (borradores que se revisan antes de crear nada)",
            "Crear productos en tu inventario al confirmar: cada alta te la pregunta en el chat y queda en el Historial como hecha por el agente IA",
        ],
    },
}

export const museApi = {
    getClaves: () => request<{ claves: ClaveMcp[] }>("/mcp-conexion/claves"),

    /** Devuelve la clave en claro UNA sola vez: el backend solo guarda su hash. */
    crearClave: (nombre?: string, nivel: number = 1) =>
        request<{ ok: boolean; clave: string }>("/mcp-conexion/claves", {
            method: "POST",
            body: JSON.stringify({ nombre: nombre?.trim() || null, nivel }),
        }),

    /** Soft-delete: el agente queda desconectado en el próximo request. */
    revocarClave: (id: number) =>
        request<{ ok: boolean }>(`/mcp-conexion/claves/${id}`, { method: "DELETE" }),
}
