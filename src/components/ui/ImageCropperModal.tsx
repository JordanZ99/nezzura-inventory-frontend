// ==============================================================================
// src/components/ui/ImageCropperModal.tsx
// Modal con cropper 1:1 para recortar fotos antes de subirlas.
// Usa react-easy-crop — zoom ajustable, arrastre, aspecto cuadrado.
// ==============================================================================

"use client"

import { useState, useCallback } from "react"
import Cropper, { Area } from "react-easy-crop"
import Icon from "./Icon"

interface ImageCropperModalProps {
    /** URL (blob) de la imagen original a recortar */
    imageUrl: string
    /** Se dispara con el Blob ya recortado listo para comprimir/subir */
    onCropComplete: (croppedBlob: Blob) => void
    /** El usuario canceló el recorte */
    onCancel: () => void
}

/**
 * Carga una imagen desde una URL (blob) para dibujarla en canvas.
 */
function cargarImagen(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.setAttribute("crossOrigin", "anonymous")
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("No se pudo cargar la imagen para recortar"))
        img.src = url
    })
}

/**
 * Dibuja la imagen recortada en un canvas y devuelve el Blob en JPEG.
 */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    const image = await cargarImagen(imageSrc)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D")

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
    )

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob && blob.size > 0) resolve(blob)
                else reject(new Error("El canvas generó una imagen vacía"))
            },
            "image/jpeg",
            0.92,
        )
    })
}

export default function ImageCropperModal({
    imageUrl,
    onCropComplete,
    onCancel,
}: ImageCropperModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [procesando, setProcesando] = useState(false)

    const onCropChange = useCallback((location: { x: number; y: number }) => {
        setCrop(location)
    }, [])

    const onZoomChange = useCallback((z: number) => {
        setZoom(z)
    }, [])

    const onCropAreaComplete = useCallback(
        (_: Area, croppedPixels: Area) => {
            setCroppedAreaPixels(croppedPixels)
        },
        [],
    )

    const handleAccept = useCallback(async () => {
        if (!croppedAreaPixels || procesando) return
        setProcesando(true)
        try {
            const blob = await getCroppedImg(imageUrl, croppedAreaPixels)
            onCropComplete(blob)
        } catch (e) {
            console.error("Error al recortar imagen:", e)
            // Fallback: devolver la imagen original completa
            try {
                const resp = await fetch(imageUrl)
                const blob = await resp.blob()
                onCropComplete(blob)
            } catch {
                onCancel()
            }
        }
    }, [imageUrl, croppedAreaPixels, onCropComplete, onCancel, procesando])

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
        >
            <div
                className="card"
                style={{
                    width: "100%",
                    maxWidth: 560,
                    padding: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                    border: "1px solid var(--border-light)",
                }}
            >
                {/* ── Header ── */}
                <div
                    style={{
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderBottom: "1px solid var(--border-light)",
                    }}
                >
                    <Icon name="Crop" size={20} color="var(--primary-mid)" />
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                        Recortar foto
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Arrastra para posicionar
                    </span>
                </div>

                {/* ── Cropper ── */}
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: 360,
                        background: "#000",
                    }}
                >
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropAreaComplete}
                        classes={{
                            containerClassName: "cropper-container",
                            cropAreaClassName: "cropper-crop-area",
                        }}
                    />
                </div>

                {/* ── Controles ── */}
                <div
                    style={{
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                    }}
                >
                    {/* Slider de zoom */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="ZoomOut" size={18} color="var(--text-muted)" />
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.05}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            style={{
                                flex: 1,
                                height: 4,
                                appearance: "none",
                                WebkitAppearance: "none",
                                background: zoom <= 1
                                    ? "var(--border-light)"
                                    : `linear-gradient(to right, var(--primary-mid) ${((zoom - 1) / 2) * 100}%, var(--border-light) ${((zoom - 1) / 2) * 100}%)`,
                                borderRadius: 2,
                                outline: "none",
                                cursor: "pointer",
                            }}
                            onInput={(e) => {
                                // Sincronizar color del slider en tiempo real
                                const val = Number((e.target as HTMLInputElement).value)
                                const pct = ((val - 1) / 2) * 100
                                ;(e.target as HTMLInputElement).style.background =
                                    `linear-gradient(to right, var(--primary-mid) ${pct}%, var(--border-light) ${pct}%)`
                            }}
                        />
                        <Icon name="ZoomIn" size={18} color="var(--text-muted)" />
                    </div>

                    {/* Etiqueta de ayuda */}
                    <p
                        style={{
                            margin: 0,
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                            textAlign: "center",
                        }}
                    >
                        {zoom <= 1.2
                            ? "🖼️ Toda la imagen en marco cuadrado"
                            : zoom >= 2.5
                                ? "🔍 Vista muy cercana"
                                : "🔍 Ajusta el zoom para encuadrar"}
                    </p>

                    {/* Botones */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={procesando}
                            style={{
                                flex: 1,
                                padding: "12px 16px",
                                borderRadius: 12,
                                border: "1px solid var(--border-primary)",
                                background: "var(--bg-card2)",
                                color: "var(--text-main)",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                cursor: procesando ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                transition: "all 0.15s",
                            }}
                        >
                            <Icon name="X" size={18} color="var(--text-muted)" />
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleAccept}
                            disabled={procesando}
                            style={{
                                flex: 1,
                                padding: "12px 16px",
                                borderRadius: 12,
                                border: "none",
                                background: procesando ? "var(--border-light)" : "var(--gradient-1)",
                                color: procesando ? "var(--text-muted)" : "#fff",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                cursor: procesando ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                transition: "all 0.15s",
                            }}
                        >
                            {procesando ? (
                                <>
                                    <Icon name="Hourglass" size={18} color="var(--text-muted)" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Icon name="Check" size={18} color="#fff" />
                                    Aceptar recorte
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
