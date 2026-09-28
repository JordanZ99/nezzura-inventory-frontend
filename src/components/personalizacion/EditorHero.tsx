// ==============================================================================
// src/components/personalizacion/EditorHero.tsx
// Mini-canva del Hero (migración 049): WYSIWYG sobre la imagen hero con
// elementos posicionables con el mouse:
//
//   - Cajas de TEXTO: arrastrables + escalables (manija inferior-derecha),
//     con tipografía (7 display de lib/catalogo-fuentes), tamaño, color,
//     peso y alineación.
//   - LOGO: arrastrable y escalable (usa el logo del negocio).
//   - REDES: un botón por cada red con link llenado (tipo 'red'),
//     tamaño y lugar independientes.
//   - BOTÓN "Ver el catálogo": texto, tamaño y color editables.
//
// IMÁN DE ALINEACIÓN: bordes/centros del elemento enganchan con los de OTRO
// elemento o el centro del canvas. Con:
//   1) Medidas REALES del DOM (getBoundingClientRect → % del canvas),
//   2) Histéresis: engancha con THR (1.1%) y solo suelta a > THR_OFF (1.9%),
//      entre frames el enganche SE MANTIENE (adiós al parpadeo).
//
// DOS SETS DE COORDENADAS: 'elementos' (escritorio, base 1920) e
// 'elementos_movil' (teléfono, base 1280/clamps de pantalla chica). Si el
// set móvil no existe, hereda el de escritorio; la primera edición en la
// pestaña móvil lo crea (copia del escritorio). Lo que corrijas en un canva
// NO cambia el otro.
//
// El estado vive en catalogoConfig.hero_layout; cada gesto agenda guardado
// con debounce ({ [set]: LISTA COMPLETA } — el backend reemplaza el array).
// ==============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Icon from "@/components/ui/Icon"
import { FUENTES_CATALOGO, FUENTES_ORDEN, CSS_GESTOR_FUENTES } from "@/lib/catalogo-fuentes"
import { optimizarImagenCloudinary } from "@/lib/image-utils"
import type { HeroElemento } from "@/types"

interface Props {
    heroUrl: string              // imagen hero actual
    logoUrl: string              // logo del negocio
    redesDisponibles: string[]   // redes con link llenado
    elementosEscritorio: HeroElemento[]
    elementosMovil?: HeroElemento[]   // set teléfono (undefined = hereda escritorio)
    onCambiar: (elementos: HeroElemento[], modo: "escritorio" | "movil") => void
}

/** Siete tipografías display del gestor (excluye 'sistema': es la sans neutral) */
const FUENTES_CANVA = FUENTES_ORDEN.filter(k => k !== "sistema")

/** Imán: engancha bajo THR, suelta hasta cruzar THR_OFF (histéresis) */
const THR = 1.1
const THR_OFF = 1.9

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Color de texto legible sobre el fondo del botón */
function textoContraste(hex?: string): string {
    if (!hex) return "#fff"
    const c = hex.replace("#", "")
    if (c.length < 6) return "#fff"
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1a1a1a" : "#fff"
}

/** Crea un elemento por defecto */
function nuevoElemento(tipo: HeroElemento["tipo"], id: string): HeroElemento {
    if (tipo === "texto") return { id, tipo, x: 22, y: 42, w: 40, texto: "Escribe aquí...", fuente: "playfair", tamano: 56, color: "#ffffff", peso: "700", align: "center" }
    if (tipo === "logo") return { id, tipo, x: 45, y: 14, w: 10 }
    if (tipo === "redes") return { id, tipo, x: 44, y: 82 }
    return { id, tipo: "boton", x: 30, y: 80, texto: "Ver el catálogo", tamano: 15, color: "" }
}

// Iconos por red
const ICONO_RED: Record<string, string> = {
    instagram: "Instagram", facebook: "Facebook", tiktok: "Music2", whatsapp: "Phone",
}
const ETIQUETAS_RED: Record<string, string> = {
    instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", whatsapp: "WhatsApp",
}

/** Caja de un elemento medida del DOM, en % del canvas */
interface Caja { x0: number; y0: number; x1: number; y1: number }

/** Fijado del imán: guía dibujada + posición ajustada que SE MANTIENE.
 *  off = offset del borde enganchado respecto a la posición del elemento. */
interface Fijado { adj: number; pos: number; off: number }

export function EditorHero({
    heroUrl,
    logoUrl,
    redesDisponibles,
    elementosEscritorio,
    elementosMovil,
    onCambiar,
}: Props) {
    const [modo, setModo] = useState<"escritorio" | "movil">("escritorio")
    // El set ACTIVO: en móvil 'elementos_movil' si ya existe; si no, una vista
    // del escritorio (la primera edición clona a elementos_movil vía onCambiar).
    const escritorio = elementosEscritorio
    const activo = modo === "movil" ? (elementosMovil ?? elementosEscritorio) : elementosEscritorio

    const [lista, setLista] = useState<HeroElemento[]>(elementosEscritorio)
    const [sel, setSel] = useState<string | null>(null)
    const [guia, setGuia] = useState<{ axis: "v" | "h"; pos: number }[]>([])
    const canvasRef = useRef<HTMLDivElement>(null)
    const listaRef = useRef(lista)                     // estado fresco SIN re-render
    const [, setTick] = useState(0)                    // fuerza repintado en drag

    // Sincronizar lista local cuando cambia el set activo (cambio de pestaña,
    // carga asíncrona de config o retorno del guardado del propio gesto).
    useEffect(() => { setLista(activo); listaRef.current = activo }, [activo, modo])

    // Ancho real del canvas para escala WYSIWYG
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
    useLayoutEffect(() => {
        if (!CSS_GESTOR_FUENTES || document.getElementById("css-fuentes-gestor")) return
        const link = document.createElement("link")
        link.id = "css-fuentes-gestor"
        link.rel = "stylesheet"
        link.href = CSS_GESTOR_FUENTES
        document.head.appendChild(link)
    }, [])

    function persistir() {
        onCambiar(listaRef.current, modo)
    }

    // ── Drag con imán (histéresis) + resize con el mouse ──
    function iniciarDrag(e: React.PointerEvent, el: HeroElemento, dragModo: "mover" | "escalar") {
        e.preventDefault()
        e.stopPropagation()
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        setSel(el.id)

        // Medidas REALES: cajas de los demás (anclas) y la mía, en % del canvas
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
        const selfW0 = self ? self.x1 - self.x0 : 40
        const selfH0 = self ? self.y1 - self.y0 : 10
        // Offsets de borde→posición: los bordes reales medidos al iniciar;
        // durante el gesto solo cambia la posición (tamaño constante).
        const ejeX: { off: number }[] = [{ off: self ? self.x0 - el.x : 0 }, { off: self ? (self.x0 + self.x1) / 2 - el.x : 20 }, { off: self ? self.x1 - el.x : 40 }]
        const ejeY: { off: number }[] = [{ off: self ? self.y0 - el.y : 0 }, { off: self ? self.y1 - el.y : 10 }]

        const dragState = { ejer: { x: null as Fijado | null, y: null as Fijado | null }, dragModo }

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
                // ── Resolver un eje con histéresis ──
                // valCrudo = posición cruda (sin imán). Si hay enganche activo
                // se MANTIENE hasta cruzar THR_OFF; solo entonces se re-evalúa
                // contra todas las anclas (medidas del DOM + centro del canvas).
                const resolver = (
                    valCrudo: number,
                    fijado: Fijado | null,
                    offs: { off: number }[],
                    anclasEje: number[],
                    hayCentro: boolean,
                ): { val: number; fijado: Fijado | null; pos: number | null } => {
                    if (fijado) {
                        const d = Math.abs(fijado.pos - (valCrudo + fijado.off))
                        if (d <= THR_OFF) {
                            return { val: fijado.adj, fijado, pos: fijado.pos }
                        }
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

                const nx = resolver(ini.x + dx, dragState.ejer.x,
                    ejeX,
                    anclas.flatMap(b => [b.x0, (b.x0 + b.x1) / 2, b.x1]), true)
                const ny = resolver(ini.y + dy, dragState.ejer.y,
                    ejeY,
                    anclas.flatMap(b => [b.y0, b.y1]), false)

                dragState.ejer.x = nx.fijado
                dragState.ejer.y = ny.fijado
                setGuia([
                    ...(nx.pos !== null ? [{ axis: "v" as const, pos: nx.pos }] : []),
                    ...(ny.pos !== null ? [{ axis: "h" as const, pos: ny.pos }] : []),
                ])

                act.x = Math.round(nx.val * 10) / 10
                act.y = Math.round(ny.val * 10) / 10
            } else {
                // Escalar: manija horizontal (ancho del elemento)
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

    /** + Redes: añade un botón INDEPENDIENTE por cada red con link llenado */
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

    // Escala WYSIWYG: px del hero real → px del canvas actual.
    // Mismo criterio que el render público: text/boton/redes escalan con el
    // ancho real (1920 escritorio / 1280 a vista móvil simulada).
    const base = modo === "movil" ? 1280 : 1920
    const escala = anchoCanvas ? anchoCanvas / base : (modo === "movil" ? 0.2 : 0.36)
    const escalaMin = anchoCanvas ? anchoCanvas / 390 : 0.66
    const minTexto = modo === "movil" ? 13 * escalaMin : 0
    const minBoton = modo === "movil" ? 10 * escalaMin : 0
    const minRed = modo === "movil" ? 22 * escalaMin : 0

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                            borderRadius: 10, cursor: "pointer",
                            fontSize: "0.78rem", fontWeight: 700,
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
                <button
                    onClick={() => agregarRedes()}
                    disabled={redesDisponibles.length === 0}
                    title={redesDisponibles.length === 0 ? "Llena Instagram, Facebook, TikTok o teléfono en Identidad del Negocio" : undefined}
                    style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                        borderRadius: 10, cursor: redesDisponibles.length === 0 ? "not-allowed" : "pointer",
                        fontSize: "0.78rem", fontWeight: 700, opacity: redesDisponibles.length === 0 ? 0.45 : 1,
                        border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)",
                        color: "var(--text-main)", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (redesDisponibles.length) e.currentTarget.style.borderColor = "var(--primary-mid)" }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-primary)" }}
                >
                    <Icon name="Share2" size={15} color="var(--primary-mid)" />
                    {redesDisponibles.length ? `Redes (${redesDisponibles.length})` : "Redes"}
                </button>
            </div>

            {/* Pestañas de vista: escritorio / móvil (sets INDEPENDIENTES) */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {([
                    { key: "escritorio" as const, label: "Escritorio", icono: "Monitor" },
                    { key: "movil" as const, label: "Móvil", icono: "Smartphone" },
                ]).map(v => {
                    const on = modo === v.key
                    return (
                        <button
                            key={v.key}
                            onClick={() => setModo(v.key)}
                            style={{
                                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                                borderRadius: 10, cursor: "pointer", fontSize: "0.76rem", fontWeight: 700,
                                border: `1.5px solid ${on ? "var(--primary-mid)" : "var(--border-primary)"}`,
                                background: on ? "var(--primary-soft)" : "var(--bg-card2)",
                                color: on ? "var(--primary-mid)" : "var(--text-muted)",
                            }}
                        >
                            <Icon name={v.icono as any} size={14} />
                            {v.label}
                        </button>
                    )
                })}
                {modo === "movil" && !elementosMovil && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Hereda la de escritorio — el primer cambio crea la versión móvil
                    </span>
                )}
            </div>

            {/* ── Canvas WYSIWYG (escritorio 16:9 / móvil retrato 390×844) ── */}
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
                    {!heroUrl && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 600 }}>
                            Sube la imagen del Hero arriba para previsualizarla aquí
                        </div>
                    )}
                    {heroUrl && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.25))", opacity: 0.4, pointerEvents: "none" }} />}

                    {/* Guías del imán */}
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
                                {el.tipo === "boton" && (
                                    <div style={{
                                        padding: `${Math.max(minBoton, (el.tamano ?? 15) * escala) * 0.65}px ${Math.max(minBoton, (el.tamano ?? 15) * escala) * 1.7}px`,
                                        borderRadius: 999,
                                        background: el.color || "var(--primary-mid)",
                                        color: textoContraste(el.color),
                                        fontWeight: 800, fontSize: `${Math.max(minBoton, (el.tamano ?? 15) * escala)}px`,
                                        whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
                                        pointerEvents: "none",
                                    }}>
                                        {el.texto || "Ver el catálogo"}
                                    </div>
                                )}
                                {/* Manija de redimensionar (texto y logo) */}
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

            {/* ── Panel de propiedades del elemento seleccionado ── */}
            {selEl && selEl.tipo === "texto" && (
                <TextoPanel el={selEl} onActualizar={actualizar} onQuitar={quitar} />
            )}
            {selEl && selEl.tipo === "boton" && (
                <BotonPanel el={selEl} onActualizar={actualizar} onQuitar={quitar} />
            )}
            {selEl && selEl.tipo === "red" && (
                <div style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                            {ETIQUETAS_RED[selEl.red ?? "instagram"]}
                        </span>
                        <button onClick={() => quitar(selEl.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            <Icon name="Trash2" size={13} /> Eliminar
                        </button>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                        Link de Identidad del Negocio. Cambia su tamaño y muévelo de forma independiente.
                    </p>
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
                            ? "Logo del negocio — escálalo con la manija inferior-derecha del elemento."
                            : "Redes sociales — fila clásica con las redes del negocio."}
                    </p>
                    <button onClick={() => quitar(selEl.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <Icon name="Trash2" size={13} /> Eliminar
                    </button>
                </div>
            )}
            {!selEl && lista.length > 0 && (
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    Consejo: haz clic en un elemento para editarlo y arrástralo. Al pasar cerca de otra figura aparecerá el imán que alinea bordes y centros. La manija inferior-derecha cambia el tamaño.
                </p>
            )}
        </div>
    )
}

/* ── Panel de la caja de texto ── */
function TextoPanel({ el, onActualizar, onQuitar }: {
    el: HeroElemento
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

            {/* Tipografías disponibles (7 display del gestor) */}
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

            {/* Tamaño + color + alineación + peso */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tamaño</span>
                        <span style={{ fontWeight: 800, fontSize: "0.74rem", color: "var(--primary-mid)" }}>{el.tamano ?? 56}px</span>
                    </div>
                    <input
                        type="range" min={16} max={160} step={2}
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

/* ── Panel del botón: texto + tamaño + color ── */
function BotonPanel({ el, onActualizar, onQuitar }: {
    el: HeroElemento
    onActualizar: (id: string, cambios: Partial<HeroElemento>) => void
    onQuitar: (id: string) => void
}) {
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
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tamaño</span>
                        <span style={{ fontWeight: 800, fontSize: "0.74rem", color: "var(--primary-mid)" }}>{el.tamano ?? 15}px</span>
                    </div>
                    <input
                        type="range" min={10} max={36} step={1}
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
        </div>
    )
}
