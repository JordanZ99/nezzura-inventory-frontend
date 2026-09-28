// ==============================================================================
// src/components/personalizacion/EditorHero.tsx
// Mini-canva del Hero (migración 049, Fase 2): WYSIWYG sobre la imagen hero
// con elementos posicionables con el mouse:
//
//   - Cajas de TEXTO: arrastrables (todo el elemento) + escalables (manija
//     inferior-derecha), con tipografía (7 display de lib/catalogo-fuentes),
//     tamaño, color, peso y alineación.
//   - REDES SOCIALES: fila de iconos (links de Identidad del Negocio).
//   - BOTÓN "Ver el catálogo": el CTA actual dentro del hero.
//
// Coordenadas en porcentajes del hero (x, y, w: 0-100). El mismo layout escala
// en móvil (el render público reduce el ~38% el tamaño de texto). El estado
// vive en catalogoConfig.hero_layout.elementos; cada gesto programa un guardado
// con debounce ({ elementos: LISTA COMPLETA } — el backend reemplaza el array).
// ==============================================================================

import { useLayoutEffect, useRef, useState } from "react"
import Icon from "@/components/ui/Icon"
import { FUENTES_CATALOGO, FUENTES_ORDEN, CSS_GESTOR_FUENTES } from "@/lib/catalogo-fuentes"
import { optimizarImagenCloudinary } from "@/lib/image-utils"
import type { HeroElemento } from "@/types"

interface Props {
    heroUrl: string          // imagen hero actual (ya con optimización externa)
    elementos: HeroElemento[]
    onCambiar: (elementos: HeroElemento[]) => void   // mutate + agenda guardado
}

/** Siete tipografías display del gestor (excluye 'sistema': es la sans neutral) */
const FUENTES_CANVA = FUENTES_ORDEN.filter(k => k !== "sistema")

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const redondear = (v: number) => Math.round(v * 10) / 10

/** Crea un elemento por defecto en el centro del hero */
function nuevoElemento(tipo: HeroElemento["tipo"], id: string): HeroElemento {
    if (tipo === "texto") return { id, tipo, x: 22, y: 42, w: 40, texto: "Escribe aquí...", fuente: "playfair", tamano: 56, color: "#ffffff", peso: "700", align: "center" }
    if (tipo === "redes") return { id, tipo, x: 44, y: 82 }
    return { id, tipo: "boton", x: 30, y: 80 }
}

export function EditorHero({
    heroUrl,
    elementos,
    onCambiar,
}: {
    heroUrl: string
    elementos: HeroElemento[]
    onCambiar: (elementos: HeroElemento[]) => void
}) {
    const [lista, setLista] = useState<HeroElemento[]>(elementos)
    const [sel, setSel] = useState<string | null>(null)
    const canvasRef = useRef<HTMLDivElement>(null)
    const listaRef = useRef(lista)                      // estado fresco SIN re-render
    const [, setTick] = useState(0)                      // fuerza repintado en drag
    const selRef = useRef(sel)
    selRef.current = sel

    // Ancho real del canvas para escalar los tamaños de fuente WYSIWYG
    const [anchoCanvas, setAnchoCanvas] = useState(0)
    useLayoutEffect(() => {
        if (!canvasRef.current) return
        const ro = new ResizeObserver(entries => {
            for (const e of entries) setAnchoCanvas(e.contentRect.width)
        })
        ro.observe(canvasRef.current)
        setAnchoCanvas(canvasRef.current.getBoundingClientRect().width)
        return () => ro.disconnect()
    }, [])

    // Inyectar CSS de Google Fonts para previsualizar las 7 tipografías
    // (mismo patrón del acordeón de fuentes del gestor: un request cacheado).
    useLayoutEffect(() => {
        if (!CSS_GESTOR_FUENTES || document.getElementById("css-fuentes-gestor")) return
        const link = document.createElement("link")
        link.id = "css-fuentes-gestor"
        link.rel = "stylesheet"
        link.href = CSS_GESTOR_FUENTES
        document.head.appendChild(link)
    }, [])

    // Al terminar cualquier gesto: delegamos la lista completa al padre,
    // que actualiza catalogoConfig + agenda el guardado con debounce.
    function persistir() {
        onCambiar(listaRef.current)
    }

    // ── Drag & resize con el mouse (Pointer Events, sin librerías) ──
    function iniciarDrag(e: React.PointerEvent, el: HeroElemento, modo: "mover" | "escalar") {
        e.preventDefault()
        e.stopPropagation()
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        setSel(el.id)
        const ini = { ...el }
        const clienteX = e.clientX, clienteY = e.clientY

        const mover = (ev: PointerEvent) => {
            const dx = ((ev.clientX - clienteX) / rect.width) * 100
            const dy = ((ev.clientY - clienteY) / rect.height) * 100
            const i = listaRef.current.findIndex(x => x.id === el.id)
            if (i < 0) return
            const act = { ...listaRef.current[i] }
            if (modo === "mover") {
                act.x = clamp(Math.round((ini.x + dx) * 10) / 10, 0, 100)
                act.y = clamp(Math.round((ini.y + dy) * 10) / 10, 0, 100)
            } else {
                act.w = clamp(Math.round((ini.w ?? 40) + dx) * 1, 4, 100)
            }
            listaRef.current[i] = act
            setLista([...listaRef.current])
            setTick(t => t + 1)
        }
        const subir = () => {
            window.removeEventListener("pointermove", mover)
            window.removeEventListener("pointerup", subir)
            window.removeEventListener("pointercancel", subir)
            persistir()
        }
        window.addEventListener("pointermove", mover)
        window.addEventListener("pointerup", subir)
        window.addEventListener("pointercancel", subir)
    }

    function agregar(tipo: HeroElemento["tipo"]) {
        const id = `el_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        const el = nuevoElemento(tipo, id)
        listaRef.current = [...listaRef.current, el]
        setLista(listaRef.current)
        setSel(id)
        persistir()
    }

    function actualizar(id: string, cambios: Partial<HeroElemento>) {
        const i = listaRef.current.findIndex(x => x.id === id)
        if (i < 0) return
        listaRef.current[i] = { ...listaRef.current[i], ...cambios }
        setLista([...listaRef.current])
        persistir()
    }

    function quitar(id: string) {
        listaRef.current = listaRef.current.filter(x => x.id !== id)
        setLista(listaRef.current)
        if (selRef.current === id) setSel(null)
        persistir()
    }

    const selEl = lista.find(x => x.id === sel)

    // Escala WYSIWYG: px del hero real (1920) → px del canvas actual
    const escala = anchoCanvas ? anchoCanvas / 1920 : 0.36

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Barra de herramientas */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Añadir</span>
                {([
                    { tipo: "texto" as const, label: "Texto", icono: "Type" },
                    { tipo: "redes" as const, label: "Redes", icono: "Share2" },
                    { tipo: "boton" as const, label: "Botón", icono: "RectangleHorizontal" },
                ]).map(b => (
                    <button
                        key={b.tipo}
                        onClick={() => agregar(b.tipo)}
                        style={{
                            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                            borderRadius: 10, cursor: "pointer", fontSize: "0.78rem", fontWeight: 700,
                            border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)",
                            color: "var(--text-main)", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary-mid)" }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-primary)" }}
                    >
                        <Icon name={b.icono as any} size={15} color="var(--primary-mid)" />
                        {b.label}
                    </button>
                ))}
            </div>

            {/* ── Canvas WYSIWYG ── */}
            <div
                ref={canvasRef}
                onPointerDown={() => setSel(null)}
                style={{
                    position: "relative", width: "100%", aspectRatio: "16 / 9",
                    borderRadius: 12, overflow: "hidden", boxSizing: "border-box",
                    border: "1.5px solid var(--border-primary)",
                    background: heroUrl
                        ? `url(${optimizarImagenCloudinary(heroUrl, 1280)}) center / cover no-repeat`
                        : "var(--bg-app)",
                    userSelect: "none", touchAction: "none",
                }}
            >
                {!heroUrl && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 600 }}>
                        Sube la imagen del Hero arriba para previsualizarla aquí
                    </div>
                )}
                {/* Velo como en el público (aprox gradiente oscuro con opacidad 40) */}
                {heroUrl && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.25))", opacity: 0.4, pointerEvents: "none" }} />}

                {lista.map(el => {
                    const activo = sel === el.id
                    const borde = activo ? "var(--primary-mid)" : "transparent"
                    return (
                        <div
                            key={el.id}
                            onPointerDown={e => iniciarDrag(e, el, "mover")}
                            style={{
                                position: "absolute",
                                left: `${el.x}%`,
                                top: `${el.y}%`,
                                width: el.tipo === "texto" ? `${el.w ?? 40}%` : undefined,
                                cursor: "move",
                                outline: `1.5px dashed ${borde === "transparent" ? "rgba(255,255,255,0.35)" : borde}`,
                                outlineOffset: 2,
                                pointerEvents: "auto",
                            }}
                        >
                            {el.tipo === "texto" && (
                                <div style={{
                                    fontSize: `${(el.tamano ?? 56) * escala}px`,
                                    fontFamily: FUENTES_CATALOGO[el.fuente ?? "playfair"]?.stack ?? "'Playfair Display', Georgia, serif",
                                    fontWeight: Number(el.peso ?? 700),
                                    color: el.color || "#fff",
                                    textAlign: (el.align ?? "center") as "left" | "center" | "right",
                                    lineHeight: 1.15,
                                    whiteSpace: "pre-wrap",
                                    textShadow: "0 2px 12px rgba(0,0,0,0.4)",
                                    pointerEvents: "none",
                                }}>
                                    {el.texto || "Texto"}
                                </div>
                            )}
                            {el.tipo === "redes" && (
                                <div style={{ display: "flex", gap: 8 }}>
                                    {(["instagram", "facebook", "tiktok", "whatsapp"] as const).map(red => (
                                        <span key={red} style={{
                                            width: 34, height: 34, borderRadius: "50%",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            background: "rgba(255,255,255,0.14)", backdropFilter: "blur(6px)",
                                        }}>
                                            <Icon name={(red === "instagram" ? "Instagram" : red === "facebook" ? "Facebook" : red === "tiktok" ? "Music2" : "Phone") as any} size={15} color="#fff" />
                                        </span>
                                    ))}
                                </div>
                            )}
                            {el.tipo === "boton" && (
                                <div style={{
                                    padding: "10px 22px", borderRadius: 999,
                                    background: "var(--primary-mid)", color: "#fff",
                                    fontWeight: 800, fontSize: "0.85rem",
                                    whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
                                    pointerEvents: "none",
                                }}>
                                    <Icon name="ArrowDown" size={14} />
                                    Ver el catálogo
                                </div>
                            )}
                            {/* Manija de redimensionar (solo texto) */}
                            {el.tipo === "texto" && (
                                <div
                                    onPointerDown={e => iniciarDrag(e, el, "escalar")}
                                    style={{
                                        position: "absolute", right: -6, bottom: -6,
                                        width: 12, height: 12, borderRadius: 3,
                                        background: "var(--primary-mid)", border: "2px solid #fff",
                                        cursor: "ew-resize",
                                    }}
                                />
                            )}
                            {/* Eliminar (solo seleccionado) */}
                            {activo && (
                                <button
                                    onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                                    onClick={e => { e.stopPropagation(); quitar(el.id) }}
                                    title="Eliminar elemento"
                                    style={{
                                        position: "absolute", top: -10, right: -10,
                                        width: 20, height: 20, borderRadius: "50%",
                                        background: "#e53935", color: "#fff", fontSize: 10, fontWeight: 800,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", border: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* ── Panel de propiedades del elemento seleccionado ── */}
            {selEl && selEl.tipo === "texto" && (
                <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Propiedades del texto</span>
                        <button onClick={() => quitar(selEl.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon name="Trash2" size={13} /> Eliminar
                        </button>
                    </div>

                    <textarea
                        className="input-primary"
                        value={selEl.texto ?? ""}
                        onChange={e => actualizar(selEl.id, { texto: e.target.value })}
                        rows={2}
                        style={{ fontSize: "0.82rem", resize: "vertical" }}
                    />

                    {/* Tipografías disponibles (7 display del gestor) */}
                    <div>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Tipografía</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {FUENTES_CANVA.map(k => {
                                const f = FUENTES_CATALOGO[k]
                                const on = (selEl.fuente ?? "playfair") === k
                                return (
                                    <button
                                        key={k}
                                        onClick={() => actualizar(selEl.id, { fuente: k })}
                                        style={{
                                            padding: "6px 12px", borderRadius: 10, cursor: "pointer", fontSize: "0.78rem",
                                           fontWeight: on ? 800 : 600, fontFamily: f.stack, transition: "all 0.15s",
                                            border: `1.5px solid ${on ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                            background: on ? "var(--primary-soft)" : "var(--bg-card2)",
                                            color: on ? "var(--primary-mid)" : "var(--text-main)",
                                        }}
                                    >
                                        {f.label.replace(/ \(serif\)/, "")}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Tamaño + color + alineación */}
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tamaño</span>
                                <span style={{ fontWeight: 800, fontSize: "0.74rem", color: "var(--primary-mid)" }}>{selEl.tamano ?? 56}px</span>
                            </div>
                            <input
                                type="range" min={16} max={160} step={2}
                                value={selEl.tamano ?? 56}
                                onChange={e => actualizar(selEl.id, { tamano: Number(e.target.value) })}
                                style={{ width: "100%", accentColor: "var(--primary-mid)", cursor: "pointer" }}
                            />
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                            <input
                                type="color" value={selEl.color || "#ffffff"}
                                onChange={e => actualizar(selEl.id, { color: e.target.value })}
                                style={{ width: 24, height: 24, border: "none", background: "none", padding: 0, cursor: "pointer" }}
                            />
                            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>Color</span>
                        </label>
                        <div style={{ display: "flex", gap: 4 }}>
                            {(["left", "center", "right"] as const).map(a => {
                                const on = (selEl.align ?? "center") === a
                                return (
                                    <button
                                        key={a}
                                        onClick={() => actualizar(selEl.id, { align: a })}
                                        title={a}
                                        style={{
                                            width: 28, height: 28, borderRadius: 8, cursor: "pointer",
                                            border: `1.5px solid ${on ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                            background: on ? "var(--primary-soft)" : "var(--bg-card2)",
                                            color: on ? "var(--primary-mid)" : "var(--text-muted)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}
                                    >
                                        <Icon name={(a === "left" ? "AlignLeft" : a === "center" ? "AlignCenter" : "AlignRight") as any} size={14} />
                                    </button>
                                )
                            })}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                            {(["400", "600", "700", "800"] as const).map(w => {
                                const on = (selEl.peso ?? "700") === w
                                return (
                                    <button
                                        key={w}
                                        onClick={() => actualizar(selEl.id, { peso: w })}
                                        style={{
                                            padding: "4px 8px", borderRadius: 8, cursor: "pointer", fontSize: "0.72rem", fontWeight: on ? 800 : 600,
                                            border: `1.5px solid ${on ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                            background: on ? "var(--primary-soft)" : "var(--bg-card2)",
                                            color: on ? "var(--primary-mid)" : "var(--text-muted)",
                                        }}
                                    >
                                        {w === "400" ? "Fina" : w === "600" ? "Normal" : w === "700" ? "Bold" : "Extra"}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
            {selEl && selEl.tipo !== "texto" && (
                <div style={{ padding: "10px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        {selEl.tipo === "redes" ? "Redes sociales — se muestran Instagram, Facebook, TikTok y WhatsApp del negocio (Identidad del Negocio)." : 'Botón "Ver el catálogo" — baja al menú.'}
                    </p>
                    <button onClick={() => quitar(selEl.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <Icon name="Trash2" size={13} /> Eliminar
                    </button>
                </div>
            )}
            {!selEl && lista.length > 0 && (
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    Consejo: haz clic en un elemento para editarlo y arrástralo a la posición que quieras. La esquina inferior-derecha de una caja de texto cambia su ancho.
                </p>
            )}
        </div>
    )
}
