// ==============================================================================
// src/app/layout.tsx
// Layout raíz — sidebar en desktop, bottom-nav en móvil.
// ==============================================================================

import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import Link from "next/link"
import "./globals.css"

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

const NAV = [
    { href: "/", icon: "🛍️", label: "Punto de Venta" },
    { href: "/inventario", icon: "📦", label: "Inventario" },
    { href: "/estadisticas", icon: "📊", label: "Estadísticas" },
    { href: "/gastos", icon: "💸", label: "Gastos" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body className={jakarta.className} style={{ margin: 0 }}>
                <div style={{ display: "flex", minHeight: "100vh", maxWidth: "100vw", overflowX: "hidden" }}>


                    {/* ── Sidebar desktop ── */}
                    <aside className="hidden md:flex" style={{
                        width: "240px",
                        background: "linear-gradient(180deg, #ffc9dbff 0%, #fdf6f9 60%, #ffffff 100%)",
                        flexDirection: "column",
                        padding: "0 0 24px 0",
                        position: "fixed",
                        height: "100vh",
                        top: 0,
                        left: 0,
                        zIndex: 100,
                        borderRight: "1.5px solid #fce4ec",
                        boxShadow: "4px 0 24px rgba(216, 27, 96, 0.06)",
                    }}>

                        {/* Logo */}
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: "32px 16px 24px",
                            borderBottom: "1.5px solid #fce4ec",
                            marginBottom: 12,
                        }}>
                            <div style={{
                                background: "linear-gradient(135deg, #fce4ec, #f8bbd0)",
                                borderRadius: "50%",
                                padding: 4,
                                marginBottom: 12,
                                boxShadow: "0 4px 16px rgba(216,27,96,0.15)",
                            }}>
                                <img src="/logo.png" alt="Goyangi"
                                    style={{
                                        width: 76, height: 76,
                                        borderRadius: "50%",
                                        objectFit: "contain",
                                        display: "block",
                                    }}
                                />
                            </div>
                            <span style={{
                                color: "#ad1457",
                                fontWeight: 800,
                                fontSize: "1.05rem",
                                letterSpacing: 0.3,
                            }}>
                                Goyangi Store
                            </span>
                            <span style={{
                                color: "#b15b7aff",
                                fontSize: "0.7rem",
                                fontWeight: 500,
                                marginTop: 3,
                                letterSpacing: 0.8,
                                textTransform: "uppercase",
                            }}>
                                Panel de control
                            </span>
                        </div>

                        {/* Etiqueta sección */}
                        <div style={{
                            padding: "0 20px 10px",
                            color: "#f48fb1",
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                        }}>
                            Menú principal
                        </div>

                        {/* Links de navegación */}
                        <nav style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            padding: "0 12px",
                        }}>
                            {NAV.map(item => (
                                <Link key={item.href} href={item.href}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "11px 16px",
                                        borderRadius: 12,
                                        color: "#880e4f",
                                        textDecoration: "none",
                                        fontSize: "0.875rem",
                                        fontWeight: 600,
                                        transition: "background 0.15s, color 0.15s",
                                        letterSpacing: 0.1,
                                    }}
                                    className="nav-link"
                                >
                                    <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>{item.icon}</span>
                                    {item.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Footer */}
                        <div style={{
                            marginTop: "auto",
                            padding: "16px 20px",
                            borderTop: "1.5px solid #fce4ec",
                            color: "#f48fb1",
                            fontSize: "0.68rem",
                            fontWeight: 500,
                            textAlign: "center",
                            letterSpacing: 0.3,
                        }}>
                            Hecho para mi pookie 🐱 · lov u
                        </div>
                    </aside>

                    {/* ── Contenido principal ── */}
                    <main className="md:ml-[240px]" style={{
                        flex: 1,
                        minWidth: 0,
                        paddingBottom: 72,
                        minHeight: "100vh",
                        background: "var(--bg-app)",
                    }}>
                        {children}
                    </main>

                    {/* ── Bottom Navigation móvil ── */}
                    <nav className="flex md:hidden" style={{
                        position: "fixed",
                        bottom: 0, left: 0, right: 0,
                        background: "#fff",
                        borderTop: "1.5px solid #fce4ec",
                        justifyContent: "space-around",
                        alignItems: "center",
                        height: 64,
                        zIndex: 200,
                        boxShadow: "0 -4px 20px rgba(194,24,91,0.08)",
                    }}>
                        {NAV.map(item => (
                            <Link key={item.href} href={item.href} style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 3,
                                textDecoration: "none",
                                flex: 1,
                                padding: "8px 0",
                            }}>
                                <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>{item.icon}</span>
                                <span style={{
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    color: "#ad1457",
                                    letterSpacing: 0.3,
                                }}>
                                    {item.label.split(" ")[0]}
                                </span>
                            </Link>
                        ))}
                    </nav>

                </div>

                <style>{`
                    .nav-link:hover {
                        background: linear-gradient(135deg, #fce4ec, #f8bbd0) !important;
                        color: #880e4f !important;
                    }
                `}</style>
            </body>
        </html>
    )
}
