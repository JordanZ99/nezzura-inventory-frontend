// ==============================================================================
// src/components/inventario/FormCierreConteo.tsx
// Pantalla de cierre del conteo: lista SOLO las diferencias contra el stock
// VIVO (lo que el backend resolverá) y pide la decisión por renglón:
//   - Faltantes:  Merma (default) | Se vendió | Stock estaba mal
//   - Sobrantes:  Stock estaba mal (default) | Llegó sin registrar (costo/precio opcional)
// "Todo merma" clasifica en bloque; la fecha aplica a las ventas declaradas
// (para que el bazar del sábado caiga al día contable del sábado). La
// confirmación final resume lo que se aplicará antes de tocar cualquier stock.
// ==============================================================================

import { useMemo, useState } from "react"
import Icon from "@/components/ui/Icon"
import type { ConteoItem, Producto, ResolucionConteoItem } from "@/lib/api"
import { claveConteo } from "@/hooks/useConteoData"

const EPSILON = 0.001

type ResolucionFaltante = "merma" | "venta" | "error_sistema"
type ResolucionSobrante = "entrada_no_registrada" | "error_sistema"
type Resolucion = ResolucionFaltante | ResolucionSobrante

const ETIQUETA_FALTANTE: Record<ResolucionFaltante, string> = {
    merma: "Merma",
    venta: "Se vendió",
    error_sistema: "Stock estaba mal",
}

const ETIQUETA_SOBRANTE: Record<ResolucionSobrante, string> = {
    entrada_no_registrada: "Ingreso no registrado",
    error_sistema: "Stock estaba mal",
}

function hoyLocal(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

interface FilaCierre {
    item: ConteoItem
    contado: number | null
    vivo: number | null
    delta: number | null
}

interface Props {
    items: ConteoItem[]
    inv: Producto[]
    capturas: Record<string, number | null>
    onAplicar: (resoluciones: ResolucionConteoItem[], fecha?: string) => void
    cerrando: boolean
    onVolver: () => void
}

export default function FormCierreConteo({ items, inv, capturas, onAplicar, cerrando, onVolver }: Props) {
    // Decisión por renglón; si el usuario no eligió, se usa el default del signo
    // (merma para faltantes, error_sistema para sobrantes) tanto aquí como en
    // el backend.
    const [resoluciones, setResoluciones] = useState<Record<string, Resolucion>>({})
    // Costo/precio opcionales para "Ingreso no registrado" (default: último lote)
    const [extras, setExtras] = useState<Record<string, { costo: string; precio: string }>>({})
    const [fecha, setFecha] = useState<string>(hoyLocal())
    const [confirmando, setConfirmando] = useState(false)

    const productoDe = (item: ConteoItem) => inv.find(p => p.producto === item.producto)

    // Stock VIVO del renglón: consolidado del producto o de SU variación.
    // Es el mismo cálculo que hará el backend al cerrar.
    const vivoDe = (item: ConteoItem): number | null => {
        const p = productoDe(item)
        if (!p) return null
        if (item.variacion) return p.variaciones?.find(v => v.nombre === item.variacion)?.stock ?? 0
        return p.stock_total
    }

    // Precio de referencia para estimar las ventas declaradas (el backend usa
    // el precio del lote PEPS: puede variar unos centavos).
    const precioDe = (f: FilaCierre): number => {
        const p = productoDe(f.item)
        if (!p) return 0
        if (f.item.variacion) return p.variaciones?.find(v => v.nombre === f.item.variacion)?.precio ?? p.precio_venta
        return p.precio_venta
    }

    const filas: FilaCierre[] = useMemo(() => items.map(item => {
        const contado = capturas[claveConteo(item.producto, item.variacion)] ?? null
        const vivo = vivoDe(item)
        const delta = contado !== null && vivo !== null ? Math.round((contado - vivo) * 1000) / 1000 : null
        return { item, contado, vivo, delta }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [items, inv, capturas])

    const sinContar = filas.filter(f => f.contado === null)
    const omitidos = filas.filter(f => f.contado !== null && f.vivo === null)
    const cuadran = filas.filter(f => f.delta !== null && Math.abs(f.delta) <= EPSILON)
    const faltantes = filas.filter(f => f.delta !== null && f.delta < -EPSILON)
    const sobrantes = filas.filter(f => f.delta !== null && f.delta > EPSILON)

    const claveDe = (item: { producto: string; variacion: string }) =>
        claveConteo(item.producto, item.variacion)

    const resolucionDe = (f: FilaCierre): Resolucion => {
        const elegida = resoluciones[claveDe(f.item)]
        if (elegida) return elegida
        return (f.delta ?? 0) < 0 ? "merma" : "error_sistema"
    }

    function elegir(fila: FilaCierre, res: Resolucion) {
        setResoluciones(prev => ({ ...prev, [claveDe(fila.item)]: res }))
    }

    function todoMerma() {
        setResoluciones(prev => {
            const nuevas = { ...prev }
            for (const f of faltantes) nuevas[claveDe(f.item)] = "merma"
            return nuevas
        })
    }

    // ── Resumen que se mostrará en la confirmación (proyección con fichas) ──
    const resumenConfirmacion = useMemo(() => {
        let mermas = 0, mermaUds = 0, mermaCosto = 0
        let ventas = 0, ventaUds = 0, ventaTotal = 0
        let entradas = 0, entradasUds = 0
        let ajustes = 0
        for (const f of faltantes) {
            const res = resolucionDe(f)
            const uds = Math.abs(f.delta ?? 0)
            if (res === "merma") { mermas++; mermaUds += uds; mermaCosto += uds * (productoDe(f.item)?.costo_promedio ?? 0) }
            else if (res === "venta") { ventas++; ventaUds += uds; ventaTotal += uds * precioDe(f) }
            else ajustes++
        }
        for (const f of sobrantes) {
            const res = resolucionDe(f)
            const uds = f.delta ?? 0
            if (res === "entrada_no_registrada") { entradas++; entradasUds += uds }
            else ajustes++
        }
        return { mermas, mermaUds, mermaCosto, ventas, ventaUds, ventaTotal, entradas, entradasUds, ajustes }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filas, resoluciones, inv])

    function construirPayload(): ResolucionConteoItem[] {
        const out: ResolucionConteoItem[] = []
        for (const f of [...faltantes, ...sobrantes]) {
            const res = resolucionDe(f)
            const item: ResolucionConteoItem = {
                producto: f.item.producto,
                variacion: f.item.variacion,
                resolucion: res,
            }
            if (res === "entrada_no_registrada") {
                const ex = extras[claveDe(f.item)]
                const costo = parseFloat((ex?.costo ?? "").replace(",", "."))
                const precio = parseFloat((ex?.precio ?? "").replace(",", "."))
                if (!isNaN(costo) && costo >= 0) item.costo = costo
                if (!isNaN(precio) && precio >= 0) item.precio_venta = precio
            }
            out.push(item)
        }
        return out
    }

    function aplicar() {
        setConfirmando(false)
        // La fecha solo aplica a las ventas declaradas; sin ventas no se envía.
        onAplicar(construirPayload(), resumenConfirmacion.ventas > 0 ? fecha : undefined)
    }

    // ── Chips de resolución (control segmentado por renglón) ──
    const chips = (f: FilaCierre, opciones: Resolucion[], etiquetas: Record<Resolucion, string>) => {
        const actual = resolucionDe(f)
        return (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {opciones.map(res => (
                    <button
                        key={res}
                        onClick={() => elegir(f, res)}
                        style={{
                            padding: "5px 10px", borderRadius: 8,
                            border: `1px solid ${actual === res ? "transparent" : "var(--border-primary)"}`,
                            background: actual === res ? "var(--gradient-1)" : "var(--bg-card2)",
                            color: actual === res ? "#fff" : "var(--text-main)",
                            fontWeight: 700, fontSize: "0.7rem", cursor: "pointer", transition: "all 0.15s",
                        }}
                    >
                        {etiquetas[res]}
                    </button>
                ))}
            </div>
        )
    }

    return (
        <div className="card fade-up" style={{ padding: "16px 20px" }}>
            {/* Cabecera */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="ClipboardCheck" size={18} color="var(--primary-alter)" /> Cerrar conteo
                </h2>
                <button onClick={onVolver} disabled={cerrando} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    <Icon name="ArrowLeft" size={15} /> Seguir contando
                </button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Las diferencias se comparan contra el stock <b>actual</b>: lo vendido durante el conteo ya quedó descontado y ahí cuadra solo.
            </p>

            {/* Resumen de estado */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)" }}>
                <span>✓ {cuadran.length} cuadran</span>
                {(sinContar.length > 0 || omitidos.length > 0) && <span>— {sinContar.length + omitidos.length} sin contar (se quedan como están)</span>}
                {faltantes.length > 0 && <span style={{ color: "var(--error-text)" }}>− {faltantes.length} faltantes</span>}
                {sobrantes.length > 0 && <span style={{ color: "var(--success-text)" }}>+ {sobrantes.length} sobrantes</span>}
            </div>

            {cuadran.length === filas.length && faltantes.length === 0 && sobrantes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 16px" }}>
                    <Icon name="CircleCheck" size={44} color="var(--success-main)" />
                    <h3 style={{ margin: "10px 0 6px", fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>Todo cuadra</h3>
                    <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Lo contado coincide con el stock del sistema — el cierre no cambia nada.
                    </p>
                    <button className="btn-primary" onClick={aplicar} disabled={cerrando}>
                        <Icon name="Check" size={15} /> {cerrando ? "Cerrando..." : "Confirmar cierre"}
                    </button>
                </div>
            ) : (
                <>
                    {/* ── Faltantes ── */}
                    {faltantes.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                                <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>
                                    Faltan ({faltantes.length}) — ¿qué pasó con lo que no está?
                                </h3>
                                <button
                                    onClick={todoMerma}
                                    style={{ background: "none", border: "1px solid var(--border-primary)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontWeight: 700, fontSize: "0.7rem", color: "var(--primary-dark)" }}
                                >
                                    Todo merma
                                </button>
                            </div>
                            {faltantes.map(f => {
                                const res = resolucionDe(f)
                                return (
                                    <div key={f.item.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                                        <div style={{ minWidth: 160 }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>
                                                {f.item.producto}{f.item.variacion ? ` · ${f.item.variacion}` : ""}
                                            </p>
                                            <p style={{ margin: "2px 0 0", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>
                                                Sistema: {f.vivo} → Contado: {f.contado} · <b style={{ color: "var(--error-text)" }}>faltan {Math.abs(f.delta ?? 0)}</b>
                                            </p>
                                            {res === "venta" && (
                                                <p style={{ margin: "2px 0 0", fontSize: "0.68rem", fontWeight: 700, color: "var(--primary-mid)" }}>
                                                    Se creará una venta retroactiva de {Math.abs(f.delta ?? 0)} × ${precioDe(f).toFixed(2)} (≈ ${(Math.abs(f.delta ?? 0) * precioDe(f)).toFixed(2)})
                                                </p>
                                            )}
                                        </div>
                                        {chips(f, ["merma", "venta", "error_sistema"], { ...ETIQUETA_FALTANTE, entrada_no_registrada: "" })}
                                    </div>
                                )
                            })}

                            {/* Fecha de las ventas declaradas (global para todas) */}
                            {resumenConfirmacion.ventas > 0 && (
                                <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--primary-bg)", border: "1px solid var(--border-primary)", marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <Icon name="Calendar" size={16} color="var(--primary-mid)" />
                                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary-dark)" }}>Fecha de las ventas declaradas</span>
                                    <input
                                        type="date"
                                        value={fecha}
                                        max={hoyLocal()}
                                        onChange={e => setFecha(e.target.value || hoyLocal())}
                                        style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.8rem", outline: "none" }}
                                    />
                                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)" }}>
                                        Para que caigan al día correcto (ej. lo vendido en el bazar del sábado)
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Sobrantes ── */}
                    {sobrantes.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                            <h3 style={{ margin: "0 0 8px", fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>
                                Sobran ({sobrantes.length}) — hay más de lo que el sistema dice
                            </h3>
                            {sobrantes.map(f => {
                                const clave = claveDe(f.item)
                                const res = resolucionDe(f)
                                const ex = extras[clave] ?? { costo: "", precio: "" }
                                return (
                                    <div key={f.item.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-light)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                                            <div style={{ minWidth: 160 }}>
                                                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "var(--text-main)" }}>
                                                    {f.item.producto}{f.item.variacion ? ` · ${f.item.variacion}` : ""}
                                                </p>
                                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>
                                                    Sistema: {f.vivo} → Contado: {f.contado} · <b style={{ color: "var(--success-text)" }}>sobran {f.delta}</b>
                                                </p>
                                            </div>
                                            {chips(f, ["entrada_no_registrada", "error_sistema"], { ...ETIQUETA_SOBRANTE, merma: "", venta: "" })}
                                        </div>
                                        {res === "entrada_no_registrada" && (
                                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)" }}>Se dará de alta un lote — costo/precio (opcional, default: último lote):</span>
                                                <input type="number" min={0} step="0.01" placeholder="Costo" value={ex.costo}
                                                    onChange={e => setExtras(prev => ({ ...prev, [clave]: { ...ex, costo: e.target.value } }))}
                                                    style={{ width: 100, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", fontSize: "0.72rem", outline: "none" }} />
                                                <input type="number" min={0} step="0.01" placeholder="Precio" value={ex.precio}
                                                    onChange={e => setExtras(prev => ({ ...prev, [clave]: { ...ex, precio: e.target.value } }))}
                                                    style={{ width: 100, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", fontSize: "0.72rem", outline: "none" }} />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* ── Acciones ── */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={onVolver} disabled={cerrando} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                            Volver
                        </button>
                        <button className="btn-primary" onClick={() => setConfirmando(true)} disabled={cerrando}>
                            <Icon name="Check" size={15} /> {cerrando ? "Aplicando..." : "Aplicar cierre"}
                        </button>
                    </div>
                </>
            )}

            {/* ── Modal de confirmación ── */}
            {confirmando && (
                <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: 24 }}
                    onClick={() => setConfirmando(false)}
                >
                    <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, width: "100%", padding: 24, gap: 16, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: "1px solid var(--border-light)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--gradient-1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon name="ClipboardCheck" size={24} color="var(--primary-soft)" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>Confirmar cierre</h3>
                        </div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.7, background: "var(--bg-card2)", borderRadius: 12, padding: "12px 16px" }}>
                            {resumenConfirmacion.mermas > 0 && (
                                <div>• {resumenConfirmacion.mermas} mermas: {resumenConfirmacion.mermaUds} uds fuera del inventario (costo ≈ ${resumenConfirmacion.mermaCosto.toFixed(2)})</div>
                            )}
                            {resumenConfirmacion.ventas > 0 && (
                                <div>• <b>{resumenConfirmacion.ventas} ventas retroactivas por ≈ ${resumenConfirmacion.ventaTotal.toFixed(2)}</b> ({resumenConfirmacion.ventaUds} uds · se crea 1 ticket en efectivo del {fecha})</div>
                            )}
                            {resumenConfirmacion.entradas > 0 && (
                                <div>• {resumenConfirmacion.entradas} ingresos no registrados: +{resumenConfirmacion.entradasUds} uds al inventario</div>
                            )}
                            {resumenConfirmacion.ajustes > 0 && (
                                <div>• {resumenConfirmacion.ajustes} correcciones de stock</div>
                            )}
                            {sinContar.length + omitidos.length > 0 && (
                                <div style={{ color: "var(--text-muted)" }}>• {sinContar.length + omitidos.length} renglones sin contar se quedan como están</div>
                            )}
                        </div>
                        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                            Se aplicará contra el stock vivo al confirmar: si algo se vendió mientras decidías, cuadrará solo.
                        </p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button onClick={() => setConfirmando(false)} disabled={cerrando}
                                style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                                Cancelar
                            </button>
                            <button onClick={aplicar} disabled={cerrando} className="btn-primary">
                                <Icon name="Check" size={15} /> {cerrando ? "Aplicando..." : "Confirmar y aplicar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
