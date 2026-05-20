"use client"
// ==============================================================================
// src/components/Providers.tsx
// Wrapper client-side para los proveedores de contexto globales.
// Necesario porque layout.tsx es un Server Component y no puede tener contextos.
// ==============================================================================

import { TenantProvider } from "@/contexts/TenantContext"

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <TenantProvider>
            {children}
        </TenantProvider>
    )
}
