// ==============================================================================
// src/lib/local/repos/catalogo.ts
// Carga de datos para el CATÁLOGO IMPRIMIBLE en Modo Local: nada de red,
// todo lee IndexedDB (perfil de identidad + categorías visibles + productos
// visibles con su precio consolidado, igual que getInventario).
// ==============================================================================

import { abrirDB } from "../db"
import { getInventario } from "./inventario"
import type { Producto } from "@/types"

export interface CategoriaCatalogo {
    nombre: string
    orden: number
}

export interface CargaCatalogo {
    // Identidad del negocio (perfil local; logo/foto = dataURL)
    empresa: string
    logo: string
    telefono: string
    correo: string
    instagram: string
    facebook: string
    tiktok: string
    sitio_web: string
    maps: string
    // Categorías visibles para catálogo, ya ordenadas (drag & drop)
    categorias: CategoriaCatalogo[]
    // Productos visibles (estado Activo, visible_en_catalogo ≠ false,
    // y con al menos una categoría visible; sin categorías van a "Otros")
    productos: Producto[]
}

export async function getCargaCatalogo(): Promise<CargaCatalogo> {
    const d = abrirDB()
    const [perfil, inventario] = await Promise.all([
        d.perfil.get(1),
        getInventario(),
    ])

    // Categorías visibles ordenadas (orden numérico; faltantes al final)
    const catFilas = await d.categorias.toArray()
    const visibles = catFilas
        .filter(c => c.visible_en_catalogo !== false)
        .sort((a, b) =>
            ((a.orden ?? 999) - (b.orden ?? 999)) || a.nombre.localeCompare(b.nombre))
    const nombresVisibles = new Set(visibles.map(c => c.nombre))

    // Productos del catálogo (mismo criterio del catálogo público: quien
    // NO marcó visible_en_catalogo sale del listado impreso)
    const productos = inventario
        .filter(p =>
            p.visible_en_catalogo !== false &&
            (!p.categoria?.length || p.categoria.some(c => nombresVisibles.has(c))))
        .sort((a, b) => a.producto.localeCompare(b.producto))

    return {
        empresa: perfil?.empresa || "",
        logo: perfil?.logo || "",
        telefono: perfil?.telefono || "",
        correo: perfil?.correo || "",
        instagram: perfil?.instagram || "",
        facebook: perfil?.facebook || "",
        tiktok: perfil?.tiktok || "",
        sitio_web: perfil?.sitio_web || "",
        maps: perfil?.maps || "",
        categorias: visibles.map(c => ({ nombre: c.nombre, orden: c.orden ?? 999 })),
        productos,
    }
}
