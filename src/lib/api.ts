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
    costo_promedio: number;
    categoria: string[];
    codigo_interno?: string;
    codigo_barras?: string;
    ubicacion?: string;
}

export interface ItemCarrito {
    producto: string;
    cantidad: number;
    precio_real: number;
}

export interface Lote {
    id_lote: string;
    producto: string;
    costo: number;
    precio_venta: number;
    stock_lote: number;
    fecha_entrada: string;
    estado: string;
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
}

export interface Restock {
    producto: string;
    costo: number;
    precio_venta: number;
    stock: number;
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
    activo: boolean;
    ultima_ejecucion?: string;
    created_at?: string;
}

export interface Categoria {
    id: string;
    nombre: string;
    slug: string;
    total_productos: number;
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

export const api = {
    // Inicialización
    initDB: () => request<{ ok: boolean; mensaje: string }>("/init-db"),

    // Inventario
    getInventario: () => request<Producto[]>("/inventario/"),
    getLotes: () => request<Lote[]>("/inventario/lotes"),
    crearProducto: (data: NuevoProducto & { imagen?: string }) => request("/inventario/", { method: "POST", body: JSON.stringify(data) }),
    restockear: (data: Restock) => request("/inventario/restock", { method: "POST", body: JSON.stringify(data) }),
    editarProducto: (prod: string, data: { descripcion: string; imagen: string; estado: string; categoria: string[]; costo?: number; precio_venta?: number; producto?: string; codigo_interno?: string; codigo_barras?: string; ubicacion?: string }) => request(`/inventario/${prod}`, { method: "PATCH", body: JSON.stringify(data) }),
    // Categorías
    getCategorias: () => request<Categoria[]>("/inventario/categorias"),
    crearCategoria: (nombre: string) => request<{ ok: boolean; categoria: Categoria; mensaje: string }>("/inventario/categoria/crear", { method: "POST", body: JSON.stringify({ nombre }) }),
    editarCategoria: (viejoNombre: string, nuevoNombre: string) => request<{ ok: boolean; categoria: Categoria }>(`/inventario/categoria/${encodeURIComponent(viejoNombre)}`, { method: "PATCH", body: JSON.stringify({ nuevo_nombre: nuevoNombre }) }),
    eliminarCategoria: (categoria: string) => request(`/inventario/categoria/${encodeURIComponent(categoria)}`, { method: "DELETE" }),
    editarLote: (id: string, data: { costo: number; precio_venta: number; stock: number }) => request(`/inventario/lote/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    eliminarLote: (id: string) => request<{ ok: boolean; producto: string; producto_desactivado: boolean }>(`/inventario/lote/${id}`, { method: "DELETE" }),
    subirFoto: async (producto: string, file: File): Promise<{ ruta: string }> => {
        const authHeaders = await getAuthHeaders()
        const formData = new FormData()
        formData.append("foto", file)
        const res = await fetch(`${BASE_URL}/inventario/foto/${producto}`, {
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
    getPerfil: () => request<{ tenant_id: string }>("/inventario/me"),

    // Ventas
    getVentas: () => request<Venta[]>("/ventas/"),
    cobrarCarrito: (items: ItemCarrito[]) => request<{ total_cobrado: number }>("/ventas/cobrar", { method: "POST", body: JSON.stringify({ items }) }),
    actualizarVenta: (id: number, data: { fecha?: string; precio_real?: number; cantidad?: number; total_venta?: number; ganancia_bruta?: number }) => request(`/ventas/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    eliminarVenta: (id: number) => request(`/ventas/${id}`, { method: "DELETE" }),

    // Gastos
    getGastos: () => request<Gasto[]>("/gastos/"),
    crearGasto: (data: { fecha: string; categoria: string; descripcion: string; monto: number; estado?: string; gasto_programado_id?: string }) => request("/gastos/", { method: "POST", body: JSON.stringify(data) }),
    confirmarGasto: (id: number) => request(`/gastos/${id}/confirmar`, { method: "PUT" }),
    descartarGasto: (id: number) => request(`/gastos/${id}/descartar`, { method: "PUT" }),
    eliminarGasto: (id: number) => request(`/gastos/${id}`, { method: "DELETE" }),

    // Gastos Programados
    getGastosProgramados: () => request<GastoProgramado[]>("/gastos_programados"),
    crearGastoProgramado: (data: { nombre: string; tipo: string; valor: number; frecuencia: string; proxima_fecha: string }) =>
        request("/gastos_programados", { method: "POST", body: JSON.stringify(data) }),
}
