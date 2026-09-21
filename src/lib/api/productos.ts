import { BASE_URL, getAuthHeaders, request, conQuery } from "./client"
import type {
    Producto,
    Lote,
    NuevoProducto,
    Restock,
    Categoria,
    Variacion,
    MaterialReceta,
    ImagenProducto,
    PostOverride,
    RespuestaMovimientos
} from "@/types"

export const productosApi = {
    // Inicialización
    initDB: () => request<{ ok: boolean; mensaje: string }>("/init-db"),

    // Inventario y Lotes
    getInventario: () => request<Producto[]>("/inventario/"),
    getLotes: () => request<Lote[]>("/inventario/lotes"),
    // Historial de cambios del inventario (ledger append-only, migración 040)
    getMovimientos: (params?: {
        limit?: number
        offset?: number
        tipo?: string
        producto?: string
        desde?: string
        hasta?: string
    }) =>
        request<RespuestaMovimientos>(conQuery("/inventario/movimientos", {
            limit: params?.limit,
            offset: params?.offset,
            tipo: params?.tipo,
            producto: params?.producto,
            desde: params?.desde,
            hasta: params?.hasta,
        })),
    crearProducto: (data: NuevoProducto & { imagen?: string }) =>
        request("/inventario/", { method: "POST", body: JSON.stringify(data) }),
    restockear: (data: Restock) =>
        request("/inventario/restock", { method: "POST", body: JSON.stringify(data) }),
    editarProducto: (
        prod: string,
        data: {
            descripcion: string
            imagen: string
            estado: string
            categoria: string[]
            costo?: number
            precio_venta?: number
            producto?: string
            codigo_interno?: string
            codigo_barras?: string
            ubicacion?: string
            visible_en_catalogo?: boolean
            sufijo_precio?: string
            fraccionable?: boolean
            tipo_producto?: string
            costo_servicio?: number
            precio_servicio?: number
        }
    ) => request(`/inventario/${encodeURIComponent(prod)}`, { method: "PATCH", body: JSON.stringify(data) }),

    // Categorías
    getCategorias: () => request<Categoria[]>("/inventario/categorias"),
    crearCategoria: (nombre: string) =>
        request<{ ok: boolean; categoria: Categoria; mensaje: string }>("/inventario/categoria/crear", {
            method: "POST",
            body: JSON.stringify({ nombre }),
        }),
    editarCategoria: (viejoNombre: string, nuevoNombre: string) =>
        request<{ ok: boolean; categoria: Categoria }>(`/inventario/categoria/${encodeURIComponent(viejoNombre)}`, {
            method: "PATCH",
            body: JSON.stringify({ nuevo_nombre: nuevoNombre }),
        }),
    eliminarCategoria: (categoria: string) =>
        request(`/inventario/categoria/${encodeURIComponent(categoria)}`, { method: "DELETE" }),
    toggleVisibilidadCategoria: (categoria: string) =>
        request<{ ok: boolean; categoria: string; visible_en_catalogo: boolean; mensaje: string }>(
            `/inventario/categoria/${encodeURIComponent(categoria)}/visibilidad`,
            { method: "PATCH" }
        ),

    // Lote individual
    editarLote: (
        id: string,
        data: { costo: number; precio_venta: number; stock: number; etiqueta?: string; variacion?: string }
    ) => request(`/inventario/lote/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    reasignarLoteVariacion: (id: string, variacion: string) =>
        request(`/inventario/lote/${id}`, { method: "PATCH", body: JSON.stringify({ variacion }) }),
    eliminarLote: (id: string) =>
        request<{ ok: boolean; producto: string; producto_desactivado: boolean }>(`/inventario/lote/${id}`, {
            method: "DELETE",
        }),

    // Variaciones
    getVariaciones: (producto: string) =>
        request<Variacion[]>(`/inventario/variaciones/${encodeURIComponent(producto)}`),
    crearVariacion: (
        producto: string,
        nombre: string,
        precio: number,
        foto?: string,
        stockInicial?: number,
        costo?: number
    ) =>
        request<{ ok: boolean; variacion: Variacion }>("/inventario/variaciones", {
            method: "POST",
            body: JSON.stringify({ producto, nombre, precio, foto: foto ?? "", stock_inicial: stockInicial, costo }),
        }),
    editarVariacion: (id: number, nombre: string, precio: number, foto?: string) =>
        request<{ ok: boolean; variacion: Variacion }>(`/inventario/variaciones/${id}`, {
            method: "PATCH",
            body: JSON.stringify(foto !== undefined ? { nombre, precio, foto } : { nombre, precio }),
        }),
    eliminarVariacion: (id: number, confirmar = false) =>
        request<
            | { ok: boolean; id: number }
            | { ok: boolean; requiere_confirmacion: boolean; unidades: number; lotes: number; mensaje: string }
        >(`/inventario/variaciones/${id}?confirmar=${confirmar}`, { method: "DELETE" }),
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
            try {
                const err = await res.json()
                detail = err.detail || detail
            } catch {
                // ignore
            }
            throw new Error(detail)
        }
        return res.json()
    },

    // Recetas de compuestos
    getRecetas: (producto: string) =>
        request<MaterialReceta[]>(`/inventario/recetas/${encodeURIComponent(producto)}`),
    agregarMaterial: (producto: string, material: string, cantidad: number, variacion_id?: number | null) =>
        request<{ ok: boolean; material: string; cantidad: number }>("/inventario/recetas", {
            method: "POST",
            body: JSON.stringify({ producto, material, cantidad, variacion_id: variacion_id ?? null }),
        }),
    editarMaterial: (id: number, cantidad: number) =>
        request<{ ok: boolean; id: number; cantidad: number }>(`/inventario/recetas/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ cantidad }),
        }),
    eliminarMaterial: (id: number) =>
        request<{ ok: boolean; id: number }>(`/inventario/recetas/${id}`, { method: "DELETE" }),

    // Fotos de producto
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
            } catch {
                // ignore
            }
            throw new Error(detail)
        }
        return res.json()
    },

    // Perfil y configuración de inventario
    getPerfil: () =>
        request<{
            tenant_id: string
            modo_precio_sugerido: string
            zona_horaria: string
            metodo_pago_default: string
            gasto_comision_automatico: boolean
            // Cartera de clientes + sistema de puntos (migraciones 038/039)
            clientes_activos: boolean
            cliente_campos: import("@/types").ClienteCampos
            puntos_activos: boolean
            puntos_valor_punto: number
            puntos_modo: import("@/types").ModoPuntos
            puntos_gasto_monto: number
            puntos_gasto_pts: number
            puntos_fijos: number | null
        }>("/inventario/me"),
    // PATCH genérico de la config del perfil (zona, clientes, puntos...).
    actualizarPerfilNegocio: (data: Record<string, unknown>) =>
        request<Record<string, unknown>>("/inventario/me", {
            method: "PATCH",
            body: JSON.stringify(data),
        }),
    actualizarModoPrecioSugerido: (modo: string) =>
        request<{ ok: boolean; modo_precio_sugerido: string }>("/inventario/me", {
            method: "PATCH",
            body: JSON.stringify({ modo_precio_sugerido: modo }),
        }),
    actualizarZonaHoraria: (zona: string) =>
        request<{ ok: boolean; zona_horaria: string }>("/inventario/me", {
            method: "PATCH",
            body: JSON.stringify({ zona_horaria: zona }),
        }),
    actualizarGastoComision: (activo: boolean) =>
        request<{ ok: boolean; gasto_comision_automatico: boolean }>("/inventario/me", {
            method: "PATCH",
            body: JSON.stringify({ gasto_comision_automatico: activo }),
        }),

    // Galería de imágenes (Plan Plus)
    getImagenesProducto: (producto: string) =>
        request<ImagenProducto[]>(`/inventario/imagenes/${encodeURIComponent(producto)}`),
    subirImagenExtra: async (
        producto: string,
        file: File,
        ordenTarget?: number
    ): Promise<{ ok: boolean; url: string; orden: number }> => {
        const authHeaders = await getAuthHeaders()
        const formData = new FormData()
        formData.append("foto", file)
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
            try {
                const err = await res.json()
                detail = err.detail || detail
            } catch {
                // ignore
            }
            throw new Error(detail)
        }
        return res.json()
    },
    eliminarImagenExtra: (imagenId: number) =>
        request<{ ok: boolean; id: number }>(`/inventario/imagenes/${imagenId}`, { method: "DELETE" }),
    borrarImagen: (url: string) =>
        request<{ ok: boolean; mensaje: string }>("/inventario/borrar_imagen", {
            method: "POST",
            body: JSON.stringify({ url }),
        }),
    reordenarImagenes: (producto: string, ids: number[]) =>
        request<{ ok: boolean; mensaje: string }>(
            `/inventario/imagenes/${encodeURIComponent(producto)}/reordenar`,
            { method: "PATCH", body: JSON.stringify({ ids }) }
        ),

    // Posts override en producto
    guardarPostOverride: (producto: string, post_override: PostOverride | null) =>
        request<{ ok: boolean; producto: string; post_override: PostOverride | null }>(
            `/inventario/${encodeURIComponent(producto)}/post_override`,
            { method: "PATCH", body: JSON.stringify({ post_override }) }
        ),
}
