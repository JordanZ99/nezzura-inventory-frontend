import { request, BASE_URL, ApiError } from "./client"
import { invalidarUsoAlmacenamiento } from "@/lib/query-client"
import { obtenerLicencia } from "@/lib/local/licencia"
import type { CatalogoConfig, PostConfig } from "@/types"

export const catalogoApi = {
    // Configuración general del catálogo (gestión privada)
    getConfigCatalogo: () => request<CatalogoConfig>("/catalogo_gestion"),
    actualizarConfigCatalogo: (data: {
        activo?: boolean
        tema?: string
        template?: string
        titulo?: string
        subtitulo?: string
        mostrar_precios?: boolean
        mostrar_stock?: boolean
        mostrar_categorias?: boolean
        agrupar_por_categoria?: boolean
        columnas_movil?: number
        permitir_descarga?: boolean
        ocultar_agotados?: boolean
        relacion_imagen?: string
        /** Fuente display (migración 044) */
        fuente?: string
        banner_url?: string
        banner_url_movil?: string
        hero_estilo?: string
        banner_texto_color?: string
        banner_mostrar_texto?: boolean
        banner_mostrar_logo?: boolean
        /** Iconos de redes sobre el banner (migración 059) */
        banner_mostrar_redes?: boolean
        anuncio_texto?: string
        /** Fondo del catálogo con imagen (migración 045) */
        fondo_url?: string
        fondo_modo?: string
        fondo_opacidad?: number
        fondo_color?: string
        /** Portada Hero (migración 047) */
        hero_url?: string
        hero_url_movil?: string
        hero_color?: string
        hero_opacidad?: number
        /** Layout del hero (migración 049): parche parcial sobre el jsonb.
         *  elementos: mini-canva (Fase 2) — el editor manda el array COMPLETO. */
        hero_layout?: import("@/types").HeroLayout
    }) =>
        request<{ ok: boolean; mensaje: string }>("/catalogo_gestion", {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    // Defaults de posts del negocio (Posts Automáticos)
    getPostConfig: () => request<PostConfig>("/catalogo_gestion/post_config"),
    actualizarPostConfig: (data: {
        template_default?: string
        font?: string
        posicion?: string
        mostrar?: { nombre?: boolean; precio?: boolean; negocio?: boolean }
        color_primario?: string
        color_secundario?: string
    }) =>
        request<{ ok: boolean; mensaje: string }>("/catalogo_gestion/post_config", {
            method: "PUT",
            body: JSON.stringify(data),
        }),
}

// ============================================================================
// Publish del catálogo desde el MODO LOCAL (plan local, $99/mes)
//
// Autenticación por LICENCIA de dispositivo (JWT HS256), NO sesión Supabase:
// el dispositivo local no tiene sesión — el tenant_id sale del token en el
// backend (tenant_de_licencia). Por eso es fetch manual en vez de request()
// (que agrega headers de Supabase) — mismo patrón que subirFoto en productos.ts.
// ============================================================================

/** Una fila del delta: '__config__' o un producto. data=null ⇒ borrar. */
export interface FilaDelta {
    clave: string
    hash: string
    data?: Record<string, unknown> | null
    orden?: number
}

export interface RespuestaDelta {
    ok: boolean
    aplicadas: number
    eliminadas: number
    slug: string
}

/** Envía el delta del catálogo local (filas + borrados) al backend. */
export async function publicarDeltaCatalogo(filas: FilaDelta[]): Promise<RespuestaDelta> {
    const lic = obtenerLicencia()
    if (!lic) throw new ApiError("Sin licencia de dispositivo.", { status: 401, codigo: "LICENCIA_AUSENTE" })
    const res = await fetch(`${BASE_URL}/catalogo-publicado/delta`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lic.token}` },
        body: JSON.stringify({ filas }),
    })
    if (!res.ok) {
        const cuerpo = await res.json().catch(() => null)
        const detalle = typeof cuerpo?.detail === "string" ? cuerpo.detail : undefined
        throw new ApiError(detalle || `Error publicando el catálogo (${res.status}).`, { status: res.status })
    }
    return res.json() as Promise<RespuestaDelta>
}

/** Sube UNA foto (dataURL→Blob) del catálogo local a Cloudinary. */
export async function publicarFotoCatalogo(nombre: string, foto: Blob): Promise<{ ok: boolean; ruta: string }> {
    const lic = obtenerLicencia()
    if (!lic) throw new ApiError("Sin licencia de dispositivo.", { status: 401, codigo: "LICENCIA_AUSENTE" })
    const formData = new FormData()
    formData.append("foto", foto, "foto.jpg")
    formData.append("nombre", nombre)
    const res = await fetch(`${BASE_URL}/catalogo-publicado/foto`, {
        method: "POST",
        headers: { Authorization: `Bearer ${lic.token}` },
        body: formData,
    })
    if (!res.ok) {
        const cuerpo = await res.json().catch(() => null)
        const detalle = typeof cuerpo?.detail === "string" ? cuerpo.detail : undefined
        throw new ApiError(detalle || `Error subiendo la foto (${res.status}).`, { status: res.status })
    }
    invalidarUsoAlmacenamiento()  // el peso del tenant acaba de cambiar
    return res.json() as Promise<{ ok: boolean; ruta: string }>
}
