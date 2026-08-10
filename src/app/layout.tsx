// ==============================================================================
// src/app/layout.tsx
// Layout raíz — oculta sidebar en /login, muestra botón de logout.
// ==============================================================================

import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import AppShell from "@/components/AppShell"
import Providers from "@/components/Providers"

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
    return (
        <html lang="es">
            <head>
                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        try {
                            var tema = localStorage.getItem('tema') || 'default';
                            document.documentElement.setAttribute('data-theme', tema);
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
                    <AppShell>{children}</AppShell>
                </Providers>
            </body>
        </html>
    )
}
