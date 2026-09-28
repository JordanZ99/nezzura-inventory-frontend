/**
 * Configuración del catálogo público de un tenant.
 */
export interface CatalogoConfig {
    id: number;
    slug: string;
    activo: boolean;
    tema: string;
    template: string;  // 'grid-clasico' | 'menu-carta'
    titulo: string;
    subtitulo: string;
    mostrar_precios: boolean;
    mostrar_stock: boolean;
    mostrar_categorias: boolean;
    agrupar_por_categoria?: boolean;
    columnas_movil?: number;
    permitir_descarga?: boolean;
    ocultar_agotados?: boolean;
    relacion_imagen?: string;  // '1:1' (default) | '4:5' — relación global de las fotos de producto
    /** Fuente display del catálogo (migración 044): 'serif' default; claves en lib/catalogo-fuentes.ts */
    fuente?: string;
    banner_url?: string;
    banner_url_movil?: string;
    hero_estilo?: string;      // 'gradiente' | 'imagen' | 'hero' (pantalla completa)
    banner_texto_color?: string;
    banner_mostrar_texto?: boolean;
    banner_mostrar_logo?: boolean;
    anuncio_texto?: string;
    /** Fondo del catálogo con imagen (migración 045): '' = usa el color del tema */
    fondo_url?: string;
    /** Modo de dibujado: 'cover' (foto completa) | 'repeat' (textura tileada) */
    fondo_modo?: string;
    /** Opacidad de la imagen sobre el color de fondo (0-100) */
    fondo_opacidad?: number;
    /** Color hex bajo la imagen; '' = color del tema */
    fondo_color?: string;
    /** Portada Hero a pantalla completa (migración 047) */
    /** Imagen hero escritorio (crop 16:9, 1920×1080) */
    hero_url?: string;
    /** Imagen hero móvil (crop retrato, 750×1334); '' = usa hero_url centrado */
    hero_url_movil?: string;
    /** Color hex del velo sobre la imagen; '' = gradiente oscuro del tema */
    hero_color?: string;
    /** Opacidad del velo (0-100) */
    hero_opacidad?: number;
    logo?: string;
    created_at?: string;
}

/**
 * Override de la tarjeta de post para un producto (Posts Automáticos, Fase 1).
 * Dict PARCIAL: las claves ausentes se heredan de los defaults del negocio.
 * null en productos.post_override = sin override (usa defaults).
 */
export interface PostOverride {
    template?: string;   // 'marco' | 'overlay'
    font?: string;       // 'moderna' | 'elegante' | 'redondeada'
    posicion?: string;   // 'arriba' | 'abajo'
    mostrar?: { nombre?: boolean; precio?: boolean; negocio?: boolean };
    color_primario?: string;
    color_secundario?: string;
}

/**
 * Defaults de posts del NEGOCIO (tabla post_config).
 * Los productos SIN override usan estos valores automáticamente.
 */
export interface PostConfig {
    tenant_id: string;
    template_default: string;  // 'marco' | 'overlay'
    font: string;
    posicion: string;
    mostrar: { nombre: boolean; precio: boolean; negocio: boolean };
    color_primario?: string;
    color_secundario?: string;
}

export interface Categoria {
    id: string;
    nombre: string;
    slug: string;
    total_productos: number;
    visible_en_catalogo?: boolean;
    /** Posición manual (drag & drop en Personalización > Catálogo). NULL = alfabético al final. */
    orden?: number | null;
}
