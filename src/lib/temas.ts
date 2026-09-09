// src/lib/temas.ts
// =================
// Claves canónicas de los temas del gestor y utilidades para leerlos.
// 'midnightBlack' fue renombrado a 'midnightSlate' (el tema es teal/índigo,
// sin negro puro); los valores antiguos se normalizan al leerlos.

const TEMAS_LEGADO: Record<string, string> = {
    midnightBlack: "midnightSlate",
};

export const TEMAS_GESTOR = ["default", "midnightSlate", "strawberry", "cozyYellow"];

export function normalizarTema(tema: string | null | undefined): string {
    if (!tema) return "default";
    return TEMAS_LEGADO[tema] ?? tema;
}

export function obtenerTemaGestor(): string {
    if (typeof window === "undefined") return "default";
    try {
        return normalizarTema(localStorage.getItem("tema"));
    } catch {
        return "default";
    }
}
