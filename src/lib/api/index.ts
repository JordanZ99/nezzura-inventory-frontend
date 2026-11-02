// ==============================================================================
// src/lib/api/index.ts  —  Interruptor NUBE ↔ LOCAL
//
// `api` es el único punto de datos que consumen las pantallas. Este módulo
// envuelve los módulos HTTP (los de siempre) con una capa doble:
//
//   - MODO NUBE: exactamente lo de hoy — peticiones al backend FastAPI.
//   - MODO LOCAL: las funciones del repositorio local (IndexedDB/Dexie en
//     el dispositivo); lo no portado todavía responde con un error CLARO
//     ("todavía no disponible en Modo Local") en lugar de colgarse intentando
//     una request sin internet.
//
// Los módulos HTTP por dominio (productosApi, ventasApi, ...) siguen
// exportándose sin tocar: el usuario de modo nube no nota nada.
// ==============================================================================

import { productosApi } from "./productos"
import { ventasApi } from "./ventas"
import { gastosApi } from "./gastos"
import { catalogoApi } from "./catalogo"
import { turnosApi } from "./turnos"
import { terminalesApi } from "./terminales"
import { statsApi } from "./stats"
import { mesasApi } from "./mesas"
import { clientesApi } from "./clientes"
import { conteosApi } from "./conteos"
import { analiticaApi } from "./analitica"
import { ApiError } from "./client"

import * as invLocal from "@/lib/local/repos/inventario"
import * as ventasLocal from "@/lib/local/repos/ventas"
import * as statsLocal from "@/lib/local/repos/stats"
import * as gastosLocal from "@/lib/local/repos/gastos"
import * as terminalesLocal from "@/lib/local/repos/terminales"
import * as turnosLocal from "@/lib/local/repos/turnos"
import * as mesasLocal from "@/lib/local/repos/mesas"
import * as clientesLocal from "@/lib/local/repos/clientes"
import { obtenerModo } from "@/lib/local/modo"
import { obtenerLicencia } from "@/lib/local/licencia"
import type {
    RespuestaOrdenesPaginadas, RangoFechas,
} from "@/types"

export * from "./client"
export * from "./productos"
export * from "./ventas"
export * from "./gastos"
export * from "./catalogo"
export * from "./turnos"
export * from "./terminales"
export * from "./stats"
export * from "./mesas"
export * from "./clientes"
export * from "./conteos"
export * from "./analitica"

/** Llamado en modo local a una función aún no portada → error explicado. */
function pendienteEnLocal(nombre: string): () => Promise<never> {
    return async () => {
        throw new ApiError(
            `"${nombre}" todavía no está disponible en Modo Local (fase 2 del desarrollo).`,
            { status: 501, codigo: "MODO_LOCAL_PENDIENTE" }
        )
    }
}

/**
 * Envuelve un módulo HTTP de dominio con el interruptor de modo.
 * En nube → delega a `http` (idéntico a hoy). En local → delega a `local`
 * si la función existe en él; si no, error explicado.
 */
function conModoDoble<T extends Record<string, unknown>>(
    http: T,
    local?: Record<string, (...args: never[]) => unknown>
): T {
    return new Proxy(http, {
        get(target, prop) {
            const enHttp = Reflect.get(target, prop)
            if (typeof enHttp !== "function") return enHttp
            if (obtenerModo() !== "local") return (enHttp as (...a: unknown[]) => unknown).bind(target)
            const enLocal = local?.[prop as string]
            if (!enLocal) return pendienteEnLocal(String(prop))
            return enLocal
        },
    }) as T
}

// ============================================================================
// Adaptadores forma-http → forma-local
// ============================================================================
const productosLocalAdapt = {
    // Inventario
    getInventario: () => invLocal.getInventario(),
    getLotes: () => invLocal.getLotes(),
    getMovimientos: (p?: Parameters<typeof invLocal.getMovimientos>[0]) => invLocal.getMovimientos(p),
    crearProducto: (data: import("@/types").NuevoProducto & { imagen?: string }) => invLocal.crearProducto(data),
    restockear: (data: import("@/types").Restock) => invLocal.restockear(data),
    editarProducto: (prod: string, data: import("@/lib/local/repos/inventario").ActualizarProductoArgs) =>
        invLocal.editarProducto(prod, data),

    // Categorías
    getCategorias: () => invLocal.getCategorias(),
    crearCategoria: (nombre: string) => invLocal.crearCategoria(nombre),
    editarCategoria: (viejo: string, nuevo: string) => invLocal.editarCategoria(viejo, nuevo),
    eliminarCategoria: (cat: string) => invLocal.eliminarCategoria(cat),
    toggleVisibilidadCategoria: (cat: string) => invLocal.toggleVisibilidadCategoria(cat),
    reordenarCategorias: (ordenes: { id: string; orden: number }[]) => invLocal.reordenarCategorias(ordenes),

    // Lotes
    editarLote: (id: string, data: Parameters<typeof invLocal.editarLote>[1]) => invLocal.editarLote(id, data),
    eliminarLote: (id: string) => invLocal.eliminarLote(id),

    // Variaciones
    getVariaciones: (producto: string) => invLocal.getVariaciones(producto),
    crearVariacion: invLocal.crearVariacion,
    editarVariacion: invLocal.editarVariacion,
    eliminarVariacion: invLocal.eliminarVariacion,

    // Recetas
    getRecetas: (producto: string) => invLocal.getRecetas(producto),
    agregarMaterial: invLocal.agregarMaterial,
    editarMaterial: invLocal.editarMaterial,
    eliminarMaterial: invLocal.eliminarMaterial,

    // Fotos (locales: dataURL en IndexedDB)
    subirFoto: invLocal.subirFoto,
    subirFotoVariacion: invLocal.subirFotoVariacion,
    borrarImagen: invLocal.borrarImagen,

    // Perfil
    getPerfil: () => invLocal.getPerfil(obtenerLicencia()?.tenant_id || ""),
    actualizarPerfilNegocio: (data: Record<string, unknown>) => invLocal.actualizarPerfil(data),
    actualizarModoPrecioSugerido: (modo: string) => invLocal.actualizarModoPrecioSugerido(modo),
    actualizarZonaHoraria: (zona: string) => invLocal.actualizarPerfil({ zona_horaria: zona }),
    actualizarGastoComision: (activo: boolean) => invLocal.actualizarPerfil({ gasto_comision_automatico: activo }),

    // Posts
    guardarPostOverride: invLocal.guardarPostOverride,
}

const ventasLocalAdapt = {
    getVentas: (rango?: RangoFechas) => ventasLocal.getVentas(rango),
    getOrdenes: (limit?: number, rango?: RangoFechas) => ventasLocal.getOrdenes(limit ?? 500, rango),
    cobrarCarrito: ventasLocal.cobrarCarrito,
    actualizarOrden: ventasLocal.actualizarOrden,
    anularOrden: ventasLocal.anularOrden,
    actualizarVenta: ventasLocal.actualizarVenta,
    eliminarVenta: ventasLocal.eliminarVenta,

    /** Historial paginado filtrado en local (equivalente de /ventas/ordenes/paginadas). */
    async getOrdenesPaginadas(
        params: RangoFechas & { pagina?: number; por_pagina?: number; busqueda?: string; orden?: string }
    ): Promise<RespuestaOrdenesPaginadas> {
        const todas = await ventasLocal.getOrdenes(5000, { desde: params.desde, hasta: params.hasta })
        let lista = todas
        if (params.busqueda) {
            const t = params.busqueda.toLowerCase()
            lista = lista.filter(o =>
                String(o.n_ticket).includes(t) ||
                o.ventas.some(v => v.producto.toLowerCase().includes(t)))
        }
        lista = [...lista].sort((a, b) =>
            params.orden === "asc"
                ? a.fecha.localeCompare(b.fecha)
                : b.fecha.localeCompare(a.fecha))
        const porPagina = params.por_pagina || 25
        const pagina = Math.max(1, params.pagina || 1)
        const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina))
        return {
            ordenes: lista.slice((pagina - 1) * porPagina, pagina * porPagina),
            total: lista.length,
            pagina,
            por_pagina: porPagina,
            total_paginas: totalPaginas,
        }
    },
}

// ============================================================================
// `api` único: nube por default, local cuando hay licencia de dispositivo
// ============================================================================
const gastosLocalAdapt = {
    getGastos: gastosLocal.getGastos,
    crearGasto: gastosLocal.crearGasto,
    actualizarGasto: gastosLocal.actualizarGasto,
    confirmarGasto: gastosLocal.confirmarGasto,
    descartarGasto: gastosLocal.descartarGasto,
    eliminarGasto: gastosLocal.eliminarGasto,

    // Programados
    getGastosProgramados: gastosLocal.getGastosProgramados,
    crearGastoProgramado: gastosLocal.crearGastoProgramado,
    ejecutarGastoProgramado: gastosLocal.ejecutarGastoProgramado,
    estimarMontoGastoProgramado: gastosLocal.estimarMontoGastoProgramado,
    actualizarGastoProgramado: gastosLocal.actualizarGastoProgramado,
    eliminarGastoProgramado: gastosLocal.eliminarGastoProgramado,
    /** Chequeo del día en local: genera los vencidos y avanza fechas. */
    sincronizarProgramados: gastosLocal.sincronizarProgramados,

    // Categorías
    getCategoriasGasto: gastosLocal.getCategoriasGasto,
    crearCategoriaGasto: gastosLocal.crearCategoriaGasto,
    editarCategoriaGasto: gastosLocal.editarCategoriaGasto,
    eliminarCategoriaGasto: gastosLocal.eliminarCategoriaGasto,
}

const terminalesLocalAdapt = {
    getTerminales: terminalesLocal.getTerminales,
    crearTerminal: terminalesLocal.crearTerminal,
    actualizarTerminal: terminalesLocal.actualizarTerminal,
    eliminarTerminal: terminalesLocal.eliminarTerminal,
}

const turnosLocalAdapt = {
    getTurnos: turnosLocal.getTurnos,
    abrirTurno: turnosLocal.abrirTurno,
    cerrarTurno: turnosLocal.cerrarTurno,
    editarTurno: turnosLocal.editarTurno,
}

const mesasLocalAdapt = {
    getMesas: mesasLocal.getMesas,
    crearMesa: mesasLocal.crearMesa,
    actualizarMesa: mesasLocal.actualizarMesa,
    eliminarMesa: mesasLocal.eliminarMesa,
    reordenarMesas: mesasLocal.reordenarMesas,
    agregarItems: mesasLocal.agregarItems,
    editarItem: mesasLocal.editarItem,
    quitarItem: mesasLocal.quitarItem,
    pedirCuenta: mesasLocal.pedirCuenta,
    regresarAOcupada: mesasLocal.regresarAOcupada,
    cancelarOrden: mesasLocal.cancelarOrden,
}

const clientesLocalAdapt = {
    getClientes: clientesLocal.getClientes,
    crearCliente: clientesLocal.crearCliente,
    verificarCliente: clientesLocal.verificarCliente,
    getCliente: clientesLocal.getCliente,
    actualizarCliente: clientesLocal.actualizarCliente,
    eliminarCliente: clientesLocal.eliminarCliente,

    ajustarPuntos: clientesLocal.ajustarPuntos,
    getStatsClientes: () => clientesLocal.getStatsClientes(),

    // CRM
    getEtiquetas: clientesLocal.getEtiquetas,
    crearEtiqueta: clientesLocal.crearEtiqueta,
    actualizarEtiqueta: clientesLocal.actualizarEtiqueta,
    eliminarEtiqueta: clientesLocal.eliminarEtiqueta,
    setEtiquetasCliente: clientesLocal.setEtiquetasCliente,
    addInteraccion: clientesLocal.addInteraccion,
    getInteracciones: clientesLocal.getInteracciones,
    getSegmentos: clientesLocal.getSegmentos,
    getLtv: clientesLocal.getLtv,
}

const statsLocalAdapt = {
    getStatsResumen: statsLocal.getStatsResumen,
    getStatsSerie: statsLocal.getStatsSerie,
    getStatsProductos: statsLocal.getStatsProductos,
    getVentasProductoStats: statsLocal.getVentasProductoStats,
}

export const api = {
    ...conModoDoble(productosApi, productosLocalAdapt),
    ...conModoDoble(ventasApi, ventasLocalAdapt),
    ...conModoDoble(gastosApi, gastosLocalAdapt),
    ...conModoDoble(catalogoApi),
    ...conModoDoble(turnosApi, turnosLocalAdapt),
    ...conModoDoble(terminalesApi, terminalesLocalAdapt),
    ...conModoDoble(statsApi, statsLocalAdapt),
    ...conModoDoble(mesasApi, mesasLocalAdapt),
    ...conModoDoble(clientesApi, clientesLocalAdapt),
    // Fase 3 (conteos programados y catálogo público): siguen pendientes
    ...conModoDoble(conteosApi),
    ...conModoDoble(analiticaApi),
}
