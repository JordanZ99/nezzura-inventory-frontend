// ==============================================================================
// src/lib/local/repos/copia.ts
// Copia de seguridad 100% del cliente: exporta TODO el IndexedDB del negocio
// (incluye fotos en dataURL y el PIN hasheado) a JSON / CSV, y permite
// restaurarlo. Sin SheetJS: el "XLSX" local es un CSV Multi-UTF8-BOM.
// ==============================================================================

import { abrirDB } from "../db"

function pedirNombre(base: string, ext: string): string {
    return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`
}

function descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

// ============================================================================
// Exportar JSON (respaldo completo, restaurable)
// ============================================================================
export async function exportarJson(): Promise<void> {
    const d = abrirDB()
    const dump: { _meta: Record<string, unknown>; tablas: Record<string, unknown[]> } = {
        _meta: {
            app: "Nezzura Digital — Modo Local",
            db: d.name,
            version: d.verno,
            exportado: new Date().toISOString(),
        },
        tablas: {},
    }
    for (const nombre of d.tables) {
        dump.tablas[nombre.name] = await nombre.toArray()
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" })
    descargar(blob, pedirNombre("nezzura-respaldo", "json"))
}

// ============================================================================
// Exportar CSV (una tabla por hoja; sin dependencias — el backend usa openpyxl)
// ============================================================================
function csvEscapar(valor: unknown): string {
    if (valor == null) return ""
    const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor)
    if (/[",\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
    return texto
}

function csvDeFilas(filas: Record<string, unknown>[]): string {
    if (!filas.length) return ""
    const columnas = [...new Set(filas.flatMap(f => Object.keys(f)))]
    const lineas = [columnas.join(",")]
    for (const f of filas) {
        lineas.push(columnas.map(c => csvEscapar(f[c])).join(","))
    }
    return lineas.join("\r\n")
}

export async function exportarCsv(): Promise<void> {
    const d = abrirDB()
    const partes: string[] = []
    for (const tabla of d.tables) {
        const filas = await tabla.toArray()
        if (!filas.length) continue
        partes.push(`"=== ${tabla.name} ==="\r\n${csvDeFilas(filas)}\r\n`)
    }
    if (!partes.length) partes.push('"Sin datos todavía"\r\n')
    // BOM UTF-8: Excel abre el acento perfecto sin openpyxl
    const blob = new Blob(["\ufeff" + partes.join("\r\n")], { type: "text/csv;charset=utf-8" })
    descargar(blob, pedirNombre("nezzura-datos", "csv"))
}

// ============================================================================
// Importar JSON (restaura; pregunta antes de borrará lo actual)
// ============================================================================
export async function importarJson(archivo: File, reemplazar = false): Promise<Record<string, number>> {
    const texto = await archivo.text()
    const dump = JSON.parse(texto) as {
        _meta?: Record<string, unknown>
        tablas?: Record<string, unknown[]>
    }
    if (!dump.tablas) throw new Error("El archivo no es un respaldo válido de Nezzura.")

    const d = abrirDB()
    const tablas = dump.tablas
    const importadas: Record<string, number> = {}
    await d.transaction("rw", d.tables, async () => {
        if (reemplazar) {
            for (const tabla of d.tables) {
                await tabla.clear()
            }
        }
        for (const nombre of Object.keys(tablas)) {
            const tabla = d.tables.find(t => t.name === nombre)
            if (!tabla) continue                                    // esquema más nuevo que el respaldo
            const filas = tablas[nombre]
            if (!Array.isArray(filas)) continue
            if (reemplazar) {
                await tabla.bulkPut(filas as never[])
            } else {
                await tabla.bulkAdd(filas as never[])
            }
            importadas[nombre] = filas.length
        }
    })
    return importadas
}
