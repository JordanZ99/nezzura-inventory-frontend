// ==============================================================================
// src/components/ui/ImageCropperModal.tsx
// Modal con cropper 1:1 para recortar fotos antes de subirlas.
//
// Comportamiento del zoom:
//   - Slider de 0% a 100%, con posición inicial en 50% (centro).
//   - 50% → zoom por defecto: la imagen cubre todo el marco cuadrado (cover).
//   - < 50% → zoom out: la imagen se encoge hasta mostrarse COMPLETA
//              dentro del marco cuadrado (contain), dejando márgenes.
//   - > 50% → zoom in: acerca la imagen para ver detalles.
//   - Snap magnético en 48-52% → salta a 50% automáticamente.
//   - Drag bounds se adaptan según el zoom.
// ==============================================================================

"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import Cropper, { Area } from "react-easy-crop"
import Icon from "./Icon"

const MAX_ZOOM = 3

interface ImageCropperModalProps {
    /** URL (blob) de la imagen original a recortar */
    imageUrl: string
    /** Se dispara con el Blob ya recortado listo para comprimir/subir */
    onCropComplete: (croppedBlob: Blob) => void
    /** El usuario canceló el recorte */
    onCancel: () => void
}

/**
 * Carga una imagen desde una URL para dibujarla en canvas o medir sus
 * dimensiones naturales.
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

/**
 * Convierte un valor de slider (0-100) al zoom real de react-easy-crop.
 *
 *   - 0%   → zoomContain (imagen completa visible dentro del marco cuadrado)
 *   - 50%  → zoom=1 (imagen cubre todo el marco, comportamiento por defecto)
 *   - 100% → MAX_ZOOM (zoom máximo, detalle muy cercano)
 */
function sliderToZoom(sliderPct: number, zoomContain: number): number {
    if (zoomContain >= 0.99) {
        // Imagen cuadrada: la mitad izquierda del slider (0-50%) mantiene
        // zoom=1 (cover ≡ contain), la mitad derecha (50-100%) hace zoom in.
        if (sliderPct <= 50) return 1
        return 1 + (MAX_ZOOM - 1) * ((sliderPct - 50) / 50)
    }
    if (sliderPct <= 50) {
        // Modo contain → cover: de zoomContain a 1
        return zoomContain + (1 - zoomContain) * (sliderPct / 50)
    }
    // Modo cover → zoom in: de 1 a MAX_ZOOM
    return 1 + (MAX_ZOOM - 1) * ((sliderPct - 50) / 50)
}

/**
 * Convierte un zoom real de react-easy-crop a valor de slider (0-100).
 */
function zoomToSlider(zoom: number, zoomContain: number): number {
    if (zoomContain >= 0.99) {
        // Imagen cuadrada: zoom=1 mapea a slider=50%, zoom>1 sube hasta 100%
        if (zoom <= 1) return 50
        return 50 + ((zoom - 1) / (MAX_ZOOM - 1)) * 50
    }
    if (zoom <= 1) {
        return ((zoom - zoomContain) / (1 - zoomContain)) * 50
    }
    return 50 + ((zoom - 1) / (MAX_ZOOM - 1)) * 50
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

    // ── Dimensiones naturales de la imagen ──
    const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 })
    const zoomContainRef = useRef(1)

    useEffect(() => {
        let cancel = false
        const img = new Image()
        img.setAttribute("crossOrigin", "anonymous")
        img.onload = () => {
            if (cancel) return
            const w = img.naturalWidth
            const h = img.naturalHeight
            setImageNaturalSize({ width: w, height: h })
            // zoomContain = lado más corto / lado más largo
            // Así se ve la imagen COMPLETA dentro del marco cuadrado
            const ratio = Math.min(w, h) / Math.max(w, h)
            zoomContainRef.current = Math.max(0.1, ratio)
        }
        img.onerror = () => {
            if (cancel) return
            zoomContainRef.current = 1
        }
        img.src = imageUrl
        return () => { cancel = true }
    }, [imageUrl])

    // Valor del slider derivado del zoom actual
    const sliderValue = useMemo(
        () => zoomToSlider(zoom, zoomContainRef.current),
        [zoom],
    )

    // ── Handlers ──

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

    const handleSliderChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = Number(e.target.value)
            // Snap magnético: si está entre 48 y 52, salta al 50 exacto
            const snapped = raw >= 48 && raw <= 52 ? 50 : raw
            const zc = zoomContainRef.current
            const newZoom = sliderToZoom(snapped, zc)
            setZoom(newZoom)
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

    // ── Texto contextual del zoom ──
    const zoomLabel = useMemo(() => {
        const zc = zoomContainRef.current
        const esCuadrada = zc >= 0.99
        if (esCuadrada) {
            if (sliderValue >= 90) return "Vista ampliada"
            return "Imagen cuadrada - ajusta el zoom"
        }
        if (sliderValue <= 5) return "Imagen completa dentro del marco"
        if (sliderValue <= 15) return "Casi toda la imagen visible"
        if (sliderValue >= 48 && sliderValue <= 52) return "Imagen ajustada al marco"
        if (sliderValue >= 90) return "Vista ampliada"
        if (sliderValue < 48) return "Mostrando mas imagen"
        return "Acercando para detalle"
    }, [sliderValue])

    // ── Determinar si estamos en modo contain (< 50%) para ajustar mensaje ──
    const esModoContain = sliderValue < 48 && zoomContainRef.current < 0.99

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
                        background: "var(--border-light)",
                    }}
                >
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        minZoom={zoomContainRef.current}
                        maxZoom={MAX_ZOOM}
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
                    {/* Slider de zoom — 0 a 100% */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Icon name="ZoomOut" size={18} color="var(--text-muted)" />
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(sliderValue)}
                            onChange={handleSliderChange}
                            style={{
                                flex: 1,
                                height: 4,
                                appearance: "none",
                                WebkitAppearance: "none",
                                background: `linear-gradient(to right, var(--primary-mid) ${sliderValue}%, var(--border-light) ${sliderValue}%)`,
                                borderRadius: 2,
                                outline: "none",
                                cursor: "pointer",
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
                        {esModoContain ? (
                            <>
                                La imagen se ve completa dentro del marco cuadrado
                            </>
                        ) : (
                            <>{zoomLabel}</>
                        )}
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
