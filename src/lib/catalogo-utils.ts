// ==============================================================================
// src/lib/catalogo-utils.ts
// Utilidades compartidas entre los templates del catálogo público:
// agrupación de productos por categoría, orden de secciones y emojis.
// ==============================================================================

/**
 * Agrupa productos por categoría con fallback para productos sin categoría.
 * Si un producto tiene categoria = null, [] o string vacío, se agrupa
 * bajo la sección "Sin categoría" para que nunca desaparezca del catálogo.
 */
export function agruparPorCategoria<T extends { categoria?: string[] | null }>(productos: T[]): Record<string, T[]> {
    return productos.reduce((acc, prod) => {
        const cats = Array.isArray(prod.categoria) && prod.categoria.length > 0
            ? prod.categoria
            : ["Sin categoría"]

        cats.forEach(cat => {
            if (!acc[cat]) acc[cat] = []
            acc[cat].push(prod)
        })
        return acc
    }, {} as Record<string, T[]>)
}

/**
 * Ordena las categorías alfabéticamente (es, sin diferenciar mayúsculas),
 * dejando "Sin categoría" siempre al final.
 */
export function ordenarCategorias(categorias: string[]): string[] {
    return [...categorias].sort((a, b) => {
        if (a === "Sin categoría") return 1
        if (b === "Sin categoría") return -1
        return a.localeCompare(b, "es", { sensitivity: "base" })
    })
}

/**
 * Icono emoji para cada categoría basado en palabras clave.
 * Si no encuentra coincidencia, devuelve un genérico.
 */
export function emojiParaCategoria(categoria: string): string {
    const lower = categoria.toLowerCase()
    if (/(café|cafe|espresso|capuchino|latte|americano|moka)/.test(lower)) return "☕"
    if (/(bebida|refresco|soda|jugo|agua|malteada|frapp|smoothie|té|te|infusión|infusion)/.test(lower)) return "🥤"
    if (/(postre|pastel|pastelería|pasteleria|helado|dulce|galleta|brownie|cheesecake|pay|tarta)/.test(lower)) return "🍰"
    if (/(comida|platillo|entrada|ensalada|sopa|guarnición|guarnicion|pasta|hamburguesa|taco|burrito|pizza)/.test(lower)) return "🍽️"
    if (/(carne|pollo|cerdo|res|pescado|marisco|camarón|camaron|filete|parrilla|asado)/.test(lower)) return "🥩"
    if (/(botana|snack|papas|nachos|totopos)/.test(lower)) return "🥨"
    if (/(cerveza|vino|licor|cóctel|coctel|ron|whisky|vodka)/.test(lower)) return "🍷"
    if (/(desayuno|huevo|hotcake|panqueque|chilaquil|omelette)/.test(lower)) return "🌅"
    if (/(juguete|peluche|muñeco|muñeca|figura|acción|accion|lego|rompecabezas|bloque|carro|robot|oso|pelota)/.test(lower)) return "🧸"
    if (/(bolsa|mochila|riñonera|rinonera|cartera|monedero|neceser|tote|morral)/.test(lower)) return "👜"
    if (/(ropa|camisa|playera|pantalón|pantalon|vestido|short|suéter|sueter|hoodie|calcetín|calcetin|gorra|sombrero|bufanda|pijama)/.test(lower)) return "👕"
    if (/(zapato|tenis|sandalias|botas|chancla)/.test(lower)) return "👟"
    if (/(accesorio|arete|pulsera|collar|anillo|reloj|diadema|ligas|pinza|broche)/.test(lower)) return "💍"
    if (/(cuidado|cosmético|cosmetico|maquillaje|crema|perfume|jabón|jabon|shampoo|belleza|uñas|unas|labial|esmalte)/.test(lower)) return "💄"
    if (/(hogar|decoración|decoracion|vela|almohada|cobija|taza|vaso|plato|jarra|organizador|colgante)/.test(lower)) return "🏠"
    if (/(electrónico|electronico|celular|audífono|audifono|auricular|cargador|cable|pantalla|bocina|reloj|gadget)/.test(lower)) return "📱"
    if (/(papelería|papeleria|libreta|lapicera|pluma|lápiz|lapiz|marcador|escolar|sticker|calcomanía|calcomania|cuaderno|adorno)/.test(lower)) return "📚"
    return "●"
}
