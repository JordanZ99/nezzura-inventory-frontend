"use client"

import { useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // El inventario se mantiene fresco durante la navegación sin
                // repetir la misma consulta al volver a una ruta.
                staleTime: 2 * 60 * 1000,
                gcTime: 15 * 60 * 1000,
                refetchOnWindowFocus: false,
                // Las queries de inventario ya hacen un unico reintento
                // controlado despues de initDB; evita duplicar peticiones a
                // Render si el backend responde con error.
                retry: 0,
            },
        },
    }))

    // La caché vive en el navegador. Se limpia al cambiar de sesión para que
    // nunca quede visible información del tenant anterior.
    useEffect(() => {
        const { data: listener } = supabase.auth.onAuthStateChange(event => {
            if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
                queryClient.clear()
            }
        })

        return () => listener.subscription.unsubscribe()
    }, [queryClient])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
