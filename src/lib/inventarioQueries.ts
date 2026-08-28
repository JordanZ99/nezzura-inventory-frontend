import { api, type CatalogoConfig, type Categoria, type Gasto, type Lote, type Orden, type Producto, type Terminal, type Venta } from "@/lib/api"

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
    terminales: (tenantId: string) => ["terminales", tenantId] as const,
}

// Marcador que emite el backend cuando el error es exactamente SQLSTATE
// 42P01 (tabla inexistente). Cualquier otro fallo (timeout de cold start,
// red, 5xx, pool agotado) NO debe disparar /init-db: si 5 queries fallan en
// paralelo, serían 5 corridas concurrentes de migraciones DDL contra la DB.
const CODIGO_DB_SIN_TABLAS = "DB_NO_INICIALIZADA"
const SQLSTATE_TABLA_INEXISTENTE = "42P01"

function esErrorTablaInexistente(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    const e = error as Error & { codigo?: string; sqlstate?: string }
    return e.codigo === CODIGO_DB_SIN_TABLAS || e.sqlstate === SQLSTATE_TABLA_INEXISTENTE
}

// Conserva el comportamiento original SOLO para el caso real de tablas
// faltantes: se inicializa la base y se repite la consulta una sola vez.
// Con las migraciones corriendo en el arranque del backend (evento startup,
// que se ejecuta en cada deploy), este caso es excepcional.
async function conReintentoInitDB<T>(consulta: () => Promise<T>): Promise<T> {
    try {
        return await consulta()
    } catch (error) {
        if (!esErrorTablaInexistente(error)) throw error
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

export function obtenerTerminales(): Promise<Terminal[]> {
    return api.getTerminales()
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
