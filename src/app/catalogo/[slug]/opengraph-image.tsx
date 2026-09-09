// ==============================================================================
// src/app/catalogo/[slug]/opengraph-image.tsx
// Genera la imagen del preview al compartir el catálogo (WhatsApp, Facebook...).
// Tarjeta 1200×630 con el gradiente del tema del catálogo, el logo y el nombre
// del negocio. Next.js la sirve en .../catalogo/{slug}/opengraph-image y la
// inyecta automáticamente como <meta property="og:image">.
// ==============================================================================

import { ImageResponse } from "next/og"
import { normalizarTema } from "@/lib/temas"

export const alt = "Catálogo"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export const runtime = "edge" // edge: evita el bug de @vercel/og con rutas de archivo en Windows (Node runtime)

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

// Mismas paletas que los temas del catálogo (CatalogoView.tsx)
const TEMAS: Record<string, { from: string; to: string }> = {
    default: { from: "#3a7dbf", to: "#5e87a4" },
    midnightSlate: { from: "#1f2321", to: "#1e6456" },
    strawberry: { from: "#f33376", to: "#fa30df" },
    cozyYellow: { from: "#ffd05b", to: "#eb7456" },
    botanical: { from: "#24a85b", to: "#5ec967" },
    cottonCandy: { from: "#f472b6", to: "#7dd3fc" },
}

interface ConfigCatalogo {
    titulo?: string
    subtitulo?: string
    logo?: string
    tema?: string
}

async function obtenerConfig(slug: string): Promise<ConfigCatalogo | null> {
    try {
        const res = await fetch(`${API_URL}/public/catalogo/${encodeURIComponent(slug)}`, {
            cache: "no-store",
        })
        if (!res.ok) return null
        const data = (await res.json()) as { config: ConfigCatalogo }
        return data?.config ?? null
    } catch {
        return null
    }
}

/**
 * Satori (el motor de next/og en Next 14) no decodifica WebP. Como el logo
 * del tenant puede estar en WebP (u otro formato), pedimos a Cloudinary que
 * lo entregue como PNG al vuelo. Solo aplica a URLs de Cloudinary.
 */
function logoComoPng(url: string): string {
    try {
        const u = new URL(url)
        if (!u.hostname.includes("res.cloudinary.com")) return url
        // f_auto entregaría el formato original: lo quitamos para forzar PNG
        u.pathname = u.pathname.replace(/f_auto,?|,f_auto/g, "")
        if (/\.[a-zA-Z0-9]{2,4}$/.test(u.pathname)) {
            // Cambiar la extensión hace que Cloudinary convierta el formato
            u.pathname = u.pathname.replace(/\.[a-zA-Z0-9]{2,4}$/, ".png")
        } else {
            // Sin extensión: insertamos la transformación f_png
            u.pathname = u.pathname.replace(/\/image\/upload\//, "/image/upload/f_png/")
        }
        return u.toString()
    } catch {
        return url
    }
}

export default async function ImagenPreview({ params }: { params: { slug: string } }) {
    const config = await obtenerConfig(params.slug)

    const titulo = config?.titulo?.trim() || "Catálogo"
    const subtitulo = config?.subtitulo?.trim() || ""
    const gradiente = TEMAS[normalizarTema(config?.tema)] ?? TEMAS.default
    const logo = config?.logo || null

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(135deg, ${gradiente.from} 0%, ${gradiente.to} 100%)`,
                    fontFamily: "sans-serif",
                }}
            >
                {logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={logoComoPng(logo)}
                        width={300}
                        height={300}
                        alt=""
                        style={{
                            borderRadius: 999,
                            objectFit: "cover",
                            border: "8px solid rgba(255,255,255,0.92)",
                        }}
                    />
                )}
                <div
                    style={{
                        fontSize: 68,
                        fontWeight: 800,
                        color: "#ffffff",
                        marginTop: logo ? 36 : 0,
                        padding: "0 64px",
                        textAlign: "center",
                        lineHeight: 1.1,
                    }}
                >
                    {titulo}
                </div>
                {subtitulo && (
                    <div
                        style={{
                            fontSize: 32,
                            fontWeight: 500,
                            color: "rgba(255,255,255,0.92)",
                            marginTop: 18,
                            padding: "0 96px",
                            textAlign: "center",
                        }}
                    >
                        {subtitulo}
                    </div>
                )}
                <div
                    style={{
                        position: "absolute",
                        bottom: 40,
                        fontSize: 24,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.75)",
                    }}
                >
                    Catálogo digital · Nezzura Digital
                </div>
            </div>
        ),
        { ...size }
    )
}
