// ==============================================================================
// src/components/personalizacion/CardPublicarCatalogo.tsx
// Tarjeta "Publicar catálogo online" — EL GANCHO del plan local ($99/mes).
//
// Solo se muestra en Modo Local: publica un DELTA del catálogo (productos
// visibles + identidad del negocio) al backend con la licencia del
// dispositivo; las fotos van a Cloudinary (URLs, no dataURLs) y el catálogo
// público se sirve por el /catalogo/{slug} de siempre (Vercel dibujando
// desde datos). Si solo cambió 1 producto, solo 1 fila se sube.
//
// Sin costos: el payload público jamás lleva costo_promedio/costo_unitario/
// costo_servicio (ver repos/catalogo.ts filaProductoPublica).
// ==============================================================================

import { useEffect, useState } from "react"
import Icon from "@/components/ui/Icon"
import { useToast } from "@/components/ui/Toast"
import {
    getEstadoPublicacion, calcularDelta, publicarCatalogo,
    type ProgresoPublish,
} from "@/lib/local/repos/catalogo"

const ORIGEN_SITIO =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : "https://productos.nezzura.digital")

/** "hace 3 días" a partir de un ISO local (YYYY-MM-DDTHH:MM). */
function haceCuando(iso: string | null): string | null {
    if (!iso) return null
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return null
    const min = Math.max(0, Math.floor((Date.now() - t) / 60000))
    if (min < 60) return `hace ${min} min`
    const horas = Math.floor(min / 60)
    if (horas < 24) return `hace ${horas} h`
    const dias = Math.floor(horas / 24)
    if (dias === 1) return "ayer"
    if (dias < 30) return `hace ${dias} días`
    return `hace ${Math.floor(dias / 30)} meses`
}

export function CardPublicarCatalogo() {
    const { mostrarMsg } = useToast()
    const [publicado_en, setPublicadoEn] = useState<string | null>(null)
    const [slug, setSlug] = useState<string | null>(null)
    const [delta, setDelta] = useState<{ cambios: number; borrados: number } | null>(null)
    const [progreso, setProgreso] = useState<ProgresoPublish | null>(null)
    const [ocupado, setOcupado] = useState(false)

    async function recargar() {
        try {
            const [estado, d] = await Promise.all([getEstadoPublicacion(), calcularDelta()])
            setPublicadoEn(estado.publicado_en)
            setSlug(estado.slug)
            setDelta(d)
        } catch {
            // Sin licencia (sesión en proceso de salida): la tarjeta se queda
            // en su estado base; el guard de licencia maneja el resto.
        }
    }

    useEffect(() => { recargar() }, [])

    async function publicar() {
        setOcupado(true)
        setProgreso({ fase: "calculando", fotosTotal: 0, fotosSubidas: 0 })
        try {
            const r = await publicarCatalogo(p => setProgreso(p))
            mostrarMsg(
                true,
                r.aplicadas === 0
                    ? "Tu catálogo ya estaba al día."
                    : `Catálogo publicado: ${r.aplicadas} fila(s)` +
                      (r.fotos ? `, ${r.fotos} foto(s) nueva(s)` : "") + ".",
            )
        } catch (e) {
            mostrarMsg(false, e instanceof Error ? e.message : "Error publicando el catálogo")
        } finally {
            setOcupado(false)
            setProgreso(null)
            recargar()
        }
    }

    const publicadoHace = haceCuando(publicado_en)
    const pendientes = delta ? delta.cambios + delta.borrados : 0
    const nunca = publicado_en === null
    const alDia = !ocupado && delta !== null && pendientes === 0 && !nunca
    const urlCatalogo = slug ? `${ORIGEN_SITIO}/catalogo/${slug}` : null

    const etiquetaFase = progreso
        ? progreso.fase === "fotos"
            ? `Subiendo fotos… ${progreso.fotosSubidas}/${progreso.fotosTotal}`
            : progreso.fase === "delta"
                ? "Subiendo cambios…"
                : "Preparando…"
        : null

    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 380px", maxWidth: 560 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="Globe" size={20} color="var(--primary-dark)" /> Publicar catálogo online
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>
                Comparte tu tienda con un link: tus clientes ven los productos, precios y fotos en un catálogo
                web elegante (con vista previa al compartirlo por WhatsApp). <strong>Solo se sube lo público</strong> —
                tus costos y ganancias se quedan en tu teléfono. Si solo cambió un precio, solo ese cambio viaja.
            </p>

            {/* ── Estado ── */}
            <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 14,
                border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: 4,
            }}>
                {nunca ? (
                    <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                        Aún no has publicado tu catálogo.
                    </span>
                ) : (
                    <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                        Publicado {publicadoHace}.
                    </span>
                )}
                {delta && !nunca && (
                    <span style={{ color: "var(--text-muted)" }}>
                        {alDia
                            ? "Todo al día con tu catálogo local."
                            : `${delta.cambios > 0 ? `${delta.cambios} cambio(s)` : ""}` +
                              `${delta.cambios > 0 && delta.borrados > 0 ? ", " : ""}` +
                              `${delta.borrados > 0 ? `${delta.borrados} producto(s) retirado(s)` : ""} pendiente(s) de publicar.`}
                    </span>
                )}
                {urlCatalogo && publicadoHace && !ocupado && (
                    <a
                        href={urlCatalogo}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--primary-dark)", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                        <Icon name="ExternalLink" size={13} /> Ver catálogo
                    </a>
                )}
            </div>

            {/* ── Progreso de fotos ── */}
            {etiquetaFase && (
                <div style={{ marginBottom: 12, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {etiquetaFase}
                </div>
            )}

            <button
                onClick={publicar}
                disabled={ocupado || alDia}
                className="btn btn-primary"
                style={{ width: "100%", opacity: ocupado || alDia ? 0.6 : 1, cursor: ocupado || alDia ? "not-allowed" : "pointer" }}
            >
                <Icon name={nunca ? "Upload" : "RefreshCw"} size={16} /> {nunca ? "Publicar catálogo" : "Actualizar catálogo"}
            </button>

            {alDia && (
                <p style={{ margin: "10px 0 0", fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center" }}>
                    Tu catálogo online refleja exactamente tu inventario local.
                </p>
            )}
        </div>
    )
}
