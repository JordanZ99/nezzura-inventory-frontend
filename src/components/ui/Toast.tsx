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

/** Banner de mensaje con el mismo estilo que usaba personalizacion en línea. */
export function ToastBanner() {
    const { msg } = useToast()
    if (!msg) return null
    return (
        <div style={{
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 10,
            fontSize: "0.82rem",
            fontWeight: 700,
            background: msg.ok ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.1)",
            color: msg.ok ? "#2e7d32" : "#c62828",
            borderLeft: `4px solid ${msg.ok ? "#4caf50" : "#f44336"}`,
        }}>
            {msg.texto}
        </div>
    )
}
