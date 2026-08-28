import { api, type CatalogoConfig, type Categoria, type Gasto, type Lote, type Orden, type Producto, type Venta } from "@/lib/api"

// La identidad del tenant forma parte de cada clave para que una sesión no
// pueda reutilizar accidentalmente datos cacheados de otro negocio.
export const inventarioQueryKeys = {
    productos: (tenantId: string) => ["inventario", tenantId] as const,
    lotes: (tenantId: string) => ["lotes", tenantId] as const,
    categorias: (tenantId: string) => ["categorias", tenantId] as const,
    configCatalogo: (tenantId: string) => ["config-catalogo", tenantId] as const,
    ventas: (tenantId: string) => ["ventas", tenantId] as const,
    ordenes: (tenantId: string) => ["ordenes", tenantId] as const,
    gastos: (tenantId: string) => ["gastos", tenantId] as const,
    categoriasGasto: (tenantId: string) => ["categorias-gasto", tenantId] as const,
}

// Conserva el comportamiento existente: si las tablas aún no existen, se
// inicializa la base y se repite la consulta una sola vez.
async function conReintentoInitDB<T>(consulta: () => Promise<T>): Promise<T> {
    try {
        return await consulta()
    } catch (error) {
        await api.initDB()
        return consulta()
    }
}

export function obtenerInventario(): Promise<Producto[]> {
    return conReintentoInitDB(() => api.getInventario())
}

export function obtenerLotes(): Promise<Lote[]> {
    return conReintentoInitDB(() => api.getLotes())
}

export function obtenerCategorias(): Promise<Categoria[]> {
    return api.getCategorias()
}

export function obtenerConfigCatalogo(): Promise<CatalogoConfig> {
    return api.getConfigCatalogo()
}

export function obtenerVentas(): Promise<Venta[]> {
    return api.getVentas()
}

export function obtenerOrdenes(): Promise<Orden[]> {
    return api.getOrdenes()
}

export function obtenerGastos(): Promise<Gasto[]> {
    return api.getGastos()
}

const CATEGORIAS_GASTO_DEFAULT = ["Evento", "Decoración", "Materiales", "Alimentos", "Envíos", "Otros"]

export async function obtenerCategoriasGasto(): Promise<{ id: string; nombre: string }[]> {
    const categorias = await api.getCategoriasGasto()
    if (categorias.length === 0) {
        await Promise.all(CATEGORIAS_GASTO_DEFAULT.map(nombre => api.crearCategoriaGasto(nombre).catch(() => {})))
        return api.getCategoriasGasto()
    }
    return categorias
}
