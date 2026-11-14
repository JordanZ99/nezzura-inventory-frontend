"use client"

import { useEffect } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { queryClient } from "@/lib/query-client"

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    // La caché vive en el navegador. Se limpia al cambiar de sesión para que
    // nunca quede visible información del tenant anterior.
    useEffect(() => {
        const { data: listener } = supabase.auth.onAuthStateChange(event => {
            if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
                queryClient.clear()
            }
        })

        return () => listener.subscription.unsubscribe()
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
