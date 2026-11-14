// ==============================================================================
// src/app/layout.tsx
// Layout raíz — oculta sidebar en /login, muestra botón de logout.
// ==============================================================================

import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
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

// El service worker (sw.js, cache-first) solo tiene sentido en la PWA web.
// En el build nativo de Capacitor el WebView ya sirve el bundle local del
// binario: un SW cache-first serviría assets VIEJOS tras actualizar la app.
const ES_NATIVO = process.env.NEXT_PUBLIC_CAPACITOR === "1"

const SCRIPT_TEMA = `
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
                `

const SCRIPT_SW = ES_NATIVO
    ? ""
    : `
                    if ('serviceWorker' in navigator) {
                        window.addEventListener('load', function() {
                            navigator.serviceWorker.register('/sw.js');
                        });
                    }
                `

export default function RootLayout({ children }: { children: React.ReactNode }) {
    // El tema se aplica en el CLIENTE con el script inline del <head>: corre
    // de forma síncrona antes del primer paint, así que el HTML nunca llega
    // a verse con el tema equivocado. (Antes se leía la cookie aquí con
    // cookies(), pero eso obligaba a render dinámico y rompía `output:
    // "export"` del build nativo — la cookie la sigue escribiendo el script.)
    return (
        <html lang="es" data-theme="default" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
                <script dangerouslySetInnerHTML={{ __html: SCRIPT_SW }} />
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
