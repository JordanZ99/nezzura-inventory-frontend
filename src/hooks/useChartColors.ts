// src/hooks/useChartColors.ts
// ==========================
// Lee los colores de gráficas desde las variables CSS --chart-color-N
// correspondientes al tema activo. Usa localStorage como fuente síncrona
// para que los colores correctos se apliquen desde el primer render.

import { useEffect, useState, useCallback } from "react";

const COLORES_POR_TEMA: Record<string, string[]> = {
    default:         ["blue", "sky", "teal", "slate", "cyan", "zinc"],
    midnightBlack:   ["teal", "indigo", "slate", "green", "violet", "amber"],
    strawberry:      ["rose", "pink", "fuchsia-700", "violet", "purple", "slate"],
    cozyYellow:      ["red-400", "orange-400", "yellow-300", "red-600", "orange-700", "slate"],
};

function obtenerTema(): string {
    if (typeof window === "undefined") return "default";
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr;
    return localStorage.getItem("tema") || "default";
}

function leerColoresCSS(count: number): string[] {
    try {
        const root = document.documentElement;
        const style = getComputedStyle(root);
        const resolved = Array.from({ length: count }, (_, i) =>
            style.getPropertyValue(`--chart-color-${i + 1}`).trim()
        ).filter(Boolean);
        if (resolved.length > 0) return resolved;
    } catch {
        // fallback
    }
    return [];
}

function coloresIniciales(count: number): string[] {
    const tema = obtenerTema();
    const delMapa = COLORES_POR_TEMA[tema]?.slice(0, count);
    if (delMapa) return delMapa;

    const delCSS = leerColoresCSS(count);
    if (delCSS.length > 0) return delCSS;

    return ["rose", "pink", "fuchsia", "violet", "purple", "slate"].slice(0, count);
}

export function useChartColors(count: number = 6): string[] {
    const [colors, setColors] = useState<string[]>(() => coloresIniciales(count));

    const sincronizar = useCallback(() => {
        const delCSS = leerColoresCSS(count);
        if (delCSS.length > 0) {
            setColors(delCSS);
            return;
        }
        const tema = obtenerTema();
        const delMapa = COLORES_POR_TEMA[tema]?.slice(0, count);
        if (delMapa) setColors(delMapa);
    }, [count]);

    useEffect(() => {
        sincronizar();

        const observer = new MutationObserver(() => {
            sincronizar();
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => observer.disconnect();
    }, [sincronizar]);

    return colors;
}
