"use client"
// ==============================================================================
// src/components/ui/Toast.tsx
// Toast global: provider + hook (useToast) + banner (ToastBanner).
// Centraliza el patrón "mostrarMsg" que cada página implementaba por su cuenta
// (estado local + setTimeout con duraciones distintas). El provider se monta
// en el layout raíz; las páginas consumen useToast() y renderizan ToastBanner.
// ==============================================================================

import { createContext, useContext, useState, type ReactNode } from "react"

export interface ToastMsg {
    ok: boolean
    texto: string
}

interface ToastContextValue {
    msg: ToastMsg | null
    mostrarMsg: (ok: boolean, texto: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
    const [msg, setMsg] = useState<ToastMsg | null>(null)
    function mostrarMsg(ok: boolean, texto: string) {
        setMsg({ ok, texto })
        setTimeout(() => setMsg(null), 4000)
    }
    return (
        <ToastContext.Provider value={{ msg, mostrarMsg }}>
            {children}
        </ToastContext.Provider>
    )
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>")
    return ctx
}

/**
 * Toast flotante (pill fija en la parte superior de la pantalla).
 * Antes era un banner inline: quedaba DETRÁS de los overlays de modales
 * (zIndex 9999) y los toasts de validación eran invisibles con el modal
 * abierto. Esta pill vive en zIndex 10000, por encima de cualquier overlay.
 */
export function ToastBanner() {
    const { msg } = useToast()
    if (!msg) return null
    return (
        <>
            <style>{`@keyframes toast-pill-in { from { opacity: 0; transform: translateX(-50%) translateY(-14px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
            <div style={{
                position: "fixed",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10000,
                maxWidth: "min(92vw, 480px)",
                padding: "10px 18px",
                borderRadius: 999,
                fontSize: "0.82rem",
                fontWeight: 700,
                background: msg.ok ? "rgba(46,125,50,0.94)" : "rgba(198,40,40,0.94)",
                color: "#fff",
                boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
                animation: "toast-pill-in 0.18s ease-out",
            }}>
                {msg.texto}
            </div>
        </>
    )
}
