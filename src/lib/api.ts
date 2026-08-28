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
    // 'stock' | 'servicio' | 'compuesto' — para saber en el historial si la venta consumió inventario
    tipo_producto?: string;
    // Nombre de la variación vendida (ej. "Doble", "S") — vacío = sin variación
    variacion?: string;
    // Consumo real de materiales de una venta COMPUESTA (solo compuestos)
    consumo?: { material: string; id_lote: string | null; cantidad: number; costo: number }[] | null;
    // Orden (ticket) a la que pertenece el renglón (migración 032)
    orden_id?: string;
}

// Pago individual dentro de un ticket (efectivo o tarjeta; el mixto son varios)
export interface PagoOrden {
    metodo: string;
    monto: number;
    referencia?: string | null;
    terminal_id?: string | null;
    terminal_nombre?: string | null;
    comision?: number;
}

// Terminal bancaria del negocio con su tarifa real (Fase B)
export interface Terminal {
    id: string;
    nombre: string;
    banco?: string | null;
    comision_debito_pct: number;
    comision_credito_pct: number;
    comision_fija: number;
    activo: boolean;
}

// Turno de caja con arqueo (Fase C)
export interface Turno {
    id: string;
    estado: "Abierto" | "Cerrado";
    abierta_en: string;
    cerrada_en: string | null;
    monto_apertura: number;
    efectivo_esperado: number | null;
    efectivo_contado: number | null;
    diferencia: number | null;
    notas?: string | null;
    num_ordenes: number;
    total_turno: number;
    efectivo_cobrado: number;
}

// Ticket/orden de venta: cabecera de un cobro que agrupa sus renglones
export interface Orden {
    id: string;
    n_ticket: number;
    fecha: string;
    total: number;
    ganancia: number;
    cantidad_items: number;
    estado: string; // 'Activa' | 'Anulada'
    ventas: Venta[];
    // Cobro (Fase A): NULL/undefined en órdenes legadas = "No registrado"
    metodo_pago?: string | null; // 'efectivo' | 'tarjeta_debito' | 'tarjeta_credito' | 'mixto'
    pagos?: PagoOrden[] | null;
    propina?: number;
    monto_recibido?: number | null;
    cambio?: number | null;
    comision_total?: number;
    turno_id?: string | null;
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

// ── Estadísticas server-side: respuestas de la BDD, no dumps de renglones ──

// KPIs del período (GET /stats/resumen)
export interface ResumenStats {
    total_vendido: number;
    ganancia_bruta: number;
    unidades: number;
    num_ventas: number;
    num_anuladas: number;
    tickets: number;
    ticket_promedio: number;
    total_gastos: number;
    cobros_por_metodo: { efectivo: number; tarjeta_debito: number; tarjeta_credito: number; no_registrado: number };
    propinas: number;
    con_metodo: boolean;
    por_terminal: { nombre: string; cobrado: number; comision: number }[];
    top_productos: StatsProducto[];
}

// Cubo temporal de la serie (GET /stats/serie): día/semana/més según el rango
export interface FilaSerie {
    periodo: string;   // 'YYYY-MM-DD' (inicio del cubo)
    ventas: number;
    ganancia: number;
    gastos: number;
}

// Totales de UN producto en el período (GET /stats/productos)
export interface StatsProducto {
    producto: string;
    total: number;
    unidades: number;
    ganancia: number;
    num_ventas: number;
}

// Historial de tickets paginado en servidor (GET /ventas/ordenes/paginadas)
export interface RespuestaOrdenesPaginadas {
    ordenes: Orden[];
    total: number;
    pagina: number;
    por_pagina: number;
    total_paginas: number;
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
    template?: string;   // 'marco' | 'overlay'
    font?: string;       // 'moderna' | 'elegante' | 'redondeada'
    posicion?: string;   // 'arriba' | 'abajo' (solo Overlay, Fase 2)
    mostrar?: { nombre?: boolean; precio?: boolean; negocio?: boolean };
    // Colores de texto personalizables: primario = NOMBRE + NEGOCIO,
    // secundario = PRECIO (hex #RRGGBB o '' = automático por plantilla).
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
    // Colores de texto personalizables: primario = NOMBRE + NEGOCIO,
    // secundario = PRECIO (hex #RRGGBB o '' = automático por plantilla).
    color_primario?: string;
    color_secundario?: string;
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

/**
 * Error de la API con metadatos del cuerpo de respuesta (status, codigo,
 * sqlstate). Los reintentos controlados (ej. tablas faltantes 42P01)
 * inspeccionan estos campos; el texto solo es para mostrar al usuario.
 */
export class ApiError extends Error {
    status?: number
    codigo?: string
    sqlstate?: string

    constructor(mensaje: string, detalles: { status?: number; codigo?: string; sqlstate?: string } = {}) {
        super(mensaje)
        this.name = "ApiError"
        Object.assign(this, detalles)
    }
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
        let codigo: string | undefined
        let sqlstate: string | undefined
        try {
            const err = await res.json()
            errStr = err.detail || err.mensaje || JSON.stringify(err)
            codigo = err.codigo
            sqlstate = err.sqlstate
        } catch {
            // ignore
        }
        throw new ApiError(errStr, { status: res.status, codigo, sqlstate })
    }
    return res.json()
}

/** Rango de fechas contable para listados ('YYYY-MM-DD', ambos opcionales). */
export interface RangoFechas {
    desde?: string
    hasta?: string
}

/** Agrega pares clave/valor como querystring, omitiendo vacíos. */
function conQuery(path: string, params: Record<string, string | number | boolean | undefined | null>): string {
    const qs = new URLSearchParams()
    for (const [clave, valor] of Object.entries(params)) {
        if (valor === undefined || valor === null || valor === "") continue
        qs.set(clave, String(valor))
    }
    const s = qs.toString()
    return s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path
}

/** Agrega ?desde/?hasta a un path solo cuando el rango trae límites. */
function conRango(path: string, rango?: RangoFechas): string {
    return conQuery(path, { desde: rango?.desde, hasta: rango?.hasta })
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
    getPerfil: () => request<{ tenant_id: string; modo_precio_sugerido: string; zona_horaria: string; metodo_pago_default: string; gasto_comision_automatico: boolean }>("/inventario/me"),
    // Modo de precio sugerido del POS: 'antiguo' | 'maximo' | 'reciente'
    actualizarModoPrecioSugerido: (modo: string) =>
        request<{ ok: boolean; modo_precio_sugerido: string }>("/inventario/me", { method: "PATCH", body: JSON.stringify({ modo_precio_sugerido: modo }) }),
    // Zona horaria IANA del negocio: define el día contable de ventas/gastos/cortes
    actualizarZonaHoraria: (zona: string) =>
        request<{ ok: boolean; zona_horaria: string }>("/inventario/me", { method: "PATCH", body: JSON.stringify({ zona_horaria: zona }) }),

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

    // Ventas — sin rango el backend devuelve el mes contable actual
    getVentas: (rango?: RangoFechas) => request<Venta[]>(conRango("/ventas/", rango)),
    getOrdenes: (limit = 500, rango?: RangoFechas) => request<Orden[]>(conRango(`/ventas/ordenes?limit=${limit}`, rango)),
    // Historial paginado en servidor (una página por request)
    getOrdenesPaginadas: (params: RangoFechas & { pagina?: number; por_pagina?: number; busqueda?: string; orden?: string }) =>
        request<RespuestaOrdenesPaginadas>(conQuery("/ventas/ordenes/paginadas", { ...params })),

    // Estadísticas server-side: la BDD calcula, el frontend solo dibuja
    getStatsResumen: (rango?: RangoFechas & { todo?: boolean }) =>
        request<ResumenStats>(conQuery("/stats/resumen", { desde: rango?.desde, hasta: rango?.hasta, todo: rango?.todo ? 1 : undefined })),
    getStatsSerie: (params?: RangoFechas & { granularidad?: string }) =>
        request<FilaSerie[]>(conQuery("/stats/serie", { ...params })),
    getStatsProductos: (rango?: RangoFechas) =>
        request<StatsProducto[]>(conRango("/stats/productos", rango)),
    getVentasProductoStats: (producto: string, rango?: RangoFechas) =>
        request<Venta[]>(conQuery("/stats/ventas-producto", { producto, desde: rango?.desde, hasta: rango?.hasta })),
    // Edita la fecha de un ticket (cascada a todos sus renglones)
    actualizarOrden: (ordenId: string, data: { fecha: string }) =>
        request<{ ok: boolean; n_ticket: number }>(`/ventas/ordenes/${ordenId}`, { method: "PATCH", body: JSON.stringify(data) }),
    // Anula un ticket completo: restaura el stock de todos sus renglones
    anularOrden: (ordenId: string) =>
        request<{ ok: boolean; anuladas: number; stock_restaurado?: number }>(`/ventas/ordenes/${ordenId}`, { method: "DELETE" }),
    // Pago de un carrito (Fase A/B): método único o mixto + propina + terminal + recibido
    cobrarCarrito: (items: ItemCarrito[], pago?: {
        metodo: string;
        propina?: number;
        pagos?: { metodo: string; monto: number; referencia?: string; terminal_id?: string }[];
        monto_recibido?: number;
        terminal_id?: string;
    }) => request<{ ok: boolean; ventas: number; total_cobrado: number; n_ticket?: number | null; metodo_pago?: string | null; propina?: number; cambio?: number | null }>(
        "/ventas/cobrar",
        { method: "POST", body: JSON.stringify({ items, pago: pago ?? null }) }
    ),
    actualizarVenta: (id: number, data: { fecha?: string; precio_real?: number; costo_unitario?: number; cantidad?: number; total_venta?: number; ganancia_bruta?: number }) => request(`/ventas/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    eliminarVenta: (id: number) => request(`/ventas/${id}`, { method: "DELETE" }),

    // Terminales bancarias con comisiones (Fase B)
    getTerminales: () => request<Terminal[]>("/terminales/"),
    crearTerminal: (data: { nombre: string; banco?: string; comision_debito_pct: number; comision_credito_pct: number; comision_fija: number }) =>
        request<{ ok: boolean }>("/terminales/", { method: "POST", body: JSON.stringify(data) }),
    actualizarTerminal: (id: string, data: Partial<{ nombre: string; banco: string; comision_debito_pct: number; comision_credito_pct: number; comision_fija: number; activo: boolean }>) =>
        request<{ ok: boolean }>(`/terminales/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    eliminarTerminal: (id: string) => request<{ ok: boolean }>(`/terminales/${id}`, { method: "DELETE" }),

    // Turnos de caja con arqueo (Fase C)
    getTurnos: (limit = 50) => request<Turno[]>(`/turnos/?limit=${limit}`),
    abrirTurno: (monto_apertura: number) =>
        request<{ ok: boolean; turno: Turno }>("/turnos/", { method: "POST", body: JSON.stringify({ monto_apertura }) }),
    cerrarTurno: (turnoId: string, efectivo_contado: number, notas?: string) =>
        request<{ ok: boolean; efectivo_esperado: number; efectivo_contado: number; diferencia: number }>(`/turnos/${turnoId}/cerrar`, { method: "POST", body: JSON.stringify({ efectivo_contado, notas }) }),

    // Gasto automático de comisiones (Fase B)
    actualizarGastoComision: (activo: boolean) =>
        request<{ ok: boolean; gasto_comision_automatico: boolean }>("/inventario/me", { method: "PATCH", body: JSON.stringify({ gasto_comision_automatico: activo }) }),

    // Gastos — sin rango el backend devuelve el mes contable actual
    getGastos: (rango?: RangoFechas) => request<Gasto[]>(conRango("/gastos/", rango)),
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
        font?: string;
        posicion?: string;
        mostrar?: { nombre?: boolean; precio?: boolean; negocio?: boolean };
        color_primario?: string;
        color_secundario?: string;
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
