"use client"
// ==============================================================================
// ScrollableTable — Wrapper con indicador de scroll horizontal visible
// ==============================================================================
// Útil en móvil donde los navegadores ocultan la scrollbar nativa.
// Detecta overflow y muestra una barra indicadora con la posición actual.
// ==============================================================================

import { useRef, useState, useEffect, useCallback, type ReactNode } from "react"

interface Props {
    children: ReactNode
}

export default function ScrollableTable({ children }: Props) {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const [overflow, setOverflow] = useState(false)
    const [scrollProgress, setScrollProgress] = useState(0)
    const [thumbWidth, setThumbWidth] = useState(0)
    const [trackWidth, setTrackWidth] = useState(0)

    const update = useCallback(() => {
        const el = wrapperRef.current
        if (!el) return
        const hasOverflow = el.scrollWidth > el.clientWidth
        setOverflow(hasOverflow)
        if (hasOverflow) {
            setScrollProgress(el.scrollLeft / (el.scrollWidth - el.clientWidth))
            const tw = el.clientWidth
            setTrackWidth(tw)
            setThumbWidth(Math.max(24, (tw / el.scrollWidth) * tw))
        }
    }, [])

    useEffect(() => {
        const el = wrapperRef.current
        if (!el) return

        update()

        const ro = new ResizeObserver(update)
        ro.observe(el)
        el.addEventListener("scroll", update, { passive: true })

        return () => {
            ro.disconnect()
            el.removeEventListener("scroll", update)
        }
    }, [update])

    return (
        <div style={{ position: "relative" }}>
            {/* Oculta la scrollbar nativa para que solo se vea el indicador personalizado */}
            <div
                ref={wrapperRef}
                className="scrollable-table-wrapper"
                style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {children}
            </div>
            {/* Estilo para ocultar la scrollbar en WebKit (Chrome, Safari, Edge) */}
            <style>{`.scrollable-table-wrapper::-webkit-scrollbar { display: none; }`}</style>

            {/* Indicador de scroll horizontal */}
            {overflow && (
                <div
                    style={{
                        height: 4,
                        borderRadius: 2,
                        background: "var(--border-light)",
                        marginTop: 4,
                        position: "relative",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: scrollProgress * (trackWidth - thumbWidth),
                            height: "100%",
                            width: thumbWidth,
                            borderRadius: 2,
                            background: "var(--primary-light)",
                            transition: "left 0.1s ease",
                            opacity: 0.6,
                        }}
                    />
                </div>
            )}
        </div>
    )
}
