// ==============================================================================
// src/app/layout.tsx
// Layout raíz — sidebar de navegación compartido en todas las páginas.
// ==============================================================================

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Link from "next/link"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
    title: "Goyangi Store",
    description: "Gestor de inventario y punto de venta",
}

const NAV = [
    { href: "/", label: "🛍️ Punto de Venta" },
    { href: "/inventario", label: "📦 Inventario" },
    { href: "/estadisticas", label: "📊 Estadísticas" },
    { href: "/gastos", label: "💸 Gastos" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body className={inter.className}>
                <div className="flex min-h-screen">

                    {/* Sidebar */}
                    <aside className="w-56 bg-pink-100 flex flex-col p-4 gap-2 fixed h-screen">
                        <div className="flex flex-col items-center py-4 mb-2">
                            <img src="/logo.png" alt="Goyangi Store"
                                className="w-28 h-28 object-contain rounded-full"
                            />
                        </div>

                        <nav className="flex flex-col gap-1">
                            {NAV.map(item => (
                                <Link key={item.href} href={item.href}
                                    className="px-3 py-2 rounded-xl text-sm font-medium text-pink-800
                             hover:bg-pink-200 transition-colors">
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </aside>

                    {/* Contenido principal */}
                    <main className="ml-56 flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    )
}
