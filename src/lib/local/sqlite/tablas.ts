// ==============================================================================
// sqlite/tablas.ts — Shim compatible con Dexie sobre SQLite nativo.
//
// Replica EXACTAMENTE la superficie de la API de Dexie que usan los 11 repos
// locales (medida por auditoría: where().equals(), orderBy(), get, put, add,
// update, delete, clear, count, bulkAdd, bulkPut, last, first, toArray, each,
// filter, reverse, transaction, tables) con la MISMA semántica:
//
//   * add  → INSERT; falla si la llave ya existe (como Dexie/ConstraintError).
//   * put  → INSERT OR REPLACE (reemplaza el objeto completo).
//   * update(clave, cambios) → MERGE superficial en el objeto existente,
//     devuelve 1 si tocó una fila, 0 si no (idéntico a Dexie).
//   * autoinc (`++id`) → MAX(clave)+1 asignado dentro del objeto y como
//     llave, igual que Dexie mantiene el keyPath dentro del registro.
//   * llave compuesta → JSON del arreglo [a, b] (delete([c,e]) funciona).
//   * where().equals() → comparación parametrizada contra columna indexada
//     con la MISMA codificación de valores (true↔1, undefined↔NULL).
//   * transaction("rw", …tablas, fn) → BEGIN IMMEDIATE … COMMIT real: todo
//     lo que corre dentro es atómico (el bug del cobro parcial desaparece).
//
// Los tipos son los suyos propios (TablaSQLite<T,K>); el puente hacia los
// repos se hace en db.ts con un único cast documentado en la frontera.
// ==============================================================================

import type { DriverSQLite } from "./driver"
import { crearDriverSQLite } from "./driver"
import { DEFS, VERSION_ESQUEMA, codificarValor, type DefTabla } from "./esquema"

/** Sanitiza un nombre de campo de índice: SOLO se permiten campos declarados
 * en el esquema (whitelist de Dexie stores). Un campo no declarado lanza,
 * igual que Dexie lanza SchemaError — nunca degradamos a resultado vacío. */
function campoValido(def: DefTabla, campo: string): string {
    if (!def.idx.includes(campo)) {
        throw new Error(
            `SQLite shim: "${campo}" no está indexado en la tabla "${def.nombre}". ` +
            `Agrégalo a DEFS en sqlite/esquema.ts (espejo de las stores de Dexie).`
        )
    }
    return campo
}

export class ColeccionSQLite<T> {
    constructor(
        private driver: DriverSQLite,
        private def: DefTabla,
        private sqlBase: string,
        private params: unknown[],
        private campoOrden?: string,
        private descendente = false,
    ) {}

    private sqlCon(orden: "asc" | "desc" | "ninguno", limite?: number): string {
        let sql = this.sqlBase
        if (orden !== "ninguno" && this.campoOrden) {
            sql += ` ORDER BY "${this.campoOrden}" ${orden === "desc" ? "DESC" : "ASC"}`
        }
        if (limite !== undefined) sql += ` LIMIT ${limite}`
        return sql
    }

    private async filas(sql: string): Promise<T[]> {
        const filas = await this.driver.consultar(sql, this.params)
        return filas.map(f => JSON.parse(f.valor as string) as T)
    }

    toArray(): Promise<T[]> {
        return this.filas(this.sqlCon(this.descendente ? "desc" : "asc"))
    }

    async first(): Promise<T | undefined> {
        const r = await this.filas(this.sqlCon(this.descendente ? "desc" : "asc", 1))
        return r[0]
    }

    async last(): Promise<T | undefined> {
        // last() de Dexie respeta la dirección del orden base y toma el final.
        const r = await this.filas(this.sqlCon(this.descendente ? "asc" : "desc", 1))
        return r[0]
    }

    async count(): Promise<number> {
        const filas = await this.driver.consultar(
            `SELECT COUNT(*) AS n FROM (${this.sqlCon("ninguno")})`, this.params
        )
        return Number(filas[0]?.n ?? 0)
    }

    async each(cb: (x: T) => void): Promise<void> {
        for (const x of await this.toArray()) cb(x)
    }

    filter(cb: (x: T) => boolean): ColeccionSQLite<T> {
        // Client-side como Dexie Collection.filter.
        const copia = this
        return {
            ...copia,
            toArray: async () => (await copia.toArray()).filter(cb),
            first: async () => (await copia.toArray()).find(cb),
            last: async () => {
                const r = (await copia.toArray()).filter(cb)
                return r[r.length - 1]
            },
            count: async () => (await copia.toArray()).filter(cb).length,
            each: async (fn: (x: T) => void) => { (await copia.toArray()).forEach(fn) },
        } as ColeccionSQLite<T>
    }

    reverse(): ColeccionSQLite<T> {
        return new ColeccionSQLite(
            this.driver, this.def, this.sqlBase, this.params,
            this.campoOrden, !this.descendente,
        )
    }
}

export class DondeSQLite<T> {
    constructor(
        private driver: DriverSQLite,
        private def: DefTabla,
        private campo: string,
    ) {}

    equals(valor: unknown): ColeccionSQLite<T> {
        const sql = `SELECT valor FROM "${this.def.nombre}" WHERE "${this.campo}" = ?`
        return new ColeccionSQLite<T>(this.driver, this.def, sql, [codificarValor(valor)])
    }
}

export class TablaSQLite<T, K = unknown> {
    name: string
    private def: DefTabla

    constructor(private driver: DriverSQLite, def: DefTabla) {
        this.def = def
        this.name = def.nombre
    }

    /** Llave codificada: autoinc → número crudo; compuesta/texto → JSON. */
    private aClaveSQL(clave: unknown): string | number {
        if (this.def.autoinc) {
            const campo = this.def.camposClave[0]
            const v = typeof clave === "object" && clave !== null
                ? (clave as Record<string, unknown>)[campo]
                : clave
            return Number(v)
        }
        if (this.def.camposClave.length > 1) {
            // Llave compuesta: puede llegar como arreglo o como objeto.
            if (Array.isArray(clave)) return JSON.stringify(clave)
            return JSON.stringify(this.def.camposClave.map(c => (clave as Record<string, unknown>)[c]))
        }
        if (typeof clave === "object") return JSON.stringify((clave as Record<string, unknown>)[this.def.camposClave[0]])
        return JSON.stringify(clave)
    }

    private llaveDeObjeto(obj: Record<string, unknown>): string | number {
        if (this.def.autoinc) return Number(obj[this.def.camposClave[0]])
        if (this.def.camposClave.length > 1) {
            return JSON.stringify(this.def.camposClave.map(c => obj[c]))
        }
        return JSON.stringify(obj[this.def.camposClave[0]])
    }

    private async escribir(obj: Record<string, unknown>, reemplazar: boolean): Promise<unknown> {
        let claveSQL: string | number
        if (this.def.autoinc && obj[this.def.camposClave[0]] == null) {
            const filas = await this.driver.consultar(
                `SELECT MAX(clave) AS m FROM "${this.def.nombre}"`
            )
            const siguiente = Number(filas[0]?.m ?? 0) + 1
            obj = { ...obj, [this.def.camposClave[0]]: siguiente }
            claveSQL = siguiente
        } else {
            claveSQL = this.llaveDeObjeto(obj)
        }
        const colsIdx = this.def.idx
        const placeholders = ["?", "?", ...colsIdx.map(() => "?")]
        const valores = [
            claveSQL,
            JSON.stringify(obj),
            ...colsIdx.map(c => codificarValor(obj[c])),
        ]
        const sql = `${reemplazar ? "INSERT OR REPLACE" : "INSERT"} INTO "${this.def.nombre}"
            (clave, valor${colsIdx.length ? ", " + colsIdx.map(c => `"${c}"`).join(", ") : ""})
            VALUES (${placeholders.join(", ")})`
        if (reemplazar) {
            await this.driver.ejecutar(sql, valores)
        } else {
            try {
                await this.driver.ejecutar(sql, valores)
            } catch (e) {
                if (String(e).includes("UNIQUE")) {
                    throw new Error(`ConstraintError: clave duplicada en "${this.def.nombre}"`)
                }
                throw e
            }
        }
        return this.def.autoinc ? Number(obj[this.def.camposClave[0]]) : undefined
    }

    async get(clave: unknown): Promise<T | undefined> {
        const filas = await this.driver.consultar(
            `SELECT valor FROM "${this.def.nombre}" WHERE clave = ?`,
            [this.aClaveSQL(clave)],
        )
        return filas.length ? (JSON.parse(filas[0].valor as string) as T) : undefined
    }

    put(obj: T & Record<string, unknown>): Promise<unknown> {
        return this.escribir(obj, true)
    }

    add(obj: T & Record<string, unknown>): Promise<unknown> {
        return this.escribir(obj, false)
    }

    async bulkAdd(objs: (T & Record<string, unknown>)[]): Promise<void> {
        for (const o of objs) await this.escribir(o, false)
    }

    async bulkPut(objs: (T & Record<string, unknown>)[]): Promise<void> {
        for (const o of objs) await this.escribir(o, true)
    }

    async update(clave: unknown, cambios: Record<string, unknown>): Promise<number> {
        const actual = await this.get(clave)
        if (actual === undefined) return 0
        const fusionado = { ...(actual as Record<string, unknown>), ...cambios }
        // El merge superficial de Dexie puede cambiar campos indexados:
        // re-extraemos las columnas junto con el JSON.
        const colsIdx = this.def.idx
        await this.driver.ejecutar(
            `UPDATE "${this.def.nombre}" SET valor = ?${colsIdx.length
                ? ", " + colsIdx.map(c => `"${c}" = ?`).join(", ")
                : ""} WHERE clave = ?`,
            [
                JSON.stringify(fusionado),
                ...colsIdx.map(c => codificarValor(fusionado[c])),
                this.aClaveSQL(clave),
            ],
        )
        return 1
    }

    async delete(clave: unknown): Promise<void> {
        await this.driver.ejecutar(
            `DELETE FROM "${this.def.nombre}" WHERE clave = ?`,
            [this.aClaveSQL(clave)],
        )
    }

    async clear(): Promise<void> {
        await this.driver.ejecutar(`DELETE FROM "${this.def.nombre}"`)
    }

    async count(): Promise<number> {
        const filas = await this.driver.consultar(
            `SELECT COUNT(*) AS n FROM "${this.def.nombre}"`
        )
        return Number(filas[0]?.n ?? 0)
    }

    async toArray(): Promise<T[]> {
        return new ColeccionSQLite<T>(this.driver, this.def, `SELECT valor FROM "${this.def.nombre}"`, []).toArray()
    }

    where(campo: string): DondeSQLite<T> {
        return new DondeSQLite<T>(this.driver, this.def, campoValido(this.def, campo))
    }

    orderBy(campo: string): ColeccionSQLite<T> {
        return new ColeccionSQLite<T>(
            this.driver, this.def,
            `SELECT valor FROM "${this.def.nombre}"`, [],
            campoValido(this.def, campo),
        )
    }
}

export class DBSQLite {
    /** Nombre lógico de la base (misma convención que Dexie: nezzura_local_<tenant>). */
    name: string
    /** Número de versión del esquema (equivalente a Dexie .verno). */
    verno = VERSION_ESQUEMA
    tables: TablaSQLite<never>[]
    private driverPromise: Promise<DriverSQLite> | null = null
    private driver: DriverSQLite | null = null

    private constructor(nombreDB: string) {
        this.name = nombreDB
        const tablas: Record<string, TablaSQLite<never>> = {}
        // El driver se resuelve de forma perezosa: la primera operación
        // await driverPromise antes de tocar SQLite.
        const obtenerDriver = async (): Promise<DriverSQLite> => {
            if (this.driver) return this.driver
            if (!this.driverPromise) {
                this.driverPromise = crearDriverSQLite(nombreDB)
            }
            this.driver = await this.driverPromise
            return this.driver
        }
        const alDriver = async (): Promise<DriverSQLite> => {
            if (this._enTransaccion && this.driver) return this.driver
            return obtenerDriver()
        }
        this._obtenerDriver = alDriver
        for (const def of Object.values(DEFS)) {
            const t = new TablaSQLite<never, never>({ ejecutar: (s, p) => alDriver().then(d => d.ejecutar(s, p)), consultar: (s, p) => alDriver().then(d => d.consultar(s, p)), transaccion: fn => alDriver().then(d => d.transaccion(fn)) } as DriverSQLite, def)
            tablas[def.nombre] = t
        }
        this.tables = Object.values(tablas)
        for (const [nombre, t] of Object.entries(tablas)) {
            // @ts-expect-error — índice dinámico de tablas por nombre
            this[nombre] = t
        }
    }

    private _obtenerDriver!: () => Promise<DriverSQLite>
    private _enTransaccion = false

    /** Fábrica SÍNCRONA — requisito de `abrirDB()` (que no puede esperar).
     * El driver real y el esquema se preparan con pereza en la primera
     * operación; usa precalentar() para validar al arrancar la app. */
    static abrir(nombreDB: string): DBSQLite {
        return new DBSQLite(nombreDB)
    }

    /** Abre el driver y prepara/valida el esquema YA (no pereza). Ideal para
     * el arranque de la app: los errores de SQLite salen ahí, no en la
     * primera venta del día. */
    async precalentar(): Promise<void> {
        await this._obtenerDriver()
    }

    /** Destruye TODAS las tablas de esta base (equivalente a Dexie.delete).
     * Usado por borrarDBLocal() al salir del modo local / restaurar. */
    async destruir(): Promise<void> {
        const driver = await this._obtenerDriver()
        for (const def of Object.values(DEFS)) {
            await driver.ejecutar(`DROP TABLE IF EXISTS "${def.nombre}"`)
        }
        await driver.ejecutar("PRAGMA user_version = 0")
    }

    /** transaction("rw", …tablas, fn) — mismas firmas de llamada que Dexie. */
    async transaction(modo: "rw" | "r" | "readwrite" | "readonly", ...args: unknown[]): Promise<void> {
        void modo
        const fn = args[args.length - 1]
        if (typeof fn !== "function") throw new Error("transaction: falta el callback")
        const driver = await this._obtenerDriver()
        this._enTransaccion = true
        try {
            await driver.transaccion(fn as () => Promise<void>)
        } finally {
            this._enTransaccion = false
        }
    }

    /** Cierre pasivo: el plugin mantiene la conexión en caché por nombre;
     * cambiar de tenant solo deja de usarla (misma DB de plugin, distinta
     * base lógica). Los datos viven en archivos separados por tenant. */
    close(): void {
        /* no-op en nativo (ver comentario) */
    }
}
