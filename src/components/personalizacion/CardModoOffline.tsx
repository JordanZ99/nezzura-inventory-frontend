"use client"
// ==============================================================================
// src/components/personalizacion/CardModoOffline.tsx
// Tarjeta "Modo Offline" (híbrido) — para planes básico/plus con sesión.
//
// Dos estados:
//   * Modo nube   → oferta de activación: la app pasará a operar contra la
//     DB local del dispositivo; al reconectar la sync sube ventas/gastos y
//     baja los cambios de la web.
//   * Modo híbrido → estado: pendientes de subir, última sync, botón
//     "Sincronizar ahora" y "Volver a modo nube".
//
// (El viejo plan local con licencia de dispositivo está RETIRADO: no dibuja
// nada para él.)
// ==============================================================================

import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Icon from "@/components/ui/Icon"
import { useToast } from "@/components/ui/Toast"
import { useTenant } from "@/contexts/TenantContext"
import { obtenerModo } from "@/lib/local/modo"
import { obtenerLicencia } from "@/lib/local/licencia"
import {
    activarModoOffline, obtenerTenantIdHibrido, salirModoOffline,
} from "@/lib/local/hibrido"
import { abrirDB } from "@/lib/local/db"
import { ejecutarSync, estadoSync } from "@/lib/local/repos/sync"

function haceCuando(iso: string | null): string | null {
    if (!iso) return null
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return null
    const min = Math.max(0, Math.floor((Date.now() - t) / 60000))
    if (min < 1) return "hace un momento"
    if (min < 60) return `hace ${min} min`
    const horas = Math.floor(min / 60)
    if (horas < 24) return `hace ${horas} h`
    return `hace ${Math.floor(horas / 24)} días`
}

export function CardModoOffline() {
    const { tenant } = useTenant()
    const { mostrarMsg } = useToast()
    const queryClient = useQueryClient()
    const [hibrido, setHibrido] = useState(false)
    const [pendientes, setPendientes] = useState<number | null>(null)
    const [ultima, setUltima] = useState<string | null>(null)
    const [ocupado, setOcupado] = useState(false)

    const refrescarEstado = useCallback(async () => {
        const activo = obtenerModo() === "local" && Boolean(obtenerTenantIdHibrido())
        setHibrido(activo)
        if (!activo) return
        try {
            const e = await estadoSync()
            setPendientes(e.pendientes)
            setUltima(e.ultima_sync)
        } catch { /* sin DB aún: queda en null */ }
    }, [])

    useEffect(() => { refrescarEstado() }, [refrescarEstado])

    // Auto-sync al montar si hay conexión (el ciclo de sincronizar es barato
    // cuando no hay nada pendiente: una bajada con cursor + delta vacío).
    useEffect(() => {
        if (!hibrido || !navigator.onLine) return
        void (async () => {
            try {
                const r = await ejecutarSync()
                if (r.subida) {
                    setPendientes(0)
                    setUltima(new Date().toISOString().slice(0, 16))
                    queryClient.invalidateQueries()
                }
            } catch { /* sin conexión ahora: el botón manual queda */ }
        })()
    }, [hibrido, queryClient])

    // Plan local con licencia (LEGADO, retirado): no dibuja nada.
    if (obtenerModo() === "local" && obtenerLicencia() && !obtenerTenantIdHibrido()) return null

    async function activar() {
        if (!tenant?.tenant_id) return
        // ¿La DB local ya tiene datos (sesión previa del viejo plan local)?
        // Preguntar: subirlos a la nube o empezar limpio.
        let borrarLocal = false
        try {
            const d = abrirDB()
            const productos = await d.productos.count()
            if (productos > 0) {
                borrarLocal = window.confirm(
                    "Este dispositivo tiene datos de una sesión anterior del Modo Local " +
                    `(${productos} producto(s)).\n\n` +
                    "• Aceptar = EMPEZAR LIMPIO (se borran los datos del teléfono; la nube no se toca)\n" +
                    "• Cancelar = MANTENER y subirlos en la primera sincronización",
                )
            }
        } catch { /* sin DB: es primera vez */ }
        if (borrarLocal) {
            const { borrarDBLocal } = await import("@/lib/local/db")
            await borrarDBLocal()
        }
        activarModoOffline(tenant.tenant_id, tenant.empresa || "", tenant.plan || "basico")
        // Recarga completa: todos los contextos montan ya en modo híbrido.
        window.location.reload()
    }

    async function sincronizar() {
        setOcupado(true)
        try {
            const r = await ejecutarSync()
            setPendientes(0)
            setUltima(new Date().toISOString().slice(0, 16))
            queryClient.invalidateQueries()
            const sub = r.subida
            const partes: string[] = []
            if (sub) {
                if (sub.subidas.ventas) partes.push(`${sub.subidas.ventas} venta(s)`)
                if (sub.subidas.gastos) partes.push(`${sub.subidas.gastos} gasto(s)`)
                if (sub.subidas.productos) partes.push(`${sub.subidas.productos} producto(s)`)
                if (sub.subidas.lotes) partes.push(`${sub.subidas.lotes} lote(s)`)
            }
            if (r.bajada) {
                const baj = r.bajada.productos + r.bajada.lotes + r.bajada.variaciones
                if (baj) partes.push(`${baj} cambio(s) recibido(s)`)
            }
            mostrarMsg(true, partes.length
                ? `Sincronizado: ${partes.join(", ")}.`
                : "Todo al día entre tu teléfono y la nube.")
            if (sub?.alertas.length) {
                mostrarMsg(false, `Atención: ${sub.alertas.length} lote(s) quedaron en stock NEGATIVO (se vendieron de fondo en dos lados). Revisa tu inventario.`)
            }
            if (sub?.divergencias.length) {
                mostrarMsg(false, `${sub.divergencias.length} producto(s) tenían cambios tanto en el teléfono como en la web — ganó lo del teléfono (quedó registrado en el log de sincronización).`)
            }
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error sincronizando")
        } finally {
            setOcupado(false)
            refrescarEstado()
        }
    }

    async function volverNube() {
        salirModoOffline()
        window.location.reload()
    }

    // ── MODO NUBE: oferta de activación ──
    if (!hibrido) {
        return (
            <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 380px", maxWidth: 560 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="CloudOff" size={20} color="var(--primary-dark)" /> Modo Offline
                </h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>
                    Trabaja <strong>sin internet</strong>: cobra, restockea y edita con los datos guardados en tu
                    teléfono. Al reconectar, tus ventas y gastos suben solos a la nube y los cambios hechos en la
                    web bajan al teléfono. <strong>Nunca pierdes una venta por falta de señal.</strong>
                </p>
                <button onClick={activar} disabled={!tenant?.tenant_id} className="btn btn-primary" style={{ width: "100%" }}>
                    <Icon name="Download" size={16} /> Activar Modo Offline
                </button>
            </div>
        )
    }

    // ── MODO HÍBRIDO: estado + sincronizar ──
    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 380px", maxWidth: 560 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="CloudOff" size={20} color="var(--primary-dark)" /> Modo Offline activo
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 14px" }}>
                Tus datos viven en este teléfono y se sincronizan con la nube cuando hay internet.
            </p>
            <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 14,
                border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: 4,
            }}>
                <span style={{ fontWeight: 700, color: pendientes ? "var(--text-main)" : "var(--text-muted)" }}>
                    {pendientes === null
                        ? "Calculando cambios pendientes…"
                        : pendientes === 0
                            ? "Todo sincronizado con la nube."
                            : `${pendientes} cambio(s) pendiente(s) de subir.`}
                </span>
                {ultima && (
                    <span style={{ color: "var(--text-muted)" }}>Última sincronización: {haceCuando(ultima)}.</span>
                )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                    onClick={sincronizar}
                    disabled={ocupado}
                    className="btn btn-primary"
                    style={{ flex: 1, opacity: ocupado ? 0.6 : 1, cursor: ocupado ? "wait" : "pointer" }}
                >
                    <Icon name={ocupado ? "Loader" : "RefreshCw"} size={16} /> {ocupado ? "Sincronizando…" : "Sincronizar ahora"}
                </button>
                <button
                    onClick={volverNube}
                    disabled={ocupado}
                    className="btn"
                    style={{
                        flex: "0 0 auto", border: "1px solid var(--border-primary)",
                        background: "transparent", color: "var(--text-main)",
                        borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
                    }}
                >
                    Volver a modo nube
                </button>
            </div>
        </div>
    )
}
