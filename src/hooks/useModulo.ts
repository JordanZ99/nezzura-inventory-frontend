// ==============================================================================
// src/hooks/useModulo.ts
// Fase 0 de Giros (migración 035): el giro del tenant ('tienda' |
// 'restaurante') define el PRESET de módulos activos; tenants.modulos (JSONB,
// editable a futuro por tenant) overridea al preset.
//
// useModulo('mesas') devuelve true solo si el módulo está activo para el
// tenant: es LA llave con la que las pantallas se ramifican por giro (ej. el
// POS que muestra parrilla de mesas en el preset restaurante, Fase 2).
// ==============================================================================

import { useTenant } from "@/contexts/TenantContext"

// Preset de módulos por giro. 'tienda' es el comportamiento actual (sin
// módulos extra); 'restaurante' prende mesas (Fase 2), cocina (Fase 3, vista
// read-only de órdenes abiertas) y comandera (Fase roles, push en tiempo real).
export const PRESETS_GIRO: Record<string, string[]> = {
    tienda: [],
    restaurante: ["mesas", "cocina"],
}

// Giros ofrecidos al crear un tenant (para el selector de alta futura).
export const GIROS = Object.keys(PRESETS_GIRO)

export function useModulo(nombre: string): boolean {
    const { tenant } = useTenant()
    if (!tenant) return false
    // Override explícito del tenant (tenants.modulos) manda sobre el preset
    const override = tenant.modulos?.[nombre]
    if (override !== undefined) return override
    return (PRESETS_GIRO[tenant.giro] ?? PRESETS_GIRO.tienda).includes(nombre)
}
