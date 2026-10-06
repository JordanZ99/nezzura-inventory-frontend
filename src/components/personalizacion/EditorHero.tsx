// ==============================================================================
// src/components/personalizacion/EditorHero.tsx
// Mini-canva del Hero (migración 049) con DOS CANVAS INDEPENDIENTES:
//
//   ┌ Canva de ESCRITORIO (16:9, base 1920) → hero_layout.elementos
//   └ Canva de MÓVIL     (retrato 390×844, base 1280) → hero_layout.elementos_movil
//
// Cada canva tiene SU propia lista de elementos, selección y panel de
// propiedades: lo que edites en uno NO toca al otro. El canva móvil arranca
// VACÍO (la herencia solo es explícita con "Clonar del escritorio"); en el
// catálogo público, si elementos_movil aún no existe, el teléfono muestra el
// escritorio escalado (retrocompatible).
//
// IMÁN: bordes/centros medidos del DOM + histéresis (engancha <1.1%,
// suelta a >1.9% — sin parpadeo). Elementos: texto, logo, red, redes, boton.
// ==============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Icon from "@/components/ui/Icon"
import { FUENTES_CATALOGO, FUENTES_ORDEN, CSS_GESTOR_FUENTES } from "@/lib/catalogo-fuentes"
import { optimizarImagenCloudinary } from "@/lib/image-utils"
import type { HeroElemento } from "@/types"

interface Props {
    heroUrl: string              // imagen hero actual (escritorio)
    heroUrlMovil?: string        // recorte retrato; el canva móvil lo usa si existe
    logoUrl: string              // logo del negocio
    redesDisponibles: string[]   // redes con link llenado
    /** Ubicación (Google Maps) del negocio; '' = sin dirección.
     *  Habilita la función "Cómo llegar" del botón del canva. */
    mapsDato: string
    elementosEscritorio: HeroElemento[]
    elementosMovil?: HeroElemento[]
    onCambiar: (elementos: HeroElemento[], modo: "escritorio" | "movil") => void
}

/** Siete tipografías display del gestor (excluye 'sistema') */
const FUENTES_CANVA = FUENTES_ORDEN.filter(k => k !== "sistema")

/** Imán: engancha <THR, suelta >THR_OFF (histéresis) */
const THR = 1.1
const THR_OFF = 1.9

/** Tamaño de texto máximo del gestor (px en desktop) */
const MAX_TAMANO = 320

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

function textoContraste(hex?: string): string {
    if (!hex) return "#fff"
    const c = hex.replace("#", "")
    if (c.length < 6) return "#fff"
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1a1a1a" : "#fff"
}

/** Color del texto del CTA: manual (color_texto) o automático por estilo. */
function colorTextoBoton(el: HeroElemento): string {
    if (el.color_texto) return el.color_texto
    if (el.estilo === "outline") return el.color || "#fff"
    return textoContraste(el.color)
}

function nuevoElemento(tipo: HeroElemento["tipo"], id: string): HeroElemento {
    if (tipo === "texto") return { id, tipo, x: 22, y: 42, w: 40, texto: "Escribe aquí...", fuente: "playfair", tamano: 56, color: "#ffffff", peso: "700", align: "center" }
    if (tipo === "logo") return { id, tipo, x: 45, y: 14, w: 10 }
    if (tipo === "redes") return { id, tipo, x: 44, y: 82 }
    return { id, tipo: "boton", x: 30, y: 80, texto: "Ver el catálogo", tamano: 15, color: "", radio: 16, estilo: "solido", accion: "catalogo" }
}

const ICONO_RED: Record<string, string> = {
    instagram: "Instagram", facebook: "Facebook", tiktok: "Music2", whatsapp: "Phone",
}
const ETIQUETAS_RED: Record<string, string> = {
    instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", whatsapp: "WhatsApp",
}

interface Caja { x0: number; y0: number; x1: number; y1: number }
interface Fijado { adj: number; pos: number; off: number }

/* ════════════════════════════════════════════════════════════════════════════
   CanvaSet: UN canvas (escritorio o móvil) con estado independiente.
   ════════════════════════════════════════════════════════════════════════════ */
function CanvaSet({
    modo,
    heroUrl,
    logoUrl,
    redesDisponibles,
    mapsDato,
    elementos,
    elementosDelOtro,
    onCambiar,
    paginaVacia,
    onClonarOtro,
    onVaciar,
}: {
    modo: "escritorio" | "movil"
    heroUrl: string              // imagen de fondo correspondiente al breakpoint
    logoUrl: string
    redesDisponibles: string[]
    mapsDato: string
    elementos: HeroElemento[]
    elementosDelOtro?: HeroElemento[]
    onCambiar: (elementos: HeroElemento[], modo: "escritorio" | "movil") => void
    /** Texto del placeholder cuando el canva está vacío */
    paginaVacia: string
    /** Solo móvil: reemplaza el set actual por una copia del otro */
    onClonarOtro?: () => void
    /** Solo móvil: borra TODO el set */
    onVaciar: () => void
}) {
    const [lista, setLista] = useState<HeroElemento[]>(elementos)
    const [sel, setSel] = useState<string | null>(null)
    const [guia, setGuia] = useState<{ axis: "v" | "h"; pos: number }[]>([])
    const canvasRef = useRef<HTMLDivElement>(null)
    const listaRef = useRef(lista)
    const [, setTick] = useState(0)

    // Sincronizar cuando cambie la lista guardada (gestos, herencia, clonar/vaciar)
    useEffect(() => {
        setLista(elementos)
        listaRef.current = elementos
    }, [elementos])

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

    useLayoutEffect(() => {
        if (!CSS_GESTOR_FUENTES || document.getElementById("css-fuentes-gestor")) return
        const link = document.createElement("link")
        link.id = "css-fuentes-gestor"
        link.rel = "stylesheet"
        link.href = CSS_GESTOR_FUENTES
        document.head.appendChild(link)
    }, [])

    function persistir() { onCambiar(listaRef.current, modo) }

    // ── Drag con imán (histéresis, medidas del DOM) + resize ──
    function iniciarDrag(e: React.PointerEvent, el: HeroElemento, dragModo: "mover" | "escalar") {
        e.preventDefault()
        e.stopPropagation()
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        setSel(el.id)

        const medir = (id: string): Caja | null => {
            const node = document.querySelector(`[data-hero-el="${id}"]`) as HTMLElement | null
            if (!node) return null
            const r = node.getBoundingClientRect()
            return {
                x0: ((r.left - rect.left) / rect.width) * 100,
                y0: ((r.top - rect.top) / rect.height) * 100,
                x1: ((r.right - rect.left) / rect.width) * 100,
                y1: ((r.bottom - rect.top) / rect.height) * 100,
            }
        }
        const anclas: Caja[] = listaRef.current
            .filter(o => o.id !== el.id)
            .map(o => medir(o.id))
            .filter(Boolean) as Caja[]
        const self = medir(el.id)
        const ejeX = self ? [{ off: self.x0 - el.x }, { off: (self.x0 + self.x1) / 2 - el.x }, { off: self.x1 - el.x }] : [{ off: 0 }, { off: 20 }, { off: 40 }]
        const ejeY = self ? [{ off: self.y0 - el.y }, { off: self.y1 - el.y }] : [{ off: 0 }, { off: 10 }]

        const ejer = { x: null as Fijado | null, y: null as Fijado | null }
        const clienteX = e.clientX, clienteY = e.clientY
        const ini = { x: el.x, y: el.y, w: el.w ?? 40 }

        const mover = (ev: PointerEvent) => {
            const dx = ((ev.clientX - clienteX) / rect.width) * 100
            const dy = ((ev.clientY - clienteY) / rect.height) * 100
            const i = listaRef.current.findIndex(x => x.id === el.id)
            if (i < 0) return
            const act = { ...listaRef.current[i] }
            const guias: { axis: "v" | "h"; pos: number }[] = []

            if (dragModo === "mover") {
                const resolver = (
                    valCrudo: number,
                    fijado: Fijado | null,
                    offs: { off: number }[],
                    anclasEje: number[],
                    hayCentro: boolean,
                ): { val: number; fijado: Fijado | null; pos: number | null } => {
                    if (fijado) {
                        const d = Math.abs(fijado.pos - (valCrudo + fijado.off))
                        if (d <= THR_OFF) return { val: fijado.adj, fijado, pos: fijado.pos }
                    }
                    let mejor: { d: number; adj: number; pos: number; off: number } | null = null
                    const anclajes = hayCentro ? [...anclasEje, 50] : anclasEje
                    for (const p of anclajes) {
                        for (const { off } of offs) {
                            const d = Math.abs(p - (valCrudo + off))
                            if (!mejor || d < mejor.d) mejor = { d, adj: p - off, pos: p, off }
                        }
                    }
                    if (mejor && mejor.d < THR) {
                        return { val: clamp(mejor.adj, 0, 100), fijado: mejor, pos: mejor.pos }
                    }
                    return { val: clamp(valCrudo, 0, 100), fijado: null, pos: null }
                }

                const nx = resolver(ini.x + dx, ejer.x, ejeX, anclas.flatMap(b => [b.x0, (b.x0 + b.x1) / 2, b.x1]), true)
                const ny = resolver(ini.y + dy, ejer.y, ejeY, anclas.flatMap(b => [b.y0, b.y1]), false)
                ejer.x = nx.fijado
                ejer.y = ny.fijado
                setGuia([
                    ...(nx.pos !== null ? [{ axis: "v" as const, pos: nx.pos }] : []),
                    ...(ny.pos !== null ? [{ axis: "h" as const, pos: ny.pos }] : []),
                ])
                act.x = Math.round(nx.val * 10) / 10
                act.y = Math.round(ny.val * 10) / 10
            } else {
                act.w = clamp(Math.round((ini.w + dx) * 10) / 10, 4, 100)
            }
            listaRef.current[i] = act
            setLista([...listaRef.current])
            setTick(t => t + 1)
        }
        const subir = () => {
            window.removeEventListener("pointermove", mover)
            window.removeEventListener("pointerup", subir)
            window.removeEventListener("pointercancel", subir)
            setGuia([])
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

    /** + Redes: un botón por cada red con link llenado */
    function agregarRedes() {
        if (!redesDisponibles.length) return
        const base = Date.now().toString(36)
        const nuevos = redesDisponibles.map((red, i) => ({
            id: `el_${base}${i}_${Math.random().toString(36).slice(2, 5)}`,
            tipo: "red",
            red,
            x: clamp(40 + i * 10, 0, 100),
            y: 84,
            tamano: 40,
        }))
        listaRef.current = [...listaRef.current, ...nuevos]
        setLista(listaRef.current)
        setSel(nuevos[0].id)
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
        if (sel === id) setSel(null)
        persistir()
    }

    const selEl = lista.find(x => x.id === sel)

    // Escala WYSIWYG (igual que el público): 1920 desktop / 1280 móvil
    const base = modo === "movil" ? 1280 : 1920
    const escala = anchoCanvas ? anchoCanvas / base : (modo === "movil" ? 0.2 : 0.36)
    const escalaMin = anchoCanvas ? anchoCanvas / 390 : 0.66
    const minTexto = modo === "movil" ? 13 * escalaMin : 0
    const minBoton = modo === "movil" ? 10 * escalaMin : 0
    const minRed = modo === "movil" ? 22 * escalaMin : 0

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Cabecera del canva */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)" }}>
                    <Icon name={modo === "escritorio" ? "Monitor" : "Smartphone"} size={16} color="var(--primary-mid)" />
                    {modo === "escritorio" ? "Canva de escritorio" : "Canva móvil"}
                </span>
                {lista.length > 0 && (
                    <span style={{ display: "flex", gap: 8 }}>
                        {modo === "movil" && onClonarOtro && (
                            <button
                                onClick={onClonarOtro}
                                title="Reemplazar este canva con una copia del de escritorio"
                                style={{ padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.7rem", fontWeight: 700, border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}
                            >
                                <Icon name="Copy" size={12} /> Clonar del escritorio
                            </button>
                        )}
                        <button
                            onClick={onVaciar}
                            style={{ padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.7rem", fontWeight: 700, border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)", color: "#e53935", display: "flex", alignItems: "center", gap: 4 }}
                        >
                            <Icon name="Trash2" size={12} /> {modo === "movil" ? "Descartar" : "Vaciar"}
                        </button>
                    </span>
                )}
            </div>

            {/* Barra de herramientas */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Añadir</span>
                {([
                    { tipo: "texto" as const, label: "Texto", icono: "Type" },
                    { tipo: "logo" as const, label: "Logo", icono: "CircleUserRound" },
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
                    >
                        <Icon name={b.icono as any} size={15} color="var(--primary-mid)" />
                        {b.label}
                    </button>
                ))}
                <button
                    onClick={() => agregarRedes()}
                    disabled={redesDisponibles.length === 0}
                    title={redesDisponibles.length === 0 ? "Llena Instagram, Facebook, TikTok o teléfono en Identidad del Negocio" : undefined}
                    style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                        borderRadius: 10, cursor: redesDisponibles.length === 0 ? "not-allowed" : "pointer",
                        fontSize: "0.78rem", fontWeight: 700, opacity: redesDisponibles.length === 0 ? 0.45 : 1,
                        border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)",
                        color: "var(--text-main)",
                    }}
                >
                    <Icon name="Share2" size={15} color="var(--primary-mid)" />
                    {redesDisponibles.length ? `Redes (${redesDisponibles.length})` : "Redes"}
                </button>
            </div>

            {/* ── Canvas WYSIWYG ── */}
            <div style={{ width: "100%", maxWidth: modo === "movil" ? 320 : "100%", margin: modo === "movil" ? "0 auto" : undefined }}>
                <div
                    ref={canvasRef}
                    onPointerDown={() => setSel(null)}
                    style={{
                        position: "relative", width: "100%", aspectRatio: modo === "movil" ? "390 / 844" : "16 / 9",
                        borderRadius: 12, overflow: "hidden", boxSizing: "border-box",
                        border: "1.5px solid var(--border-primary)",
                        background: heroUrl
                            ? `url(${optimizarImagenCloudinary(heroUrl, 1280)}) center / cover no-repeat`
                            : "var(--bg-app)",
                        userSelect: "none", touchAction: "none",
                    }}
                >
                    {lista.length === 0 && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 600, zIndex: 3 }}>
                            {paginaVacia}
                        </div>
                    )}
                    {heroUrl && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.25))", opacity: 0.4, pointerEvents: "none" }} />}

                    {guia.map(g => (
                        <div
                            key={`${g.axis}${g.pos}`}
                            style={g.axis === "v"
                                ? { position: "absolute", left: `${g.pos}%`, top: 0, bottom: 0, width: 1, background: "var(--primary-mid)", opacity: 0.85, pointerEvents: "none", zIndex: 10 }
                                : { position: "absolute", top: `${g.pos}%`, left: 0, right: 0, height: 1, background: "var(--primary-mid)", opacity: 0.85, pointerEvents: "none", zIndex: 10 }
                            }
                        />
                    ))}

                    {lista.map(el => {
                        const activoSel = sel === el.id
                        const borde = activoSel ? "var(--primary-mid)" : "transparent"
                        return (
                            <div
                                key={el.id}
                                data-hero-el={el.id}
                                onPointerDown={e => iniciarDrag(e, el, "mover")}
                                style={{
                                    position: "absolute",
                                    left: `${el.x}%`,
                                    top: `${el.y}%`,
                                    width: (el.tipo === "texto" || el.tipo === "logo") ? `${el.w ?? 40}%` : undefined,
                                    cursor: "move",
                                    outline: `1.5px dashed ${borde === "transparent" ? "rgba(255,255,255,0.35)" : borde}`,
                                    outlineOffset: 2,
                                    pointerEvents: "auto",
                                }}
                            >
                                {el.tipo === "logo" && logoUrl && (
                                    <img
                                        src={optimizarImagenCloudinary(logoUrl, 300)}
                                        alt="Logo"
                                        style={{
                                            width: "100%", aspectRatio: "1 / 1", borderRadius: "50%",
                                            objectFit: "cover", background: "#fff",
                                            border: "3px solid rgba(255,255,255,0.9)",
                                            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                                            pointerEvents: "none", display: "block",
                                        }}
                                    />
                                )}
                                {el.tipo === "texto" && (
                                    <div style={{
                                        fontSize: `${Math.max(minTexto, (el.tamano ?? 56) * escala)}px`,
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
                                {el.tipo === "red" && (
                                    <div style={{
                                        width: Math.max(minRed, (el.tamano ?? 40) * escala),
                                        height: Math.max(minRed, (el.tamano ?? 40) * escala),
                                        borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        background: "rgba(255,255,255,0.14)", backdropFilter: "blur(6px)",
                                        pointerEvents: "none",
                                    }}>
                                        <Icon name={ICONO_RED[el.red ?? "instagram"] as any} size={(el.tamano ?? 40) * escala * 0.5} color="#fff" />
                                    </div>
                                )}
                                {el.tipo === "redes" && (
                                    <div style={{ display: "flex", gap: 8, pointerEvents: "none" }}>
                                        {(["instagram", "facebook", "tiktok", "whatsapp"] as const).map(red => (
                                            <span key={red} style={{
                                                width: 34, height: 34, borderRadius: "50%",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                background: "rgba(255,255,255,0.14)", backdropFilter: "blur(6px)",
                                            }}>
                                                <Icon name={ICONO_RED[red] as any} size={15} color="#fff" />
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {el.tipo === "boton" && (() => {
                                    const fantasma = el.estilo === "outline"
                                    const fs = Math.max(minBoton, (el.tamano ?? 15) * escala)
                                    return (
                                        <div style={{
                                            padding: `${fs * 0.65}px ${fs * 1.7}px`,
                                            borderRadius: el.radio ?? 999,
                                            background: fantasma ? "rgba(255,255,255,0.08)" : (el.color || "var(--primary-mid)"),
                                            border: "none",
                                            boxShadow: fantasma ? `inset 0 0 0 ${Math.max(2, fs * 0.09)}px ${el.color || "var(--primary-mid)"}` : undefined,
                                            backdropFilter: fantasma ? "blur(6px)" : undefined,
                                            color: colorTextoBoton(el),
                                            fontWeight: 800, fontSize: `${fs}px`,
                                            fontFamily: el.fuente ? (FUENTES_CATALOGO[el.fuente]?.stack ?? undefined) : undefined,
                                            whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
                                            pointerEvents: "none",
                                        }}>
                                            {el.texto || "Ver el catálogo"}
                                        </div>
                                    )
                                })()}
                                {(el.tipo === "texto" || el.tipo === "logo") && (
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
                                {activoSel && (
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
            </div>

            {/* ── Paneles de propiedades ── */}
            {selEl && selEl.tipo === "texto" && (
                <TextoPanel el={selEl} maxTamano={MAX_TAMANO} onActualizar={actualizar} onQuitar={quitar} />
            )}
            {selEl && selEl.tipo === "boton" && (
                <BotonPanel el={selEl} mapsDato={mapsDato} onActualizar={actualizar} onQuitar={quitar} />
            )}
            {selEl && selEl.tipo === "red" && (
                <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                            {ETIQUETAS_RED[selEl.red ?? "instagram"]}
                        </span>
                        <button onClick={() => quitar(selEl.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon name="Trash2" size={13} /> Eliminar
                        </button>
                    </div>
                    <input
                        type="range" min={20} max={80} step={2}
                        value={selEl.tamano ?? 40}
                        onChange={e => actualizar(selEl.id, { tamano: Number(e.target.value) })}
                        style={{ width: "100%", accentColor: "var(--primary-mid)", cursor: "pointer" }}
                    />
                </div>
            )}
            {selEl && (selEl.tipo === "logo" || selEl.tipo === "redes") && (
                <div style={{ padding: "10px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        {selEl.tipo === "logo"
                            ? "Logo del negocio — escálalo con la manija inferior-derecha."
                            : "Redes sociales — fila clásica con las redes del negocio."}
                    </p>
                    <button onClick={() => quitar(selEl.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Icon name="Trash2" size={13} /> Eliminar
                    </button>
                </div>
            )}
        </div>
    )
}

/* ════════════════════════════════════════════════════════════════════════════
   EditorHero: envoltorio con los DOS canva independentes + guardado.
   Toggle VISUAL: solo el canva activo se monta — son dos componentes
   independientes con su propio estado/guardado, nunca se mezclan.
   ════════════════════════════════════════════════════════════════════════════ */
export function EditorHero({
    heroUrl,
    heroUrlMovil,
    logoUrl,
    redesDisponibles,
    mapsDato,
    elementosEscritorio,
    elementosMovil,
    onCambiar,
}: Props) {
    const [vista, setVista] = useState<"escritorio" | "movil">("escritorio")
    const vistas = [
        { key: "escritorio" as const, label: "Escritorio", icono: "Monitor" },
        { key: "movil" as const, label: "Móvil", icono: "Smartphone" },
    ]
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Toggle de vista: puramente visual (mantiene cada canva intacto) */}
            <div style={{ display: "flex", gap: 8 }}>
                {vistas.map(v => {
                    const on = vista === v.key
                    return (
                        <button
                            key={v.key}
                            onClick={() => setVista(v.key)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                padding: "8px 6px", borderRadius: 10, cursor: "pointer", fontSize: "0.78rem",
                                fontWeight: on ? 800 : 700, transition: "all 0.15s",
                                border: `1.5px solid ${on ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                background: on ? "var(--primary-soft)" : "var(--bg-card2)",
                                color: on ? "var(--primary-mid)" : "var(--text-muted)",
                            }}
                        >
                            <Icon name={v.icono as any} size={15} />
                            {v.label}
                        </button>
                    )
                })}
            </div>
            {vista === "escritorio" && (
                <CanvaSet
                    modo="escritorio"
                    heroUrl={heroUrl}
                    logoUrl={logoUrl}
                    redesDisponibles={redesDisponibles}
                    mapsDato={mapsDato}
                    elementos={elementosEscritorio}
                    onCambiar={onCambiar}
                    paginaVacia="Canva de escritorio vacío — añade cajas de texto, logo, redes o el botón"
                    onVaciar={() => onCambiar([], "escritorio")}
                />
            )}
            {vista === "movil" && (
                <CanvaSet
                    modo="movil"
                    heroUrl={heroUrlMovil || heroUrl}
                    logoUrl={logoUrl}
                    redesDisponibles={redesDisponibles}
                    mapsDato={mapsDato}
                    /* El canva móvil siempre edita su PROPIO set (vacío si aún
                       no existe). Con placeholder hasta clonar o crear elementos. */
                    elementos={elementosMovil ?? []}
                    elementosDelOtro={elementosEscritorio}
                    onCambiar={onCambiar}
                    paginaVacia="Canva móvil vacío — clona el de escritorio o empieza de cero"
                    onClonarOtro={() => {
                        // Clonar = candidatos del canva con nuevos ids para evitar duplicados
                        const renombrados = (elementosEscritorio || []).map((e, i) => ({
                            ...e,
                            id: `cl_${Date.now().toString(36)}${i}_${Math.random().toString(36).slice(2, 5)}`,
                        }))
                        onCambiar(renombrados, "movil")
                    }}
                    onVaciar={() => onCambiar([], "movil")}
                />
            )}
        </div>
    )
}

/* ── Panel de la caja de texto ── */
function TextoPanel({ el, maxTamano, onActualizar, onQuitar }: {
    el: HeroElemento
    maxTamano: number
    onActualizar: (id: string, cambios: Partial<HeroElemento>) => void
    onQuitar: (id: string) => void
}) {
    return (
        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Propiedades del texto</span>
                <button onClick={() => onQuitar(el.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="Trash2" size={13} /> Eliminar
                </button>
            </div>

            <textarea
                className="input-primary"
                value={el.texto ?? ""}
                onChange={e => onActualizar(el.id, { texto: e.target.value })}
                rows={2}
                style={{ fontSize: "0.82rem", resize: "vertical" }}
            />

            <div>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Tipografía</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {FUENTES_CANVA.map(k => {
                        const f = FUENTES_CATALOGO[k]
                        const on = (el.fuente ?? "playfair") === k
                        return (
                            <button
                                key={k}
                                onClick={() => onActualizar(el.id, { fuente: k })}
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

            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tamaño</span>
                        <span style={{ fontWeight: 800, fontSize: "0.74rem", color: "var(--primary-mid)" }}>{el.tamano ?? 56}px</span>
                    </div>
                    <input
                        type="range" min={16} max={maxTamano} step={2}
                        value={el.tamano ?? 56}
                        onChange={e => onActualizar(el.id, { tamano: Number(e.target.value) })}
                        style={{ width: "100%", accentColor: "var(--primary-mid)", cursor: "pointer" }}
                    />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                        type="color" value={el.color || "#ffffff"}
                        onChange={e => onActualizar(el.id, { color: e.target.value })}
                        style={{ width: 24, height: 24, border: "none", background: "none", padding: 0, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>Color</span>
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                    {(["left", "center", "right"] as const).map(a => {
                        const on = (el.align ?? "center") === a
                        return (
                            <button
                                key={a}
                                onClick={() => onActualizar(el.id, { align: a })}
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
                        const on = (el.peso ?? "700") === w
                        return (
                            <button
                                key={w}
                                onClick={() => onActualizar(el.id, { peso: w })}
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
    )
}

/* ── Panel del botón: texto + función + estilo + tipografía + tamaño + color +
      redondeo + color del texto ── */
function BotonPanel({ el, mapsDato, onActualizar, onQuitar }: {
    el: HeroElemento
    mapsDato: string             // Ubicación (Google Maps) del negocio; '' = sin dirección
    onActualizar: (id: string, cambios: Partial<HeroElemento>) => void
    onQuitar: (id: string) => void
}) {
    const esPildora = (el.radio ?? 999) > 40
    const estiloActual = el.estilo ?? "solido"
    const accionActual = el.accion ?? "catalogo"
    return (
        <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Propiedades del botón</span>
                <button onClick={() => onQuitar(el.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="Trash2" size={13} /> Eliminar
                </button>
            </div>
            <input
                className="input-primary"
                value={el.texto ?? ""}
                maxLength={40}
                placeholder="Texto del botón"
                onChange={e => onActualizar(el.id, { texto: e.target.value })}
                style={{ fontSize: "0.82rem" }}
            />

            {/* Función: bajar al catálogo o abrir Google Maps con la ubicación */}
            <div>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Función</span>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={() => onActualizar(el.id, { accion: "catalogo" })}
                        title="Desplaza la vista hasta el menú"
                        style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            padding: "8px 6px", borderRadius: 10, cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, transition: "all 0.15s",
                            border: `1.5px solid ${accionActual === "catalogo" ? "var(--primary-mid)" : "var(--border-primary)"}`,
                            background: accionActual === "catalogo" ? "var(--primary-soft)" : "var(--bg-card2)",
                            color: accionActual === "catalogo" ? "var(--primary-mid)" : "var(--text-muted)",
                        }}
                    >
                        <Icon name="List" size={15} /> Ver el catálogo
                    </button>
                    <button
                        onClick={() => { if (mapsDato) onActualizar(el.id, { accion: "maps" }) }}
                        disabled={!mapsDato}
                        title={mapsDato ? "Abre la ubicación del negocio en Google Maps" : "Llena Ubicación (Google Maps) en Identidad del Negocio"}
                        style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            padding: "8px 6px", borderRadius: 10, cursor: mapsDato ? "pointer" : "not-allowed", fontSize: "0.78rem", fontWeight: 700, transition: "all 0.15s",
                            opacity: mapsDato ? 1 : 0.45,
                            border: `1.5px solid ${accionActual === "maps" ? "var(--primary-mid)" : "var(--border-primary)"}`,
                            background: accionActual === "maps" ? "var(--primary-soft)" : "var(--bg-card2)",
                            color: accionActual === "maps" ? "var(--primary-mid)" : "var(--text-muted)",
                        }}
                    >
                        <Icon name="MapPin" size={15} /> Cómo llegar
                    </button>
                </div>
            </div>

            {/* Estilo: sólido (fondo lleno) o fantasma (outline) */}
            <div>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Estilo</span>
                <div style={{ display: "flex", gap: 8 }}>
                    {([
                        { key: "solido", label: "Sólido" },
                        { key: "outline", label: "Fantasma" },
                    ] as const).map(e => {
                        const on = estiloActual === e.key
                        return (
                            <button
                                key={e.key}
                                onClick={() => onActualizar(el.id, { estilo: e.key })}
                                style={{
                                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                    padding: "8px 6px", borderRadius: 10, cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, transition: "all 0.15s",
                                    border: `1.5px solid ${on ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                    background: on ? "var(--primary-soft)" : "var(--bg-card2)",
                                    color: on ? "var(--primary-mid)" : "var(--text-muted)",
                                }}
                            >
                                {e.key === "solido" && <span style={{ width: 14, height: 14, borderRadius: 999, background: el.color || "var(--primary-mid)", border: "1.5px solid var(--border-primary)" }} />}
                                {e.key === "outline" && <span style={{ width: 14, height: 14, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: `2px solid ${el.color || "var(--primary-mid)"}` }} />}
                                {e.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Tipografía: las mismas 7 display del canva (Tema = la del catálogo) */}
            <div>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Tipografía</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {FUENTES_ORDEN.map(k => {
                        const f = FUENTES_CATALOGO[k]
                        const on = (el.fuente ?? "") === k
                        return (
                            <button
                                key={k}
                                onClick={() => onActualizar(el.id, { fuente: k === "sistema" ? undefined : k })}
                                style={{
                                    padding: "6px 12px", borderRadius: 10, cursor: "pointer", fontSize: "0.78rem",
                                    fontWeight: on ? 800 : 600, fontFamily: f.stack, transition: "all 0.15s",
                                    border: `1.5px solid ${on ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                    background: on ? "var(--primary-soft)" : "var(--bg-card2)",
                                    color: on ? "var(--primary-mid)" : "var(--text-main)",
                                }}
                            >
                                {k === "sistema" ? "Tema" : f.label.replace(/ \(serif\)/, "")}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Tamaño del texto + color del fondo */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tamaño</span>
                        <span style={{ fontWeight: 800, fontSize: "0.74rem", color: "var(--primary-mid)" }}>{el.tamano ?? 15}px</span>
                    </div>
                    <input
                        type="range" min={10} max={160} step={1}
                        value={el.tamano ?? 15}
                        onChange={e => onActualizar(el.id, { tamano: Number(e.target.value) })}
                        style={{ width: "100%", accentColor: "var(--primary-mid)", cursor: "pointer" }}
                    />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                        type="color" value={el.color || "#1f6f5c"}
                        onChange={e => onActualizar(el.id, { color: e.target.value })}
                        style={{ width: 24, height: 24, border: "none", background: "none", padding: 0, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>Color</span>
                </label>
                <button
                    onClick={() => onActualizar(el.id, { color: "" })}
                    title="Usar el color del tema"
                    style={{
                        padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                        border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)",
                        color: el.color ? "var(--text-muted)" : "var(--primary-mid)",
                        display: "flex", alignItems: "center", gap: 6,
                    }}
                >
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: "linear-gradient(135deg, var(--bg-app) 0%, var(--primary-mid) 100%)", border: "1.5px solid var(--border-primary)" }} />
                    Tema
                </button>
            </div>

            {/* Redondeo: slider 0-40px + preset píldora */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Redondeo</span>
                    <span style={{ fontWeight: 800, fontSize: "0.74rem", color: "var(--primary-mid)" }}>{esPildora ? "Píldora" : `${el.radio ?? 999}px`}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                        type="range" min={0} max={40} step={2}
                        value={esPildora ? 40 : (el.radio ?? 999)}
                        onChange={e => onActualizar(el.id, { radio: Number(e.target.value) })}
                        style={{ flex: 1, accentColor: "var(--primary-mid)", cursor: "pointer" }}
                    />
                    <button
                        onClick={() => onActualizar(el.id, { radio: esPildora ? 16 : 999 })}
                        title="Píldora (totalmente redondeado)"
                        style={{
                            padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                            border: `1.5px solid ${esPildora ? "var(--primary-mid)" : "var(--border-primary)"}`,
                            background: esPildora ? "var(--primary-soft)" : "var(--bg-card2)",
                            color: esPildora ? "var(--primary-mid)" : "var(--text-muted)",
                            display: "flex", alignItems: "center", gap: 6,
                        }}
                    >
                        <span style={{ width: 18, height: 12, borderRadius: 999, background: "var(--primary-mid)" }} />
                        Píldora
                    </button>
                </div>
            </div>

            {/* Color del texto: manual o automático por contraste */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                        type="color" value={el.color_texto || "#ffffff"}
                        onChange={e => onActualizar(el.id, { color_texto: e.target.value })}
                        style={{ width: 24, height: 24, border: "none", background: "none", padding: 0, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>Color del texto</span>
                </label>
                <button
                    onClick={() => onActualizar(el.id, { color_texto: "" })}
                    title="Automático: negro o blanco según el contraste"
                    style={{
                        padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                        border: `1.5px solid ${el.color_texto ? "var(--border-primary)" : "var(--primary-mid)"}`,
                        background: el.color_texto ? "var(--bg-card2)" : "var(--primary-soft)",
                        color: el.color_texto ? "var(--text-muted)" : "var(--primary-mid)",
                    }}
                >
                    Auto
                </button>
            </div>
        </div>
    )
}
