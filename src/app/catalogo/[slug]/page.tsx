// ==============================================================================
// src/app/catalogo/[slug]/page.tsx  —  Server Component (metadata dinámica)
//
// Este archivo es un "envoltorio" servidor para la vista pública del catálogo.
// Hace dos cosas:
//   1. generateMetadata(): consulta el backend (servidor→servidor) y genera
//      los meta tags Open Graph/Twitter con el título, subtítulo y logo del
//      tenant. Así, al compartir el link por WhatsApp/Facebook/Telegram el
//      preview muestra la tienda real y no los datos genéricos de Nezzura.
//   2. Renderiza <CatalogoView />, el Client Component que dibuja el catálogo
//      (mantiene su propio fetch del lado del cliente sin cambios).
//
// La imagen del preview (og:image) la genera opengraph-image.tsx (next/og).
// ==============================================================================

import type { Metadata } from "next"
import CatalogoView from "./CatalogoView"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

const ORIGEN_SITIO =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : "https://nezzura-digital.vercel.app")

interface CatalogoPublico {
    config: {
        titulo?: string
        subtitulo?: string
        logo?: string
    }
}

/**
 * Consulta el endpoint público del catálogo desde el servidor.
 * Devuelve null si el catálogo no existe, está inactivo o hay un error de red.
 */
async function obtenerCatalogoPublico(slug: string): Promise<CatalogoPublico | null> {
    try {
        const res = await fetch(`${API_URL}/public/catalogo/${encodeURIComponent(slug)}`, {
            cache: "no-store",
        })
        if (!res.ok) return null
        return (await res.json()) as CatalogoPublico
    } catch {
        return null
    }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const datos = await obtenerCatalogoPublico(params.slug)
    const config = datos?.config

    const titulo = config?.titulo?.trim() || "Catálogo"
    const descripcion = config?.subtitulo?.trim() || "Descubre nuestros productos"
    const url = `${ORIGEN_SITIO}/catalogo/${params.slug}`

    return {
        title: titulo,
        description: descripcion,
        openGraph: {
            title: titulo,
            description: descripcion,
            type: "website",
            url,
            siteName: titulo,
            // NOTA: la imagen (og:image) la añade automáticamente opengraph-image.tsx
        },
        twitter: {
            card: "summary_large_image",
            title: titulo,
            description: descripcion,
        },
        alternates: { canonical: url },
    }
}

export default function Page({ params }: { params: { slug: string } }) {
    return <CatalogoView slug={params.slug} />
}
