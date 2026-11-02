"use client"
// ==============================================================================
// src/app/restablecer/page.tsx
// PANTALLA DE RESTABLECER CONTRASEÑA — destino del enlace del correo
// ("Cambiar contraseña" del login). Ruta PÚBLICA (middleware).
//
// Supabase llega aquí con el token de recuperación en el hash de la URL
// (#access_token=...&type=recovery). El cliente de @supabase/ssr detecta
// esa sesión al montar; si hay sesión válida (aunque sea de recovery),
// mostramos el formulario de nueva contraseña y fijamos con updateUser.
// Si el token no sirve (expiró/ya se usó), cae en el estado de error con
// retorno al login para pedir otro enlace.
// ==============================================================================

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Icon from "@/components/ui/Icon"

type Estado = "verificando" | "formulario" | "listo" | "error"

export default function RestablecerPage() {
    const router = useRouter()
    const [estado, setEstado] = useState<Estado>("verificando")
    const [errorToken, setErrorToken] = useState<string | null>(null)

    // ── Formulario ──
    const [nueva, setNueva] = useState("")
    const [confirmar, setConfirmar] = useState("")
    const [mostrar, setMostrar] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [errorForma, setErrorForma] = useState<string | null>(null)

    // ── Detectar el token del hash: Supabase lo procesa al montar el cliente ──
    useEffect(() => {
        let activo = true
        // Pequeño margen para que supabase-js termine de procesar el fragmento
        // (#access_token=...) de la URL y establezca la sesión de recuperación.
        const t = setTimeout(async () => {
            const { error } = await supabase.auth.getUser()
            if (!activo) return
            if (error) {
                // Token ausente, expirado o ya usado → pedir uno nuevo desde el login
                setErrorToken(error.message)
                setEstado("error")
            } else {
                setEstado("formulario")
            }
        }, 600)
        return () => { activo = false; clearTimeout(t) }
    }, [])

    async function handleGuardar(e: React.FormEvent) {
        e.preventDefault()
        setErrorForma(null)

        if (nueva.length < 6) {
            setErrorForma("La nueva contraseña debe tener al menos 6 caracteres.")
            return
        }
        if (nueva !== confirmar) {
            setErrorForma("Las dos contraseñas no coinciden.")
            return
        }

        setGuardando(true)
        const { error } = await supabase.auth.updateUser({ password: nueva })
        setGuardando(false)

        if (error) {
            setErrorForma(error.message)
            return
        }
        // Contraseña fijada: cerramos la sesión del enlace (es desechable) y
        // el usuario entra limpio con su contraseña nueva.
        await supabase.auth.signOut()
        setEstado("listo")
    }

    // ── Verificando el token ──
    if (estado === "verificando") {
        return (
            <div style={EST_PANTALLA}>
                <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    border: "4px solid var(--border-light, rgba(255,255,255,0.2))",
                    borderTopColor: "var(--primary-mid)", animation: "spin 1s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    // ── Enlace inválido / expirado ──
    if (estado === "error") {
        return (
            <div style={EST_PANTALLA}>
                <div style={{ ...EST_CARD, textAlign: "center" }}>
                    <div style={{ ...EST_CIRCULO }}>
                        <Icon name="CircleAlert" size={26} color="#fff" />
                    </div>
                    <h1 style={EST_TITULO}>El enlace ya no funciona</h1>
                    <p style={EST_SUBTITULO}>
                        Los enlaces de cambio de contraseña se usan una sola vez y expiran.
                        Pide uno nuevo desde el login — en segundos te llega otro.
                    </p>
                    <p style={{ margin: "6px 0 18px", fontSize: "0.72rem", color: "rgba(0,0,0,0.5)", fontWeight: 500 }}>
                        {errorToken}
                    </p>
                    <Link href="/login" style={EST_BOTON_LINK}>
                        <Icon name="ArrowLeft" size={16} /> Volver al login
                    </Link>
                </div>
            </div>
        )
    }

    // ── Confirmación ──
    if (estado === "listo") {
        setTimeout(() => router.replace("/login"), 2500)
        return (
            <div style={EST_PANTALLA}>
                <div style={{ ...EST_CARD, textAlign: "center" }}>
                    <div style={{ ...EST_CIRCULO, background: "var(--primary-mid, #43a047)" }}>
                        <Icon name="Check" size={26} color="#fff" />
                    </div>
                    <h1 style={EST_TITULO}>¡Contraseña cambiada!</h1>
                    <p style={EST_SUBTITULO}>
                        Ya puedes entrar con tu contraseña nueva. Te llevamos al login…
                    </p>
                </div>
            </div>
        )
    }

    // ── Formulario de nueva contraseña ──
    return (
        <div style={EST_PANTALLA}>
            <div style={EST_CARD}>
                <div style={{ textAlign: "center", marginBottom: 26 }}>
                    <div style={{ ...EST_CIRCULO }}>
                        <Icon name="KeyRound" size={24} color="#fff" />
                    </div>
                    <h1 style={EST_TITULO}>Nueva contraseña</h1>
                    <p style={EST_SUBTITULO}>
                        Escribe tu nueva contraseña para tu cuenta de Nezzura Digital.
                    </p>
                </div>

                <form onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={EST_CAMPO}>
                        <label style={EST_ETIQUETA}>Nueva contraseña</label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={mostrar ? "text" : "password"}
                                autoComplete="new-password"
                                required
                                minLength={6}
                                value={nueva}
                                onChange={e => setNueva(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                style={EST_INPUT}
                                onFocus={e => (e.target.style.borderColor = "var(--primary-mid)")}
                                onBlur={e => (e.target.style.borderColor = "var(--border-primary)")}
                            />
                            <button
                                type="button"
                                aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
                                onClick={() => setMostrar(s => !s)}
                                style={{
                                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                                    background: "none", border: "none", cursor: "pointer", padding: 0,
                                }}
                            >
                                <Icon name={mostrar ? "EyeOff" : "Eye"} size={16} color="var(--text-muted)" />
                            </button>
                        </div>
                    </div>

                    <div style={EST_CAMPO}>
                        <label style={EST_ETIQUETA}>Confirmar contraseña</label>
                        <input
                            type={mostrar ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            minLength={6}
                            value={confirmar}
                            onChange={e => setConfirmar(e.target.value)}
                            placeholder="Repite la contraseña"
                            style={EST_INPUT}
                            onFocus={e => (e.target.style.borderColor = "var(--primary-mid)")}
                            onBlur={e => (e.target.style.borderColor = "var(--border-primary)")}
                        />
                    </div>

                    {errorForma && (
                        <div style={{
                            background: "rgba(244, 67, 54, 0.12)",
                            border: "1px solid rgba(244, 67, 54, 0.4)",
                            borderRadius: 10,
                            padding: "10px 14px",
                            fontSize: "0.82rem",
                            color: "#c62828",
                            fontWeight: 600,
                            display: "flex", alignItems: "center", gap: 8,
                        }}>
                            <Icon name="CircleAlert" size={15} color="#c62828" />
                            {errorForma}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={guardando}
                        style={{
                            background: guardando ? "var(--border-primary)" : "var(--primary-mid)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 12,
                            padding: "13px 20px",
                            fontWeight: 800,
                            fontSize: "0.95rem",
                            cursor: guardando ? "wait" : "pointer",
                            transition: "all 0.2s",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                    >
                        {guardando
                            ? <> <div style={{ animation: "spin 1s linear infinite", display: "flex" }}> <Icon name="Loader" size={18} color="#fff" /> </div> Guardando… </>
                            : <> <Icon name="Check" size={18} color="#fff" /> Guardar contraseña </>}
                    </button>
                </form>

                <p style={{ textAlign: "center", marginTop: 18, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    <Link href="/login" style={{ color: "var(--primary-mid)", fontWeight: 700 }}>
                        Volver al login
                    </Link>
                </p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

// ── Estilos compartidos (misma orgía visual del login, en claro) ──
const EST_PANTALLA: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--gradient-bg-login, var(--bg-app))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
}
const EST_CARD: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
    background: "var(--bg-card)",
    border: "1px solid var(--border-primary)",
    borderRadius: 20,
    padding: "36px 32px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.12)",
    animation: "fadeUp 0.35s ease both",
}
const EST_CIRCULO: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--gradient-1, var(--primary-mid))",
    borderRadius: "50%",
    width: 56, height: 56,
    marginBottom: 14,
}
const EST_TITULO: React.CSSProperties = {
    margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: -0.3,
}
const EST_SUBTITULO: React.CSSProperties = {
    margin: "8px 0 0", fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.55,
}
const EST_CAMPO: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 }
const EST_ETIQUETA: React.CSSProperties = {
    fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8,
}
const EST_INPUT: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-card2)",
    border: "1.5px solid var(--border-primary)",
    borderRadius: 12,
    padding: "11px 14px",
    fontSize: "0.9rem",
    color: "var(--text-main)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
}
const EST_BOTON_LINK: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "11px 22px", borderRadius: 12,
    background: "var(--primary-mid)", color: "#fff",
    fontWeight: 800, fontSize: "0.9rem", textDecoration: "none",
}
