// ==============================================================================
// src/app/layout.tsx
// Layout raíz — sidebar en desktop, bottom-nav en móvil.
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
    { href: "/",             icon: "🛍️", label: "Venta"        },
    { href: "/inventario",   icon: "📦", label: "Inventario"   },
    { href: "/estadisticas", icon: "📊", label: "Estadísticas" },
    { href: "/gastos",       icon: "💸", label: "Gastos"       },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body className={inter.className} style={{ margin: 0 }}>
            <div style={{ display: "flex", minHeight: "100vh" }}>

                {/* ── Sidebar desktop ── */}
                <aside className="hidden md:flex" style={{
                    width: "var(--sidebar-w)",
                    background: "linear-gradient(180deg, #c2185b 0%, #f06292 100%)",
                    flexDirection: "column",
                    padding: "0 0 24px 0",
                    position: "fixed",
                    height: "100vh",
                    top: 0,
                    left: 0,
                    zIndex: 100,
                    boxShadow: "4px 0 20px rgba(194,24,91,0.25)",
                }}>
                    {/* Logo */}
                    <div style={{
                        display: "flex", flexDirection: "column",
                        alignItems: "center", padding: "28px 16px 20px",
                        borderBottom: "1px solid rgba(255,255,255,0.18)",
                        marginBottom: 8,
                    }}>
                        <div style={{
                            background: "rgba(255,255,255,0.2)",
                            borderRadius: "50%", padding: 4, marginBottom: 8,
                        }}>
                            <img src="/logo.png" alt="Goyangi"
                                style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "contain" }} />
                        </div>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", letterSpacing: 0.5 }}>
                            Goyangi Store
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem", marginTop: 2 }}>
                            Panel de control
                        </span>
                    </div>

                    <div style={{ padding: "0 20px 8px", color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: 1.5 }}>
                        MENÚ PRINCIPAL
                    </div>

                    <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
                        {NAV.map(item => (
                            <Link key={item.href} href={item.href} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "11px 16px",
                                borderRadius: 10,
                                color: "rgba(255,255,255,0.9)",
                                textDecoration: "none",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                transition: "background 0.18s",
                            }}
                            className="hover:bg-white/20"
                            >
                                <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div style={{
                        marginTop: "auto", padding: "16px 20px",
                        borderTop: "1px solid rgba(255,255,255,0.18)",
                        color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", textAlign: "center",
                    }}>
                        Made with 🐱 · Goyangi v1.0
                    </div>
                </aside>

                {/* ── Contenido principal ── */}
                <main className="md:ml-[240px]" style={{
                    flex: 1,
                    paddingBottom: 72,
                    minHeight: "100vh",
                    background: "var(--bg-app)",
                }}>
                    {children}
                </main>

                {/* ── Bottom Navigation móvil ── */}
                <nav className="flex md:hidden" style={{
                    position: "fixed", bottom: 0, left: 0, right: 0,
                    background: "#fff",
                    borderTop: "1.5px solid #fce4ec",
                    justifyContent: "space-around",
                    alignItems: "center",
                    height: 64,
                    zIndex: 200,
                    boxShadow: "0 -4px 20px rgba(194,24,91,0.12)",
                }}>
                    {NAV.map(item => (
                        <Link key={item.href} href={item.href} style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            textDecoration: "none",
                            flex: 1,
                            padding: "8px 0",
                        }}>
                            <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{item.icon}</span>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#e91e8c", letterSpacing: 0.3 }}>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>

            </div>
        </body>
        </html>
    )
}
