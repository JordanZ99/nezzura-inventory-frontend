// ==============================================================================
// src/lib/query-client.ts
// QueryClient singleton: vive aquí (en vez de dentro de QueryProvider) para
// que la capa de API (lib/api/*) pueda invalidar queries tras mutaciones —
// p. ej. refrescar el medidor de almacenamiento inmediatamente después de
// subir una foto, sin esperar el polling de 60 s.
// ==============================================================================

import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // El inventario se mantiene fresco durante la navegación sin
            // repetir la misma consulta al volver a una ruta.
            staleTime: 2 * 60 * 1000,
            gcTime: 15 * 60 * 1000,
            refetchOnWindowFocus: false,
            // Las queries de inventario ya hacen un único reintento
            // controlado después de initDB; evita duplicar peticiones a
            // Render si el backend responde con error.
            retry: 0,
        },
    },
})

/** El peso del tenant cambió (subida/borrado): el medidor se refresca ya. */
export function invalidarUsoAlmacenamiento(): void {
    queryClient.invalidateQueries({ queryKey: ["uso-almacenamiento"] })
}
