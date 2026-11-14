// ==============================================================================
// src/lib/api/almacenamiento.ts
// Medidor de almacenamiento del tenant (cuota por plan, migración 071).
// ==============================================================================

import { request } from "./client"

export interface UsoAlmacenamiento {
    plan: string
    nombre: string
    limite_bytes: number
    bytes_usados: number
    bytes_reales: number
    porcentaje: number
    quedan_bytes: number
    excedido: boolean
    /** Peso activo por categoría (texto): {principal, galeria, variaciones…} */
    desglose: Record<string, number>
}

export const almacenamientoApi = {
    /** Estado del medidor: {plan, limite, usados, porcentaje, quedan, excedido}. */
    getUso: () => request<UsoAlmacenamiento>("/almacenamiento/uso"),

    /** Inventario de imágenes por peso (gestor de espacio). */
    listarImagenes: () =>
        request<ListadoImagenes>("/almacenamiento/imagenes"),

    /** Libera imágenes elegidas (borrado en lote, máx 50 por llamada). */
    liberarUrls: (urls: string[]) =>
        request<RespuestaLiberar>("/almacenamiento/liberar", {
            method: "POST",
            body: JSON.stringify({ urls }),
        }),
}

export interface ImagenAlmacenamiento {
    url: string
    bytes: number
    fuente: string
    contexto: string
    liberable: boolean
}

export interface ListadoImagenes {
    imagenes: ImagenAlmacenamiento[]
    total_bytes: number
}

export interface RespuestaLiberar {
    ok: boolean
    liberadas: number
    resultados: { url: string; ok: boolean; mensaje?: string }[]
}

/** 1 GB binario (igual criterio que el backend). */
export const GB = 1024 * 1024 * 1024

/** Formato legible: "0.42 GB" / "312 MB". */
export function fmtPeso(bytes: number): string {
    const abs = Math.abs(bytes)
    if (abs >= GB) return `${(bytes / GB).toFixed(2)} GB`
    return `${Math.round(bytes / (1024 * 1024))} MB`
}
