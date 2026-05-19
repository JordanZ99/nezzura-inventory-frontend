// hooks/useChartColors.ts
import { useEffect, useState } from "react";

export function useChartColors(count: number = 6): string[] {
    const [colors, setColors] = useState<string[]>(
        ["rose", "pink", "fuchsia", "violet", "purple", "slate"].slice(0, count)
    );

    useEffect(() => {
        const root = document.documentElement;
        const style = getComputedStyle(root);
        const resolved = Array.from({ length: count }, (_, i) =>
            style.getPropertyValue(`--chart-color-${i + 1}`).trim()
        ).filter(Boolean);

        if (resolved.length > 0) setColors(resolved);
    }, [count]);

    return colors;
}