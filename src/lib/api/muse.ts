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
    /** Prefijo identificador (ej. "goy_mcp_1a2b…"); la clave completa no se guarda */
    key_prefix: string
    creada_en: string
    ultimo_uso_en: string | null
    llamadas_hoy: number
    dia_uso: string | null
    /** null = activa · fecha = revocada */
    revocada_en: string | null
}

export const museApi = {
    getClaves: () => request<{ claves: ClaveMcp[] }>("/mcp-conexion/claves"),

    /** Devuelve la clave en claro UNA sola vez: el backend solo guarda su hash. */
    crearClave: (nombre?: string) =>
        request<{ ok: boolean; clave: string }>("/mcp-conexion/claves", {
            method: "POST",
            body: JSON.stringify({ nombre: nombre?.trim() || null }),
        }),

    /** Soft-delete: el agente queda desconectado en el próximo request. */
    revocarClave: (id: number) =>
        request<{ ok: boolean }>(`/mcp-conexion/claves/${id}`, { method: "DELETE" }),
}
