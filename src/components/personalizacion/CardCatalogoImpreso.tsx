// ==============================================================================
// src/components/personalizacion/CardCatalogoImpreso.tsx
// Modo Local: el catálogo público en la nube no existe (no hay servidor que
// lo sirva), así que la pestaña Catálogo muestra el acceso al catálogo
// IMPRIMIBLE: se genera en el propio aparato y se descarga como PDF.
// ==============================================================================

import Link from "next/link"
import Icon from "@/components/ui/Icon"

export function CardCatalogoImpreso() {
    return (
        <div className="card fade-up" style={{ padding: "22px 24px", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: "var(--primary-mid)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <Icon name="Printer" size={22} />
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: "0 0 4px", fontSize: "1.02rem", fontWeight: 800 }}>Catálogo para imprimir (PDF)</h2>
                    <p style={{ margin: "0 0 14px", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.6 }}>
                        Genera tu carta de precios con las fotos, precios y categorías
                        marcadas como visibles en catálogo. Dos formatos: <strong>con fotos</strong>
                        (a color completo) y <strong>lista</strong> (compacta, para pegar en la pared).
                        El PDF se hace en el diálogo de impresión del navegador — no necesita
                        internet ni catálogo en línea.
                    </p>
                    <Link href="/catalogo/impresion" style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "10px 18px", borderRadius: 999, textDecoration: "none",
                        background: "var(--primary-mid)", color: "#fff",
                        fontWeight: 800, fontSize: "0.82rem",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                    }}>
                        <Icon name="ExternalLink" size={15} /> Abrir catálogo imprimible
                    </Link>
                </div>
            </div>
        </div>
    )
}
