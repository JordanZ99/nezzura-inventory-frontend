"use client"
// ==============================================================================
// src/app/almacenamiento/page.tsx
// Gestor de espacio (cuota por plan, migración 071).
//
// VISTA POR DEFECTO (ligera): medidor + desglose por categoría en TEXTO, sin
// fotos. La lista de imágenes NO carga aquí: solo cuando el tenant decide
// liberar espacio (el peso ya no crece de otra forma, así que el listado es
// una herramienta de limpieza, no un wallpaper diario — menos presión y
// menos datos móviles).
//
// Al abrir la lista: miniaturas TRANSFORMADAS de Cloudinary (96px, q_auto,
// f_auto ≈ 10-20 KB) en vez de la foto completa; el resto pesa 0 en datos.
//
// También es la casa del respaldo completo (datos + fotos en ZIP).
//
// Fotos del catálogo publicado (Modo Local): informativas — se gestionan
// republicando desde la app, no borrando aquí.
// ==============================================================================

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import PageHeader from "@/components/ui/PageHeader"
import Icon from "@/components/ui/Icon"
import { useAlmacenamiento } from "@/hooks/useAlmacenamiento"
import {
    almacenamientoApi,
    fmtPeso,
    GB,
    type ImagenAlmacenamiento,
} from "@/lib/api/almacenamiento"
import { descargarRespaldoCompleto } from "@/lib/api/client"

const POR_PAGINA = 100
const MAX_POR_LOTE = 50

const ETIQUETAS_DESGLOSE: Record<string, string> = {
    principal: "Fotos de producto",
    galeria: "Galerías (Plus)",
    variaciones: "Variaciones",
    branding: "Logo y banners",
    catalogo: "Catálogo publicado",
    sin_referencia: "Sin usar (huérfanas)",
}

function colorEstado(porcentaje: number, excedido: boolean): string {
    if (excedido || porcentaje >= 95) return "#e53935"
    if (porcentaje >= 80) return "#fb8c00"
    return "#43a047"
}

/** Miniatura transformada: ~15 KB en vez de la foto completa. */
function thumbUrl(url: string, size = 96): string {
    const marca = "/upload/"
    if (!url.includes(marca)) return url
    return url.replace(marca, `${marca}w_${size},h_${size},c_fill,q_auto,f_auto/`)
}

export default function Almacenamiento() {
    const queryClient = useQueryClient()
    const { data: uso } = useAlmacenamiento()

    // La lista SOLO carga cuando el tenant decide liberar espacio
    const [liberarAbierto, setLiberarAbierto] = useState(false)
    const { data: listado, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ["imagenes-almacenamiento"],
        queryFn: () => almacenamientoApi.listarImagenes(),
        staleTime: 30_000,
        retry: 0,
        enabled: liberarAbierto,
    })

    const [visibles, setVisibles] = useState(POR_PAGINA)
    const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
    const [liberando, setLiberando] = useState(false)
    const [descargando, setDescargando] = useState(false)
    const [confirmarLote, setConfirmarLote] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)

    const imagenes: ImagenAlmacenamiento[] = useMemo(
        () => listado?.imagenes ?? [],
        [listado],
    )
    const pesoSeleccionado = useMemo(
        () =>
            imagenes
                .filter(i => seleccionadas.has(i.url))
                .reduce((acc, i) => acc + i.bytes, 0),
        [imagenes, seleccionadas],
    )
    const pct = uso ? Math.min(100, Math.max(0, uso.porcentaje)) : 0
    const colorBarra = uso ? colorEstado(pct, uso.excedido) : "#43a047"

    function toggle(url: string, liberable: boolean) {
        if (!liberable) return
        setMensaje(null)
        setSeleccionadas(prev => {
            const next = new Set(prev)
            if (next.has(url)) {
                next.delete(url)
            } else if (next.size < MAX_POR_LOTE) {
                next.add(url)
            }
            return next
        })
    }

    async function liberarSeleccionadas() {
        setLiberando(true)
        setMensaje(null)
        try {
            const respuesta = await almacenamientoApi.liberarUrls([...seleccionadas])
            const fallidas = (respuesta.resultados || []).filter(r => !r.ok)
            setMensaje({
                tipo: fallidas.length ? "error" : "ok",
                texto: fallidas.length
                    ? `Se liberaron ${respuesta.liberadas} imágenes; ${fallidas.length} fallaron (${fallidas[0].mensaje ?? "error"}).`
                    : `Se liberaron ${respuesta.liberadas} imágenes. Tu espacio se actualizó.`,
            })
            setSeleccionadas(new Set())
            setConfirmarLote(false)
            await queryClient.invalidateQueries({ queryKey: ["uso-almacenamiento"] })
            await refetch()
        } catch (e) {
            setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "Error al liberar imágenes" })
        } finally {
            setLiberando(false)
        }
    }

    async function descargarRespaldo() {
        setDescargando(true)
        setMensaje(null)
        try {
            await descargarRespaldoCompleto()
            setMensaje({ tipo: "ok", texto: "Respaldo descargado (datos + fotos en ZIP)." })
        } catch (e) {
            setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "Error al descargar el respaldo" })
        } finally {
            setDescargando(false)
        }
    }

    const desglose = uso?.desglose ?? {}

    return (
        <div style={{ minHeight: "100vh" }}>
            <PageHeader
                gradiente="var(--gradient-4)"
                agColor="var(--ag-color-4)"
                subtitulo="ALMACENAMIENTO"
                subtituloStyle={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}
                titulo="Espacio"
                icono="HardDrive"
                iconoEncerrado
                iconoColor="var(--primary-soft)"
                tituloClase="hidden md:flex"
                tituloStyle={{ color: "var(--primary-soft)", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", alignItems: "center", gap: 10 }}
            />

            <div style={{ padding: "0 16px 40px", maxWidth: 900, margin: "-60px auto 0", position: "relative", zIndex: 1 }}>

                {/* ── Resumen del medidor ── */}
                <div style={{
                    background: "var(--bg-card)",
                    borderRadius: 16,
                    padding: 18,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                }}>
                    {uso && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                                <div>
                                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-main, #222)" }}>
                                        {fmtPeso(uso.bytes_usados)}
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-label, #777)" }}>
                                        de {fmtPeso(uso.limite_bytes)} · plan {uso.nombre}
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: "0.8rem", fontWeight: 800,
                                    color: uso.excedido ? "#e53935" : colorBarra,
                                    background: uso.excedido ? "#fdecea" : "rgba(0,0,0,0.04)",
                                    padding: "6px 10px", borderRadius: 10,
                                }}>
                                    {uso.excedido
                                        ? `Excedido por ${fmtPeso(uso.bytes_usados - uso.limite_bytes)}`
                                        : `Te quedan ${fmtPeso(uso.quedan_bytes)}`}
                                </div>
                            </div>
                            <div style={{ height: 10, borderRadius: 5, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                                <div style={{
                                    width: `${pct}%`, height: "100%", borderRadius: 5,
                                    background: colorBarra, transition: "width 0.4s ease",
                                }} />
                            </div>
                            {uso.excedido && (
                                <p style={{ margin: "12px 0 0", fontSize: "0.8rem", color: "#b71c1c" }}>
                                    Tu espacio está lleno: no podrás subir imágenes nuevas hasta liberar
                                    espacio o mejorar a Plus. Tus datos y tu operación siguen intactos.
                                </p>
                            )}

                            {/* ── Desglose por categoría (texto, sin fotos) ── */}
                            {Object.keys(desglose).length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                                    {Object.entries(desglose).map(([clave, bytes]) => (
                                        <span key={clave} style={{
                                            fontSize: "0.72rem", fontWeight: 700,
                                            color: "var(--text-main, #333)",
                                            background: "rgba(0,0,0,0.05)",
                                            padding: "6px 10px", borderRadius: 10,
                                        }}>
                                            {ETIQUETAS_DESGLOSE[clave] ?? clave}: {fmtPeso(Number(bytes))}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                        <button
                            onClick={() => setLiberarAbierto(v => !v)}
                            style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "10px 14px", borderRadius: 12,
                                border: "1.5px solid var(--border-primary, rgba(0,0,0,0.12))",
                                background: "none", cursor: "pointer",
                                fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-icons, #555)",
                            }}
                        >
                            <Icon name="Eraser" size={16} />
                            {liberarAbierto ? "Ocultar lista de fotos" : "Liberar espacio"}
                        </button>
                        <button
                            onClick={descargarRespaldo}
                            disabled={descargando}
                            style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "10px 14px", borderRadius: 12,
                                border: "1.5px solid var(--border-primary, rgba(0,0,0,0.12))",
                                background: "none", cursor: descargando ? "wait" : "pointer",
                                fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-icons, #555)",
                            }}
                        >
                            <Icon name="Download" size={16} />
                            {descargando ? "Preparando respaldo…" : "Descargar respaldo completo"}
                        </button>
                        <a
                            href="/personalizacion"
                            style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "10px 14px", borderRadius: 12,
                                textDecoration: "none",
                                border: "1.5px solid var(--border-primary, rgba(0,0,0,0.12))",
                                fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-icons, #555)",
                            }}
                        >
                            <Icon name="TrendingUp" size={16} />
                            Mejorar a Plus ({fmtPeso(10 * GB)})
                        </a>
                    </div>
                </div>

                {/* ── Mensaje de resultado ── */}
                {mensaje && (
                    <div style={{
                        marginTop: 14, padding: "10px 14px", borderRadius: 12,
                        fontSize: "0.8rem", fontWeight: 600,
                        background: mensaje.tipo === "ok" ? "#e8f5e9" : "#fdecea",
                        color: mensaje.tipo === "ok" ? "#1b5e20" : "#b71c1c",
                    }}>
                        {mensaje.texto}
                    </div>
                )}

                {/* ── Lista de imágenes: SOLO bajo demanda ── */}
                {liberarAbierto && (
                    <div style={{
                        background: "var(--bg-card)", borderRadius: 16, marginTop: 14,
                        boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden",
                    }}>
                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)",
                        }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main, #222)" }}>
                                Marca las fotos que ya no quieres
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-label, #777)" }}>
                                {isFetching ? "Actualizando…" : "Las más pesadas primero · máx 50 por lote"}
                            </span>
                        </div>

                        {isLoading && (
                            <p style={{ padding: 24, fontSize: "0.85rem", color: "var(--text-label, #777)" }}>
                                Cargando tu inventario de imágenes…
                            </p>
                        )}
                        {isError && (
                            <p style={{ padding: 24, fontSize: "0.85rem", color: "#b71c1c" }}>
                                No se pudo cargar el inventario. Inténtalo de nuevo.
                            </p>
                        )}
                        {!isLoading && !isError && imagenes.length === 0 && (
                            <p style={{ padding: 24, fontSize: "0.85rem", color: "var(--text-label, #777)" }}>
                                No hay imágenes registradas en tu espacio.
                            </p>
                        )}

                        {imagenes.slice(0, visibles).map(img => (
                            <label key={img.url} style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "10px 16px",
                                borderBottom: "1px solid rgba(0,0,0,0.04)",
                                cursor: img.liberable ? "pointer" : "default",
                                opacity: img.liberable ? 1 : 0.65,
                            }}>
                                <input
                                    type="checkbox"
                                    checked={seleccionadas.has(img.url)}
                                    disabled={!img.liberable || liberando}
                                    onChange={() => toggle(img.url, img.liberable)}
                                    style={{ width: 18, height: 18, accentColor: colorBarra, flexShrink: 0 }}
                                />
                                <img
                                    src={thumbUrl(img.url)}
                                    alt=""
                                    loading="lazy"
                                    style={{
                                        width: 52, height: 52, borderRadius: 10,
                                        objectFit: "cover", background: "rgba(0,0,0,0.05)", flexShrink: 0,
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: "0.82rem", fontWeight: 700,
                                        color: "var(--text-main, #222)",
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                    }}>
                                        {img.contexto}
                                    </div>
                                    <div style={{ fontSize: "0.7rem", color: "var(--text-label, #777)" }}>
                                        {img.fuente}
                                        {!img.liberable && " · se actualiza republicando tu catálogo"}
                                    </div>
                                </div>
                                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-label, #555)", flexShrink: 0 }}>
                                    {img.bytes > 0 ? fmtPeso(img.bytes) : "—"}
                                </span>
                            </label>
                        ))}

                        {imagenes.length > visibles && (
                            <button
                                onClick={() => setVisibles(v => v + POR_PAGINA)}
                                style={{
                                    width: "100%", padding: 14, border: "none", background: "none",
                                    fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
                                    color: "var(--primary-icons, #555)",
                                }}
                            >
                                Mostrar más ({imagenes.length - visibles} restantes)
                            </button>
                        )}

                        <p style={{ padding: "10px 16px 14px", margin: 0, fontSize: "0.72rem", color: "var(--text-label, #777)" }}>
                            Si publicas catálogo desde el Modo Local, republica después de liberar
                            fotos para que tu catálogo online use las URLs nuevas.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Barra de acción con selección ── */}
            {liberarAbierto && seleccionadas.size > 0 && (
                <div style={{
                    position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
                    zIndex: 300, display: "flex", alignItems: "center", gap: 12,
                    background: "var(--bg-card, #fff)", borderRadius: 14,
                    padding: "10px 14px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
                    maxWidth: "92vw",
                }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main, #222)" }}>
                        {seleccionadas.size} seleccionadas · {fmtPeso(pesoSeleccionado)}
                    </div>
                    <button
                        onClick={() => setConfirmarLote(true)}
                        disabled={liberando}
                        style={{
                            padding: "10px 16px", borderRadius: 12, border: "none",
                            background: "#e53935", color: "#fff",
                            fontSize: "0.8rem", fontWeight: 800, cursor: liberando ? "wait" : "pointer",
                        }}
                    >
                        {liberando ? "Liberando…" : "Liberar espacio"}
                    </button>
                    <button
                        onClick={() => setSeleccionadas(new Set())}
                        disabled={liberando}
                        style={{
                            padding: "10px 12px", borderRadius: 12, border: "none",
                            background: "rgba(0,0,0,0.06)", color: "var(--text-main, #222)",
                            fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
                        }}
                    >
                        Cancelar
                    </button>
                </div>
            )}

            {/* ── Confirmación del lote ── */}
            {confirmarLote && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 400,
                    background: "rgba(0,0,0,0.45)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 16,
                }}>
                    <div style={{
                        background: "var(--bg-card, #fff)", borderRadius: 16,
                        padding: 22, maxWidth: 420, width: "100%",
                    }}>
                        <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-main, #222)", marginBottom: 8 }}>
                            ¿Liberar {seleccionadas.size} imágenes ({fmtPeso(pesoSeleccionado)})?
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-label, #555)", margin: "0 0 16px" }}>
                            Se quitarán de tus productos/galería, se borrarán de la nube y tu
                            espacio se liberará de inmediato. Esta acción no se puede deshacer
                            (descarga tu respaldo antes si no estás seguro).
                        </p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setConfirmarLote(false)}
                                style={{
                                    padding: "10px 14px", borderRadius: 12, border: "none",
                                    background: "rgba(0,0,0,0.06)", fontWeight: 700,
                                    fontSize: "0.8rem", cursor: "pointer",
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={liberarSeleccionadas}
                                disabled={liberando}
                                style={{
                                    padding: "10px 14px", borderRadius: 12, border: "none",
                                    background: "#e53935", color: "#fff", fontWeight: 800,
                                    fontSize: "0.8rem", cursor: liberando ? "wait" : "pointer",
                                }}
                            >
                                {liberando ? "Liberando…" : "Sí, liberar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
