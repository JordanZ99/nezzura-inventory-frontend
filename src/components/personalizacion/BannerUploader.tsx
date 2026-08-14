// ==============================================================================
// src/components/personalizacion/BannerUploader.tsx
// Subcomponente reutilizable para el banner del catálogo: vista previa,
// subir imagen (abre el modal de recorte) y quitar. Se usa 2 veces (escritorio
// y móvil) con los mismos props — antes eran 2 bloques casi idénticos en
// SeccionApariencia.
// ==============================================================================

import Icon from "@/components/ui/Icon"
import type { ReactNode } from "react"

interface Props {
    target: "escritorio" | "movil"
    inputRef: React.RefObject<HTMLInputElement>
    url: string
    subiendo: boolean
    onFile: (e: React.ChangeEvent<HTMLInputElement>, target: "escritorio" | "movil") => void
    onQuitar: (target: "escritorio" | "movil") => void
    renderGuardado: (campo: string) => ReactNode
    campo: string
    icono: string
    etiqueta: string
    alturaPreview: number
    recomendacion: string
}

export function BannerUploader({
    target,
    inputRef,
    url,
    subiendo,
    onFile,
    onQuitar,
    renderGuardado,
    campo,
    icono,
    etiqueta,
    alturaPreview,
    recomendacion,
}: Props) {
    return (
        <div style={{ border: "1.5px solid var(--border-light)", borderRadius: 12, padding: 12, background: "var(--bg-card2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name={icono as any} size={16} color="var(--primary-mid)" />
                    <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-main)" }}>{etiqueta}</span>
                </div>
                {renderGuardado(campo)}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{
                    width: 110, height: alturaPreview,
                    borderRadius: 8, overflow: "hidden", flexShrink: 0,
                    background: "var(--bg-app)",
                    border: "2px dashed var(--border-primary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    {url ? (
                        <img
                            src={url}
                            alt={etiqueta}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={e => { e.currentTarget.style.display = "none" }}
                        />
                    ) : (
                        <Icon name="ImagePlus" size={20} color="var(--text-muted)" />
                    )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={e => onFile(e, target)}
                    />
                    <button
                        onClick={() => inputRef.current?.click()}
                        disabled={subiendo}
                        className="btn-primary"
                        style={{ fontSize: "0.75rem", padding: "7px 12px", width: "fit-content" }}
                    >
                        {subiendo ? "Subiendo..." : <><Icon name="Upload" size={13} /> Subir imagen</>}
                    </button>
                    {url && (
                        <button
                            onClick={() => onQuitar(target)}
                            style={{
                                fontSize: "0.7rem", fontWeight: 700, padding: "5px 10px",
                                borderRadius: 8, border: "1px solid var(--border-primary)",
                                background: "var(--bg-card2)", color: "var(--text-muted)",
                                cursor: "pointer", width: "fit-content",
                            }}
                        >
                            Quitar
                        </button>
                    )}
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        Recomendado: <b>{recomendacion}</b>
                    </span>
                </div>
            </div>
        </div>
    )
}
