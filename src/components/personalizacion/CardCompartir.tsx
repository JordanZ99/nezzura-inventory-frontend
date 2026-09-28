// ==============================================================================
// src/components/personalizacion/CardCompartir.tsx
// Tarjeta "Compartir": estado del catálogo, QR (SVG visible + canvas oculto
// para descargar PNG), compartir nativo, abrir en nueva pestaña y enlace
// público con copiar. Todo viene de useConfigCatalogo vía props.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import type { CatalogoConfig } from "@/lib/api"

interface Props {
    catalogoConfig: CatalogoConfig | null
    CATALOGO_LINK: string
    qrCanvasRef: React.RefObject<HTMLCanvasElement>
    qrDescargado: boolean
    descargarQR: () => void
    compartirLink: () => void
    linkCopiado: boolean
    copiarLink: (slug: string) => void
}

export function CardCompartir({
    catalogoConfig,
    CATALOGO_LINK,
    qrCanvasRef,
    qrDescargado,
    descargarQR,
    compartirLink,
    linkCopiado,
    copiarLink,
}: Props) {
    return (
        <div className="card fade-up" style={{ padding: "24px 28px", flex: "1 1 300px", maxWidth: 380 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>Compartir</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 20px" }}>
                Comparte tu catálogo con tus clientes.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
                {/* Estado del catálogo */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: 20,
                    background: catalogoConfig?.activo ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.08)",
                    color: catalogoConfig?.activo ? "#2e7d32" : "#c62828",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                }}>
                    <div style={{
                        width: 8, height: 8,
                        borderRadius: "50%",
                        background: catalogoConfig?.activo ? "#4caf50" : "#f44336",
                        animation: catalogoConfig?.activo ? "pulse 2s infinite" : "none",
                    }} />
                    {catalogoConfig?.activo ? "Catálogo activo" : "Catálogo inactivo"}
                    <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
                </div>

                {/* QR Code */}
                {catalogoConfig?.slug && (
                    <>
                        {/* QR visible (SVG) */}
                        <div style={{
                            background: "#fff",
                            padding: 16,
                            borderRadius: 16,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <QRCodeSVG
                                value={CATALOGO_LINK}
                                size={180}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                level="M"
                            />
                        </div>

                        {/* QR canvas (oculto, solo para descargar PNG) */}
                        <div style={{ display: "none" }}>
                            <QRCodeCanvas
                                ref={qrCanvasRef}
                                value={CATALOGO_LINK}
                                size={512} // Alta resolución para descarga
                                bgColor="#ffffff"
                                fgColor="#000000"
                                level="M"
                            />
                        </div>

                        {/* Botones de acción */}
                        <div style={{
                            display: "flex",
                            gap: 8,
                            width: "100%",
                            flexWrap: "wrap",
                            justifyContent: "center",
                        }}>
                            {/* Descargar QR */}
                            <button
                                onClick={descargarQR}
                                className="btn-primary"
                                style={{
                                    flex: 1,
                                    minWidth: 120,
                                    padding: "10px 14px",
                                    fontSize: "0.78rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                }}
                            >
                                <Icon name={qrDescargado ? "Check" : "Download"} size={14} />
                                {qrDescargado ? "Descargado" : "Descargar QR"}
                            </button>

                            {/* Compartir nativo */}
                            <button
                                onClick={compartirLink}
                                className="btn-primary"
                                style={{
                                    flex: 1,
                                    minWidth: 120,
                                    padding: "10px 14px",
                                    fontSize: "0.78rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                }}
                            >
                                <Icon name="Share2" size={14} />
                                Compartir
                            </button>
                        </div>

                        {/* Abrir catálogo en nueva pestaña */}
                        <a
                            href={CATALOGO_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "10px 14px",
                                fontSize: "0.82rem",
                                textDecoration: "none",
                                width: "100%",
                            }}
                        >
                            <Icon name="ExternalLink" size={16} />
                            Abrir catálogo
                        </a>
                    </>
                )}

                {/* Link */}
                {catalogoConfig?.slug && (
                    <div style={{ width: "100%" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Enlace público</span>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                readOnly
                                value={CATALOGO_LINK}
                                onClick={e => (e.target as HTMLInputElement).select()}
                                className="input-primary"
                                style={{
                                    flex: 1,
                                    fontSize: "0.75rem",
                                    fontFamily: "monospace",
                                    cursor: "text",
                                }}
                            />
                            <button
                                onClick={() => copiarLink(catalogoConfig!.slug)}
                                className="btn-primary"
                                style={{
                                    padding: "8px 14px",
                                    fontSize: "0.78rem",
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Icon name={linkCopiado ? "Check" : "Copy"} size={14} />
                                {linkCopiado ? "Copiado" : "Copiar"}
                            </button>
                        </div>
                    </div>
                )}

                {!catalogoConfig?.slug && (
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center" }}>
                        Guarda la configuración para generar el link de tu catálogo.
                    </p>
                )}
            </div>
        </div>
    )
}
