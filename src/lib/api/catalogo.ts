import { request } from "./client"
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
        banner_url?: string
        banner_url_movil?: string
        hero_estilo?: string
        banner_texto_color?: string
        banner_mostrar_texto?: boolean
        banner_mostrar_logo?: boolean
        anuncio_texto?: string
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
