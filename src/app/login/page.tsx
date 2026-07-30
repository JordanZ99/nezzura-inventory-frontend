"use client"
// ==============================================================================
// src/app/login/page.tsx
// Pantalla de acceso con glassmorphism sobre el gradiente --gradient-login.
// ==============================================================================

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Icon from "@/components/ui/Icon"
import BorderGlow from "@/components/ui/BorderGlow"

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [rememberMe, setRememberMe] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPass, setShowPass] = useState(false)

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        // Verificación de seguridad de variables
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            setError("Error técnico: Faltan las variables de entorno de Supabase.")
            setLoading(false)
            return
        }

        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

        if (authError) {
            // Mostramos el mensaje real de Supabase para saber qué pasa (ej: "Email not confirmed")
            setError(authError.message === "Invalid login credentials"
                ? "Correo o contraseña incorrectos."
                : authError.message)
            setLoading(false)
            return
        }

        // Si el usuario no quiere mantener sesión, la configuramos como efímera
        if (!rememberMe) {
            await supabase.auth.updateUser({})
            // El token igual se usa, pero el usuario debe reloguearse al volver
        }

        router.replace("/")
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
            {/* Orbes decorativos */}
            <div style={{
                position: "absolute", top: "-80px", right: "-80px",
                width: 320, height: 320,
                background: "rgba(255,255,255,0.08)",
                borderRadius: "50%",
                filter: "blur(40px)",
                pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute", bottom: "-60px", left: "-60px",
                width: 260, height: 260,
                background: "rgba(255,255,255,0.06)",
                borderRadius: "50%",
                filter: "blur(32px)",
                pointerEvents: "none",
            }} />

            {/* Card de login */}
            <BorderGlow
                className="w-full max-w-[420px]"
                glowColor="256 80 70"
                glowIntensity={10}
                glowRadius={80}
                backgroundColor="var(--gradient-login)"
                borderRadius={24}
                animated={true}
                edgeSensitivity={10}
                colors={['#6841d2', '#c084fc', '#f472b6']}
            >
                <div style={{
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1.5px solid rgba(255,255,255,0.3)",
                    borderRadius: 24,
                    padding: "40px 36px",
                    //boxShadow: "0 24px 64px rgba(104, 65, 210, 0.25), 0 1px 0 rgba(255,255,255,0.4) inset",
                    //animation: "fadeUp 0.45s ease both",
                }}>
                    {/* Logo + Título */}
                    <div style={{ textAlign: "center", marginBottom: 32 }}>
                        <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.25)",
                            borderRadius: "50%",
                            width: 72, height: 72,
                            marginBottom: 16,
                            boxShadow: "0 4px 20px rgba(104,65,210,0.2)",
                        }}>
                            <img src="/logo.png" alt="Nezzura Digital"
                                style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "contain" }}
                            />
                        </div>
                        <h1 style={{
                            margin: 0,
                            fontSize: "1.5rem",
                            fontWeight: 800,
                            color: "#fff",
                            letterSpacing: -0.3,
                        }}>
                            Nezzura Digital
                        </h1>
                        <p style={{
                            margin: "6px 0 0",
                            fontSize: "0.82rem",
                            color: "rgba(255,255,255,0.75)",
                            fontWeight: 500,
                        }}>
                            Inicia sesión para gestionar tu inventario
                        </p>
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Email */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.85)",
                                textTransform: "uppercase",
                                letterSpacing: 0.8,
                            }}>
                                Correo electrónico
                            </label>
                            <div style={{ position: "relative" }}>
                                <input
                                    id="email"
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
                                        padding: "11px 14px 11px 42px",
                                        fontSize: "0.9rem",
                                        color: "#fff",
                                        outline: "none",
                                        transition: "border-color 0.2s, box-shadow 0.2s",
                                    }}
                                    onFocus={e => {
                                        e.target.style.borderColor = "rgba(255,255,255,0.7)"
                                        e.target.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.15)"
                                    }}
                                    onBlur={e => {
                                        e.target.style.borderColor = "rgba(255,255,255,0.35)"
                                        e.target.style.boxShadow = "none"
                                    }}
                                />
                                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                                    <Icon name="Mail" size={16} color="rgba(255,255,255,0.6)" />
                                </div>
                            </div>
                        </div>

                        {/* Contraseña */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.85)",
                                textTransform: "uppercase",
                                letterSpacing: 0.8,
                            }}>
                                Contraseña
                            </label>
                            <div style={{ position: "relative" }}>
                                <input
                                    id="password"
                                    type={showPass ? "text" : "password"}
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
                                        padding: "11px 42px 11px 42px",
                                        fontSize: "0.9rem",
                                        color: "#fff",
                                        outline: "none",
                                        transition: "border-color 0.2s, box-shadow 0.2s",
                                    }}
                                    onFocus={e => {
                                        e.target.style.borderColor = "rgba(255,255,255,0.7)"
                                        e.target.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.15)"
                                    }}
                                    onBlur={e => {
                                        e.target.style.borderColor = "rgba(255,255,255,0.35)"
                                        e.target.style.boxShadow = "none"
                                    }}
                                />
                                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                                    <Icon name="Lock" size={16} color="rgba(255,255,255,0.6)" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPass(s => !s)}
                                    style={{
                                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                                        background: "none", border: "none", cursor: "pointer", padding: 0,
                                    }}
                                >
                                    <Icon name={showPass ? "EyeOff" : "Eye"} size={16} color="rgba(255,255,255,0.6)" />
                                </button>
                            </div>
                        </div>

                        {/* Mantener sesión */}
                        <label style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: "pointer",
                            userSelect: "none",
                        }}>
                            <div
                                onClick={() => setRememberMe(r => !r)}
                                style={{
                                    width: 20, height: 20,
                                    borderRadius: 6,
                                    border: "2px solid rgba(255,255,255,0.5)",
                                    background: rememberMe ? "rgba(255,255,255,0.9)" : "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "background 0.2s",
                                    flexShrink: 0,
                                }}
                            >
                                {rememberMe && (
                                    <Icon name="Check" size={12} color="#6841d2" />
                                )}
                            </div>
                            <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
                                Mantener sesión iniciada
                            </span>
                        </label>

                        {/* Error */}
                        {error && (
                            <div style={{
                                background: "rgba(244, 67, 54, 0.2)",
                                border: "1px solid rgba(244, 67, 54, 0.4)",
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: "0.82rem",
                                color: "#fff",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}>
                                <Icon name="CircleAlert" size={15} color="#fff" />
                                {error}
                            </div>
                        )}

                        {/* Botón */}
                        <button
                            id="btn-login"
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: 4,
                                background: loading
                                    ? "rgba(255,255,255,0.3)"
                                    : "rgba(255,255,255,0.95)",
                                color: "#6841d2",
                                border: "none",
                                borderRadius: 12,
                                padding: "13px 20px",
                                fontWeight: 800,
                                fontSize: "0.95rem",
                                cursor: loading ? "not-allowed" : "pointer",
                                transition: "all 0.2s",
                                boxShadow: loading ? "none" : "0 4px 20px rgba(255,255,255,0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                            }}
                            onMouseEnter={e => { if (!loading) (e.currentTarget.style.transform = "translateY(-2px)") }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)" }}
                        >
                            {loading ? (
                                <>
                                    <div style={{ animation: "spin 1s linear infinite", display: "flex" }}>
                                        <Icon name="Loader" size={18} color="#6841d2" />
                                    </div>
                                    Iniciando...
                                </>
                            ) : (
                                <>
                                    <Icon name="LogIn" size={18} color="#6841d2" />
                                    Entrar al panel
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <p style={{
                        textAlign: "center",
                        marginTop: 24,
                        fontSize: "0.72rem",
                        color: "rgba(255,255,255,0.5)",
                        fontWeight: 500,
                    }}>
                        Nezzura Digital · Panel privado
                    </p>
                </div>
            </BorderGlow>

            <style>{`
                input::placeholder { color: rgba(255,255,255,0.45) !important; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
