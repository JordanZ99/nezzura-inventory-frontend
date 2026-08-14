// ==============================================================================
// src/components/personalizacion/SeccionContenido.tsx
// Sección "Contenido": título, subtítulo y barra de anuncios (guardado con
// debounce por ser textos).
// ==============================================================================

import SeccionHeader from "@/components/ui/SeccionHeader"
import type { PropsSeccionConfig } from "./tipos"

export function SeccionContenido({ catalogoConfig, setCatalogoConfig, autoguardarDebounce, renderGuardado }: PropsSeccionConfig) {
    return (
        <>
            <SeccionHeader icono="FileText" titulo="Contenido" />
            {/* Título */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Título del Catálogo</span>
                    {renderGuardado("titulo")}
                </div>
                <input
                    className="input-primary"
                    placeholder="Ej: Nuestros productos"
                    value={catalogoConfig?.titulo || ""}
                    onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, titulo: e.target.value } : null); autoguardarDebounce("titulo", () => ({ titulo: e.target.value })) }}
                    maxLength={60}
                    style={{ fontSize: "0.85rem" }}
                />
            </div>

            {/* Subtítulo */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Subtítulo</span>
                    {renderGuardado("subtitulo")}
                </div>
                <input
                    className="input-primary"
                    placeholder="Ej: Los mejores productos de la región"
                    value={catalogoConfig?.subtitulo || ""}
                    onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, subtitulo: e.target.value } : null); autoguardarDebounce("subtitulo", () => ({ subtitulo: e.target.value })) }}
                    maxLength={120}
                    style={{ fontSize: "0.85rem" }}
                />
            </div>

            {/* ── Barra de anuncios ── */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Barra de anuncios</span>
                    {renderGuardado("anuncio_texto")}
                </div>
                <input
                    className="input-primary"
                    placeholder="Ej: 🚚 Envíos gratis desde $500"
                    value={catalogoConfig?.anuncio_texto || ""}
                    onChange={e => { setCatalogoConfig(prev => prev ? { ...prev, anuncio_texto: e.target.value } : null); autoguardarDebounce("anuncio_texto", () => ({ anuncio_texto: e.target.value })) }}
                    maxLength={120}
                    style={{ fontSize: "0.85rem" }}
                />
                <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    Franja que aparece arriba del catálogo. Vacío = oculta.
                </p>
            </div>
        </>
    )
}
