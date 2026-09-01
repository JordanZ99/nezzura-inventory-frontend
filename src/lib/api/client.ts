import { supabase } from "@/lib/supabase"
import type { RangoFechas } from "@/types"

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

/**
 * Obtiene el token JWT de la sesión activa de Supabase.
 * Si no hay sesión, devuelve objeto vacío y el backend rechazará la petición.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
}

/**
 * Error de la API con metadatos del cuerpo de respuesta (status, codigo, sqlstate).
 */
export class ApiError extends Error {
    status?: number
    codigo?: string
    sqlstate?: string

    constructor(mensaje: string, detalles: { status?: number; codigo?: string; sqlstate?: string } = {}) {
        super(mensaje)
        this.name = "ApiError"
        Object.assign(this, detalles)
    }
}

export async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const authHeaders = await getAuthHeaders()
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...authHeaders,
            ...options.headers,
        },
    })
    if (!res.ok) {
        let errStr = "Error en la petición"
        let codigo: string | undefined
        let sqlstate: string | undefined
        try {
            const err = await res.json()
            errStr = err.detail || err.mensaje || JSON.stringify(err)
            codigo = err.codigo
            sqlstate = err.sqlstate
        } catch {
            // ignore
        }
        throw new ApiError(errStr, { status: res.status, codigo, sqlstate })
    }
    return res.json()
}

/** Agrega pares clave/valor como querystring, omitiendo vacíos. */
export function conQuery(path: string, params: Record<string, string | number | boolean | undefined | null>): string {
    const qs = new URLSearchParams()
    for (const [clave, valor] of Object.entries(params)) {
        if (valor === undefined || valor === null || valor === "") continue
        qs.set(clave, String(valor))
    }
    const s = qs.toString()
    return s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path
}

/** Agrega ?desde/?hasta a un path solo cuando el rango trae límites. */
export function conRango(path: string, rango?: RangoFechas): string {
    return conQuery(path, { desde: rango?.desde, hasta: rango?.hasta })
}

/**
 * Llama al endpoint público del catálogo (NO requiere autenticación).
 */
export async function fetchCatalogoPublico<T = unknown>(slug: string): Promise<T> {
    const res = await fetch(`${BASE_URL}/public/catalogo/${encodeURIComponent(slug)}`)
    if (!res.ok) {
        let errStr = "Error al cargar el catálogo"
        try {
            const err = await res.json()
            errStr = err.detail || JSON.stringify(err)
        } catch {
            // ignore
        }
        throw new Error(errStr)
    }
    return res.json()
}

/**
 * Nombre de archivo que envía el servidor en Content-Disposition (con fallback).
 */
function nombreArchivoDescarga(header: string | null, fallback: string): string {
    if (!header) return fallback
    const m = header.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
    if (m) {
        const nombre = m[1] || m[2]
        if (nombre) return nombre.trim()
    }
    return fallback
}

/**
 * Descarga un archivo del backend con el token de sesión.
 */
async function descargarArchivo(path: string, fallback: string): Promise<void> {
    const authHeaders = await getAuthHeaders()
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders })
    if (!res.ok) {
        let detail = "Error al descargar"
        try {
            const err = await res.json()
            detail = err.detail || detail
        } catch {
            // ignore
        }
        throw new Error(detail)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = nombreArchivoDescarga(res.headers.get("Content-Disposition"), fallback)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

export async function descargarDatosJson(): Promise<void> {
    await descargarArchivo(
        "/export/json",
        `nezzura-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    )
}

export async function descargarDatosXlsx(): Promise<void> {
    await descargarArchivo(
        "/export/xlsx",
        `nezzura-respaldo-${new Date().toISOString().slice(0, 10)}.xlsx`
    )
}
