// ==============================================================================
// src/app/layout.tsx
// Layout raíz — oculta sidebar en /login, muestra botón de logout.
// ==============================================================================

import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import AppShell from "@/components/AppShell"

const jakarta = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
    title: "Goyangi Store",
    description: "Gestor de inventario y punto de venta",
    icons: {
        icon: "/logo.png",
        shortcut: "/logo.png",
        apple: "/logo.png",
    },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body className={jakarta.className} style={{ margin: 0 }}>
                <AppShell>{children}</AppShell>
            </body>
        </html>
    )
}
