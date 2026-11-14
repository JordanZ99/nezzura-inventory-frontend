"use client"
// ==============================================================================
// src/components/LicenciaGuard.tsx
// Guardia de licencia del MODO LOCAL (no hace nada en modo nube).
//
// Al montar la app:
//   - licencia vigente → deja pasar. Si hay conexión, revalida en silencio
//     (estira el token otros 14 días — el dueño ni se entera).
//   - licencia vencida → intenta revalidar. Falla → pantalla de bloqueo
//     CLARA: "Tus datos están a salvo en este dispositivo; conéctate un
//     momento para continuar". Botón reintentar.
//   - licencia muerta (dispositivo revocado / plan sin local) → limpia el
//     modo y manda al login.
//
// Helpers: src/lib/local/licencia.ts
// ==============================================================================

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Icon from "@/components/ui/Icon"
import { obtenerModo } from "@/lib/local/modo"
import { estadoLicencia, revalidarLicencia, salirModoLocal } from "@/lib/local/licencia"
import { obtenerTenantIdHibrido, salirModoOffline } from "@/lib/local/hibrido"

type Estado = "cargando" | "ok" | "bloqueado" | "muerto"

export default function LicenciaGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    // El catálogo público pasa SIEMPRE (migración …): páginas para clientes,
    // fuera del contrato del Modo Local. El [slug] no está portado a local
    // (requiere servidor y ya tiene su propio estado de error amigable) y
    // /catalogo/impresion vive en el IndexedDB del aparato, así que no tiene
    // sentido bloquearlas por licencia (ni mostrar el flash de arranque).
    const esCatalogo = pathname?.startsWith("/catalogo") ?? false
    // Estado inicial perezoso: en modo nube (o en el catálogo) no hay nada
    // que revalidar — el PRIMER paint ya pasa directo, sin flash de "Reconectando…".
    const [estado, setEstado] = useState<Estado>(() =>
        obtenerModo() !== "local" ? "ok" : "cargando"
    )

    async function validar() {
        if (obtenerModo() !== "local" || esCatalogo) {
            setEstado("ok")
            return
        }
        // Modo OFFLINE HÍBRIDO (básico/plus): la autenticación es la sesión
        // Supabase, no hay licencia que revalidar — pasa directo. La sync
        // corre cuando hay conexión (CardModoOffline/repos/sync.ts).
        if (obtenerTenantIdHibrido()) {
            setEstado("ok")
            return
        }
        if (estadoLicencia() === "vigente") {
            setEstado("ok")
            // Revalidación en silencio: estira el token sin molestar al usuario.
            // Si no hay conexión, simplemente se reintenta el próximo arranque.
            if (navigator.onLine) revalidarLicencia().catch(() => {})
            return
        }
        setEstado("cargando")
        try {
            await revalidarLicencia()
            setEstado("ok")
        } catch (e) {
            const msg = e instanceof Error ? e.message : ""
            if (msg.startsWith("LICENCIA_MUERTA"))
                setEstado("muerto")
            else
                setEstado("bloqueado")
        }
    }

    useEffect(() => {
        void validar()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function abandonar() {
        if (obtenerTenantIdHibrido()) salirModoOffline()
        else salirModoLocal()
        router.replace("/login")
    }

    if (estado === "ok" || esCatalogo) return <>{children}</>

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
            background: "var(--gradient-bg-login, linear-gradient(135deg,#1e123e,#6841d2))",
        }}>
            <div style={{
                maxWidth: 420, width: "100%", textAlign: "center",
                background: "rgba(255,255,255,0.14)",
                backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                border: "1.5px solid rgba(255,255,255,0.3)",
                borderRadius: 24, padding: "36px 28px", color: "#fff",
            }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                    <Icon name={estado === "muerto" ? "Lock" : "CloudOff"} size={40} color="#fff" />
                </div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                    {estado === "muerto"
                        ? "Licencia no disponible"
                        : estado === "cargando"
                            ? "Reconectando…"
                            : "Se necesita un momento de conexión"}
                </h2>
                <p style={{
                    margin: "10px 0 22px", fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)", lineHeight: 1.5,
                }}>
                    {estado === "muerto"
                        ? "Este dispositivo ya no tiene acceso al Modo Local. Tus datos siguen guardados aquí; solicita acceso con tu administrador."
                        : estado === "cargando"
                            ? "Validando tu licencia…"
                            : "Tus datos están a salvo en este dispositivo. Conéctate a internet unos segundos y toca Reintentar para seguir trabajando."}
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    {estado !== "muerto" && (
                        <button
                            type="button"
                            onClick={() => void validar()}
                            style={{
                                background: "rgba(255,255,255,0.95)", color: "#6841d2",
                                border: "none", borderRadius: 12, padding: "12px 22px",
                                fontWeight: 800, fontSize: "0.9rem", cursor: "pointer",
                            }}
                        >
                            Reintentar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={abandonar}
                        style={{
                            background: "transparent", color: "rgba(255,255,255,0.85)",
                            border: "1.5px solid rgba(255,255,255,0.4)",
                            borderRadius: 12, padding: "12px 18px",
                            fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                        }}
                    >
                        {estado === "muerto" ? "Volver al login" : "Salir del modo local"}
                    </button>
                </div>
            </div>
        </div>
    )
}
