// ==============================================================================
// src/hooks/useConteoData.ts
// Estado y datos del conteo de auditoría (tab Auditoría de Inventario).
// - Sesión abierta + renglones del snapshot e historial de cerrados (react-query).
// - Capturas locales con autosave: debounce de 800ms → PATCH /items. Los
//   valores son ABSOLUTOS (no incrementales), así los reintentos de red son
//   idempotentes (mismo patrón del buscador debounced de useInventarioUI).
// - Respaldo en localStorage: si la red falla o se recarga la página antes del
//   flush, las capturas pendientes se recuperan al volver y se envían solas.
// ==============================================================================

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type Conteo, type ConteoItem, type ResolucionConteoItem, type ResumenConteo } from "@/lib/api"
import { inventarioQueryKeys } from "@/lib/inventarioQueries"
import { useTenant } from "@/contexts/TenantContext"
import { useToast } from "@/components/ui/Toast"

const DELAY_AUTOSAVE_MS = 800

/** Clave única de un renglón del conteo: nombre del producto + variación. */
export function claveConteo(producto: string, variacion: string): string {
    return `${producto}||${variacion}`
}

interface RespaldoLocal {
    capturas: Record<string, number | null>
    /** true = hay capturas que no llegaron al servidor (red caída / recarga) */
    pendientes: boolean
}

function claveStorage(conteoId: string): string {
    return `goyangi-conteo-${conteoId}`
}

function leerRespaldo(conteoId: string): RespaldoLocal | null {
    try {
        const crudo = localStorage.getItem(claveStorage(conteoId))
        return crudo ? (JSON.parse(crudo) as RespaldoLocal) : null
    } catch {
        return null
    }
}

function escribirRespaldo(conteoId: string, respaldo: RespaldoLocal) {
    try {
        localStorage.setItem(claveStorage(conteoId), JSON.stringify(respaldo))
    } catch {
        /* localStorage lleno o deshabilitado: el autosave en vivo sigue */
    }
}

export function useConteoData() {
    const { tenant } = useTenant()
    const { mostrarMsg } = useToast()
    const queryClient = useQueryClient()
    const tenantId = tenant?.tenant_id

    const activoQuery = useQuery({
        queryKey: tenantId ? ["conteo-activo", tenantId] : ["conteo-activo", "sin-tenant"],
        queryFn: () => api.getConteoActivo(),
        enabled: Boolean(tenantId),
    })
    const historialQuery = useQuery({
        queryKey: tenantId ? ["conteos-historial", tenantId] : ["conteos-historial", "sin-tenant"],
        queryFn: () => api.getHistorialConteos(30),
        enabled: Boolean(tenantId),
    })

    const sesion: Conteo | null = activoQuery.data?.conteo ?? null
    const items: ConteoItem[] = activoQuery.data?.items ?? []
    const conteoId = sesion?.id ?? null

    // ── Capturas locales (valor absoluto por renglón) + autosave ──
    const [capturas, setCapturas] = useState<Record<string, number | null>>({})
    const [guardandoCaptura, setGuardandoCaptura] = useState(false)
    const [cerrando, setCerrando] = useState(false)
    const [abriendo, setAbriendo] = useState(false)
    const pendientesRef = useRef<Set<string>>(new Set())
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const conteoIdRef = useRef<string | null>(null)
    const capturasRef = useRef(capturas)
    capturasRef.current = capturas

    // Envía SOLO lo pendiente (no el mapa completo): el PATCH es absoluto e
    // idempotente, pero enviar cientos de renglones por cada autosave pesaría.
    async function vaciarPendientes() {
        const idActivo = conteoIdRef.current
        const claves = Array.from(pendientesRef.current)
        if (!idActivo || claves.length === 0) return
        setGuardandoCaptura(true)
        try {
            const payload = claves.map(k => {
                const [producto, ...resto] = k.split("||")
                return { producto, variacion: resto.join("||"), contado: capturasRef.current[k] ?? null }
            })
            await api.guardarCapturas(idActivo, payload)
            for (const k of claves) pendientesRef.current.delete(k)
            escribirRespaldo(idActivo, { capturas: capturasRef.current, pendientes: pendientesRef.current.size > 0 })
        } catch {
            // La red falló: los valores quedan pendientes y se reintentan con la
            // próxima captura (o al recargar la página, vía el respaldo local).
            mostrarMsg(false, "No se pudo guardar la captura — se reintentará automáticamente")
        } finally {
            setGuardandoCaptura(false)
        }
    }

    // Al (re)conocer una sesión: sembrar capturas desde el servidor y, si quedó
    // respaldo local pendiente, mezclarlo y disparar el envío inmediato.
    // Solo corre cuando CAMBIA el id de la sesión (un refetch de foco no debe
    // pisar las ediciones locales).
    useEffect(() => {
        if (!conteoId) {
            conteoIdRef.current = null
            setCapturas({})
            pendientesRef.current = new Set()
            return
        }
        if (conteoIdRef.current === conteoId) return
        conteoIdRef.current = conteoId

        const delServidor: Record<string, number | null> = {}
        for (const it of items) delServidor[claveConteo(it.producto, it.variacion)] = it.contado

        const respaldo = leerRespaldo(conteoId)
        if (respaldo?.pendientes) {
            const mezcladas = { ...delServidor, ...respaldo.capturas }
            const aEnviar = Object.keys(mezcladas).filter(k => mezcladas[k] !== delServidor[k])
            setCapturas(mezcladas)
            pendientesRef.current = new Set(aEnviar)
            vaciarPendientes()
        } else {
            setCapturas(delServidor)
            pendientesRef.current = new Set()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conteoId])

    // Cancelar el timer al desmontar (lo no enviado queda protegido en localStorage)
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

    /** Fija el total contado de un renglón (absoluto; null = quitar captura). */
    function marcarContado(producto: string, variacion: string, valor: number | null) {
        const id = conteoIdRef.current
        if (!id) return
        const clave = claveConteo(producto, variacion)
        const limpio = valor === null ? null : Math.max(0, Math.round(valor * 1000) / 1000)
        const nuevas = { ...capturasRef.current, [clave]: limpio }
        capturasRef.current = nuevas
        setCapturas(nuevas)
        pendientesRef.current.add(clave)
        escribirRespaldo(id, { capturas: nuevas, pendientes: true })
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(vaciarPendientes, DELAY_AUTOSAVE_MS)
    }

    async function invalidarSesion() {
        if (!tenantId) return
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["conteo-activo", tenantId] }),
            queryClient.invalidateQueries({ queryKey: ["conteos-historial", tenantId] }),
        ])
    }

    async function abrir(): Promise<boolean> {
        if (abriendo || cerrando) return false
        setAbriendo(true)
        try {
            await api.abrirConteo()
            await invalidarSesion()
            mostrarMsg(true, "Conteo iniciado — cuenta todo lo físico y ciérralo al terminar")
            return true
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error al iniciar el conteo"}`)
            return false
        } finally {
            setAbriendo(false)
        }
    }

    /**
     * Cierra la sesión aplicando las resoluciones. Antes de cerrar fuerza el
     * envío de lo pendiente: el backend resuelve contra los `contado` del
     * servidor, así que nada puede quedarse sin guardar.
     */
    async function cerrar(resoluciones: ResolucionConteoItem[], fecha?: string): Promise<ResumenConteo | null> {
        const id = conteoIdRef.current
        if (!id || cerrando) return null
        setCerrando(true)
        if (timerRef.current) clearTimeout(timerRef.current)
        await vaciarPendientes()
        try {
            const r = await api.cerrarConteo(id, resoluciones, fecha)
            localStorage.removeItem(claveStorage(id))
            conteoIdRef.current = null
            setCapturas({})
            pendientesRef.current = new Set()
            await invalidarSesion()
            // El cierre cambia stock (salidas/entradas/ajustes) y puede crear un
            // ticket retroactivo: refrescar inventario, lotes, ventas y órdenes.
            if (tenantId) {
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.productos(tenantId) }),
                    queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.lotes(tenantId) }),
                    queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.ordenes(tenantId) }),
                    queryClient.invalidateQueries({ queryKey: inventarioQueryKeys.ventas(tenantId) }),
                ])
            }
            return r.resumen
        } catch (e: unknown) {
            mostrarMsg(false, `${e instanceof Error ? e.message : "Error al cerrar el conteo"}`)
            return null
        } finally {
            setCerrando(false)
        }
    }

    return {
        sesion,
        sesionAbierta: Boolean(sesion),
        items,
        cargando: activoQuery.isPending,
        capturas,
        marcarContado,
        guardandoCaptura,
        abrir,
        abriendo,
        cerrar,
        cerrando,
        historial: historialQuery.data ?? [],
        cargandoHistorial: historialQuery.isPending,
    }
}
