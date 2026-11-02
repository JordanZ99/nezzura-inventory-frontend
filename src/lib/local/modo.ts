// ==============================================================================
// src/lib/local/modo.ts
// Interruptor nube/local. "local" = la app opera 100% offline contra
// IndexedDB del dispositivo (licencia de dispositivo, ver licencia.ts).
//
// El flag vive en localStorage (accesible desde el cliente siempre) y se
// espeja en una cookie (leyíble por el middleware edge de Next: es su única
// forma de dejar pasar rutas de un usuario SIN sesión Supabase).
// ==============================================================================

export type Modo = "nube" | "local"

export const CLAVE_MODO = "nezzura_modo"
export const COOKIE_MODO = "nezzura_modo"

export function obtenerModo(): Modo {
    if (typeof window === "undefined") return "nube"
    try {
        return localStorage.getItem(CLAVE_MODO) === "local" ? "local" : "nube"
    } catch {
        return "nube"
    }
}

export function ponerModo(modo: Modo): void {
    try {
        if (modo === "local") {
            localStorage.setItem(CLAVE_MODO, "local")
            // Para el middleware (server/edge): cookie de 1 año, sin HttpOnly
            // porque la escribe JS. El middleware solo usa su EXISTENCIA.
            document.cookie = `${COOKIE_MODO}=local;path=/;max-age=31536000;samesite=lax`
        } else {
            localStorage.removeItem(CLAVE_MODO)
            document.cookie = `${COOKIE_MODO}=;path=/;max-age=0`
        }
    } catch {
        // Sin storage disponible: no hay modo local posible
    }
}
