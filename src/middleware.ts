// ==============================================================================
// src/middleware.ts — Next.js Route Protection (Edge, SIN llamadas de red)
//
// Antes este middleware creaba un cliente Supabase y validaba sesión con
// llamadas de red desde el edge: si Supabase Auth tardaba, Vercel cortaba
// con "Routing Middleware has timed out" (504).
//
// Ahora SOLO verifica la existencia/forma de la cookie de sesión de
// @supabase/ssr. La validación profunda vive en las capas que ya existían:
//   1. Cliente: supabase.auth refresca el token y TenantContext decide el
//      estado real de la sesión tras montar.
//   2. Backend: dependencies.get_tenant_id valida firma y vigencia del JWT
//      en cada endpoint (ningún dato se sirve sin token válido).
// ==============================================================================

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/login", "/catalogo"]

// Cookie de sesión de @supabase/ssr: 'sb-<ref>-auth-token'; cuando el valor
// excede el límite de tamaño se particiona como 'sb-<ref>-auth-token.0', '.1'…
const RE_COOKIE_SESION = /^sb-.*-auth-token(\.\d+)?$/

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Rutas públicas pasan sin verificación
    if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
        return NextResponse.next()
    }

    const cookiesSesion = request.cookies
        .getAll()
        .filter(c => RE_COOKIE_SESION.test(c.name))

    // Sin ninguna cookie de sesión → no hay sesión que refrescar: al login
    if (!cookiesSesion.some(c => c.value.length > 0)) {
        const loginUrl = new URL("/login", request.url)
        return NextResponse.redirect(loginUrl)
    }

    // Forma mínima (sin red): reconstruir el valor (uniendo chunks si aplica)
    // y verificar que el JSON se parezca a una sesión de Supabase. Una cookie
    // parseable SIN access_token está rota → al login. Si no se puede parsear
    // (formato legado u opaco), se deja pasar: el cliente la refresca o
    // redirige, y el backend rechaza peticiones sin token válido.
    const valor = cookiesSesion.map(c => c.value).join("")
    try {
        const json = valor.startsWith("base64-") ? atob(valor.slice(7)) : valor
        const sesion = JSON.parse(json)
        if (sesion && typeof sesion === "object" && !sesion.access_token) {
            const loginUrl = new URL("/login", request.url)
            return NextResponse.redirect(loginUrl)
        }
    } catch {
        // Formato no parseable: la validación profunda la hace el cliente
    }

    return NextResponse.next()
}

// Aplicar a todas las rutas excepto archivos estáticos
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\..*).*)"],
}
