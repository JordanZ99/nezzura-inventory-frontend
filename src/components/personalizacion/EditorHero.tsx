// ==============================================================================
// src/components/personalizacion/EditorHero.tsx
// Mini-canva del Hero (migración 049): WYSIWYG sobre la imagen hero con
// elementos posicionables con el mouse:
//
//   - Cajas de TEXTO: arrastrables + escalables (manija inferior-derecha),
//     con tipografía (7 display de lib/catalogo-fuentes), tamaño, color,
//     peso y alineación.
//   - LOGO: arrastrable y escalable (usa el logo del negocio).
//   - REDES SOCIALES: fila de iconos (links de Identidad del Negocio).
//   - BOTÓN "Ver el catálogo": arrastrable, texto y tamaño editables.
//
// IMÁN DE ALINEACIÓN: al arrastrar, si una borda/centro del elemento se
// acerca (< thr) a bordas/centros de OTRO elemento o al centro del canvas,
// "salta" al punto de alineación y se dibuja una guía temporal.
//
// Coordenadas en porcentajes del hero (x, y, w: 0-100). El mismo layout escala
// en móvil. El estado vive en catalogoConfig.hero_layout.elementos; cada gesto
// agenda un guardado con debounce ({ elementos: LISTA COMPLETA } — el backend
// reemplaza el array).
// ==============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Icon from "@/components/ui/Icon"
import { FUENTES_CATALOGO, FUENTES_ORDEN, CSS_GESTOR_FUENTES } from "@/lib/catalogo-fuentes"
import { optimizarImagenCloudinary } from "@/lib/image-utils"
import type { HeroElemento } from "@/types"

interface Props {
    heroUrl: string          // imagen hero actual
    logoUrl: string          // logo del negocio
    elementos: HeroElemento[]
    onCambiar: (elementos: HeroElemento[]) => void   // mutate + agenda guardado
}

/** Siete tipografías display del gestor (excluye 'sistema': es la sans neutral) */
const FUENTES_CANVA = FUENTES_ORDEN.filter(k => k !== "sistema")

/** Umbral del imán: distancia (% del canvas) a la que un borde "engancha" */
const THR = 1.1

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Ancho estimado (%) de un elemento — el imán lo usa para bordes/centros.
 *  Texto/logo tienen w real; redes/botón lo estimamos (el navegador lo mide). */
function anchoDe(el: HeroElemento): number {
    if (el.tipo === "logo") return el.w ?? 10
    if (el.tipo === "texto") return el.w ?? 40
    if (el.tipo === "redes") return 13
    return 20
}

/** Crea un elemento por defecto en el centro del hero */
function nuevoElemento(tipo: HeroElemento["tipo"], id: string): HeroElemento {
    if (tipo === "texto") return { id, tipo, x: 22, y: 42, w: 40, texto: "Escribe aquí...", fuente: "playfair", tamano: 56, color: "#ffffff", peso: "700", align: "center" }
    if (tipo === "logo") return { id, tipo, x: 45, y: 14, w: 10 }
    if (tipo === "redes") return { id, tipo, x: 44, y: 82 }
    return { id, tipo: "boton", x: 30, y: 80, texto: "Ver el catálogo", tamano: 15 }
}

// Iconos por red (el Icon consume el nombre tipado de lucide)
const ICONO_RED: Record<string, string> = {
    instagram: "Instagram", facebook: "Facebook", tiktok: "Music2", whatsapp: "Phone",
}

export function EditorHero({
    heroUrl,
    logoUrl,
    elementos,
    onCambiar,
}: Props) {
    const [lista, setLista] = useState<HeroElemento[]>(elementos)
    const [sel, setSel] = useState<string | null>(null)
    const [guia, setGuia] = useState<{ axis: "v" | "h"; pos: number }[]>([])
    const canvasRef = useRef<HTMLDivElement>(null)
    const listaRef = useRef(lista)                      // estado fresco SIN re-render
    const [, setTick] = useState(0)                      // fuerza repintado en drag

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

    // Sincronizar lista local cuando el config carga de forma asíncrona
    // (el padre actualiza hero_layout con la MISMA referencia al persistir,
    // así el sync no estorba los gestos activos).
    useEffect(() => { setLista(elementos) }, [elementos])

    // Al terminar cualquier gesto: delegamos la lista completa al padre,
    // que actualiza catalogoConfig + agenda el guardado con debounce.
    function persistir() {
        onCambiar(listaRef.current)
    }

    // ── Puntos de alineación del entorno: centros del canvas ──
    // (los compañeros los aporta el algoritmo de imán por elemento)

    // ── Drag con imán + resize con el mouse (Pointer Events, sin librerías) ──
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
            const guias: { axis: "v" | "h"; pos: number }[] = []

            if (modo === "mover") {
                let nx = clamp((ini.x + dx), 0, 100)
                let ny = clamp((ini.y + dy), 0, 100)
                let ajustoV = false, ajustoH = false

                // Ancho/mítad de YO y de los demás para bordar/centrar
                const selfW = anchoDe(act)

                // ── IMÁN horizontal: comparar borde izq, centro y borde der
                //     contra los mismos anclajes de los otros y el centro del canvas
                for (const otro of listaRef.current) {
                    if (otro.id === el.id) continue
                    const WI = anchoDe(otro)
                    const anclajesOtro = [
                        { pos: otro.x, tipo: "borde" as const },
                        { pos: otro.x + WI / 2, tipo: "centro" as const },
                        { pos: otro.x + WI, tipo: "borde" as const },
                    ]
                    for (const a of anclajesOtro) {
                        // Yo: izquierda / centro / derecha
                        const opciones = [
                            { delta: a.pos - nx, pos: nx, lado: "izq" as const, adj: a.pos },
                            { delta: a.pos - (nx + selfW / 2), pos: nx + selfW / 2, lado: "centro" as const, adj: a.pos - selfW / 2 },
                            { delta: a.pos - (nx + selfW), pos: nx + selfW, lado: "der" as const, adj: a.pos - selfW },
                        ]
                        for (const o of opciones) {
                            if (Math.abs(o.delta) < THR) { nx = Math.round(o.adj * 10) / 10; ajustoV = true; guias.push({ axis: "v", pos: a.pos }) ; break }
                        }
                        if (ajustoV) break
                    }
                    if (ajustoV) break
                }
                // Centro del canvas como anclaje permanente
                if (!ajustoV) {
                    for (const o of [nx, nx + selfW / 2, nx + selfW]) {
                        if (Math.abs(50 - o) < THR) { nx = Math.round((50 - (o - nx)) * 10) / 10; ajustoV = true; guias.push({ axis: "v", pos: 50 }); break }
                    }
                }

                // ── IMÁN vertical: bordes superiores/inferiores aproximados
                const altoSelf = el.tipo === "logo" ? (act.w ?? 10) / 2.5 : 6   // alto estimado (%)
                for (const otro of listaRef.current) {
                    if (otro.id === el.id) continue
                    const altoOtro = otro.tipo === "logo" ? (otro.w ?? 10) / 2.5 : 6
                    const alturas = [otro.y, otro.y + altoOtro]
                    for (const a of alturas) {
                        for (const y0 of [ny, ny + altoSelf]) {
                            if (Math.abs(a - y0) < THR) { ny = Math.round(y0 + (a - y0) * 10) / 10; ajustoH = true; guias.push({ axis: "h", pos: a }); break }
                        }
                        if (ajustoH) break
                    }
                    if (ajustoH) break
                }
                if (!ajustoH) {
                    for (const y0 of [ny, ny + altoSelf]) {
                        if (Math.abs(50 - y0) < THR) { ny = Math.round(y0 + (50 - y0) * 10) / 10; ajustoH = true; guias.push({ axis: "h", pos: 50 }); break }
                    }
                }

                act.x = clamp(Math.round(nx * 10) / 10, 0, 100)
                act.y = clamp(Math.round(ny * 10) / 10, 0, 100)
                setGuia(guias)
            } else {
                // Escalar: manija horizontal (ancho del elemento)
                const nw = clamp((ini.w ?? 40) + dx, 4, 100)
                act.w = clamp(Math.round(nw * 10) / 10, 4, 100)
            }
            listaRef.current[i] = act
            setLista([...listaRef.current])
            setTick(t => t + 1)
        }
        const subir = () => {
            window.removeEventListener("pointermove", mover)
            window.removeEventListener("pointerup", subir)
            window.removeEventListener("pointercancel", subir)
            dragRef.current = null
            setGuia([])
            persistir()
        }
        window.addEventListener("pointermove", mover)
        window.addEventListener("pointerup", subir)
        window.addEventListener("pointercancel", subir)
    }

    // Referencia para limpiar listeners al desmontar durante un gesto
    const dragRef = useRef<{ id: string } | null>(null)

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
        if (sel === id) setSel(null)
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
                    { tipo: "logo" as const, label: "Logo", icono: "CircleUserRound" },
                    { tipo: "redes" as const, label: "Redes", icono: "Share2" },
                    { tipo: "boton" as const, label: "Botón", icono: "RectangleHorizontal" },
                ]).map(b => {
                    const sinLogo = b.tipo === "logo" && !logoUrl
                    return (
                        <button
                            key={b.tipo}
                            onClick={() => agregar(b.tipo)}
                            disabled={sinLogo}
                            title={sinLogo ? "Sube un logo en Identidad del Negocio" : undefined}
                            style={{
                                display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                                borderRadius: 10, cursor: sinLogo ? "not-allowed" : "pointer",
                                fontSize: "0.78rem", fontWeight: 700, opacity: sinLogo ? 0.45 : 1,
                                border: "1.5px solid var(--border-primary)", background: "var(--bg-card2)",
                                color: "var(--text-main)", transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { if (!sinLogo) e.currentTarget.style.borderColor = "var(--primary-mid)" }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-primary)" }}
                        >
                            <Icon name={b.icono as any} size={15} color="var(--primary-mid)" />
                            {b.label}
                        </button>
                    )
                })}
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

                {/* Guías del imán (v = vertical que baja el fondo, h = horizontal) */}
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
                                    padding: `${((el.tamano ?? 15) * escala) * 0.7}px ${((el.tamano ?? 15) * escala) * 1.6}px`,
                                    borderRadius: 999,
                                    background: "var(--primary-mid)", color: "#fff",
                                    fontWeight: 800, fontSize: `${(el.tamano ?? 15) * escala}px`,
                                    whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
                                    pointerEvents: "none",
                                }}>
                                    <Icon name="ArrowDown" size={14} />
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
                <TextoPanel el={selEl} onActualizar={actualizar} onQuitar={quitar} />
            )}
            {selEl && selEl.tipo === "boton" && (
                <BotonPanel el={selEl} onActualizar={actualizar} onQuitar={quitar} />
            )}
            {selEl && (selEl.tipo === "logo" || selEl.tipo === "redes") && (
                <div style={{ padding: "10px 16px", background: "var(--bg-card2)", borderRadius: 12, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        {selEl.tipo === "logo"
                            ? "Logo del negocio — escálalo con la manija inferior-derecha del elemento."
                            : "Redes sociales — se muestran Instagram, Facebook, TikTok y WhatsApp del negocio (Identidad del Negocio)."}
                    </p>
                    <button onClick={() => quitar(selEl.id)} style={{ border: "none", background: "none", color: "#e53935", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <Icon name="Trash2" size={13} /> Eliminar
                    </button>
                </div>
            )}
            {!selEl && lista.length > 0 && (
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    Consejo: haz clic en un elemento para editarlo y arrástralo a la posición que quieras. Al pasar cerca de otra figura aparecerá un ímán que alinea bordes y centros. La manija inferior-derecha cambia el tamaño.
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

/* ── Panel del botón: texto + tamaño ── */
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
            </div>
        </div>
    )
}
