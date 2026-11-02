// ==============================================================================
// src/lib/local/licencia.ts
// Licencia de dispositivo para el Modo Local.
//
// Flow (el único momento que pide internet):
//   1. Login Supabase + POST /licencias/activar → JWT firmado {tenant_id,
//      plan, exp +14d}. Se guarda en localStorage.
//   2. Offline: validarLicencia() decodifica el payload y revisa exp —
//      validación de cliente (suave). El enforcement real es server-side,
//      en /licencias/revalidar (revocación, cambio de plan).
//   3. Con conexión esporádica: revalidarLicencia() estira el token otros
//      14 días. Si el dispositivo fue revocado → LICENCIA_INVALIDA_OFFLINE
//      y la app bloquea al vencer el token actual (sus datos NO se pierden).
// ==============================================================================

"use client"

import { supabase } from "@/lib/supabase"
import { BASE_URL, request } from "@/lib/api/client"
import { ponerModo } from "./modo"

const CLAVE_DEVICE_ID = "nezzura_device_id"
const CLAVE_LICENCIA = "nezzura_licencia"

export interface LicenciaGuardada {
    token: string
    tenant_id: string
    plan: string
    exp: number           // epoch segundos
    empresa: string
    logo: string
}

// ──Respuestas del backend (routers/licencias.py) ──
interface RespuestaActivar {
    ok: boolean
    token: string
    exp: number
    plan: string
    empresa: string
    logo: string
}

export const ERRORES_LICENCIA = {
    PLAN: "PLAN_SIN_LOCAL",
    LIMITE: "LIMITE_DISPOSITIVOS",
    REVOCADO: "DISPOSITIVO_REVOCADO",
    INVALIDA: "LICENCIA_INVALIDA",
} as const

/** UUID estable del aparato: se genera UNA vez y vive en localStorage. */
function obtenerDeviceId(): string {
    let id = localStorage.getItem(CLAVE_DEVICE_ID)
    if (!id) {
        id = crypto.randomUUID()
        localStorage.setItem(CLAVE_DEVICE_ID, id)
    }
    return id
}

export function obtenerLicencia(): LicenciaGuardada | null {
    try {
        const cruda = localStorage.getItem(CLAVE_LICENCIA)
        if (!cruda) return null
        const lic = JSON.parse(cruda) as LicenciaGuardada
        if (!lic?.token || !lic?.exp || !lic?.tenant_id) return null
        return lic
    } catch {
        return null
    }
}

function guardarLicencia(lic: LicenciaGuardada): void {
    localStorage.setItem(CLAVE_LICENCIA, JSON.stringify(lic))
}

export function borrarLicencia(): void {
    localStorage.removeItem(CLAVE_LICENCIA)
}

/**
 * Activa ESTE dispositivo con licencia del modo local.
 * Requiere internet + debe existir sesión o credenciales de Supabase.
 * Devuelve la empresa (para el caso "activo desde el login de /acceso-local").
 */
export async function activarDispositivo(nombre = "Este dispositivo"): Promise<LicenciaGuardada> {
    const device_id = obtenerDeviceId()
    const r = await request<RespuestaActivar>("/licencias/activar", {
        method: "POST",
        body: JSON.stringify({ device_id, nombre }),
    })
    // request() firma el JWT de Supabase de la sesión activa — debe existir.
    const lic: LicenciaGuardada = {
        token: r.token,
        exp: r.exp,
        plan: r.plan,
        tenant_id: decodificarPayload(r.token).tenant_id,
        empresa: r.empresa || "",
        logo: r.logo || "",
    }
    guardarLicencia(lic)
    ponerModo("local")
    return lic
}

/** Login completo (credenciales) + activación, para /acceso-local. */
export async function entrarYActivar(
    email: string,
    password: string,
    nombre = "Este dispositivo"
): Promise<LicenciaGuardada> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
        if (error.message === "Invalid login credentials") {
            throw new Error("Correo o contraseña incorrectos.")
        }
        throw new Error(error.message)
    }
    return activarDispositivo(nombre)
}

/**
 * Validación OFFLINE de la licencia (decodificar sin verificar firma —
 * la firma la valida el servidor; aquí solo decide si el token vivo).
 * Estados: "vigente" | "vencida" (revalidar con internet) | "ausente".
 */
export function estadoLicencia(): "vigente" | "vencida" | "ausente" {
    const lic = obtenerLicencia()
    if (!lic) return "ausente"
    return Date.now() / 1000 < lic.exp ? "vigente" : "vencida"
}

export function diasRestantes(): number {
    const lic = obtenerLicencia()
    if (!lic) return 0
    return Math.max(0, Math.floor((lic.exp - Date.now() / 1000) / 86400))
}

/**
 * Revalida CON internet: estrena token. Errores con código conocido se
 * marcan en el mensaje de error (el caller decide la UI).
 */
export async function revalidarLicencia(): Promise<LicenciaGuardada> {
    const lic = obtenerLicencia()
    if (!lic) throw new Error("No hay licencia que revalidar.")
    const res = await fetch(`${BASE_URL}/licencias/revalidar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${lic.token}` },
    })
    if (!res.ok) {
        const codigo = res.headers.get("x-codigo") || ""
        if (codigo === ERRORES_LICENCIA.REVOCADO || codigo === ERRORES_LICENCIA.PLAN) {
            // Muerte definitiva de la licencia: limpiar y bloquear.
            borrarLicencia()
            throw new Error("LICENCIA_MUERTA")
        }
        if (codigo === ERRORES_LICENCIA.INVALIDA || res.status === 401) {
            throw new Error("LICENCIA_INVALIDA_OFFLINE")
        }
        throw new Error("SIN_CONEXION")
    }
    const r = (await res.json()) as RespuestaActivar
    const nueva: LicenciaGuardada = {
        ...lic,
        token: r.token,
        exp: r.exp,
        plan: r.plan,
    }
    guardarLicencia(nueva)
    return nueva
}

/** Decodifica el payload de un JWT sin verificarlo (solo para tenant_id al activar). */
function decodificarPayload(token: string): { tenant_id: string; exp?: number } {
    try {
        const parte = token.split(".")[1]
        const json = atob(parte.replace(/-/g, "+").replace(/_/g, "/"))
        return JSON.parse(json)
    } catch {
        return { tenant_id: "" }
    }
}

/** Termina el modo local en ESTE aparato: quita token y cookie (los datos
 * del negocio en IndexedDB se conservan — el dueño puede volver a entrar). */
export function salirModoLocal(): void {
    borrarLicencia()
    ponerModo("nube")
}
