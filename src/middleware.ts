// ==============================================================================
// src/middleware.ts — Next.js Route Protection (Edge Runtime compatible)
// Usa @supabase/ssr para leer la sesión desde cookies en el edge.
// Redirige a /login si no hay sesión activa.
// ==============================================================================

import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/login", "/catalogo"]

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Rutas públicas pasan sin verificación
    if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
        return NextResponse.next()
    }

    const response = NextResponse.next({
        request: { headers: request.headers },
    })

    // Cliente SSR: lee/escribe cookies en el edge sin problemas
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // Obtener sesión (también refresca el token automáticamente si expiró)
    const { data: { session } } = await supabase.auth.getSession()

    // Sin sesión → redirigir al login
    if (!session) {
        const loginUrl = new URL("/login", request.url)
        return NextResponse.redirect(loginUrl)
    }

    return response
}

// Aplicar a todas las rutas excepto archivos estáticos
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\..*).*)"],
}
