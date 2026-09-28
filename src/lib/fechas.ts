// ==============================================================================
// src/lib/fechas.ts
// Normalización de fechas TEXT del backend a la zona horaria del negocio.
//
// ── ¿Por qué existe? ──
// El backend guarda ventas.fecha / gastos.fecha como TEXT con formatos mixtos:
//   1. ISO con offset:  "2026-09-26T21:01:11.214752-05:00"  (código nuevo)
//   2. ISO con 'Z':     "2026-09-22T12:00:00.000Z"          (toISOString del front)
//   3. Naive legacy:    "2026-06-22 00:22:44.237222"        (backend antiguo;
//      son instantes UTC guardados sin offset)
//   4. Solo fecha:      "2026-09-22"  (gastos del motor de programados: fecha
//      local del negocio, NO es un instante UTC)
//
// El bug: usar `fecha.substring(0, 10)` o `new Date(fecha)` con criterio
// inconsistente desplaza ventas nocturnas de día (medido: 9.6% de las ventas
// del tenant Kali caían en el día equivocado).
//
// CRITERIO ÚNICO (idéntico al de database/fechas.py en el backend):
//   - Con offset (ISO-T o sufijo Z/±HH:MM) → parsear respetando el offset.
//   - Solo fecha "YYYY-MM-DD"              → tratarla como fecha LOCAL pura.
//   - Naive (sin hora) "YYYY-MM-DD HH:MM"  → interpretar como UTC y convertir
//     a la zona del negocio.
// ==============================================================================

// Regex de formato ISO con 'T' (incluye "2026-09-28T..." y "2026-09-28T12:00:00Z")
const RE_ISO_T = /^\d{4}-\d{2}-\d{2}T/
// Regex de sufijo de offset: 'Z' o +HH:MM / +HHMM al final
const RE_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/
// Regex de fecha sola "YYYY-MM-DD"
const RE_SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Convierte el string de fecha del backend a un Date que representa el
 * instante correcto en UTC (respetando el formato de origen).
 * Devuelve null si el formato no es reconocido.
 */
export function parseFechaUTC(texto: string): Date | null {
    if (!texto) return null
    // Con 'T' u offset explícito → el parser estándar lo interpreta bien
    if (RE_ISO_T.test(texto) || RE_OFFSET.test(texto)) {
        const d = new Date(texto)
        return isNaN(d.getTime()) ? null : d
    }
    // Solo fecha → mediodía LOCAL del día indicado (nunca se mueve de día
    // al formatear localmente; el mediodía da margen ante cualquier horario
    // de verano)
    if (RE_SOLO_FECHA.test(texto)) {
        const [y, m, d] = texto.split("-").map(Number)
        return new Date(y, m - 1, d, 12, 0, 0)
    }
    // Naive legacy → es un instante UTC sin offset: declarar UTC
    const d = new Date(texto.replace(" ", "T") + "Z")
    return isNaN(d.getTime()) ? null : d
}

/**
 * Devuelve la FECHA LOCAL del negocio ("YYYY-MM-DD") a la que pertenece el
 * registro. Es la función que deben usar TODAS las agrupaciones por día
 * (gráficas, "mejor día", filtros de rango).
 *
 * zonaHoraria: IANA del tenant (ej. "America/Cancun"). Si no se conoce,
 * se usa la del navegador (mejor esfuerzo, mismo criterio que antes).
 */
export function fechaLocal(texto: string, zonaHoraria?: string): string {
    const d = parseFechaUTC(texto)
    if (!d) return texto.substring(0, 10) // fallback: no empeorar lo que había

    if (!zonaHoraria) {
        // Sin zona conocida → mejor esfuerzo con el reloj del navegador
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const dia = String(d.getDate()).padStart(2, "0")
        return `${y}-${m}-${dia}`
    }

    // Con zona IANA → formatear partes directamente en esa zona (sin librerías)
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: zonaHoraria,
        year: "numeric", month: "2-digit", day: "2-digit"
    })
    // en-CA devuelve "YYYY-MM-DD" con formatToParts garantizamos orden exacto
    return fmt.format(d)
}

/**
 * Igual que fechaLocal pero devolviendo el número del día de la semana
 * (0=domingo ... 6=sábado) en la zona del negocio.
 */
export function diaSemanaLocal(texto: string, zonaHoraria?: string): number {
    const d = parseFechaUTC(texto)
    if (!d) return new Date(texto).getDay() // fallback legacy
    if (!zonaHoraria) return d.getDay()
    // Determinar el día dentro de la zona: convertir a "YYYY-MM-DD" local y
    // construir un Date local de mediodía para leer su getDay()
    const iso = fechaLocal(texto, zonaHoraria)
    const [y, m, dia] = iso.split("-").map(Number)
    return new Date(y, m - 1, dia, 12, 0, 0).getDay()
}

/**
 * Fecha de hoy del negocio en "YYYY-MM-DD" según su zona horaria.
 * (El navegador puede estar en otra zona: el dueño viaja, el servidor no.)
 */
export function hoyNegocio(zonaHoraria?: string): string {
    return fechaLocal(new Date().toISOString(), zonaHoraria)
}
