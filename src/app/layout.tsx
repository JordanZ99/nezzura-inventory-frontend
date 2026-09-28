// ==============================================================================
// src/app/layout.tsx
// Layout raíz — oculta sidebar en /login, muestra botón de logout.
// ==============================================================================

import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Plus_Jakarta_Sans } from "next/font/google"
import { normalizarTema } from "@/lib/temas"
import "./globals.css"
import AppShell from "@/components/AppShell"
import Providers from "@/components/Providers"
import { ToastProvider } from "@/components/ui/Toast"

const jakarta = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
})

const ORIGEN_SITIO =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : "https://productos.nezzura.digital")

export const metadata: Metadata = {
    metadataBase: new URL(ORIGEN_SITIO),
    title: "Nezzura Digital",
    description: "Gestor de inventario y punto de venta",
    manifest: "/manifest.json",
    icons: {
        icon: "/logo.png",
        shortcut: "/logo.png",
        apple: "/logo.png",
    },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    // El tema se renderiza en el SERVIDOR desde la cookie: el HTML ya llega
    // con data-theme correcto y el primer paint nunca muestra Steel Slate.
    // El script inline es un fallback (primera visita sin cookie / sincronía
    // con localStorage) y también persiste la cookie para el próximo render.
    const temaInicial = normalizarTema(cookies().get("tema")?.value)

    return (
        <html lang="es" data-theme={temaInicial} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        try {
                            var tema = localStorage.getItem('tema') || 'default';
                            /* Migración: 'midnightBlack' fue renombrado a 'midnightSlate' */
                            if (tema === 'midnightBlack') tema = 'midnightSlate';
                        } catch(e) { tema = 'default'; }
                        document.documentElement.setAttribute('data-theme', tema);
                        /* Persistencia aparte: si falla, no impide aplicar el tema */
                        try {
                            localStorage.setItem('tema', tema);
                            document.cookie = 'tema=' + tema + ';path=/;max-age=31536000;samesite=lax';
                        } catch(e) {}
                    })();
                `}} />
                <script dangerouslySetInnerHTML={{
                    __html: `
                    if ('serviceWorker' in navigator) {
                        window.addEventListener('load', function() {
                            navigator.serviceWorker.register('/sw.js');
                        });
                    }
                `}} />
            </head>
            <body className={jakarta.className} style={{ margin: 0 }}>
                <Providers>
                    <ToastProvider>
                        <AppShell>{children}</AppShell>
                    </ToastProvider>
                </Providers>
            </body>
        </html>
    )
}
