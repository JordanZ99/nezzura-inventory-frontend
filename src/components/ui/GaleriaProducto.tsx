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
//   - **Drag & Drop**: botón "Reordenar" que activa grid de miniaturas arrastrables
// ==============================================================================

import { useRef, useState, useCallback } from "react"
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
    /** Orden en la galería del backend (1-5, solo para fotos existentes) */
    orden?: number
}

// ── Componente SortablePhoto para DnD ──

interface SortablePhotoProps {
    id: string  // ID estable para DnD (no basado en índice)
    foto: FotoGaleria
    index: number
    disabled?: boolean
    onDelete: (index: number) => void
    aspectRatio?: number  // Relación global de las fotos (1 o 4/5)
}

function SortablePhoto({ id, foto, index, disabled, onDelete, aspectRatio = 1 }: SortablePhotoProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id })

    // Un solo elemento raíz: todos los eventos de arrastre + ref + atributos de accesibilidad
    // en el mismo div. Esto es lo que @dnd-kit espera para funcionar correctamente
    // tanto en desktop (mouse) como en móvil (touch).
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--bg-card2)",
        aspectRatio: aspectRatio,
        border: index === 0 ? "2px solid #f59e0b" : "2px solid var(--border-light)",
        cursor: disabled ? "not-allowed" : "grab",
        // ⚠️ CRÍTICO: touch-action: none es OBLIGATORIO para que PointerSensor
        // funcione en dispositivos táctiles. Sin esto, el navegador intercepta
        // el touch para hacer scroll y el drag nunca se activa.
        touchAction: "none",
        zIndex: isDragging ? 10 : 1,
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.25)" : "none",
        // La imagen entera es el handle de arrastre (height 100% hereda de aspect-ratio)
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            title="Arrastrar para reordenar"
        >
            <img
                src={foto.url}
                alt={`Foto ${index + 1}`}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: 6,
                    // La imagen NO debe interceptar eventos para que el drag funcione
                    pointerEvents: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                }}
                onError={e => { e.currentTarget.style.display = "none" }}
                loading="lazy"
                draggable={false}
            />

            {/* Badge de orden */}
            <span style={{
                position: "absolute",
                top: 6,
                left: 6,
                background: index === 0 ? "#f59e0b" : "var(--primary-mid)",
                color: "#fff",
                fontSize: "0.6rem",
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: 8,
                zIndex: 2,
                // El badge no debe interceptar eventos de pointer
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                gap: 3,
            }}>
                {index === 0 ? (
                    <><Icon name="Star" size={9} color="#fff" /> Principal</>
                ) : (
                    <>#{index + 1}</>
                )}
            </span>

            {/* Botón eliminar */}
            <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete(index) }}
                onPointerDown={e => e.stopPropagation() /* evitar que el click active el drag */}
                disabled={disabled}
                title="Eliminar foto"
                style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    cursor: disabled ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 3,
                    transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "rgba(0,0,0,0.85)" }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.6)" }}
            >
                <Icon name="Trash2" size={13} color="#fff" />
            </button>

            {/* Indicador visual de que se puede arrastrar (siempre visible en grid) */}
            {!disabled && !isDragging && (
                <div style={{
                    position: "absolute",
                    bottom: 6,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.55)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    // Siempre visible para que el usuario sepa que puede arrastrar
                    opacity: 0.85,
                }}>
                    <Icon name="GripVertical" size={12} color="#fff" />
                    <span style={{ fontSize: "0.55rem", color: "#fff", fontWeight: 700 }}>Arrastrar</span>
                </div>
            )}
        </div>
    )
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
    /** Si el tenant está en plan básico, oculta el carrusel y muestra un mensaje de upgrade */
    planLocked?: boolean
    /** Relación global de las fotos (1 = cuadrada, 4/5 = vertical Instagram).
     *  Aplica a la vista previa, los slots vacíos, las miniaturas de reordenar
     *  y el crop de nuevas fotos. Default: 1 (1:1). */
    aspectRatio?: number
}

// ── Componente ──

export default function GaleriaProducto({
    fotos, onChange, maxFotos = 5, disabled = false, label = "Fotos del producto", planLocked = false, aspectRatio = 1
}: GaleriaProductoProps) {
    // Si el plan es básico, mostrar un bloqueo visual con mensaje de upgrade
    if (planLocked) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{
                    fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: 0.8
                }}>
                    {label}
                </label>
                <div style={{
                    padding: "24px 20px",
                    borderRadius: 12,
                    background: "var(--bg-card2)",
                    border: "1.5px dashed var(--border-primary)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    textAlign: "center",
                }}>
                    <Icon name="Lock" size={28} color="var(--text-muted)" />
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)" }}>
                        Fotos bloqueadas
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.4 }}>
                        La función de fotos está disponible solo en el plan Plus. Actualiza tu plan para poder subir imágenes de tus productos.
                    </span>
                </div>
            </div>
        )
    }


    // ── Estados internos ──
    const [carouselIndex, setCarouselIndex] = useState(0)
    const [modoReordenar, setModoReordenar] = useState(false)

    // Sensores para DnD (PointerSensor para mouse + tacto)
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 4, // 4px — más responsive en móvil, evita drags accidentales
            },
        })
    )

    // Referencias para los inputs ocultos: galería y cámara
    const galleryRef = useRef<HTMLInputElement>(null)
    const cameraRef = useRef<HTMLInputElement>(null)

    // Estado del cropper (se abre cuando se selecciona un archivo nuevo)
    const [showCropper, setShowCropper] = useState(false)
    const [cropperImageUrl, setCropperImageUrl] = useState<string | null>(null)
    /** Índice de la foto que se está reemplazando, o -1 si es nueva */
    const replaceIndexRef = useRef(-1)
    const pendingFileRef = useRef<File | null>(null)

    // ── Función helper: ID estable para DnD ──
    // Las fotos existentes (con id) usan "img-{id}".
    // Las fotos nuevas (sin id) usan "new-{hash}" basado en la URL (blob URL única).
    // NO se incluye el índice, para que el ID no cambie al reordenar.
    const getItemId = useCallback((foto: FotoGaleria): string => {
        if (foto.id !== undefined) return `img-${foto.id}`
        // Para fotos nuevas, usar un hash estable de la URL (blob URL única por creation)
        const urlHash = foto.url.slice(-16)
        return `new-${urlHash}`
    }, [])

    // Items estables para SortableContext
    const sortableItems = fotos.map(foto => getItemId(foto))

    // ── Handlers de DnD ──

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        // Buscar índices reales usando los IDs estables
        const activeId = active.id as string
        const overId = over.id as string

        const oldIndex = fotos.findIndex(f => getItemId(f) === activeId)
        const newIndex = fotos.findIndex(f => getItemId(f) === overId)

        if (oldIndex === -1 || newIndex === -1) return

        const reordenadas = arrayMove(fotos, oldIndex, newIndex)
        onChange(reordenadas)

        // Al reordenar, resetear carrusel al inicio para evitar confusión visual
        setCarouselIndex(0)
    }, [fotos, onChange, getItemId])

    const lugarLibre = fotos.length < maxFotos
    // Índice máximo del carrusel: si hay lugar libre, permitimos navegar
    // una posición extra (fotos.length) que corresponde al slot vacío
    // "Añade una foto". Si no hay lugar, el máximo es la última foto real.
    const indiceMaximo = lugarLibre ? fotos.length : fotos.length - 1
    // True cuando el carrusel está mostrando el slot vacío
    const esSlotVacio = carouselIndex === fotos.length && lugarLibre

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

            {/* Cropper modal (recorta con la relación global elegida: 1:1 o 4:5) */}
            {showCropper && cropperImageUrl && (
                <ImageCropperModal
                    imageUrl={cropperImageUrl}
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                    aspectRatio={aspectRatio}
                />
            )}

            {/* ── Contador + Botón Reordenar ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>
                    Fotos {fotos.length}/{maxFotos}
                    {fotos.length === 0 && " — La primera que subas será la foto principal"}
                </p>
                {fotos.length >= 2 && !modoReordenar && (
                    <button type="button"
                        onClick={() => setModoReordenar(true)}
                        disabled={disabled}
                        title="Reordenar fotos arrastrando"
                        style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 8,
                            border: "1px solid var(--border-primary)",
                            background: "var(--bg-card2)",
                            color: "var(--primary-mid)",
                            fontWeight: 700, fontSize: "0.65rem",
                            cursor: disabled ? "not-allowed" : "pointer",
                            transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = "var(--border-light)"; e.currentTarget.style.borderColor = "var(--primary-mid)" } }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card2)"; e.currentTarget.style.borderColor = "var(--border-primary)" }}
                    >
                        <Icon name="ArrowUpDown" size={14} color="var(--primary-mid)" />
                        Reordenar
                    </button>
                )}
                {modoReordenar && (
                    <button type="button"
                        onClick={() => setModoReordenar(false)}
                        style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 8,
                            border: "none",
                            background: "var(--primary-mid)",
                            color: "#fff",
                            fontWeight: 700, fontSize: "0.65rem",
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        <Icon name="Check" size={14} color="#fff" />
                        Hecho
                    </button>
                )}
            </div>

            {/* ── MODO REORDENAR: Grid DnD ── */}
            {modoReordenar && fotos.length >= 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>
                        Arrastra las fotos para reordenarlas. La primera será la principal.
                    </p>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sortableItems}
                            strategy={rectSortingStrategy}
                        >
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                                gap: 10,
                            }}>
                                {fotos.map((foto, i) => {
                                    const stableId = getItemId(foto)
                                    return (
                                        <SortablePhoto
                                            key={stableId}
                                            id={stableId}
                                            foto={foto}
                                            index={i}
                                            disabled={disabled}
                                            aspectRatio={aspectRatio}
                                            onDelete={handleDelete}
                                        />
                                    )
                                })}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            )}

            {/* ── MODO CARRUSEL (solo cuando NO estamos en reordenar) ── */}
            {!modoReordenar && (fotos.length > 0 || lugarLibre) && (
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

                    {/* Contenedor central: foto real o slot vacío "Añade una foto" */}
                    {esSlotVacio ? (
                        /* Slot vacío: contenedor dashed cliqueable que abre la galería */
                        <div onClick={handleGalleryClick}
                            title="Haz clic para añadir una foto"
                            style={{
                                flex: 1, position: "relative", borderRadius: 12,
                                background: "var(--bg-card2)", aspectRatio: aspectRatio,
                                border: "2px dashed var(--primary-mid)",
                                cursor: disabled ? "not-allowed" : "pointer",
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", gap: 10,
                                transition: "border-color 0.2s, background 0.2s",
                            }}
                            onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = "var(--primary-dark)"; e.currentTarget.style.background = "var(--border-light)" } }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--primary-mid)"; e.currentTarget.style.background = "var(--bg-card2)" }}
                        >
                            <Icon name="ImagePlus" size={36} color="var(--primary-mid)" />
                            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-mid)" }}>
                                Añade una foto
                            </span>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                Foto {carouselIndex + 1} de {maxFotos}
                            </span>
                        </div>
                    ) : (
                        /* Foto real — cliqueable para cambiar */
                        <div onClick={() => handleReplaceClick(carouselIndex)}
                            title="Haz clic para cambiar esta foto"
                        style={{
                            flex: 1, position: "relative", borderRadius: 12, overflow: "hidden",
                            background: "var(--bg-card2)", aspectRatio: aspectRatio,
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
                    )}

                    {/* Flecha derecha */}
                    <button type="button"
                        onClick={() => setCarouselIndex(i => Math.min(indiceMaximo, i + 1))}
                        disabled={disabled || carouselIndex >= indiceMaximo}
                        title="Foto siguiente"
                        style={{
                            flexShrink: 0, width: 32, height: 32, borderRadius: 10,
                            border: "1px solid var(--border-primary)", background: "var(--bg-card2)",
                            color: carouselIndex >= indiceMaximo ? "var(--text-muted)" : "var(--primary-mid)",
                            cursor: carouselIndex >= indiceMaximo ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        <Icon name="ChevronRight" size={18} />
                    </button>
                </div>
            )}

            {/* ── Dots de navegación (solo en modo carrusel) ── */}
            {!modoReordenar && (fotos.length > 1 || (lugarLibre && fotos.length > 0)) && (
                <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                    {/* Dots para cada foto real */}
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
                    {/* Dot extra para el slot vacío si hay lugar */}
                    {lugarLibre && (
                        <button key="empty" type="button"
                            onClick={() => setCarouselIndex(fotos.length)}
                            style={{
                                width: carouselIndex === fotos.length ? 18 : 7, height: 7, borderRadius: 4,
                                border: "none", cursor: "pointer",
                                background: carouselIndex === fotos.length ? "var(--primary-mid)" : "var(--border-light)",
                                transition: "all 0.2s",
                            }}
                        />
                    )}
                </div>
            )}

            {/* ── Botones Subir foto + Tomar foto (solo en modo carrusel) ── */}
            {!modoReordenar && lugarLibre && (
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
