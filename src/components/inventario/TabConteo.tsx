// ==============================================================================
// src/components/inventario/TabConteo.tsx
// Orquestador de la tab "Auditoría" de Inventario (conteo físico vs sistema).
// - Sin sesión: estado vacío con explicación + botón "Iniciar conteo" +
//   historial de conteos cerrados.
// - Sesión abierta: banner de progreso (con estado del autosave) + grid de
//   captura + pantalla de cierre, y "Descartar conteo" para abandonarla sin
//   tocar ningún stock (a través de cerrar sin resoluciones).
// ==============================================================================

import { useState } from "react"
import Icon from "@/components/ui/Icon"
import { ToastBanner, useToast } from "@/components/ui/Toast"
import type { ResumenConteo } from "@/lib/api"
import type { useConteoData } from "@/hooks/useConteoData"
import GridConteo from "@/components/inventario/GridConteo"
import FormCierreConteo from "@/components/inventario/FormCierreConteo"
import HistorialConteos from "@/components/inventario/HistorialConteos"

interface Props {
    conteo: ReturnType<typeof useConteoData>
    inv: import("@/lib/api").Producto[]
    relacionImagen: string
}

export default function TabConteo({ conteo, inv, relacionImagen }: Props) {
    const { mostrarMsg } = useToast()
    const {
        sesion, items, cargando, capturas, marcarContado,
        guardandoCaptura, abrir, abriendo, cerrar, cerrando,
        historial, cargandoHistorial,
    } = conteo

    const [modo, setModo] = useState<"captura" | "cierre">("captura")
    const [confirmarDescartar, setConfirmarDescartar] = useState(false)

    const contados = items.filter(it => capturas[`${it.producto}||${it.variacion}`] !== undefined).length

    async function aplicarCierre(resoluciones: Parameters<typeof cerrar>[0], fecha?: string) {
        const resumen: ResumenConteo | null = await cerrar(resoluciones, fecha)
        if (!resumen) return
        setModo("captura")
        const partes: string[] = [`✓ ${resumen.cuadrados} cuadrados`]
        if (resumen.mermas) partes.push(`${resumen.mermas} mermas por $${Number(resumen.merma_costo).toFixed(2)} (gasto en Egresos)`)
        if (resumen.ventas) partes.push(`${resumen.ventas} ventas por $${Number(resumen.venta_total).toFixed(2)}${resumen.n_ticket ? ` (ticket #${resumen.n_ticket})` : ""}`)
        if (resumen.entradas) partes.push(`${resumen.entradas} ingresos`)
        if (resumen.ajustes) partes.push(`${resumen.ajustes} correcciones`)
        mostrarMsg(true, `Conteo cerrado — ${partes.join(", ")}`)
    }

    async function descartar() {
        setConfirmarDescartar(false)
        const resumen = await cerrar([], undefined)
        if (resumen) mostrarMsg(true, "Conteo descartado — no se cambió ningún stock")
    }

    return (
        <div>
            <ToastBanner />

            {cargando ? (
                <div className="card" style={{ padding: 24, textAlign: "center" }}>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 600 }}>Cargando auditoría…</p>
                </div>
            ) : sesion ? (
                <>
                    {/* ── Banner de la sesión abierta ── */}
                    <div className="card fade-up" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <div>
                            <p style={{ margin: "0 0 4px", fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                Conteo abierto · {new Date(sesion.abierto_at).toLocaleString()}
                            </p>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: "0.8rem", fontWeight: 600 }}>
                                <span>Contados: <b style={{ color: "var(--primary-dark)" }}>{contados}</b> de {items.length}</span>
                                <span style={{ display: "flex", alignItems: "center", gap: 4, color: guardandoCaptura ? "var(--text-muted)" : "var(--success-text)" }}>
                                    <Icon name={guardandoCaptura ? "LoaderCircle" : "CloudUpload"} size={13} />
                                    {guardandoCaptura ? "Guardando…" : "Guardado"}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <button className="btn-primary" onClick={() => setModo("cierre")} disabled={cerrando}>
                                <Icon name="ClipboardCheck" size={15} /> Cerrar conteo
                            </button>
                            <button
                                onClick={() => setConfirmarDescartar(true)}
                                title="Abandona el conteo sin cambiar ningún stock"
                                style={{ background: "none", border: "none", cursor: cerrando ? "default" : "pointer", fontWeight: 700, fontSize: "0.78rem", color: "var(--text-muted)", opacity: cerrando ? 0.5 : 1 }}
                            >
                                Descartar
                            </button>
                        </div>
                    </div>

                    {modo === "cierre" ? (
                        <FormCierreConteo
                            items={items}
                            inv={inv}
                            capturas={capturas}
                            onAplicar={aplicarCierre}
                            onVolver={() => setModo("captura")}
                            cerrando={cerrando}
                        />
                    ) : (
                        <GridConteo
                            items={items}
                            inv={inv}
                            capturas={capturas}
                            onMarcar={marcarContado}
                            relacionImagen={relacionImagen}
                        />
                    )}
                </>
            ) : (
                <>
                    {/* ── Estado vacío: iniciar conteo ── */}
                    <div className="card fade-up" style={{ padding: "40px 24px", textAlign: "center", marginBottom: 24 }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px",
                            background: "var(--gradient-1)", display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <Icon name="ClipboardList" size={34} color="#fff" />
                        </div>
                        <h2 style={{ margin: "0 0 10px", fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)" }}>
                            Auditoría de Stock
                        </h2>
                        <p style={{ margin: "0 auto 6px", maxWidth: 440, fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.6 }}>
                            Cuenta físicamente lo que tienes y compara contra el sistema:
                            encuentra los productos que ya no están y decide si fueron
                            <b> merma</b> o <b>ventas no registradas</b>.
                        </p>
                        <p style={{ margin: "0 auto 20px", maxWidth: 440, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                            Al iniciar se congela el stock actual como referencia. Puedes seguir vendiendo
                            mientras cuentas: esas ventas ya quedan descontadas y no contarán como diferencia.
                        </p>
                        <button className="btn-primary" onClick={() => abrir()} disabled={abriendo || cerrando}>
                            <Icon name={abriendo ? "LoaderCircle" : "Play"} size={16} />
                            {abriendo ? "Iniciando…" : "Iniciar conteo"}
                        </button>
                    </div>

                    {/* ── Historial de conteos cerrados ── */}
                    <h3 style={{ margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="History" size={16} color="var(--primary-alter)" /> Historial de conteos
                    </h3>
                    <HistorialConteos historial={historial} cargando={cargandoHistorial} />
                </>
            )}

            {/* ── Modal: confirmar descartar ── */}
            {confirmarDescartar && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                    padding: 24
                }} onClick={() => setConfirmarDescartar(false)}>
                    <div className="card" onClick={e => e.stopPropagation()} style={{
                        maxWidth: 440, width: "100%", padding: 28, gap: 20,
                        display: "flex", flexDirection: "column",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-light)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ffeef0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon name="TriangleAlert" size={24} color="#ad4955ff" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                                Descartar conteo
                            </h3>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5, fontWeight: 500 }}>
                            ¿Descartar el conteo abierto? <strong>Ningún stock cambia</strong>: la sesión solo se cierra como registro vacío en el historial.
                        </p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                            <button onClick={() => setConfirmarDescartar(false)}
                                style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                                Cancelar
                            </button>
                            <button onClick={descartar} disabled={cerrando}
                                style={{
                                    padding: "10px 20px", borderRadius: 10, border: "none",
                                    background: "#ad4955ff", color: "#fff",
                                    fontWeight: 700, fontSize: "0.82rem", cursor: cerrando ? "default" : "pointer",
                                    display: "flex", alignItems: "center", gap: 8, opacity: cerrando ? 0.6 : 1
                                }}>
                                <Icon name="Trash2" size={16} color="#fff" /> {cerrando ? "Cerrando…" : "Descartar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
