// ==============================================================================
// src/lib/catalogo-fuentes.ts
// Set curado de fuentes "display" del catálogo público (migración 044).
// Solo se aplican a nombres, precios, títulos de sección y hero; el resto
// (descripciones, stock, UI) queda en la sans neutra por contraste visual.
//
// 'serif' es el default de TODOS los catálogos (la serif elegante del Menú
// Carta). Las claves con googleCss cargan su CSS de Google Fonts en el
// catálogo bajo demanda. Claves válidas también en el backend
// (_FUENTES_CATALOGO en routers/catalogo_gestion.py).
// ==============================================================================

export interface FuenteCatalogo {
    /** Clave almacenada en catalogo_config.fuente */
    key: string
    /** Etiqueta para el selector del gestor */
    label: string
    /** Font stack CSS (con fallbacks nativos) */
    stack: string
    /** CSS2 de Google Fonts a inyectar en <head> (opcional) */
    googleCss?: string
    /** Descripción informativa del selector */
    desc: string
    /**
     * Compensación óptica (1 = neutral): aplica como multiplicador al tamaño
     * de las fuentes display (--fd-scale). Existen fuentes con x-height chica
     * (Cormorant Garamond se ve pequeña al mismo px que una sans) → +escala;
     * las geométricas grandes (Poppins/Baloo) → −escala.
     */
    escala: number
}

export const FUENTES_CATALOGO: Record<string, FuenteCatalogo> = {
    sistema: {
        key: "sistema",
        label: "Actual (sin display)",
        stack: "inherit",
        desc: "La sans neutral del catálogo — default para todos los negocios.",
        escala: 1,
    },
    serif: {
        key: "serif",
        label: "Elegante (serif)",
        stack: "Georgia, 'Times New Roman', serif",
        desc: "La serif clásica del Menú Carta, ahora opcional.",
        escala: 1.02,
    },
    playfair: {
        key: "playfair",
        label: "Playfair Display",
        stack: "'Playfair Display', Georgia, serif",
        googleCss: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&display=swap",
        desc: "Restaurante fino",
        escala: 1.06,
    },
    cormorant: {
        key: "cormorant",
        label: "Cormorant Garamond",
        stack: "'Cormorant Garamond', Georgia, serif",
        googleCss: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap",
        desc: "Restaurante editorial (más aire)",
        escala: 1.18,
    },
    poppins: {
        key: "poppins",
        label: "Poppins",
        stack: "'Poppins', system-ui, sans-serif",
        googleCss: "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&display=swap",
        desc: "Moderno amable (cafeterías, food trucks)",
        escala: 0.96,
    },
    quicksand: {
        key: "quicksand",
        label: "Quicksand",
        stack: "'Quicksand', system-ui, sans-serif",
        googleCss: "https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700&display=swap",
        desc: "Redondita amigable (cute con sobriedad)",
        escala: 1.02,
    },
    oswald: {
        key: "oswald",
        label: "Oswald",
        stack: "'Oswald', system-ui, sans-serif",
        googleCss: "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap",
        desc: "Rústico condensado (parrilla, taquería)",
        escala: 1.1,
    },
    baloo2: {
        key: "baloo2",
        label: "Baloo 2",
        stack: "'Baloo 2', system-ui, sans-serif",
        googleCss: "https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap",
        desc: "Artesanal chunky (torterías, dulces)",
        escala: 0.95,
    },
}

/** Orden de presentación en el selector del gestor */
export const FUENTES_ORDEN = [
    "sistema", "serif", "playfair", "cormorant", "poppins", "quicksand", "oswald", "baloo2",
]

/** Normaliza cualquier valor de config a una opción válida ('sistema' fallback). */
export function normalizarFuente(fuente: string | null | undefined): FuenteCatalogo {
    if (fuente && FUENTES_CATALOGO[fuente]) return FUENTES_CATALOGO[fuente]
    return FUENTES_CATALOGO.sistema
}
