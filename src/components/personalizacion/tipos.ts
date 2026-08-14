// ==============================================================================
// src/components/personalizacion/tipos.ts
// Tipos compartidos por las secciones de configuración del catálogo.
// Las acciones (autoguardar, renderGuardado...) vienen de useConfigCatalogo
// y se pasan por props para mantener el flujo unidireccional.
// ==============================================================================

import type { Dispatch, SetStateAction, ReactNode } from "react"
import type { CatalogoConfig } from "@/lib/api"

export interface PropsSeccionConfig {
    catalogoConfig: CatalogoConfig | null
    setCatalogoConfig: Dispatch<SetStateAction<CatalogoConfig | null>>
    autoguardar: (campo: string, data: Record<string, any>) => void
    autoguardarDebounce: (campo: string, data: () => Record<string, any>) => void
    campoGuardando: string | null
    renderGuardado: (campo: string) => ReactNode
}
