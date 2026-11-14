// ==============================================================================
// src/lib/local/hibrido.ts
// Modo OFFLINE HÍBRIDO (plan básico/plus): la app opera contra los repos
// locales (SQLite/Dexie) como el Modo Local, PERO la autenticación es la
// sesión Supabase — no hay licencia de dispositivo. Al reconectar, la
// sincronización (repos/sync.ts) sube el delta de ventas/gastos/productos
// y baja los cambios hechos en la web.
//
// Qué guarda: el tenant_id en localStorage (offline no hay de dónde leerlo)
// y un id de dispositivo estable (namespace de las uids de la sync).
// La DB local es la MISMA que el viejo plan local usaba:
// nezzura_local_<tenant_id> — los datos de un tenant local→híbrido
// sobreviven y la primera sync los sube.
// ==============================================================================

import { ponerModo, obtenerModo } from "./modo"

const CLAVE_TENANT = "nezzura_tenant_hibrido"
const CLAVE_EMPRESA = "nezzura_empresa_hibrido"
const CLAVE_PLAN = "nezzura_plan_hibrido"
const CLAVE_DISPOSITIVO = "nezzura_dispositivo"

/** Activa el modo offline híbrido. Requiere sesión de Supabase activa.
 * El plan se guarda para que la UI (features de plus, etc.) siga igual
 * mientras la app opera offline. */
export function activarModoOffline(tenantId: string, empresa: string, plan: string): void {
    try {
        localStorage.setItem(CLAVE_TENANT, tenantId)
        localStorage.setItem(CLAVE_EMPRESA, empresa || "")
        localStorage.setItem(CLAVE_PLAN, plan || "basico")
        ponerModo("local")
    } catch {
        // sin storage: no hay modo híbrido posible
    }
}

/** tenant_id del modo híbrido (null si no está activado / modo nube). */
export function obtenerTenantIdHibrido(): string | null {
    if (obtenerModo() !== "local") return null
    try {
        return localStorage.getItem(CLAVE_TENANT)
    } catch {
        return null
    }
}

/** Nombre del negocio guardado al activar (solo para el perfil inicial). */
export function obtenerEmpresaHibrida(): string {
    try {
        return localStorage.getItem(CLAVE_EMPRESA) || ""
    } catch {
        return ""
    }
}

/** Plan guardado al activar (la UI lo usa mientras está offline). */
export function obtenerPlanHibrido(): string {
    try {
        return localStorage.getItem(CLAVE_PLAN) || "basico"
    } catch {
        return "basico"
    }
}

/** Id estable de este dispositivo+tenant: namespace de las uids de sync
 * (dos dispositivos NUNCA generan la misma uid para filas distintas). */
export function obtenerIdDispositivo(): string {
    try {
        let id = localStorage.getItem(CLAVE_DISPOSITIVO)
        if (!id) {
            id = crypto.randomUUID().slice(0, 8)
            localStorage.setItem(CLAVE_DISPOSITIVO, id)
        }
        return id
    } catch {
        return "dev"
    }
}

/** Sale del modo offline (híbrido o local puro) de vuelta a la nube. */
export function salirModoOffline(): void {
    try {
        localStorage.removeItem(CLAVE_TENANT)
        localStorage.removeItem(CLAVE_EMPRESA)
        localStorage.removeItem(CLAVE_PLAN)
    } catch { /* noop */ }
    // salirModoLocal limpia la licencia + el flag/cookie de modo (modo.ts).
    import("./licencia").then(m => m.salirModoLocal())
}
