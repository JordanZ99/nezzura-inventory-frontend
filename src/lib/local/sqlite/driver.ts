// ==============================================================================
// sqlite/driver.ts — Conexión SQLite NATIVA (plugin @capacitor-community/sqlite).
//
// Solo se usa dentro de la app nativa de Capacitor (Android primero). En la
// PWA web NO se toca: ahí `abrirDB()` sigue usando Dexie/IndexedDB tal como
// siempre (ver db.ts), así que el cambio de motor es invisible y sin riesgo.
//
// * La conexión se abre con inicialización perezosa (ensureListo): abrirDB()
//   sigue siendo síncrono y ninguna operación toca el plugin hasta que de
//   verdad se necesita.
// * El esquema se crea con PRAGMA user_version (equivalente a las versiones
//   de Dexie); las migraciones futuras añaden pasos numerados.
// * Las transacciones son BEGIN IMMEDIATE / COMMIT / ROLLBACK reales: esto
//   ARREGLA de paso el bug de `cobrarCarrito` (ventas.ts) donde lotes y
//   ledger quedaban fuera de la transacción Dexie — en SQLite todo el cobro
//   es atómico contra crash.
// ==============================================================================

import { DEFS, VERSION_ESQUEMA, ddlTabla } from "./esquema"
import type { SQLiteDBConnection } from "@capacitor-community/sqlite"

export interface FilaSQLite {
    [columna: string]: unknown
}

export interface DriverSQLite {
    /** Ejecuta una sentencia (INSERT/UPDATE/DELETE/DDL/PRAGMA). */
    ejecutar(sql: string, params?: unknown[]): Promise<void>
    /** Consulta filas (SELECT). Devuelve objetos {columna: valor}. */
    consultar(sql: string, params?: unknown[]): Promise<FilaSQLite[]>
    /** Bloque exclusivo BEGIN/COMMIT alrededor del callback. */
    transaccion<T>(fn: () => Promise<T>): Promise<T>
}

/** Tipo de los values[] del plugin (evita escribir `any` aquí). */
type ParametrosPlugin = Parameters<SQLiteDBConnection["run"]>[1]

/** Límite de reintentos si el plugin tarda en estar listo al abrir. */
const REINTENTOS_APERTURA = 5
const PAUSA_REINTENTO_MS = 300

export async function crearDriverSQLite(nombreDB: string): Promise<DriverSQLite> {
    // Import dinámico: el bundle web nunca carga el plugin.
    const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite")
    const sqlite = new SQLiteConnection(CapacitorSQLite)

    // (encrypted=false, mode="no-encryption", versión 1, readonly=false).
    // Fase 2: activar SQLCipher con clave generada y guardada en Secure
    // Preferences — el change-point está aquí y en createConnection.
    let conexion = null
    let ultimoError: unknown = null
    for (let intento = 0; intento < REINTENTOS_APERTURA; intento++) {
        try {
            conexion = await sqlite.createConnection(nombreDB, false, "no-encryption", 1, false)
            await conexion.open()
            break
        } catch (e) {
            ultimoError = e
            await new Promise(r => setTimeout(r, PAUSA_REINTENTO_MS))
        }
    }
    if (!conexion) {
        throw new Error(`No se pudo abrir SQLite nativo (${nombreDB}): ${String(ultimoError)}`)
    }
    const db = conexion

    let listo: Promise<void> | null = null
    async function preparar(): Promise<void> {
        const filas = await db.query("PRAGMA user_version")
        const version = Number((filas.values?.[0] as FilaSQLite | undefined)?.user_version ?? 0)
        if (version >= VERSION_ESQUEMA) return
        for (const def of Object.values(DEFS)) {
            for (const ddl of ddlTabla(def)) await db.execute(ddl)
        }
        await db.execute(`PRAGMA user_version = ${VERSION_ESQUEMA}`)
    }

    async function ensureListo(): Promise<void> {
        if (!listo) {
            listo = preparar().catch(e => {
                listo = null
                throw e
            })
        }
        await listo
    }

    const driver: DriverSQLite = {
        async ejecutar(sql, params = []) {
            await ensureListo()
            // execute() del plugin NO acepta parámetros (solo statement);
            // para sentencias parametrizadas se usa run().
            if (params.length) {
                await db.run(sql, params as ParametrosPlugin)
            } else {
                await db.execute(sql)
            }
        },
        async consultar(sql, params = []) {
            await ensureListo()
            const r = await db.query(sql, params as ParametrosPlugin)
            return (r.values ?? []) as FilaSQLite[]
        },
        async transaccion<T>(fn: () => Promise<T>): Promise<T> {
            await ensureListo()
            // Helpers nativos del plugin (rastrean el estado de transacción
            // internamente; BEGIN/COMMIT SQL crudo lo confundiría).
            await db.beginTransaction()
            try {
                const r = await fn()
                await db.commitTransaction()
                return r
            } catch (e) {
                try { await db.rollbackTransaction() } catch { /* el BEGIN ya murió */ }
                throw e
            }
        },
    }

    return driver
}
