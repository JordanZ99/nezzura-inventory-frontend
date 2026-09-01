// ==============================================================================
// src/lib/api.ts
// Fachada retrocompatible: re-exporta los tipos de @/types y los clientes de @/lib/api.
// Esto permite que el código existente siga importando de "@/lib/api" sin cambios,
// mientras que el código nuevo o refactorizado puede importar directamente de @/types
// o @/lib/api/productos, etc.
// ==============================================================================

export * from "@/types"
export * from "./api/index"
