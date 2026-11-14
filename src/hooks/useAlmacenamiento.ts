"use client"
// ==============================================================================
// src/hooks/useAlmacenamiento.ts
// Hook del medidor de almacenamiento (cuota por plan, migración 071).
//
// Con react-query: la caché evita pedir el uso en cada render y el
// refetchInterval suave mantiene la barra al día tras subir fotos desde
// cualquier módulo o pestaña (el peso solo crece con subidas, nunca de
// otra forma).
// ==============================================================================

import { useQuery } from "@tanstack/react-query"
import { almacenamientoApi, type UsoAlmacenamiento } from "@/lib/api/almacenamiento"

export function useAlmacenamiento() {
    return useQuery<UsoAlmacenamiento>({
        queryKey: ["uso-almacenamiento"],
        queryFn: () => almacenamientoApi.getUso(),
        staleTime: 60_000,
        retry: 0,
        refetchInterval: 60_000,
    })
}
