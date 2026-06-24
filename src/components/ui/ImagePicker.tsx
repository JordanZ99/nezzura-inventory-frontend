// ==============================================================================
// src/components/ui/ImagePicker.tsx
// Selector de imagen con dos opciones: subir desde galería o tomar foto con la
// cámara. Muestra una previsualización de la imagen seleccionada.
//
// Al seleccionar una foto, se abre un modal de recorte 1:1 antes de confirmar.
// ==============================================================================

"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Icon from "./Icon"
import ImageCropperModal from "./ImageCropperModal"

interface ImagePickerProps {
    /** Se dispara cuando el usuario selecciona una imagen (ya recortada) */
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

    // Estado del cropper
    const [showCropper, setShowCropper] = useState(false)
    const [cropperImageUrl, setCropperImageUrl] = useState<string | null>(null)
    /** Archivo original pendiente de recortar */
    const pendingFileRef = useRef<File | null>(null)

    // Estado para controlar el hover sobre la previsualización de la imagen
    const [hoverPreview, setHoverPreview] = useState(false)

    // Sincronizar si cambia currentImageUrl externamente (e.g. al editar otro producto)
    useEffect(() => {
        if (currentImageUrl && currentImageUrl !== "No hay foto") {
            setPreviewUrl(currentImageUrl)
        } else if (!currentImageUrl) {
            setPreviewUrl(null)
        }
    }, [currentImageUrl])

    /**
     * Cuando el usuario selecciona un archivo del input, abrimos el cropper.
     */
    const iniciarCropper = useCallback((file: File) => {
        pendingFileRef.current = file

        // Crear URL temporal para mostrar en el cropper
        const url = URL.createObjectURL(file)
        setCropperImageUrl(url)
        setShowCropper(true)
    }, [])

    /**
     * El cropper terminó — recibimos el Blob recortado.
     */
    const handleCropComplete = useCallback((croppedBlob: Blob) => {
        // Liberar la URL temporal del cropper
        if (cropperImageUrl && cropperImageUrl.startsWith("blob:")) {
            URL.revokeObjectURL(cropperImageUrl)
        }
        setCropperImageUrl(null)
        setShowCropper(false)

        const originalFile = pendingFileRef.current
        pendingFileRef.current = null

        if (!originalFile) return

        // Crear un File a partir del Blob recortado, usando el nombre original
        const nombreBase = originalFile.name.replace(/\.[^.]+$/, "")
        const croppedFile = new File([croppedBlob], `${nombreBase}_cropped.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
        })

        // Liberar la preview anterior si existe
        if (previewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl)
        }

        // Mostrar preview del recorte
        const newPreviewUrl = URL.createObjectURL(croppedFile)
        setPreviewUrl(newPreviewUrl)
        onImageSelected(croppedFile)
    }, [cropperImageUrl, previewUrl, onImageSelected])

    /**
     * El usuario canceló el recorte.
     */
    const handleCropCancel = useCallback(() => {
        if (cropperImageUrl && cropperImageUrl.startsWith("blob:")) {
            URL.revokeObjectURL(cropperImageUrl)
        }
        setCropperImageUrl(null)
        setShowCropper(false)
        pendingFileRef.current = null
    }, [cropperImageUrl])

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
                    if (file) iniciarCropper(file)
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
                    if (file) iniciarCropper(file)
                }}
            />

            {/* Cropper modal */}
            {showCropper && cropperImageUrl && (
                <ImageCropperModal
                    imageUrl={cropperImageUrl}
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}

            {/* Preview */}
            {previewUrl ? (
                <div
                    onClick={handleGalleryClick}
                    onMouseEnter={() => setHoverPreview(true)}
                    onMouseLeave={() => setHoverPreview(false)}
                    style={{
                        position: "relative",
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "var(--bg-card2)",
                        aspectRatio: "16/9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--border-light)",
                        cursor: "pointer",
                        transition: "border-color 0.2s"
                    }}
                >
                    <img
                        src={previewUrl}
                        alt="Vista previa — haz clic para cambiar la foto"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            padding: 8,
                            transition: "filter 0.2s"
                        }}
                    />

                    {/* Overlay semitransparente con ícono Pencil que aparece al hacer hover */}
                    {hoverPreview && (
                        <div style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "opacity 0.2s",
                            backdropFilter: "blur(2px)"
                        }}>
                            <div style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 6,
                                color: "#fff"
                            }}>
                                <Icon name="Pencil" size={32} color="#fff" />
                                <span style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    textShadow: "0 1px 4px rgba(0,0,0,0.5)"
                                }}>
                                    Cambiar foto
                                </span>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemove() }}
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
                            backdropFilter: "blur(4px)",
                            zIndex: 2
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.8)" }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.6)" }}
                    >
                        <Icon name="X" size={18} color="#fff" />
                    </button>
                </div>
            ) : (
                /* Placeholder cuando no hay imagen — también es cliqueable */
                <div
                    onClick={handleGalleryClick}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary-mid)"; e.currentTarget.style.background = "var(--border-light)" }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.background = "var(--bg-card2)" }}
                    style={{
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
                        cursor: "pointer",
                        transition: "all 0.15s"
                    }}
                >
                    <Icon name="Image" size={32} color="var(--text-muted)" />
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>
                        Haz clic o presiona Subir foto
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
