"use client"
// ==============================================================================
// src/components/AppShell.tsx
// Shell del layout: sidebar, bottom-nav y botón logout.
// Gastos ahora es un link plano (toda la funcionalidad está unificada en /gastos).
// Se oculta completamente en /login para mostrar la pantalla limpia.
// ==============================================================================

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Icon from "@/components/ui/Icon"
import { supabase } from "@/lib/supabase"
import { useTenant } from "@/contexts/TenantContext"

const NAV = [
    { href: "/", icon: "ShoppingCart", label: "Punto de Venta" },
    { href: "/inventario", icon: "Package", label: "Inventario" },
    { href: "/estadisticas", icon: "ChartPie", label: "Estadísticas" },
    { href: "/gastos", icon: "DollarSign", label: "Gastos" },
    { href: "/personalizacion", icon: "UserRoundPen", label: "Ajustes" }
]

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    // Re-aplica el tema guardado tras la hidratación de React.
    useEffect(() => {
        try {
            const tema = localStorage.getItem('tema') || 'default'
            document.documentElement.setAttribute('data-theme', tema)
        } catch (e) { }
    }, [])
    const isLoginPage = pathname === "/login"
    const isCatalogo = pathname.startsWith("/catalogo")
    const { tenant } = useTenant()

    const logoSrc = tenant?.logo || "/logo.png"
    const empresa = tenant?.empresa || "..."

    async function handleLogout() {
        await supabase.auth.signOut()
        router.replace("/login")
    }

    // En login y catálogo público renderizamos solo los children (sin sidebar)
    if (isLoginPage || isCatalogo) {
        return <>{children}</>
    }

    function isActive(href: string): boolean {
        if (href === "/gastos") {
            return pathname === "/gastos" || pathname.startsWith("/gastos/")
        }
        return pathname === href
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", maxWidth: "100vw", overflowX: "hidden" }}>

            {/* ── Sidebar desktop ── */}
            <aside className="hidden md:flex" style={{
                width: "240px",
                background: "var(--gradient-layout)",
                flexDirection: "column",
                padding: "0 0 24px 0",
                position: "fixed",
                height: "100vh",
                top: 0,
                left: 0,
                zIndex: 100,
                boxShadow: "4px 0 24px rgba(216, 27, 96, 0.06)",
            }}>

                {/* Logo */}
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "32px 16px 24px",
                    marginBottom: 12,
                }}>
                    <div style={{
                        background: "var(--primary-layout)",
                        borderRadius: "50%",
                        padding: 4,
                        marginBottom: 12,
                        boxShadow: "0 4px 16px rgba(216,27,96,0.15)",
                    }}>
                        <img src={logoSrc} alt={empresa}
                            style={{
                                width: 76, height: 76,
                                borderRadius: "50%",
                                objectFit: "cover",
                                display: "block",
                            }}
                        />
                    </div>
                    <span style={{
                        color: "var(--primary-icons)",
                        fontWeight: 800,
                        fontSize: "1.05rem",
                        letterSpacing: 0.3,
                        textAlign: "center",
                    }}>
                        {empresa}
                    </span>
                    <span style={{
                        color: "var(--primary-darkGray)",
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
                    padding: "0 64px 10px",
                    color: "var(--primary-light)",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
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
                                color: isActive(item.href) ? "var(--primary-dark)" : "var(--primary-icons)",
                                background: isActive(item.href)
                                    ? "var(--primary-layout)"
                                    : "transparent",
                                textDecoration: "none",
                                fontSize: "0.875rem",
                                fontWeight: isActive(item.href) ? 700 : 600,
                                transition: "background 0.15s, color 0.15s",
                                letterSpacing: 0.1,
                            }}
                            className="nav-link"
                        >
                            <Icon name={item.icon as any} size={20} />
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* Footer con logout */}
                <div style={{
                    marginTop: "auto",
                    padding: "16px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}>
                    <button
                        id="btn-logout"
                        onClick={handleLogout}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "10px 16px",
                            background: "none",
                            border: "1.5px solid var(--border-primary)",
                            borderRadius: 12,
                            color: "var(--primary-icons)",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "background 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--primary-soft)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                        <Icon name="LogOut" size={16} />
                        Cerrar sesión
                    </button>
                    <p style={{
                        color: "var(--primary-light)",
                        fontSize: "0.65rem",
                        fontWeight: 500,
                        textAlign: "center",
                        margin: 0,
                        letterSpacing: 0.3,
                    }}>
                        Nezzura Digital
                    </p>
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
                background: "var(--bg-card)",
                justifyContent: "space-around",
                alignItems: "center",
                height: 64,
                zIndex: 200,
                boxShadow: "0 -4px 20px rgba(47, 24, 194, 0.08)",
            }}>
                {NAV.map(item => {
                    const active = isActive(item.href)
                    return (
                        <Link key={item.href} href={item.href} style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 3,
                            textDecoration: "none",
                            flex: 1,
                            padding: "8px 0",
                        }}>
                            <Icon name={item.icon as any} size={22}
                                color={active ? "var(--primary-mid)" : "var(--primary-icons)"}
                            />
                            <span style={{
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                color: active ? "var(--primary-mid)" : "var(--primary-icons)",
                                letterSpacing: 0.3,
                            }}>
                                {item.label.split(" ")[0]}
                            </span>
                        </Link>
                    )
                })}
            </nav>

        </div>
    )
}
