"use client"

import { useState, useEffect } from "react"
import { api, Producto } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import dynamic from "next/dynamic"
import Icon from "@/components/ui/Icon"

const Antigravity = dynamic(() => import("@/components/Antigravity"), { ssr: false })

type Tab = "cuenta" | "catalogo"

export default function Personalizacion() {
    const [cargando, setCargando] = useState(true)
    const [tab, setTab] = useState<Tab>("cuenta")
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const [tenantId, setTenantId] = useState<string | null>(null)
    const [productos, setProductos] = useState<Producto[]>([])

    useEffect(() => {
        async function loadData() {
            try {
                // Obtener datos del usuario
                const { data } = await supabase.auth.getSession()
                if (data.session?.user) {
                    setUserEmail(data.session.user.email ?? "Usuario Goyangi")
                }
                const perfil = await api.getPerfil()
                if (perfil?.tenant_id) {
                    setTenantId(perfil.tenant_id)
                }
                // Obtener catálogo
                const inv = await api.getInventario()
                setProductos(inv)
            } catch (e) {
                console.error("Error cargando configuración:", e)
            } finally {
                setCargando(false)
            }
        }
        loadData()
    }, [])

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: "cuenta", label: "Mi Cuenta", icon: "User" },
        { id: "catalogo", label: "Catálogo", icon: "ClipboardList" },
    ]

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* ── Hero con Antigravity ── */}
            <div style={{ position: "relative", overflow: "hidden", background: "var(--gradient-5)", padding: "32px 24px 90px" }}>
                <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" }}>
                    <Antigravity
                        count={400}
                        magnetRadius={12}
                        ringRadius={8}
                        waveSpeed={0.5}
                        waveAmplitude={1.2}
                        particleSize={1.5}
                        lerpSpeed={0.08}
                        color="var(--ag-color-5)"
                        autoAnimate={true}
                        particleVariance={0.8}
                        rotationSpeed={0.3}
                        depthFactor={0.5}
                        pulseSpeed={2}
                        particleShape="capsule"
                        fieldStrength={8}
                    />
                </div>
                <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                    <p style={{ color: "rgba(255, 255, 255, 0.91)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>CONFIGURACIÓN</p>
                    <h1 className="hidden md:flex" style={{ color: "var(--white)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}>
                        <div style={{ marginLeft: "-5px" }}>
                            <Icon name="UserRoundPen" size={32} color="var(--white)" />
                        </div>
                        Personalización
                    </h1>
                </div>
            </div>

            <div style={{ width: "100%", padding: "0 24px", marginTop: -47 }}>
                
                {/* ── Selector de Temas Original del Usuario ── */}
                <div style={{ flex: 1, gap: 12, marginBottom: 24 }}>
                    <div className="card fade-up" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="PaintBucket" size={32} color="var(--primary-alter)" />
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Temas</p>
                        </div>
                        {/* Contenedor de círculos de temas */}
                        <div style={{ display: "flex", flex: 1, gap: 20, justifyContent: "center" }}>
                            {/* Círculo Gris */}
                            <button onClick={() => document.documentElement.setAttribute('data-theme', 'default')}
                                style={{
                                    width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", backgroundColor: "#91a5b3ff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                                }}
                                title="Steel Slate"
                            />
                            {/* Círculo Rosa */}
                            <button onClick={() => document.documentElement.setAttribute('data-theme', 'strawberry')}
                                style={{
                                    width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", backgroundColor: "#f33376", boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                                }}
                                title="Strawberry Pink"
                            />
                            {/* Círculo Negro */}
                            <button onClick={() => document.documentElement.setAttribute('data-theme', 'midnightBlack')}
                                style={{
                                    width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", backgroundColor: "#232323ff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                                }}
                                title="Midnight Black"
                            />
                            {/* Círculo Amarillo */}
                            <button onClick={() => document.documentElement.setAttribute('data-theme', 'cozyYellow')}
                                style={{
                                    width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid white", backgroundColor: "#ffd779ff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                                }}
                                title="Cozy Yellow"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Selector de Pestañas (Tabs) ── */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "10px 20px",
                                borderRadius: 12,
                                border: "none",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                background: tab === t.id ? "var(--primary-mid)" : "var(--bg-card)",
                                color: tab === t.id ? "#fff" : "var(--text-muted)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                                transition: "all 0.2s"
                            }}
                        >
                            <Icon name={t.icon as any} size={16} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Contenido de las pestañas ── */}
                {tab === "cuenta" && (
                    <div className="card fade-up" style={{ padding: "24px 28px", maxWidth: 500 }}>
                        <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Información de la Cuenta</h2>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>Detalles del administrador de Goyangi Store.</p>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 12 }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Correo Electrónico</span>
                                <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>{cargando ? "Cargando..." : userEmail}</span>
                            </div>
                            <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 12 }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tenant ID (Multitenant)</span>
                                <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text-main)", fontWeight: 700 }}>{cargando ? "Cargando..." : tenantId}</span>
                            </div>
                            <div>
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Estado de Conexión</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", fontWeight: 700, color: "#4caf50" }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4caf50" }} />
                                    Servidores Conectados (FastAPI + Supabase)
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === "catalogo" && (
                    <div className="card fade-up" style={{ padding: "20px 24px", overflow: "hidden" }}>
                        <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Catálogo de Productos</h2>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>Visualiza el catálogo de productos disponibles en el inventario.</p>
                        
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                    <tr style={{ color: "var(--text-muted)", borderBottom: "1.5px solid var(--border-primary)" }}>
                                        {["Imagen", "Producto", "Categoría", "Stock Total", "Precio"].map(h => (
                                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.map(p => (
                                        <tr key={p.producto} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "12px 16px" }}>
                                                {p.imagen ? (
                                                    <img src={p.imagen} alt={p.producto} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                                                ) : (
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <Icon name="Package" size={18} color="var(--text-muted)" />
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 700 }}>{p.producto}</td>
                                            <td style={{ padding: "12px 16px" }}>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "var(--bg-app)", color: "var(--primary-dark)", padding: "3px 8px", borderRadius: 12 }}>
                                                    {p.categoria || "Otros"}
                                                </span>
                                            </td>
                                            <td style={{ padding: "12px 16px", fontWeight: 800 }}>{p.stock_total} uds</td>
                                            <td style={{ padding: "12px 16px", fontWeight: 800, color: "var(--primary-dark)" }}>${p.precio_venta.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {productos.length === 0 && !cargando && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No hay productos en el catálogo.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            <div style={{ height: 32 }} />
        </div>
    )
}
