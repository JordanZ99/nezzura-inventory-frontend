// ==============================================================================
// src/components/ui/ImagePicker.tsx
// Selector de imagen con dos opciones: subir desde galería o tomar foto con la
// cámara. Muestra una previsualización de la imagen seleccionada.
// ==============================================================================

"use client"

import { useRef, useState, useEffect } from "react"
import Icon from "./Icon"

interface ImagePickerProps {
    /** Se dispara cuando el usuario selecciona o limpia una imagen */
    onImageSelected: (file: File | null) => void
    /** URL de previsualización inicial (para edición de productos existentes) */
    currentImageUrl?: string
    /** Label sobre el componente */
    label?: string
}

export default function ImagePicker({ onImageSelected, currentImageUrl, label = "Foto" }: ImagePickerProps) {
    const galleryRef = useRef<HTMLInputElement>(null)
    const cameraRef = useRef<HTMLInputElement>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null)

    // Sincronizar si cambia currentImageUrl externamente (e.g. al editar otro producto)
    useEffect(() => {
        if (currentImageUrl && currentImageUrl !== "No hay foto") {
            setPreviewUrl(currentImageUrl)
        } else if (!currentImageUrl) {
            setPreviewUrl(null)
        }
    }, [currentImageUrl])

    function handleFileSelected(file: File | null) {
        if (!file) {
            setPreviewUrl(null)
            onImageSelected(null)
            return
        }

        // Liberar la URL anterior si existe
        if (previewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl)
        }

        // Crear URL de previsualización
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        onImageSelected(file)
    }

    function handleGalleryClick() {
        galleryRef.current?.click()
    }

    function handleCameraClick() {
        cameraRef.current?.click()
    }

    function handleRemove() {
        // Limpiar ambos inputs
        if (galleryRef.current) galleryRef.current.value = ""
        if (cameraRef.current) cameraRef.current.value = ""
        // Liberar la URL object para evitar memory leaks
        if (previewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl)
        }
        setPreviewUrl(currentImageUrl && currentImageUrl !== "No hay foto" ? currentImageUrl : null)
        onImageSelected(null)
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{
                fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: 0.8
            }}>
                {label}
            </label>

            {/* Hidden inputs */}
            <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => {
                    const file = e.target.files?.[0] || null
                    if (file) handleFileSelected(file)
                }}
            />
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={e => {
                    const file = e.target.files?.[0] || null
                    if (file) handleFileSelected(file)
                }}
            />

            {/* Preview */}
            {previewUrl ? (
                <div style={{
                    position: "relative",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--bg-card2)",
                    aspectRatio: "16/9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border-light)"
                }}>
                    <img
                        src={previewUrl}
                        alt="Vista previa"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        title="Quitar foto"
                        style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            backdropFilter: "blur(4px)"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.8)" }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.6)" }}
                    >
                        <Icon name="X" size={18} color="#fff" />
                    </button>
                </div>
            ) : (
                /* Placeholder cuando no hay imagen */
                <div style={{
                    borderRadius: 12,
                    background: "var(--bg-card2)",
                    border: "2px dashed var(--border-light)",
                    aspectRatio: "16/9",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 16,
                    transition: "border-color 0.15s"
                }}>
                    <Icon name="Image" size={32} color="var(--text-muted)" />
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>
                        Elige una foto para el producto
                    </p>
                </div>
            )}

            {/* Botones: Galería y Cámara */}
            <div style={{ display: "flex", gap: 8 }}>
                <button
                    type="button"
                    onClick={handleGalleryClick}
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "10px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-card2)",
                        color: "var(--text-main)",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        transition: "all 0.15s"
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = "var(--border-light)"
                        e.currentTarget.style.borderColor = "var(--primary-mid)"
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = "var(--bg-card2)"
                        e.currentTarget.style.borderColor = "var(--border-primary)"
                    }}
                >
                    <Icon name="FolderOpen" size={18} color="var(--primary-mid)" />
                    Subir foto
                </button>
                <button
                    type="button"
                    onClick={handleCameraClick}
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "10px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-card2)",
                        color: "var(--text-main)",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        transition: "all 0.15s"
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = "var(--border-light)"
                        e.currentTarget.style.borderColor = "var(--primary-mid)"
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = "var(--bg-card2)"
                        e.currentTarget.style.borderColor = "var(--border-primary)"
                    }}
                >
                    <Icon name="Camera" size={18} color="var(--primary-mid)" />
                    Tomar foto
                </button>
            </div>
        </div>
    )
}
