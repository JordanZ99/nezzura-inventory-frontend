// ==============================================================================
// sqlite/esquema.ts — Espejo de las "stores" de Dexie (db.ts v1–v3) en SQLite.
//
// Estrategia de almacenamiento: cada tabla guarda el objeto completo como
// JSON en `valor` y los CAMPOS CONSULTADOS como columnas reales con índice.
// Con esto el shim (tablas.ts) replica la semántica de Dexie sin reescribir
// la lógica de negocio de los repos, y el archivo .sqlite sigue siendo UN
// solo archivo respaldable (Fase 2: backup cifrado a Supabase Storage).
//
//   clave : llave primaria — codificada igual que Dexie:
//             * tablas con `++id`: entero crudo (SQLite lo guarda numérico).
//             * tablas de llave texto: JSON.stringify(valor).
//             * llave compuesta (clientes_cliente_etiqueta): JSON del arreglo.
//   valor : JSON del objeto completo (Dexie guarda el keyPath dentro del
//           objeto; aquí también: el id vive dentro del JSON).
//   <campo> : columnas de índice solo para los campos que los repos consultan
//           con where()/orderBy() (whitelist de Dexie stores). Si un repo
//           futuro consulta un campo NO declarado aquí, el shim lanza error
//           igual que Dexie haría con SchemaError — nunca falla en silencio.
// ==============================================================================

/** Esquema espejo de db.ts versiones 1–3 (mismas tablas, mismos índices). */
export interface DefTabla {
    nombre: string
    /** Campos que forman la llave primaria: 1 campo normal, 2 si es compuesta. */
    camposClave: string[]
    /** `++id` de Dexie: la llave se autogenera si el objeto no la trae. */
    autoinc: boolean
    /** Campos consultables (whitelist de índices de Dexie stores). */
    idx: string[]
}

export const VERSION_ESQUEMA = 2

/** Campos numéricos: se guardan con afinidad REAL para que ORDER BY ordene
 * por magnitud y no lexicográficamente ("9" vs "10"). */
const CAMPOS_NUMERICOS = new Set(["n_ticket", "orden"])

export const DEFS: Record<string, DefTabla> = {
    // ── Fase 1 (v1) ──
    perfil: { nombre: "perfil", camposClave: ["id"], autoinc: false, idx: [] },
    categorias: { nombre: "categorias", camposClave: ["id"], autoinc: false, idx: ["nombre", "orden"] },
    productos: { nombre: "productos", camposClave: ["producto"], autoinc: false, idx: ["estado", "tipo_producto"] },
    lotes: { nombre: "lotes", camposClave: ["id_lote"], autoinc: false, idx: ["producto", "estado", "variacion_id", "fecha_entrada"] },
    variaciones: { nombre: "variaciones", camposClave: ["id"], autoinc: true, idx: ["producto"] },
    recetas: { nombre: "recetas", camposClave: ["id"], autoinc: true, idx: ["producto", "material"] },
    movimientos: { nombre: "movimientos", camposClave: ["id"], autoinc: true, idx: ["fecha", "tipo", "producto"] },
    ventas: { nombre: "ventas", camposClave: ["id"], autoinc: true, idx: ["orden_id", "fecha", "n_ticket", "estado", "producto"] },
    ordenes: { nombre: "ordenes", camposClave: ["id"], autoinc: false, idx: ["fecha", "n_ticket", "estado", "turno_id"] },
    // ── Fase 2 (v2) ──
    gastos: { nombre: "gastos", camposClave: ["id"], autoinc: true, idx: ["fecha", "categoria", "estado", "gasto_programado_id"] },
    gastos_categorias: { nombre: "gastos_categorias", camposClave: ["id"], autoinc: false, idx: ["nombre"] },
    gastos_programados: { nombre: "gastos_programados", camposClave: ["id"], autoinc: false, idx: ["frecuencia", "proxima_fecha"] },
    clientes: { nombre: "clientes", camposClave: ["id"], autoinc: false, idx: ["nombre", "activo"] },
    clientes_puntos: { nombre: "clientes_puntos", camposClave: ["id"], autoinc: false, idx: ["cliente_id", "fecha"] },
    clientes_etiquetas: { nombre: "clientes_etiquetas", camposClave: ["id"], autoinc: false, idx: ["nombre"] },
    clientes_cliente_etiqueta: { nombre: "clientes_cliente_etiqueta", camposClave: ["cliente_id", "etiqueta_id"], autoinc: false, idx: ["cliente_id", "etiqueta_id"] },
    clientes_interacciones: { nombre: "clientes_interacciones", camposClave: ["id"], autoinc: false, idx: ["cliente_id", "fecha"] },
    terminales: { nombre: "terminales", camposClave: ["id"], autoinc: false, idx: ["activo"] },
    turnos: { nombre: "turnos", camposClave: ["id"], autoinc: false, idx: ["estado", "abierta_en"] },
    mesas: { nombre: "mesas", camposClave: ["id"], autoinc: false, idx: ["orden", "estado"] },
    mesa_items: { nombre: "mesa_items", camposClave: ["id"], autoinc: false, idx: ["mesa_id", "producto"] },
    // ── Fase 3 (v3) ──
    conteos: { nombre: "conteos", camposClave: ["id"], autoinc: false, idx: ["estado", "abierto_at"] },
    conteo_items: { nombre: "conteo_items", camposClave: ["id"], autoinc: false, idx: ["conteo_id", "producto"] },
    // ── Publish de catálogo online (v2) ──
    catalogo_publicado: { nombre: "catalogo_publicado", camposClave: ["clave"], autoinc: false, idx: ["orden"] },
}

/** Codifica un valor de campo indexado al dominio de SQLite (misma función
 * para escribir y para consultar: true↔1, undefined↔NULL). */
export function codificarValor(v: unknown): string | number | null {
    if (v === undefined || v === null) return null
    if (typeof v === "boolean") return v ? 1 : 0
    if (typeof v === "number") return v
    if (typeof v === "string") return v
    // Objetos/arreglos no deberían ser campos indexados; se conservan
    // comparables como texto (paridad con Dexie, que indexaría [object Object]).
    return JSON.stringify(v)
}

/** Afinitad de columna para un campo indexado. */
export function afinidadDe(campo: string): string {
    return CAMPOS_NUMERICOS.has(campo) ? "REAL" : "BLOB"
}

/** DDL de creación de una tabla + sus índices. */
export function ddlTabla(def: DefTabla): string[] {
    const tipoClave = def.autoinc ? "INTEGER" : "TEXT"
    const colsIdx = def.idx
        .map(c => `"${c}" ${afinidadDe(c)}`)
        .join(",\n    ")
    const ddlTabla = `CREATE TABLE IF NOT EXISTS "${def.nombre}" (
    clave ${tipoClave} PRIMARY KEY,
    valor TEXT NOT NULL${colsIdx ? ",\n    " + colsIdx : ""}
)`
    const ddlIdx = def.idx.map(
        c => `CREATE INDEX IF NOT EXISTS "idx_${def.nombre}_${c}" ON "${def.nombre}"("${c}")`
    )
    return [ddlTabla, ...ddlIdx]
}
