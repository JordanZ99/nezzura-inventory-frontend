// ==============================================================================
// src/lib/local/db.ts
// Base de datos LOCAL del negocio (IndexedDB, motor Dexie) — el corazón del
// Modo Local: aquí vive TODO el negocio del usuario, en su propio teléfono.
//
// Un ESQUEMA por tenant: nezzura_local_<tenant_id>. El mismo dueño podría
// bajar dos negocios (dos cuentas Supabase) en el mismo navegador sin
// colisiones, y los datos jamás se cruzan entre tenants.
//
// Conveniones de columnas: en IndexedDB las llaves de objetos son
// camelCase/lowercase COMO LOS TRAE EL BACKEND (las clases de @/types ya
// mapean snake_case → camelCase en las respuestas HTTP). Los repos locales
// devuelven EXACTAMENTE las mismas formas que los endpoints HTTP (contratos).
// ==============================================================================

import Dexie, { type Table } from "dexie"
import { Capacitor } from "@capacitor/core"
import { obtenerLicencia } from "./licencia"
import { DBSQLite } from "./sqlite/tablas"

// ── Filas tal cual se persisten (camelCase, como entrega el HTTP) ──
export interface PerfilLocal {
    id: 1  // fila única
    empresa: string
    logo: string
    zona_horaria: string
    metodo_pago_default: string
    gasto_comision_automatico: boolean
    dias_cerrados: string[]
    clientes_activos: boolean
    puntos_activos?: boolean
    // Cómo el POS sugiere el precio: 'antiguo' (PEPS) | 'reciente' | 'maximo'
    modo_precio_sugerido?: string
    giro: string
    modulos: Record<string, boolean> | null
    // ── Datos de contacto (como tenants en Supabase, migración 043) ──
    telefono?: string
    correo?: string
    instagram?: string
    facebook?: string
    tiktok?: string
    sitio_web?: string
    maps?: string
    /** Config del catálogo (espejo local de catalogo_gestion): guarda solo
     *  los campos que el dueño cambió; el resto toma defaults. La relación
     *  de imagen del POS/inventario vive aquí (relacion_imagen). */
    catalogo_config?: Record<string, unknown>
}

export interface CategoriaLocal {
    id: string
    nombre: string
    slug: string
    visible_en_catalogo?: boolean
    orden?: number
}

export interface ProductoLocal {
    producto: string
    descripcion: string
    imagen: string
    estado: string
    costo?: number            // productos DE SERVICIO: costo directo
    precio_venta?: number     // productos DE SERVICIO: precio directo
    categorias?: string[]     // nombres de categorías (pivot simplificado local)
    codigo_interno?: string
    codigo_barras?: string
    ubicacion?: string
    visible_en_catalogo?: boolean
    sufijo_precio?: string
    fraccionable?: boolean
    tamano_cm?: number
    tipo_producto?: string    // 'stock' | 'servicio' | 'compuesto'
    costo_servicio?: number
    precio_servicio?: number
    post_override?: unknown | null
    /** Galería de fotos extra (Plan Plus, local: dataURLs en IndexedDB).
     *  La principal vive en `imagen`; estas son las del índice 1+. */
    imagenes_extras?: { id: number; url: string; orden: number }[]
}

export interface LoteLocal {
    id_lote: string
    producto: string
    costo: number
    precio_venta: number
    stock_lote: number
    fecha_entrada: string
    estado: string
    etiqueta?: string
    variacion_id?: number | null
    variacion?: string
}

export interface VariacionLocal {
    id?: number            // ++id auto-increment (Dexie genera al add())
    producto: string
    nombre: string
    precio: number
    foto?: string
    tamano_cm?: number | null   // Tamaño propio (066): pill "X cm" en el catálogo
}

export interface RecetaLocal {
    id?: number            // ++id auto-increment (Dexie genera al add())
    producto: string
    material: string
    cantidad: number
    variacion_id?: number | null
}

/**
 * Ledger transaccional (idéntico a MovimientoInventario, contracto 040):
 * append-only, cantidad con signo (+ entra, − sale), snapshot del stock.
 */
export interface MovimientoLocal {
    id?: string
    producto_id: number | null
    producto: string
    variacion: string | null
    id_lote: string | null
    tipo: "entrada" | "salida" | "ajuste"
    origen: "venta" | "restock" | "ajuste_manual" | "edicion_venta" | "anulacion" | "baja_lote" | "conteo"
    cantidad: number
    stock_resultante: number | null
    referencia_id: string | null
    concepto: string | null
    fecha: string
}

export interface VentaLocal {
    id?: number
    orden_id: string
    n_ticket: number
    fecha: string
    producto: string
    cantidad: number
    precio_lista: number
    precio_real: number
    costo_unitario: number
    total_venta: number
    ganancia_bruta: number
    estado: string
    tipo_producto?: string
    variacion?: string
    descripcion?: string | null
    categoria?: string | null
    id_lote?: string | null
    consumo?: { material: string; id_lote: string | null; cantidad: number; costo: number }[] | null
}

export interface OrdenLocal {
    id: string
    n_ticket: number
    fecha: string
    total: number
    ganancia: number
    cantidad_items: number
    estado: string
    metodo_pago?: string | null
    pagos?: { metodo: string; monto: number; referencia?: string | null; terminal_id?: string | null; comision?: number }[] | null
    propina?: number
    monto_recibido?: number | null
    cambio?: number | null
    comision_total?: number
    cliente_id?: string | null
    turno_id?: string | null
    // Mesa de origen (preset restaurante): snapshot del ticket cobrado en mesa
    mesa_id?: string | null
    mesa_nombre?: string | null
}

// ── Fase 2: gastos, clientes, terminales, turnos, mesas ──
export interface GastoLocal {
    id?: number
    fecha: string
    categoria: string
    descripcion: string
    monto: number
    estado?: string               // 'Activo' | 'Pendiente' (programados automáticos)
    gasto_programado_id?: string | null
}

export interface GastoCategoriaLocal {
    id: string
    nombre: string
}

export interface GastoProgramadoLocal {
    id: string
    nombre: string
    tipo: "fijo" | "porcentaje"
    valor: number
    frecuencia: "semanal" | "mensual" | "anual"
    proxima_fecha: string
    ultimo_monto?: number | null
}

export interface ClienteLocal {
    id: string
    nombre: string
    email: string | null
    telefono: string | null
    notas: string | null
    pin_hash: string | null       // SHA-256 del PIN (como el backend: jamás texto plano)
    activo: boolean
    fecha_registro: string
    cumpleanos: string | null
    origen: string | null
    saldo_puntos: number
    total_gastado: number          // snapshot al crear; el resto es historia
}

export interface MovimientoPuntosLocal {
    id: string
    cliente_id: string
    tipo: "ganados" | "canjeados" | "ajuste"
    puntos: number
    valor_monetario: number | null
    concepto: string | null
    fecha: string
    orden_id: string | null
}

export interface EtiquetaLocal {
    id: string
    nombre: string
    color: string
}

export interface InteraccionLocal {
    id: string
    cliente_id: string
    tipo: "nota" | "llamada" | "visita" | "promo"
    texto: string
    creado_por: string
    fecha: string
}

export interface TerminalLocal {
    id: string
    nombre: string
    banco?: string | null
    comision_debito_pct: number
    comision_credito_pct: number
    comision_fija: number
    activo: boolean
}

export interface TurnoLocal {
    id: string
    estado: "Abierto" | "Cerrado"
    abierta_en: string
    cerrada_en: string | null
    monto_apertura: number
    efectivo_esperado: number | null
    efectivo_contado: number | null
    diferencia: number | null
    notas?: string | null
    num_ordenes: number
    total_turno: number
    efectivo_cobrado: number
}

export interface MesaLocal {
    id: string
    nombre: string
    capacidad?: number | null
    orden: number
    estado: "Libre" | "Ocupada" | "Cuenta"
    abierta_en?: string | null
    creada_en: string
}

export interface MesaItemLocal {
    id: string
    mesa_id: string
    producto: string
    descripcion?: string | null
    categoria?: string | null
    variacion?: string | null
    cantidad: number
    precio_unitario: number
    costo?: number | null
    notas?: string | null
    creado_en: string
}

// ── Fase 3: conteos de auditoría (espejo de migraciones 041/056/057) ──
export interface ConteoLocal {
    id: string
    estado: "abierto" | "cerrado"
    abierto_at: string
    cerrado_at: string | null
    resumen: import("@/types").ResumenConteo | null
    alcance?: import("@/types").AlcanceConteo | null
}

// ── Publish de catálogo online (snapshot del delta, clave = fila) ──
export interface CatalogoPublicadoLocal {
    /** '__config__' | 'producto||variacion' (variación '' = base) */
    clave: string
    /** Hash determinista del contenido público (sin la URL de foto): si no
     * cambia, la fila no se sube de nuevo (publish delta). */
    hash: string
    /** Hash de la FOTO (aparte): si no cambió se reutiliza la URL de
     * Cloudinary ya conocida sin re-subir la imagen. */
    foto_hash?: string
    /** Payload público de la fila (data=null ⇒ pendiente de BORRAR en nube) */
    data: Record<string, unknown> | null
    orden: number
    /** Slug devuelto por el backend al publicar (link "Ver catálogo") */
    slug?: string
    /** ISO local del último publish confirmado de esta fila */
    publicado_en?: string
}

export interface ConteoItemLocal {
    id: string
    conteo_id: string
    /** En la nube es el id numérico del producto; en local la fila vive por
     * NOMBRE (d1.productos.producto), así que se guarda referencia mínima. */
    producto_id: number | null
    producto: string
    /** '' = stock base del producto (sin variación) */
    variacion: string
    /** Snapshot del stock del sistema al ABRIR el conteo */
    esperado: number
    contado: number | null
    /** Stock vivo al cierre (solo se llena al cerrar) */
    vivo: number | null
    delta: number | null
    resolucion: import("@/types").ResolucionConteo | null
    origen?: "snapshot" | "manual"
    inicial?: number | null
}

export class DBLocal extends Dexie {
    perfil!: Table<PerfilLocal, number>
    categorias!: Table<CategoriaLocal, string>
    productos!: Table<ProductoLocal, string>
    lotes!: Table<LoteLocal, string>
    variaciones!: Table<VariacionLocal, number>
    recetas!: Table<RecetaLocal, number>
    movimientos!: Table<MovimientoLocal, number>
    ventas!: Table<VentaLocal, number>
    ordenes!: Table<OrdenLocal, string>
    // ── Fase 2 ──
    gastos!: Table<GastoLocal, number>
    gastos_categorias!: Table<GastoCategoriaLocal, string>
    gastos_programados!: Table<GastoProgramadoLocal, string>
    clientes!: Table<ClienteLocal, string>
    clientes_puntos!: Table<MovimientoPuntosLocal, string>
    clientes_etiquetas!: Table<EtiquetaLocal, string>
    clientes_cliente_etiqueta!: Table<{ cliente_id: string; etiqueta_id: string }, [string, string]>
    clientes_interacciones!: Table<InteraccionLocal, string>
    terminales!: Table<TerminalLocal, string>
    turnos!: Table<TurnoLocal, string>
    mesas!: Table<MesaLocal, string>
    mesa_items!: Table<MesaItemLocal, string>
    // ── Fase 3: conteos de auditoría ──
    conteos!: Table<ConteoLocal, string>
    conteo_items!: Table<ConteoItemLocal, string>
    // ── Publish de catálogo online (delta) ──
    catalogo_publicado!: Table<CatalogoPublicadoLocal, string>

    constructor(nombre: string) {
        super(nombre)
        this.version(1).stores({
            perfil: "id",
            categorias: "id, nombre, orden",
            productos: "producto, estado, tipo_producto",
            lotes: "id_lote, producto, estado, variacion_id, fecha_entrada",
            variaciones: "++id, producto",
            recetas: "++id, producto, material",
            movimientos: "++id, fecha, tipo, producto",
            ventas: "++id, orden_id, fecha, n_ticket, estado, producto",
            ordenes: "id, fecha, n_ticket, estado, turno_id",
        })
        // Fase 2: gastos, clientes/puntos, terminales, turnos, mesas.
        // (`++id` auto-incrementa; `m_idx_*` índices auxiliares)
        this.version(2).stores({
            perfil: "id",
            categorias: "id, nombre, orden",
            productos: "producto, estado, tipo_producto",
            lotes: "id_lote, producto, estado, variacion_id, fecha_entrada",
            variaciones: "++id, producto",
            recetas: "++id, producto, material",
            movimientos: "++id, fecha, tipo, producto",
            ventas: "++id, orden_id, fecha, n_ticket, estado, producto, m_idx_cliente",
            ordenes: "id, fecha, n_ticket, estado, turno_id, m_idx_cliente",
            gastos: "++id, fecha, categoria, estado, gasto_programado_id",
            gastos_categorias: "id, nombre",
            gastos_programados: "id, frecuencia, proxima_fecha",
            clientes: "id, nombre, activo",
            clientes_puntos: "id, cliente_id, fecha, m_idx_orden",
            clientes_etiquetas: "id, nombre",
            clientes_cliente_etiqueta: "[cliente_id+etiqueta_id]",
            clientes_interacciones: "id, cliente_id, fecha",
            terminales: "id, activo",
            turnos: "id, estado, abierta_en",
            mesas: "id, orden, estado",
            mesa_items: "id, mesa_id, producto",
        })
        // Fase 3: conteos de auditoría (páginas históricas y renglones).
        this.version(3).stores({
            conteos: "id, estado, abierto_at",
            conteo_items: "id, conteo_id, producto",
        })
        // Publish de catálogo online: snapshot local del delta (la clave ES
        // la fila: '__config__' o 'producto||variacion'). Solo guardamos lo
        // que publicamos (y su hash), para calcular el siguiente delta sin
        // depender de la nube (funciona offline siempre).
        this.version(4).stores({
            catalogo_publicado: "clave, orden",
        })
    }
}

let _db: DBLocal | null = null
let _dbNombre: string | null = null

/**
 * Abre (y cachea) la DB del tenant activo. Lanza si no hay licencia:
 * el guard de licencia corre ANTES que cualquier render que toque datos.
 *
 * DUAL MOTOR (invisible para los repos):
 *   * Web/PWA → Dexie/IndexedDB como siempre (comportamiento intacto).
 *   * App nativa (Capacitor/Android) → shim SQLite (sqlite/tablas.ts):
 *     archivo real en el sandbox del dispositivo, sobrevive a "borrar datos
 *     del navegador", transacciones atómicas BEGIN/COMMIT y listo para
 *     SQLCipher + backup cifrado (Fase 2). El cast en la frontera es el
 *     ÚNICO punto donde los dos motores se cruzan: los repos no cambian.
 */
export function abrirDB(): DBLocal {
    const lic = obtenerLicencia()
    if (!lic) throw new Error("Sin licencia de dispositivo: no hay DB local que abrir.")
    if (_db && _dbNombre === lic.tenant_id) return _db
    if (_db) _db.close()
    if (Capacitor.isNativePlatform()) {
        // DBSQLite expone la misma superficie que usa DBLocal (verificado en
        // la auditoría de repos); el cast es el contrato de la frontera.
        _db = DBSQLite.abrir(`nezzura_local_${lic.tenant_id}`) as unknown as DBLocal
    } else {
        _db = new DBLocal(`nezzura_local_${lic.tenant_id}`)
    }
    _dbNombre = lic.tenant_id
    return _db
}

export async function borrarDBLocal(): Promise<void> {
    const lic = obtenerLicencia()
    if (!lic) return
    if (_db) { _db.close(); _db = null; _dbNombre = null }
    if (Capacitor.isNativePlatform()) {
        await DBSQLite.abrir(`nezzura_local_${lic.tenant_id}`).destruir()
        return
    }
    await Dexie.delete(`nezzura_local_${lic.tenant_id}`)
}

/** Marca de tiempo local ISO (YYYY-MM-DDTHH:MM) — las consultas comparan por día. */
export function ahoraISO(): string {
    return new Date().toISOString().slice(0, 16)
}

export function hoyISO(): string {
    return new Date().toISOString().slice(0, 10)
}
