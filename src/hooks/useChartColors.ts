// src/hooks/useChartColors.ts
// ============================
// Lee los colores de gráficas desde las variables CSS --chart-color-N
// del tema activo ([data-theme] en <html>). La fuente de verdad es
// globals.css; el script inline de layout.tsx aplica el tema antes del
// primer paint, por lo que la lectura es síncrona desde el primer render.

import { useEffect, useState, useCallback } from "react";

const FALLBACK = ["blue", "sky", "teal", "slate", "cyan", "zinc"];

function leerColoresCSS(count: number): string[] {
    try {
        const style = getComputedStyle(document.documentElement);
        const resolved = Array.from({ length: count }, (_, i) =>
            style.getPropertyValue(`--chart-color-${i + 1}`).trim()
        ).filter(Boolean);
        if (resolved.length > 0) return resolved;
    } catch {
        // SSR o entorno sin DOM: usar fallback
    }
    return [];
}

function coloresIniciales(count: number): string[] {
    if (typeof window === "undefined") return FALLBACK.slice(0, count);
    const delCSS = leerColoresCSS(count);
    return delCSS.length > 0 ? delCSS : FALLBACK.slice(0, count);
}

export function useChartColors(count: number = 6): string[] {
    const [colors, setColors] = useState<string[]>(() => coloresIniciales(count));

    const sincronizar = useCallback(() => {
        const delCSS = leerColoresCSS(count);
        if (delCSS.length > 0) setColors(delCSS);
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
