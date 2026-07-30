// ==============================================================================
// src/app/catalogo/[slug]/page.tsx
// Catálogo público — componente SERVIDOR.
//
// Su única responsabilidad es:
//   1. Generar metadata dinámica (Open Graph) para crawlers como WhatsApp
//   2. Pasar los datos iniciales al componente cliente CatalogoView
//
// El componente cliente (CatalogoView) maneja toda la interactividad:
// búsqueda, filtros, templates, favicon, etc.
// ==============================================================================

import { fetchCatalogoPublico } from "@/lib/api"
import CatalogoView from "@/components/CatalogoView"
import type { Metadata } from "next"
import type { RespuestaCatalogo } from "@/components/CatalogoView"

interface Props {
    params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    try {
        const data = await fetchCatalogoPublico<RespuestaCatalogo>(params.slug)
        const titulo = data.config.titulo || "Catálogo"
        const descripcion = data.config.subtitulo || "Catálogo de productos"
        const logoUrl = data.config.logo || ""

        return {
            title: titulo,
            description: descripcion,
            openGraph: {
                title: titulo,
                description: descripcion,
                ...(logoUrl ? { images: [{ url: logoUrl, width: 512, height: 512 }] } : {}),
            },
            // También actualizar el theme-color para que la barra del navegador
            // se vea del color del tema del catálogo
            ...(data.config.tema && {
                other: {
                    "theme-color": data.config.tema === "midnightBlack" ? "#0f1419"
                        : data.config.tema === "strawberry" ? "#fff5f7"
                        : data.config.tema === "cozyYellow" ? "#fffef5"
                        : "#f0f3f8",
                }
            }),
        }
    } catch {
        return {
            title: "Catálogo",
            description: "Catálogo de productos",
        }
    }
}

export default async function Page({ params }: Props) {
    try {
        const data = await fetchCatalogoPublico<RespuestaCatalogo>(params.slug)
        return <CatalogoView initialData={data} />
    } catch {
        return <CatalogoView error="Este catálogo no está disponible o no ha sido activado." />
    }
}
