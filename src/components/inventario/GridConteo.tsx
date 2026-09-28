// ==============================================================================
// src/components/inventario/GridConteo.tsx
// Grid de captura del conteo de auditoría (réplica del patrón GridRestock:
// chips de categoría + buscador + ordenamiento con filtrarProductos reutilizada).
// Cada renglón es un (producto, variación) del snapshot con:
//   - Stepper −/input/+ que ACUMULA sobre lo contado (total absoluto).
//   - Línea "Sistema: N · Δ" que puede ocultarse (conteo a ciegas) para no
//     sesgar al contador hacia el número esperado.
// ==============================================================================

import { useEffect, useMemo, useState } from "react"
import Icon from "@/components/ui/Icon"
import type { ConteoItem, Producto } from "@/lib/api"
import { claveConteo } from "@/hooks/useConteoData"
import { categoriasUnicas, filtrarProductos } from "@/lib/ordenamiento"

/** Ordenamientos propios del conteo (el "stock" relevante es el esperado del renglón). */
const OPCIONES_ORDEN_CONTEO: { valor: string; etiqueta: string }[] = [
    { valor: "pendientes", etiqueta: "Sin contar primero" },
    { valor: "esperado-desc", etiqueta: "Mayor stock" },
    { valor: "esperado-asc", etiqueta: "Menor stock" },
    { valor: "alfabetico", etiqueta: "Alfabético A-Z" },
]

interface FilaConteo extends ConteoItem {
    descripcion?: string
    categoria?: string[]
    codigo_interno?: string
    codigo_barras?: string
    imagen?: string
    fraccionable?: boolean
}

interface Props {
    items: ConteoItem[]
    inv: Producto[]
    capturas: Record<string, number | null>
    onMarcar: (producto: string, variacion: string, valor: number | null) => void
    relacionImagen: string
}

/** Input controlado con borrador local: permite teclear "0." sin que el
 * controlado salte a 0; el valor se confirma al salir o con Enter. */
function StepperConteo({ fila, contado, onMarcar }: { fila: FilaConteo; contado: number | null; onMarcar: Props["onMarcar"] }) {
    const [borrador, setBorrador] = useState<string | null>(null)
    const paso = fila.fraccionable ? "0.1" : "1"

    function confirmar(texto: string | null) {
        setBorrador(null)
        if (texto === null || texto.trim() === "") {
            onMarcar(fila.producto, fila.variacion, null)
            return
        }
        const num = parseFloat(texto.replace(",", "."))
        onMarcar(fila.producto, fila.variacion, isNaN(num) || num < 0 ? null : num)
    }

    return (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }} onClick={e => e.stopPropagation()}>
            <button
                onClick={() => onMarcar(fila.producto, fila.variacion, Math.max(0, (contado ?? 0) - 1))}
                title="Restar 1"
                disabled={contado === null || contado <= 0}
                style={{
                    width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border-primary)",
                    background: "var(--bg-card2)", color: "var(--text-main)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: contado === null || contado <= 0 ? 0.4 : 1,
                }}
            >
                <Icon name="Minus" size={15} color="var(--text-main)" />
            </button>
            <input
                type="number"
                inputMode="decimal"
                min={0}
                step={paso}
                placeholder="—"
                value={borrador ?? (contado === null ? "" : contado)}
                onChange={e => setBorrador(e.target.value)}
                onFocus={e => { setBorrador(e.target.value); e.target.select() }}
                onBlur={() => confirmar(borrador)}
                onKeyDown={e => { if (e.key === "Enter") { confirmar(borrador); e.currentTarget.blur() } }}
                style={{
                    width: 64, textAlign: "center", padding: "5px 2px", borderRadius: 8,
                    border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                    color: "var(--text-main)", fontWeight: 800, fontSize: "0.9rem", outline: "none",
                }}
            />
            <button
                onClick={() => onMarcar(fila.producto, fila.variacion, (contado ?? 0) + 1)}
                title="Sumar 1"
                style={{
                    width: 30, height: 30, borderRadius: 8, border: "none",
                    background: "var(--gradient-1)", color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}
            >
                <Icon name="Plus" size={15} color="#fff" />
            </button>
        </div>
    )
}

/** Grid de captura del conteo. */
export default function GridConteo({ items, inv, capturas, onMarcar, relacionImagen }: Props) {
    const [buscador, setBuscador] = useState("")
    const [buscadorDebounced, setBuscadorDebounced] = useState("")
    const [catSelec, setCatSelec] = useState("Todas")
    const [orden, setOrden] = useState("pendientes")
    const [aCiegas, setACiegas] = useState(false)

    // Debounce del buscador (mismo patrón que useInventarioUI, 300ms)
    useEffect(() => {
        const timer = setTimeout(() => setBuscadorDebounced(buscador), 300)
        return () => clearTimeout(timer)
    }, [buscador])

    // Renglones enriquecidos con la ficha del producto (imagen, categorías,
    // códigos, fraccionable) + el contado LOCAL (lo que el usuario lleva).
    const filas: FilaConteo[] = useMemo(() => items.map(it => {
        const p = inv.find(pr => pr.producto === it.producto)
        return {
            ...it,
            contado: capturas[claveConteo(it.producto, it.variacion)] ?? null,
            descripcion: p?.descripcion,
            categoria: p?.categoria,
            codigo_interno: p?.codigo_interno,
            codigo_barras: p?.codigo_barras,
            imagen: p?.imagen,
            fraccionable: p?.fraccionable,
        }
    }), [items, inv, capturas])

    const categorias = useMemo(() => categoriasUnicas(filas), [filas])

    const visibles = useMemo(() => {
        const filtradas = filtrarProductos(filas, buscadorDebounced, catSelec, true)
        return filtradas.sort((a, b) => {
            switch (orden) {
                case "esperado-desc": return b.esperado - a.esperado
                case "esperado-asc": return a.esperado - b.esperado
                case "alfabetico": return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
                default: // "pendientes": sin contar primero, luego alfabético
                    return (a.contado === null ? 0 : 1) - (b.contado === null ? 0 : 1)
                        || a.producto.localeCompare(b.producto, "es", { sensitivity: "base" })
                        || a.variacion.localeCompare(b.variacion)
            }
        })
    }, [filas, buscadorDebounced, catSelec, orden])

    return (
        <>
            {/* Categorías */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "none" }}>
                {categorias.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCatSelec(cat)}
                        style={{
                            padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
                            background: catSelec === cat ? "var(--gradient-1)" : "var(--bg-card2)",
                            color: catSelec === cat ? "#fff" : "var(--primary-dark)",
                            boxShadow: catSelec === cat ? "0 2px 6px var(--primary-glow)" : "none"
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Buscador + orden + modo a ciegas */}
            <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 200 }}>
                    <Icon name="Search" size={20} color="var(--text-muted)" />
                    <input
                        className="input-primary"
                        style={{ border: "none", padding: 0, boxShadow: "none", fontSize: "0.9rem" }}
                        placeholder="Buscar por nombre, código o categoría..."
                        value={buscador}
                        onChange={e => setBuscador(e.target.value)}
                    />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid var(--border-primary)", paddingLeft: 12 }}>
                    <select
                        className="input-primary"
                        style={{ border: "none", padding: "4px 8px", fontSize: "0.85rem", background: "transparent", cursor: "pointer", fontWeight: 700, color: "var(--primary-dark)" }}
                        value={orden}
                        onChange={e => setOrden(e.target.value)}
                    >
                        {OPCIONES_ORDEN_CONTEO.map(o => (
                            <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setACiegas(v => !v)}
                        title={aCiegas ? "Mostrar el stock esperado" : "Ocultar el stock esperado (conteo a ciegas: tu ojo no redondea hacia lo que 'debería' haber)"}
                        style={{
                            display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10,
                            border: `1px solid ${aCiegas ? "var(--primary-mid)" : "var(--border-primary)"}`,
                            background: aCiegas ? "var(--primary-bg)" : "var(--bg-card2)",
                            color: "var(--primary-dark)", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer",
                        }}
                    >
                        <Icon name={aCiegas ? "EyeOff" : "Eye"} size={15} /> {aCiegas ? "A ciegas" : "Ver esperado"}
                    </button>
                </div>
            </div>

            {/* Grid de renglones */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {visibles.length === 0 ? (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border-light)", marginTop: 20 }}>
                        <span style={{ fontSize: "4rem", display: "block", marginBottom: 16, opacity: 0.3 }}>—</span>
                        <h2 style={{ fontSize: "1.5rem", color: "var(--primary-dark)", fontWeight: 800, margin: "0 0 8px" }}>Sin resultados</h2>
                        <p style={{ fontSize: "1rem", color: "var(--text-main)", fontWeight: 600, margin: 0 }}>Intenta con otra búsqueda o categoría</p>
                    </div>
                ) : (
                    visibles.map(fila => {
                        const contado = fila.contado
                        const delta = contado === null ? null : Math.round((contado - fila.esperado) * 1000) / 1000
                        return (
                            <div key={fila.id} className="card fade-up" style={{ padding: 12, transition: "transform 0.15s, box-shadow 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 30px var(--primary-glow)" }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}
                            >
                                <div style={{
                                    aspectRatio: relacionImagen, borderRadius: 12,
                                    background: "var(--gradient-bg-login)",
                                    marginBottom: 10, overflow: "hidden",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    {fila.imagen && fila.imagen !== "No hay foto" ? (
                                        <img
                                            src={fila.imagen.startsWith("http") ? fila.imagen : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/${fila.imagen}`}
                                            alt={fila.producto}
                                            style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 12 }}
                                            onError={e => { e.currentTarget.style.display = "none" }}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <Icon name="Package" size={32} color="var(--text-muted)" />
                                    )}
                                </div>
                                <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {fila.producto}
                                </p>
                                {fila.variacion && (
                                    <span style={{ display: "inline-block", fontSize: "0.62rem", fontWeight: 700, color: "var(--primary-dark)", background: "var(--bg-card2)", borderRadius: 6, padding: "2px 6px", marginBottom: 2 }}>
                                        {fila.variacion}
                                    </span>
                                )}
                                <StepperConteo fila={fila} contado={contado} onMarcar={onMarcar} />
                                {!aCiegas && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)" }}>
                                            Sistema: {fila.esperado}
                                        </span>
                                        {delta !== null && (
                                            <span style={{
                                                fontSize: "0.62rem", fontWeight: 800, borderRadius: 6, padding: "2px 6px",
                                                background: delta === 0 ? "var(--bg-card2)" : delta < 0 ? "var(--error-bg)" : "var(--success-bg)",
                                                color: delta === 0 ? "var(--text-muted)" : delta < 0 ? "var(--error-text)" : "var(--success-text)",
                                            }}>
                                                {delta > 0 ? `+${delta}` : delta}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {contado !== null && (
                                    <button
                                        onClick={() => onMarcar(fila.producto, fila.variacion, null)}
                                        title="Quitar captura (dejar sin contar)"
                                        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)" }}
                                    >
                                        <Icon name="RotateCcw" size={12} color="var(--text-muted)" /> Descontar
                                    </button>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </>
    )
}
