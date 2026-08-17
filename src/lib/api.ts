// ==============================================================================
// src/lib/api.ts  — versión con autenticación multitenant
// Agrega el Bearer token de Supabase en cada petición al backend.
// ==============================================================================

import { supabase } from "@/lib/supabase"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

export interface Producto {
    producto: string;
    descripcion: string;
    imagen: string;
    estado: string;
    stock_total: number;
    precio_venta: number;
    // Precio del lote más antiguo con stock (el que PEPS venderá); null/undefined si no aplica
    precio_sugerido?: number;
    // Rango de precios de los lotes con stock (para mostrar variabilidad en el POS)
    precio_min?: number;
    precio_max?: number;
    costo_promedio: number;
    categoria: string[];
    codigo_interno?: string;
    codigo_barras?: string;
    ubicacion?: string;
    visible_en_catalogo?: boolean;
    // Sufijo del precio en el catálogo ("c/u", "por kilo", "por litro", ...); vacío = sin sufijo
    sufijo_precio?: string;
    // Si true, se puede vender por fracciones (0.5 kg, 1.5 lt, ...). Si false
    // (default), solo unidades enteras — ni digitando decimales en el POS.
    fraccionable?: boolean;
    // Tipo de producto: 'stock' (normal) | 'servicio' (sin inventario, ej. corte de cabello)
    tipo_producto?: string;
    // Costo/precio de venta de un servicio (viven en el producto, no en lotes)
    costo_servicio?: number;
    precio_servicio?: number;
    // Variaciones: presentaciones con su PROPIO precio (ej. Sencilla/Doble, S/M/L).
    // Si un producto tiene variaciones, cada una lleva su propio inventario.
    variaciones?: Variacion[];
    // Receta de un producto compuesto (materiales que consume al venderse)
    recetas?: MaterialReceta[];
    // Solo compuestos: cuántas unidades se pueden vender con el stock actual
    // de sus materiales (min sobre la receta). null = sin receta → no estimable.
    disponibilidad_estimada?: number | null;
    // Override de la tarjeta de post de ESTE producto (Posts Automáticos, Fase 1).
    // null/undefined = usa los defaults del negocio (post_config).
    post_override?: PostOverride | null;
}

export interface Variacion {
    id: number;
    nombre: string;
    precio: number;
    // Foto propia de la variación (URL de Cloudinary) — el catálogo la muestra
    // al seleccionar esta presentación (ej. la foto de la Hamburguesa Doble).
    foto?: string;
    // Stock EXCLUSIVO de esta variación (suma de sus lotes).
    stock?: number;
}

/**
 * Material de la receta de un producto compuesto (Fases 3 y 4).
 * Un compuesto (ej. hamburguesa) no tiene stock propio: al venderlo se
 * descuenta `cantidad` de este material (producto de stock).
 *
 * variacion_id: null/undefined = receta BASE; si no, receta de ESA variación
 * (ej. Hamburguesa Doble gasta 200g carne en vez de 100g).
 */
export interface MaterialReceta {
    id: number;
    material: string;   // nombre del material (producto de stock)
    cantidad: number;   // cantidad por unidad del compuesto (permite 0.5, 150, ...)
    variacion_id?: number | null;
    variacion?: string; // nombre de la variación (solo informativo)
}

export interface ItemCarrito {
    producto: string;
    cantidad: number;
    precio_real: number;
    id_lote?: string;
    // Nombre de la variación vendida (ej. "Doble", "S") — cambia el precio
    variacion?: string;
}

export interface Lote {
    id_lote: string;
    producto: string;
    costo: number;
    precio_venta: number;
    stock_lote: number;
    fecha_entrada: string;
    estado: string;
    // Presentación opcional del lote (ej. "20cm", "Premium", "Oferta")
    etiqueta?: string;
    // A qué variación pertenece este lote
    // (null/undefined = stock base del producto, sin variación)
    variacion_id?: number | null;
    variacion?: string;
}

export interface NuevoProducto {
    producto: string;
    descripcion: string;
    costo: number;
    precio_venta: number;
    stock: number;
    imagen?: string;
    categoria?: string[];
    codigo_interno?: string;
    codigo_barras?: string;
    ubicacion?: string;
    etiqueta?: string;
    sufijo_precio?: string;
    fraccionable?: boolean;        // Si true, se vende por fracciones (0.5 kg)
    tipo_producto?: string;        // 'stock' | 'servicio' | 'compuesto'
    costo_servicio?: number;
    precio_servicio?: number;
    // Visible en el catálogo público al crearlo (default true). Solo aplica
    // si el producto es NUEVO; útil para ingredientes que no deben aparecer.
    visible_en_catalogo?: boolean;
    // Variaciones y receta se crean en la MISMA transacción que el producto.
    // Si el producto trae variaciones, TODO el stock vive en lotes por variación
    // (stock_inicial/costo opcionales por variación).
    variaciones?: { nombre: string; precio: number; stock_inicial?: number; costo?: number }[];
    recetas?: { material: string; cantidad: number }[];
}

export interface Restock {
    producto: string;
    costo: number;
    precio_venta: number;
    stock: number;
    etiqueta?: string;
    // Variación a la que llega el stock (obligatoria si el producto tiene variaciones)
    variacion?: string;
}

export interface Venta {
    id: number;
    n_ticket: number;
    fecha: string;
    producto: string;
    cantidad: number;
    precio_lista: number;
    precio_real: number;
    costo_unitario: number;
    total_venta: number;
    ganancia_bruta: number;
    estado: string;
    // 'stock' | 'servicio' — para saber en el historial si la venta consumió inventario
    tipo_producto?: string;
    // Nombre de la variación vendida (ej. "Doble", "S") — vacío = sin variación
    variacion?: string;
    // Consumo real de materiales de una venta COMPUESTA (solo compuestos)
    consumo?: { material: string; id_lote: string | null; cantidad: number; costo: number }[] | null;
}

export interface Gasto {
    id: number;
    fecha: string;
    categoria: string;
    descripcion: string;
    monto: number;
    estado?: string;
    gasto_programado_id?: string;
}

export interface GastoProgramado {
    id: string;
    tenant_id: string;
    nombre: string;
    tipo: string;          // "fijo" | "porcentaje"
    valor: number;
    frecuencia: string;    // "semanal" | "mensual" | "anual"
    proxima_fecha: string;
    created_at?: string;
    ultimo_monto?: number | null;  // monto del último gasto generado por esta regla
}

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
    banner_url?: string;
    banner_url_movil?: string;
    hero_estilo?: string;      // 'gradiente' | 'imagen'
    banner_texto_color?: string;
    banner_mostrar_texto?: boolean;
    banner_mostrar_logo?: boolean;
    anuncio_texto?: string;
    // Logo del negocio (vive en la tabla tenants; lo expone el backend en el
    // GET privado de la config del catálogo para reusarlo en las tarjetas de post)
    logo?: string;
    created_at?: string;
}

/**
 * Override de la tarjeta de post para un producto (Posts Automáticos, Fase 1).
 * Dict PARCIAL: las claves ausentes se heredan de los defaults del negocio.
 * null en productos.post_override = sin override (usa defaults).
 */
export interface PostOverride {
    template?: string;   // 'marco' (Fase 1) | 'overlay' | 'tarjeta' (Fase 2)
    color?: string;      // 'default' | 'midnightBlack' | 'strawberry' | 'cozyYellow' | 'white'
    font?: string;       // 'moderna' | 'elegante' | 'redondeada'
    posicion?: string;   // 'arriba' | 'abajo' (solo Overlay, Fase 2)
    mostrar?: { nombre?: boolean; precio?: boolean; negocio?: boolean };
}

/**
 * Defaults de posts del NEGOCIO (tabla post_config).
 * Los productos SIN override usan estos valores automáticamente.
 */
export interface PostConfig {
    tenant_id: string;
    template_default: string;  // 'marco' (Fase 1)
    color: string;
    font: string;
    posicion: string;
    mostrar: { nombre: boolean; precio: boolean; negocio: boolean };
}

export interface Categoria {
    id: string;
    nombre: string;
    slug: string;
    total_productos: number;
    visible_en_catalogo?: boolean;
}

/**
 * Representa una imagen extra en la galería de un producto (Plan Plus).
 * La imagen principal sigue siendo productos.imagen; estas son adicionales.
 */
export interface ImagenProducto {
    id: number;
    url: string;
    orden: number;
}

/**
 * Obtiene el token JWT de la sesión activa de Supabase.
 * Si no hay sesión, devuelve null y el backend rechazará la petición.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const authHeaders = await getAuthHeaders()
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...authHeaders,
            ...options.headers,
        },
    })
    if (!res.ok) {
        let errStr = "Error en la petición"
        try {
            const err = await res.json()
            errStr = err.detail || JSON.stringify(err)
        } catch {
            // ignore
        }
        throw new Error(errStr)
    }
    return res.json()
}

/**
 * Llama al endpoint público del catálogo (NO requiere autenticación).
 * El slug es un UUID v4 único que identifica al tenant.
 * Devuelve la config del catálogo + productos activos (solo campos públicos).
 */
export async function fetchCatalogoPublico<T = unknown>(slug: string): Promise<T> {
    const res = await fetch(`${BASE_URL}/public/catalogo/${encodeURIComponent(slug)}`)
    if (!res.ok) {
        let errStr = "Error al cargar el catálogo"
        try {
            const err = await res.json()
            errStr = err.detail || JSON.stringify(err)
        } catch {
            // ignore
        }
        throw new Error(errStr)
    }
    return res.json()
}

/**
 * Nombre de archivo que envía el servidor en Content-Disposition (con fallback).
 */
function nombreArchivoDescarga(header: string | null, fallback: string): string {
    if (!header) return fallback
    const m = header.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
    if (m) {
        const nombre = m[1] || m[2]
        if (nombre) return nombre.trim()
    }
    return fallback
}

/**
 * Descarga un archivo del backend con el token de sesión (como una descarga
 * de navegador normal). El tenant_id lo determina el servidor desde el JWT.
 */
async function descargarArchivo(path: string, fallback: string): Promise<void> {
    const authHeaders = await getAuthHeaders()
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders })
    if (!res.ok) {
        let detail = "Error al descargar"
        try {
            const err = await res.json()
            detail = err.detail || detail
        } catch {
            // ignore
        }
        throw new Error(detail)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = nombreArchivoDescarga(res.headers.get("Content-Disposition"), fallback)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

/**
 * Descarga el respaldo JSON con TODOS los datos del tenant autenticado
 * (mismo flujo que el botón "Descargar Datos").
 */
export async function descargarDatosJson(): Promise<void> {
    await descargarArchivo(
        "/export/json",
        `nezzura-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    )
}

/**
 * Descarga la vista Excel (XLSX) de los datos del tenant autenticado
 * (mismo flujo que el botón "Descargar Excel").
 */
export async function descargarDatosXlsx(): Promise<void> {
    await descargarArchivo(
        "/export/xlsx",
        `nezzura-respaldo-${new Date().toISOString().slice(0, 10)}.xlsx`
    )
}

export const api = {
    // Inicialización
    initDB: () => request<{ ok: boolean; mensaje: string }>("/init-db"),

    // Inventario
    getInventario: () => request<Producto[]>("/inventario/"),
    getLotes: () => request<Lote[]>("/inventario/lotes"),
    crearProducto: (data: NuevoProducto & { imagen?: string }) => request("/inventario/", { method: "POST", body: JSON.stringify(data) }),
    restockear: (data: Restock) => request("/inventario/restock", { method: "POST", body: JSON.stringify(data) }),
    editarProducto: (prod: string, data: { descripcion: string; imagen: string; estado: string; categoria: string[]; costo?: number; precio_venta?: number; producto?: string; codigo_interno?: string; codigo_barras?: string; ubicacion?: string; visible_en_catalogo?: boolean; sufijo_precio?: string; fraccionable?: boolean; tipo_producto?: string; costo_servicio?: number; precio_servicio?: number }) => request(`/inventario/${encodeURIComponent(prod)}`, { method: "PATCH", body: JSON.stringify(data) }),
    // Categorías
    getCategorias: () => request<Categoria[]>("/inventario/categorias"),
    crearCategoria: (nombre: string) => request<{ ok: boolean; categoria: Categoria; mensaje: string }>("/inventario/categoria/crear", { method: "POST", body: JSON.stringify({ nombre }) }),
    editarCategoria: (viejoNombre: string, nuevoNombre: string) => request<{ ok: boolean; categoria: Categoria }>(`/inventario/categoria/${encodeURIComponent(viejoNombre)}`, { method: "PATCH", body: JSON.stringify({ nuevo_nombre: nuevoNombre }) }),
    eliminarCategoria: (categoria: string) => request(`/inventario/categoria/${encodeURIComponent(categoria)}`, { method: "DELETE" }),
    toggleVisibilidadCategoria: (categoria: string) =>
        request<{ ok: boolean; categoria: string; visible_en_catalogo: boolean; mensaje: string }>(
            `/inventario/categoria/${encodeURIComponent(categoria)}/visibilidad`,
            { method: "PATCH" }
        ),
    editarLote: (id: string, data: { costo: number; precio_venta: number; stock: number; etiqueta?: string; variacion?: string }) => request(`/inventario/lote/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    // Reasignar/desvincular la variación de un lote (Fase 6) — '' = base
    reasignarLoteVariacion: (id: string, variacion: string) =>
        request(`/inventario/lote/${id}`, { method: "PATCH", body: JSON.stringify({ variacion }) }),
    eliminarLote: (id: string) => request<{ ok: boolean; producto: string; producto_desactivado: boolean }>(`/inventario/lote/${id}`, { method: "DELETE" }),
    // Variaciones (Fase 2): presentaciones con precio propio por producto
    getVariaciones: (producto: string) => request<Variacion[]>(`/inventario/variaciones/${encodeURIComponent(producto)}`),
    crearVariacion: (producto: string, nombre: string, precio: number, foto?: string, stockInicial?: number, costo?: number) => request<{ ok: boolean; variacion: Variacion }>("/inventario/variaciones", { method: "POST", body: JSON.stringify({ producto, nombre, precio, foto: foto ?? "", stock_inicial: stockInicial, costo }) }),
    editarVariacion: (id: number, nombre: string, precio: number, foto?: string) => request<{ ok: boolean; variacion: Variacion }>(`/inventario/variaciones/${id}`, { method: "PATCH", body: JSON.stringify(foto !== undefined ? { nombre, precio, foto } : { nombre, precio }) }),
    eliminarVariacion: (id: number, confirmar = false) => request<{ ok: boolean; id: number } | { ok: boolean; requiere_confirmacion: boolean; unidades: number; lotes: number; mensaje: string }>(`/inventario/variaciones/${id}?confirmar=${confirmar}`, { method: "DELETE" }),
    // Sube (o reemplaza) la foto propia de una variación (Fase 5)
    subirFotoVariacion: async (variacionId: number, file: File): Promise<{ ok: boolean; url: string }> => {
        const authHeaders = await getAuthHeaders()
        const formData = new FormData()
        formData.append("foto", file)
        const res = await fetch(`${BASE_URL}/inventario/variaciones/${variacionId}/foto`, {
            method: "POST",
            headers: authHeaders,
            body: formData,
        })
        if (!res.ok) {
            let detail = "Error al subir foto de la variación"
            try { const err = await res.json(); detail = err.detail || detail } catch { }
            throw new Error(detail)
        }
        return res.json()
    },
    // Recetas de compuestos (Fases 3 y 4): materiales que consume al venderse
    getRecetas: (producto: string) => request<MaterialReceta[]>(`/inventario/recetas/${encodeURIComponent(producto)}`),
    agregarMaterial: (producto: string, material: string, cantidad: number, variacion_id?: number | null) => request<{ ok: boolean; material: string; cantidad: number }>("/inventario/recetas", { method: "POST", body: JSON.stringify({ producto, material, cantidad, variacion_id: variacion_id ?? null }) }),
    editarMaterial: (id: number, cantidad: number) => request<{ ok: boolean; id: number; cantidad: number }>(`/inventario/recetas/${id}`, { method: "PATCH", body: JSON.stringify({ cantidad }) }),
    eliminarMaterial: (id: number) => request<{ ok: boolean; id: number }>(`/inventario/recetas/${id}`, { method: "DELETE" }),
    subirFoto: async (producto: string, file: File): Promise<{ ruta: string }> => {
        const authHeaders = await getAuthHeaders()
        const formData = new FormData()
        formData.append("foto", file)
        const res = await fetch(`${BASE_URL}/inventario/foto/${encodeURIComponent(producto)}`, {
            method: "POST",
            headers: authHeaders,
            body: formData,
        })
        if (!res.ok) {
            let detail = "Error al subir foto"
            try {
                const err = await res.json()
                detail = err.detail || detail
            } catch { }
            throw new Error(detail)
        }
        return res.json()
    },

    // Perfil
    getPerfil: () => request<{ tenant_id: string; modo_precio_sugerido: string }>("/inventario/me"),
    // Modo de precio sugerido del POS: 'antiguo' | 'maximo' | 'reciente'
    actualizarModoPrecioSugerido: (modo: string) =>
        request<{ ok: boolean; modo_precio_sugerido: string }>("/inventario/me", { method: "PATCH", body: JSON.stringify({ modo_precio_sugerido: modo }) }),

    // Galería de imágenes (Plan Plus) — hasta 5 imágenes extra por producto
    getImagenesProducto: (producto: string) =>
        request<ImagenProducto[]>(`/inventario/imagenes/${encodeURIComponent(producto)}`),
    subirImagenExtra: async (producto: string, file: File, ordenTarget?: number): Promise<{ ok: boolean; url: string; orden: number }> => {
            const authHeaders = await getAuthHeaders()
            const formData = new FormData()
            formData.append("foto", file)
            // Si ordenTarget se envía, el backend reemplaza la imagen en ese orden
            // (borra la anterior de Cloudinary + DB). Si es undefined, añade una nueva.
            if (ordenTarget !== undefined) {
                formData.append("orden_target", String(ordenTarget))
            }
            const res = await fetch(`${BASE_URL}/inventario/imagenes/${encodeURIComponent(producto)}`, {
                method: "POST",
                headers: authHeaders,
                body: formData,
            })
            if (!res.ok) {
                let detail = "Error al subir imagen"
                try { const err = await res.json(); detail = err.detail || detail } catch { }
                throw new Error(detail)
            }
            return res.json()
        },
    eliminarImagenExtra: (imagenId: number) =>
        request<{ ok: boolean; id: number }>(`/inventario/imagenes/${imagenId}`, { method: "DELETE" }),
    // Borra de Cloudinary una imagen reemplazada/eliminada (logo, banners)
    borrarImagen: (url: string) =>
        request<{ ok: boolean; mensaje: string }>("/inventario/borrar_imagen", { method: "POST", body: JSON.stringify({ url }) }),
    reordenarImagenes: (producto: string, ids: number[]) =>
        request<{ ok: boolean; mensaje: string }>(
            `/inventario/imagenes/${encodeURIComponent(producto)}/reordenar`,
            { method: "PATCH", body: JSON.stringify({ ids }) }
        ),

    // Ventas
    getVentas: () => request<Venta[]>("/ventas/"),
    cobrarCarrito: (items: ItemCarrito[]) => request<{ ok: boolean; ventas: number; total_cobrado: number }>("/ventas/cobrar", { method: "POST", body: JSON.stringify({ items }) }),
    actualizarVenta: (id: number, data: { fecha?: string; precio_real?: number; costo_unitario?: number; cantidad?: number; total_venta?: number; ganancia_bruta?: number }) => request(`/ventas/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    eliminarVenta: (id: number) => request(`/ventas/${id}`, { method: "DELETE" }),

    // Gastos
    getGastos: () => request<Gasto[]>("/gastos/"),
    crearGasto: (data: { fecha: string; categoria: string; descripcion: string; monto: number; estado?: string; gasto_programado_id?: string }) => request("/gastos/", { method: "POST", body: JSON.stringify(data) }),
    actualizarGasto: (id: number, data: { monto: number; categoria: string; descripcion: string }) => request(`/gastos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    confirmarGasto: (id: number) => request(`/gastos/${id}/confirmar`, { method: "PUT" }),
    descartarGasto: (id: number) => request(`/gastos/${id}/descartar`, { method: "PUT" }),
    eliminarGasto: (id: number) => request(`/gastos/${id}`, { method: "DELETE" }),

    // Gastos Programados
    getGastosProgramados: () => request<GastoProgramado[]>("/gastos_programados"),
    crearGastoProgramado: (data: { nombre: string; tipo: string; valor: number; frecuencia: string; proxima_fecha: string }) =>
        request("/gastos_programados", { method: "POST", body: JSON.stringify(data) }),
    ejecutarGastoProgramado: (id: string) =>
        request<{ ok: boolean; monto: number; nombre: string; mensaje: string }>(`/gastos_programados/${id}/ejecutar`, { method: "POST" }),
    estimarMontoGastoProgramado: (id: string) =>
        request<{ ok: boolean; monto: number; tipo: string; nombre: string; proxima_fecha: string; ganancia_bruta: number; ganancia_neta: number; total_gastos: number }>(`/gastos_programados/${id}/estimacion`),
    // Categorías de gasto (editables)
    getCategoriasGasto: () => request<{ id: string; nombre: string }[]>("/gastos/categorias"),
    crearCategoriaGasto: (nombre: string) => request<{ ok: boolean; categoria: { id: string; nombre: string }; mensaje: string }>("/gastos/categorias", { method: "POST", body: JSON.stringify({ nombre }) }),
    editarCategoriaGasto: (viejoNombre: string, nuevoNombre: string) => request<{ ok: boolean; categoria: { id: string; nombre: string } }>(`/gastos/categorias/${encodeURIComponent(viejoNombre)}`, { method: "PUT", body: JSON.stringify({ nuevo_nombre: nuevoNombre }) }),
    eliminarCategoriaGasto: (categoria: string) => request<{ ok: boolean; categoria_eliminada: string }>(`/gastos/categorias/${encodeURIComponent(categoria)}`, { method: "DELETE" }),

    actualizarGastoProgramado: (id: string, data: { nombre?: string; tipo?: string; valor?: number; frecuencia?: string; proxima_fecha?: string }) =>
        request<{ ok: boolean; mensaje: string }>(`/gastos_programados/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    eliminarGastoProgramado: (id: string) =>
        request<{ ok: boolean; mensaje: string }>(`/gastos_programados/${id}`, { method: "DELETE" }),

    // Posts Automáticos (Fase 1) — defaults del negocio + override por producto
    getPostConfig: () =>
        request<PostConfig>("/catalogo_gestion/post_config"),
    actualizarPostConfig: (data: {
        template_default?: string;
        color?: string;
        font?: string;
        posicion?: string;
        mostrar?: { nombre?: boolean; precio?: boolean; negocio?: boolean };
    }) =>
        request<{ ok: boolean; mensaje: string }>("/catalogo_gestion/post_config", {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    // Guarda (o quita, con null) el override de la tarjeta de post de un producto
    guardarPostOverride: (producto: string, post_override: PostOverride | null) =>
        request<{ ok: boolean; producto: string; post_override: PostOverride | null }>(
            `/inventario/${encodeURIComponent(producto)}/post_override`,
            { method: "PATCH", body: JSON.stringify({ post_override }) }
        ),

    // Catálogo público (gestión privada — requiere JWT)
    getConfigCatalogo: () =>
        request<CatalogoConfig>("/catalogo_gestion"),
    actualizarConfigCatalogo: (data: {
        activo?: boolean;
        tema?: string;
        template?: string;
        titulo?: string;
        subtitulo?: string;
        mostrar_precios?: boolean;
        mostrar_stock?: boolean;
        mostrar_categorias?: boolean;
        agrupar_por_categoria?: boolean;
        columnas_movil?: number;
        permitir_descarga?: boolean;
        ocultar_agotados?: boolean;
        relacion_imagen?: string;  // '1:1' | '4:5'
        banner_url?: string;
        banner_url_movil?: string;
        hero_estilo?: string;
        banner_texto_color?: string;
        banner_mostrar_texto?: boolean;
        banner_mostrar_logo?: boolean;
        anuncio_texto?: string;
    }) =>
        request<{ ok: boolean; mensaje: string }>("/catalogo_gestion", {
            method: "PUT",
            body: JSON.stringify(data),
        }),
}
