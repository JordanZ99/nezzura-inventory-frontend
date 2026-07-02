"use client"
// ==============================================================================
// src/components/ui/GaleriaProducto.tsx
// Galería unificada de fotos de producto.
//
// Reemplaza el ImagePicker de foto principal + la galería de imágenes extra
// que antes estaban separados. Ahora un solo componente maneja todas las
// fotos del producto: la primera subida es la principal, y si se elimina,
// la siguiente automáticamente pasa a ser la principal.
//
// Características:
//   - Carrusel con flechas izquierda/derecha y dots de posición
//   - Contador "Fotos X/5"
//   - Click en una foto → abre file picker para cambiarla
//   - Botón eliminar en cada foto
//   - Botones "Subir foto" (galería) y "Tomar foto" (cámara) cuando < 5 fotos
//   - Vista previa con hora de carga cuando aún no hay fotos
// ==============================================================================

import { useRef, useState, useCallback } from "react"
import Icon from "./Icon"
import ImageCropperModal from "./ImageCropperModal"

// ── Tipos exportados ──

/** Una foto dentro de la galería unificada */
export interface FotoGaleria {
    /** URL de previsualización (blob para nuevas, cloudinary para existentes) */
    url: string
    /** Archivo original (solo para fotos nuevas aún no subidas) */
    file?: File
    /** ID en la tabla producto_imagenes (solo para fotos existentes) */
    id?: number
}

// ── Props ──

interface GaleriaProductoProps {
    /** Lista actual de fotos (máximo 5). La posición 0 es la foto principal. */
    fotos: FotoGaleria[]
    /** Se dispara cuando el array de fotos cambia (add, delete, replace) */
    onChange: (fotos: FotoGaleria[]) => void
    /** Máximo de fotos permitidas (default: 5) */
    maxFotos?: number
    /** Si está deshabilitado (ej: durante una subida) */
    disabled?: boolean
    /** Etiqueta opcional sobre el componente */
    label?: string
}

// ── Componente ──

export default function GaleriaProducto({
    fotos, onChange, maxFotos = 5, disabled = false, label = "Fotos del producto"
}: GaleriaProductoProps) {

    // ── Estados internos ──
    const [carouselIndex, setCarouselIndex] = useState(0)

    // Referencias para los inputs ocultos: galería y cámara
    const galleryRef = useRef<HTMLInputElement>(null)
    const cameraRef = useRef<HTMLInputElement>(null)

    // Estado del cropper (se abre cuando se selecciona un archivo nuevo)
    const [showCropper, setShowCropper] = useState(false)
    const [cropperImageUrl, setCropperImageUrl] = useState<string | null>(null)
    /** Índice de la foto que se está reemplazando, o -1 si es nueva */
    const replaceIndexRef = useRef(-1)
    const pendingFileRef = useRef<File | null>(null)

    const lugarLibre = fotos.length < maxFotos

    // ── Helpers ──

    /** Abre el file picker de galería (acepta cualquier imagen) */
    const handleGalleryClick = useCallback(() => {
        replaceIndexRef.current = -1 // nueva foto
        galleryRef.current?.click()
    }, [])

    /** Abre la cámara del dispositivo */
    const handleCameraClick = useCallback(() => {
        replaceIndexRef.current = -1 // nueva foto
        cameraRef.current?.click()
    }, [])

    /** Click en una foto existente → abrir para cambiarla */
    const handleReplaceClick = useCallback((index: number) => {
        replaceIndexRef.current = index
        galleryRef.current?.click()
    }, [])

    /** Cuando se selecciona un archivo del input, abrimos el cropper */
    const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validar que sea imagen
        if (!file.type.startsWith("image/")) {
            e.target.value = ""
            return
        }

        pendingFileRef.current = file
        const url = URL.createObjectURL(file)
        setCropperImageUrl(url)
        setShowCropper(true)
        e.target.value = "" // limpiar input para permitir re-seleccionar
    }, [])

    /** El cropper terminó de recortar — insertar/reemplazar foto */
    const handleCropComplete = useCallback((croppedBlob: Blob) => {
        // Liberar URL temporal del cropper
        if (cropperImageUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(cropperImageUrl)
        }
        setCropperImageUrl(null)
        setShowCropper(false)

        const originalFile = pendingFileRef.current
        pendingFileRef.current = null
        if (!originalFile) return

        // Crear File a partir del Blob recortado
        const nombreBase = originalFile.name.replace(/\.[^.]+$/, "")
        const croppedFile = new File([croppedBlob], `${nombreBase}_cropped.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
        })

        const newPreviewUrl = URL.createObjectURL(croppedFile)
        const nuevaFoto: FotoGaleria = { url: newPreviewUrl, file: croppedFile }

        const idx = replaceIndexRef.current
        replaceIndexRef.current = -1

        if (idx >= 0 && idx < fotos.length) {
            // Reemplazar foto existente → liberar la URL vieja si era blob
            const vieja = fotos[idx]
            if (vieja?.url?.startsWith("blob:")) URL.revokeObjectURL(vieja.url)
            const nuevas = [...fotos]
            nuevas[idx] = nuevaFoto
            onChange(nuevas)
        } else {
            // Añadir nueva foto al final
            onChange([...fotos, nuevaFoto])
            setCarouselIndex(fotos.length) // ir a la nueva
        }
    }, [cropperImageUrl, fotos, onChange])

    /** Cancelar el cropper */
    const handleCropCancel = useCallback(() => {
        if (cropperImageUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(cropperImageUrl)
        }
        setCropperImageUrl(null)
        setShowCropper(false)
        pendingFileRef.current = null
        replaceIndexRef.current = -1
    }, [cropperImageUrl])

    /** Eliminar una foto por índice */
    const handleDelete = useCallback((index: number) => {
        const foto = fotos[index]
        if (!foto) return

        // Liberar blob URL si existe
        if (foto.url?.startsWith("blob:")) URL.revokeObjectURL(foto.url)

        const nuevas = fotos.filter((_, i) => i !== index)
        onChange(nuevas)

        // Ajustar índice del carrusel:
        // si quedan fotos, ir a la misma posición (o la última disponible)
        if (nuevas.length === 0) {
            setCarouselIndex(0)
        } else {
            setCarouselIndex(prev => Math.max(0, Math.min(prev, nuevas.length - 1)))
        }
    }, [fotos, onChange])

    // ── Render ──

    const fotoActual = fotos[carouselIndex]

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Label */}
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
                onChange={handleFileSelected}
            />
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handleFileSelected}
            />

            {/* Cropper modal */}
            {showCropper && cropperImageUrl && (
                <ImageCropperModal
                    imageUrl={cropperImageUrl}
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}

            {/* ── Contador ── */}
            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>
                Fotos {fotos.length}/{maxFotos}
                {fotos.length === 0 && " — La primera que subas será la foto principal"}
            </p>

            {/* ── Carrusel con flechas (si hay fotos) ── */}
            {fotos.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Flecha izquierda */}
                    <button type="button"
                        onClick={() => setCarouselIndex(i => Math.max(0, i - 1))}
                        disabled={disabled || carouselIndex === 0}
                        title="Foto anterior"
                        style={{
                            flexShrink: 0, width: 32, height: 32, borderRadius: 10,
                            border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                            color: carouselIndex === 0 ? "var(--text-muted)" : "var(--primary-mid)",
                            cursor: carouselIndex === 0 ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        <Icon name="ChevronLeft" size={18} />
                    </button>

                    {/* Imagen actual del carrusel — cliqueable para cambiar */}
                    <div onClick={() => handleReplaceClick(carouselIndex)}
                        title="Haz clic para cambiar esta foto"
                        style={{
                            flex: 1, position: "relative", borderRadius: 12, overflow: "hidden",
                            background: "var(--bg-card2)", aspectRatio: "1",
                            border: "2px solid var(--border-light)",
                            cursor: disabled ? "not-allowed" : "pointer",
                            transition: "border-color 0.2s",
                        }}
                        onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = "var(--primary-mid)" }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-light)" }}
                    >
                        <img
                            src={fotoActual?.url}
                            alt={`Foto ${carouselIndex + 1}`}
                            style={{
                                width: "100%", height: "100%", objectFit: "contain", padding: 8,
                                transition: "filter 0.2s",
                            }}
                            onError={e => { e.currentTarget.style.display = "none" }}
                            loading="lazy"
                        />

                        {/* Overlay sutil al hacer hover — indica que se puede cambiar */}
                        <div style={{
                            position: "absolute", inset: 0,
                            background: "rgba(0,0,0,0.35)",
                            opacity: 0, transition: "opacity 0.2s",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }} className="hover-overlay"
                            onMouseEnter={e => { e.currentTarget.style.opacity = "1" }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = "0" }}
                        >
                            <Icon name="Pencil" size={28} color="#fff" />
                        </div>

                        {/* Botón eliminar foto */}
                        <button type="button"
                            onClick={e => { e.stopPropagation(); handleDelete(carouselIndex) }}
                            disabled={disabled}
                            title={carouselIndex === 0
                                ? "Eliminar foto principal (la siguiente pasará a ser principal)"
                                : "Eliminar foto"}
                            style={{
                                position: "absolute", top: 8, right: 8,
                                width: 30, height: 30, borderRadius: "50%",
                                border: "none", background: "rgba(0,0,0,0.6)",
                                color: "#fff", cursor: disabled ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                zIndex: 2, transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "rgba(0,0,0,0.85)" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.6)" }}
                        >
                            <Icon name="Trash2" size={16} color="#fff" />
                        </button>

                        {/* Badge de orden (principal = estrella, resto = número) */}
                        <span style={{
                            position: "absolute", top: 8, left: 8,
                            background: carouselIndex === 0 ? "#f59e0b" : "var(--primary-mid)",
                            color: "#fff", fontSize: "0.65rem", fontWeight: 800,
                            padding: "2px 8px", borderRadius: 10,
                            display: "flex", alignItems: "center", gap: 3,
                        }}>
                            {carouselIndex === 0
                                ? <><Icon name="Star" size={10} color="#fff" /> Principal</>
                                : <>#{carouselIndex + 1}</>
                            }
                        </span>
                    </div>

                    {/* Flecha derecha */}
                    <button type="button"
                        onClick={() => setCarouselIndex(i => Math.min(fotos.length - 1, i + 1))}
                        disabled={disabled || carouselIndex >= fotos.length - 1}
                        title="Foto siguiente"
                        style={{
                            flexShrink: 0, width: 32, height: 32, borderRadius: 10,
                            border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                            color: carouselIndex >= fotos.length - 1 ? "var(--text-muted)" : "var(--primary-mid)",
                            cursor: carouselIndex >= fotos.length - 1 ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        <Icon name="ChevronRight" size={18} />
                    </button>
                </div>
            )}

            {/* ── Dots de navegación ── */}
            {fotos.length > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                    {fotos.map((_, i) => (
                        <button key={i} type="button"
                            onClick={() => setCarouselIndex(i)}
                            style={{
                                width: carouselIndex === i ? 18 : 7, height: 7, borderRadius: 4,
                                border: "none", cursor: "pointer",
                                background: carouselIndex === i ? "var(--primary-mid)" : "var(--border-light)",
                                transition: "all 0.2s",
                            }}
                        />
                    ))}
                </div>
            )}

            {/* ── Botones Subir foto + Tomar foto (si hay lugar) ── */}
            {lugarLibre && (
                <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={handleGalleryClick} disabled={disabled}
                        style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                            gap: 8, padding: "10px 16px", borderRadius: 12,
                            border: "1.5px dashed var(--primary-mid)",
                            background: "transparent", color: "var(--primary-mid)",
                            fontWeight: 700, fontSize: "0.8rem",
                            cursor: disabled ? "not-allowed" : "pointer",
                            transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        <Icon name="FolderOpen" size={18} color="var(--primary-mid)" />
                        Subir foto
                    </button>
                    <button type="button" onClick={handleCameraClick} disabled={disabled}
                        style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                            gap: 8, padding: "10px 16px", borderRadius: 12,
                            border: "1.5px dashed var(--primary-mid)",
                            background: "transparent", color: "var(--primary-mid)",
                            fontWeight: 700, fontSize: "0.8rem",
                            cursor: disabled ? "not-allowed" : "pointer",
                            transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        <Icon name="Camera" size={18} color="var(--primary-mid)" />
                        Tomar foto
                    </button>
                </div>
            )}
        </div>
    )
}
