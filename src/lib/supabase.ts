// ==============================================================================
// src/lib/supabase.ts
// Exporta dos clientes:
//  - supabase → para componentes cliente (browser), con persistencia en localStorage
//  - createBrowserClient → re-exportado para uso explícito
// ==============================================================================

import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Cliente browser con persistencia automática de sesión.
 * Úsalo en cualquier componente cliente ("use client").
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
