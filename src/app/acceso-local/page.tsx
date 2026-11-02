"use client"
// ==============================================================================
// src/app/acceso-local/page.tsx
// Activación del MODO LOCAL (plan "local", licencia de dispositivo).
//
// Flow: login con Supabase (requiere internet UNA vez) → POST
// /licencias/activar → token firmado guardado en localStorage → IndexedDB
// del dispositivo queda listo. Desde aquí la app abre SOLO local: ni login
// ni red. Estilo glassmorphism heredado del login.
// ==============================================================================

import { useState } from "react"
import { useRouter } from "next/navigation"
import { entrarYActivar, obtenerLicencia } from "@/lib/local/licencia"
import { asegurarPerfil } from "@/lib/local/repos/inventario"
import { obtenerModo } from "@/lib/local/modo"
import Icon from "@/components/ui/Icon"
import BorderGlow from "@/components/ui/BorderGlow"

export default function AccesoLocalPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Ya está activado y con licencia vigente → directo a la app local
    if (obtenerModo() === "local" && obtenerLicencia()) {
        router.replace("/")
        return null
    }

    async function manejarActivar(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            await entrarYActivar(email, password)
            await asegurarPerfil()          // crea la fila del perfil local
            router.replace("/")
        } catch (err) {
            const msg = err instanceof Error ? err.message : "No se pudo activar el dispositivo."
            if (msg.includes("licencia")) setError(msg)
            else setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            background: "var(--gradient-bg-login)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            position: "relative",
            overflow: "hidden",
        }}>
            <div style={{
                position: "absolute", top: "-80px", right: "-80px",
                width: 320, height: 320,
                background: "rgba(255,255,255,0.08)",
                borderRadius: "50%",
                filter: "blur(40px)",
                pointerEvents: "none",
            }} />

            <BorderGlow
                className="w-full max-w-[420px]"
                glowColor="256 80 70"
                glowIntensity={10}
                glowRadius={80}
                backgroundColor="var(--gradient-login)"
                borderRadius={24}
                animated={true}
                edgeSensitivity={10}
                colors={["#6841d2", "#c084fc", "#f472b6"]}
            >
                <div style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1.5px solid rgba(255,255,255,0.3)",
                    borderRadius: 24,
                    padding: "40px 36px",
                }}>
                    <div style={{ textAlign: "center", marginBottom: 28 }}>
                        <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.25)",
                            borderRadius: "50%",
                            width: 72, height: 72,
                            marginBottom: 16,
                        }}>
                            <Icon name="Smartphone" size={34} color="#fff" />
                        </div>
                        <h1 style={{
                            margin: 0, fontSize: "1.4rem",
                            fontWeight: 800, color: "#fff", letterSpacing: -0.3,
                        }}>
                            Activar este dispositivo
                        </h1>
                        <p style={{
                            margin: "8px 0 0", fontSize: "0.82rem",
                            color: "rgba(255,255,255,0.75)", fontWeight: 500, lineHeight: 1.5,
                        }}>
                            Conéctate <strong>esta única vez</strong>. Después tu negocio
                            funcionará completo sin internet, con todos los datos
                            guardados aquí mismo.
                        </p>
                    </div>

                    <form onSubmit={manejarActivar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{
                                fontSize: "0.72rem", fontWeight: 700,
                                color: "rgba(255,255,255,0.85)",
                                textTransform: "uppercase", letterSpacing: 0.8,
                            }}>
                                Correo electrónico
                            </label>
                            <input
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="correo@ejemplo.com"
                                style={{
                                    width: "100%",
                                    background: "rgba(255,255,255,0.18)",
                                    border: "1.5px solid rgba(255,255,255,0.35)",
                                    borderRadius: 12,
                                    padding: "11px 14px",
                                    fontSize: "0.9rem",
                                    color: "#fff",
                                    outline: "none",
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{
                                fontSize: "0.72rem", fontWeight: 700,
                                color: "rgba(255,255,255,0.85)",
                                textTransform: "uppercase", letterSpacing: 0.8,
                            }}>
                                Contraseña
                            </label>
                            <input
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    width: "100%",
                                    background: "rgba(255,255,255,0.18)",
                                    border: "1.5px solid rgba(255,255,255,0.35)",
                                    borderRadius: 12,
                                    padding: "11px 14px",
                                    fontSize: "0.9rem",
                                    color: "#fff",
                                    outline: "none",
                                }}
                            />
                        </div>

                        {error && (
                            <div style={{
                                background: "rgba(244, 67, 54, 0.2)",
                                border: "1px solid rgba(244, 67, 54, 0.4)",
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: "0.82rem",
                                color: "#fff",
                                fontWeight: 600,
                                display: "flex", alignItems: "center", gap: 8,
                            }}>
                                <Icon name="CircleAlert" size={15} color="#fff" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: 4,
                                background: loading ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.95)",
                                color: "#6841d2",
                                border: "none",
                                borderRadius: 12,
                                padding: "13px 20px",
                                fontWeight: 800,
                                fontSize: "0.95rem",
                                cursor: loading ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                            }}
                        >
                            {loading ? (
                                <>
                                    <div style={{ animation: "spin 1s linear infinite", display: "flex" }}>
                                        <Icon name="Loader" size={18} color="#6841d2" />
                                    </div>
                                    Activando…
                                </>
                            ) : (
                                <>
                                    <Icon name="Check" size={18} color="#6841d2" />
                                    Activar y usar sin internet
                                </>
                            )}
                        </button>
                    </form>

                    <p style={{
                        textAlign: "center", marginTop: 24, fontSize: "0.72rem",
                        color: "rgba(255,255,255,0.5)", fontWeight: 500,
                    }}>
                        <a href="/login" className="footer-link">Volver a iniciar sesión normal</a>
                    </p>
                </div>
            </BorderGlow>

            <style>{`
                input::placeholder { color: rgba(255,255,255,0.45) !important; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .footer-link { color: rgba(255,255,255,0.6); text-decoration: none; }
                .footer-link:hover { text-decoration: underline; }
            `}</style>
        </div>
    )
}
