// ==============================================================================
// src/components/ui/ImageCropperModal.tsx
// Modal con cropper para recortar fotos antes de subirlas.
// Por defecto el marco es 1:1 (fotos de producto); se puede cambiar la
// relación con la prop aspectRatio (ej. 1920/373 para banners).
//
// Comportamiento del zoom:
//   - Slider de 0% a 100%, con posición inicial en 50% (centro).
//   - 50% → zoom por defecto: la imagen cubre todo el marco (cover).
//   - < 50% → zoom out SIN LÍMITE (hasta un piso mínimo): la imagen se
//              encoge por debajo de "imagen completa" (contain) y el área
//              vacía se rellena con el color de Fondo, permitiendo alejar
//              el producto de los bordes (márgenes).
//   - > 50% → zoom in: acerca la imagen para ver detalles.
//   - Snap magnético en 48-52% → salta a 50% automáticamente.
//   - Drag bounds se adaptan según el zoom.
// ==============================================================================

"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import Cropper, { Area } from "react-easy-crop"
import Icon from "./Icon"

const MAX_ZOOM = 3

export interface CropGeometry {
    /** Rectángulo visible como fracciones de la imagen natural (0-1). Pueden
     * salir de rango en zoom out (márgenes): fx/fy negativos, fw/fh > 1. */
    fx: number
    fy: number
    fw: number
    fh: number
    /** Color de relleno del área vacía (zoom out) */
    fondo: "blanco" | "negro"
}

interface ImageCropperModalProps {
    /** URL (blob) de la imagen original a recortar */
    imageUrl: string
    /** Se dispara con el Blob ya recortado listo para comprimir/subir */
    onCropComplete?: (croppedBlob: Blob) => void
    /** El usuario canceló el recorte */
    onCancel: () => void
    /** Relación de recorte (ancho/alto). Default 1 (cuadrado) */
    aspectRatio?: number
    /** Etiqueta de dimensiones mostrada en el header (ej. "1920 × 373") */
    dimensionLabel?: string
    /** Se dispara al aceptar con la geometría del recorte (fracciones de la
     * imagen natural), para renders que re-encuadran la foto SIN subir el
     * recorte (ej. la tarjeta de post: la geometría va como params a la URL). */
    onGeometryChange?: (geo: CropGeometry) => void
}

/**
 * Carga una imagen desde una URL para dibujarla en canvas o medir sus
 * dimensiones naturales.
 */
function cargarImagen(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        // Solo setear crossOrigin si NO es blob URL.
        // Las blob URLs son same-origin por definición, y setear crossOrigin
        // en ellas puede causar que el canvas se marque como "tainted" en
        // algunos navegadores (Safari móvil, ciertas versiones de Chrome),
        // lo que hace que canvas.toBlob() produzca un blob vacío o falle.
        if (!url.startsWith("blob:")) {
            img.setAttribute("crossOrigin", "anonymous")
        }
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("No se pudo cargar la imagen para recortar"))
        img.src = url
    })
}

/** Tope del lado mayor del recorte: evita canvas gigantes (memoria en móvil).
 * El archivo final igual se re-comprime con comprimirImagen (1000px máx). */
const MAX_CROP_OUTPUT = 1400

/**
 * Dibuja la imagen recortada en un canvas y devuelve el Blob en JPEG.
 *
 * @param pixelCrop Rectángulo en píxeles NATURALES de la imagen. Puede exceder
 *        los límites de la imagen (márgenes del zoom out): esas zonas se
 *        rellenan con el color de fondo.
 * @param fondo Color de relleno del área vacía (transparencia PNG o zoom-out).
 *        Sin rellenar, el canvas arranca transparente y al exportar a JPEG
 *        (sin canal alfa) esas zonas caen a NEGRO — el artefacto que se veía
 *        al subir PNG. Por defecto se rellena de blanco.
 */
async function getCroppedImg(imageSrc: string, pixelCrop: Area, fondo: string): Promise<Blob> {
    const image = await cargarImagen(imageSrc)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D")

    // Reducir el recorte si supera el tope (mantiene la proporción)
    let { width, height } = pixelCrop
    const escala = Math.min(1, MAX_CROP_OUTPUT / Math.max(width, height))
    width = Math.round(width * escala)
    height = Math.round(height * escala)

    canvas.width = width
    canvas.height = height

    // Rellenar el fondo ANTES de dibujar (ver docstring)
    ctx.fillStyle = fondo
    ctx.fillRect(0, 0, width, height)

    // El rect de recorte puede EXCEDER los límites de la imagen (márgenes de
    // zoom out). Dibujamos solo la intersección con la imagen, en su posición
    // exacta dentro del canvas, para que el relleno del Fondo quede alrededor.
    const imgW = image.naturalWidth
    const imgH = image.naturalHeight
    const ix = Math.max(0, pixelCrop.x)
    const iy = Math.max(0, pixelCrop.y)
    const ir = Math.min(imgW, pixelCrop.x + pixelCrop.width)
    const ib = Math.min(imgH, pixelCrop.y + pixelCrop.height)
    const vw = ir - ix
    const vh = ib - iy
    if (vw > 0 && vh > 0) {
        ctx.drawImage(
            image,
            ix,
            iy,
            vw,
            vh,
            (ix - pixelCrop.x) * escala,
            (iy - pixelCrop.y) * escala,
            vw * escala,
            vh * escala,
        )
    }

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob && blob.size > 0) resolve(blob)
                else reject(new Error("El canvas generó una imagen vacía"))
            },
            "image/jpeg",
            0.85,
        )
    })
}

/**
 * Convierte un valor de slider (0-100) al zoom real de react-easy-crop.
 *
 *   - 0%   → zoomOutMin (imagen mucho más pequeña que el marco: márgenes)
 *   - 50%  → zoom=1 (imagen cubre todo el marco, comportamiento por defecto)
 *   - 100% → MAX_ZOOM (zoom máximo, detalle muy cercano)
 */
function sliderToZoom(sliderPct: number, zoomOutMin: number): number {
    if (sliderPct <= 50) {
        // Zoom out sin límite (hasta zoomOutMin): de la imagen encogida con
        // márgenes a la imagen que cubre todo el marco (cover). Por debajo de
        // "imagen completa" (contain) el área vacía se rellena con el Fondo.
        return zoomOutMin + (1 - zoomOutMin) * (sliderPct / 50)
    }
    // Modo cover → zoom in: de 1 a MAX_ZOOM
    return 1 + (MAX_ZOOM - 1) * ((sliderPct - 50) / 50)
}

/**
 * Convierte un zoom real de react-easy-crop a valor de slider (0-100).
 */
function zoomToSlider(zoom: number, zoomOutMin: number): number {
    if (zoom <= 1) {
        return ((zoom - zoomOutMin) / (1 - zoomOutMin)) * 50
    }
    return 50 + ((zoom - 1) / (MAX_ZOOM - 1)) * 50
}

/**
 * Geometría del marco de recorte, replicando la lógica interna de react-easy-crop
 * (getCropSize) para poder calcular el rectángulo de recorte en píxeles naturales
 * de la imagen SIN el clamp que la librería aplica al guardar (que impedía los
 * márgenes del zoom out y recortaba un eje según el ratio de la imagen).
 *
 *  - s: escala del layout de la imagen dentro del contenedor (objectFit contain)
 *  - mediaW/mediaH: tamaño mostrado de la imagen, en unidades del contenedor
 *  - cropW/cropH: tamaño del marco de recorte, en unidades del contenedor
 */
function frameGeom(containerW: number, containerH: number, imgW: number, imgH: number, aspect: number) {
    const s = Math.min(containerW / imgW, containerH / imgH)
    const mediaW = imgW * s
    const mediaH = imgH * s
    const fittingWidth = Math.min(mediaW, containerW)
    const fittingHeight = Math.min(mediaH, containerH)
    let cropW: number, cropH: number
    if (fittingWidth > fittingHeight * aspect) {
        cropW = fittingHeight * aspect
        cropH = fittingHeight
    } else {
        cropW = fittingWidth
        cropH = fittingWidth / aspect
    }
    return { s, mediaW, mediaH, cropW, cropH }
}

/**
 * Rectángulo de recorte en píxeles NATURALES de la imagen, calculado a partir del
 * crop/zoom actuales. A diferencia de lo que devuelve react-easy-crop (que limita
 * el área a los bordes de la imagen), este rect puede exceder los límites de la
 * imagen: es lo que permite exportar los márgenes del zoom out con el color de
 * Fondo alrededor del producto.
 *
 * crop.x/crop.y están en píxeles CSS del contenedor (la semántica real de
 * react-easy-crop). La fórmula coincide con su croppedAreaPercentages
 * (verificada contra su fuente).
 */
function computeCropRectPx(
    containerW: number,
    containerH: number,
    imgW: number,
    imgH: number,
    aspect: number,
    crop: { x: number; y: number },
    zoom: number,
): Area {
    const { s, cropW, cropH } = frameGeom(containerW, containerH, imgW, imgH, aspect)
    const rectW = cropW / (s * zoom)
    const rectH = cropH / (s * zoom)
    return {
        x: imgW / 2 - rectW / 2 - crop.x / (s * zoom),
        y: imgH / 2 - rectH / 2 - crop.y / (s * zoom),
        width: rectW,
        height: rectH,
    }
}

export default function ImageCropperModal({
    imageUrl,
    onCropComplete,
    onCancel,
    aspectRatio = 1,
    dimensionLabel,
    onGeometryChange,
}: ImageCropperModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    // Color de relleno del área vacía (transparencia / zoom-out). Blanco por
    // defecto: sin este relleno el JPEG exporta esas zonas en negro.
    const [fondo, setFondo] = useState<"blanco" | "negro">("blanco")
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    // Ref espejo de croppedAreaPixels para acceso síncrono dentro de handleAccept.
    // Necesario porque el callback de espera (polling) no ve el estado actualizado
    // hasta el siguiente render, pero la ref sí se actualiza inmediatamente.
    const croppedAreaPixelsRef = useRef<Area | null>(null)
    const [procesando, setProcesando] = useState(false)

    // ── Dimensiones naturales de la imagen ──
    const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 })
    const zoomContainRef = useRef(1)
    // Piso del zoom out (mínimo del slider). Depende de zoomContain; se
    // actualiza cuando la imagen carga.
    const zoomOutMinRef = useRef(Math.max(0.2, 0.35 * 0.4))
    // Ref al contenedor del cropper (para medir su tamaño al exportar el rect).
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        let cancel = false
        // Reset del área de recorte al cambiar de imagen.
        // Sin esto, croppedAreaPixelsRef podría tener el valor de la imagen
        // anterior, y handleAccept usaría coordenadas viejas para la nueva imagen.
        croppedAreaPixelsRef.current = null
        setCroppedAreaPixels(null)
        const img = new Image()
        // Solo ponemos crossOrigin si NO es blob URL (las blob son mismo origen)
        if (!imageUrl.startsWith("blob:")) {
            img.setAttribute("crossOrigin", "anonymous")
        }
        img.onload = () => {
            if (cancel) return
            const w = img.naturalWidth
            const h = img.naturalHeight
            if (w === 0 || h === 0) {
                // Imagen inválida: usar fallback
                zoomContainRef.current = 0.35
                return
            }
            setImageNaturalSize({ width: w, height: h })
            // zoomContain = zoom con el que la imagen COMPLETA cabe en el marco
            // (con aspecto cuadrado se reduce a lado corto / lado largo).
            const A = aspectRatio
            const ratio = Math.min((w * A) / h, h / (w * A))
            zoomContainRef.current = Math.max(0.1, ratio)
            // Piso del zoom out: permite encoger la imagen hasta un 40% de
            // "imagen completa" (mínimo absoluto 0.2) para crear márgenes.
            zoomOutMinRef.current = Math.max(0.2, zoomContainRef.current * 0.4)
            // Si el zoom actual quedó por debajo del nuevo piso (cambio de
            // imagen), ajustarlo para que el slider no salga de rango.
            setZoom(z => Math.max(z, zoomOutMinRef.current))
        }
        img.onerror = () => {
            if (cancel) return
            // Si falla la carga (e.g. CORS), usamos un valor razonable
            // que permite zoom out aunque no sea perfecto
            zoomContainRef.current = 0.35
            zoomOutMinRef.current = Math.max(0.2, 0.35 * 0.4)
        }
        img.src = imageUrl
        return () => { cancel = true }
    }, [imageUrl])

    // Valor del slider derivado del zoom actual
    const sliderValue = useMemo(
        () => zoomToSlider(zoom, zoomOutMinRef.current),
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
            croppedAreaPixelsRef.current = croppedPixels // sincronizar ref para handleAccept
        },
        [],
    )

    const handleSliderChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = Number(e.target.value)
            // Snap magnético: si está entre 48 y 52, salta al 50 exacto
            const snapped = raw >= 48 && raw <= 52 ? 50 : raw
            const newZoom = sliderToZoom(snapped, zoomOutMinRef.current)
            setZoom(newZoom)
        },
        [],
    )

    const [errorRecorte, setErrorRecorte] = useState<string | null>(null)

    /**
     * Calcula el rectángulo de recorte REAL (píxeles naturales de la imagen) a
     * partir de la geometría del contenedor y del crop/zoom actuales. Puede
     * exceder los límites de la imagen (márgenes del zoom out). Devuelve null
     * si no se puede medir el contenedor o la imagen aún no cargó.
     */
    const resolveCropRect = useCallback((): Area | null => {
        const el = containerRef.current
        const { width: imgW, height: imgH } = imageNaturalSize
        if (!el || imgW <= 0 || imgH <= 0) return null
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return null
        return computeCropRectPx(r.width, r.height, imgW, imgH, aspectRatio, crop, zoom)
    }, [aspectRatio, crop, zoom, imageNaturalSize])

    const handleAccept = useCallback(async () => {
        if (procesando) return

        // ── Bug fix: croppedAreaPixels puede ser null si la imagen del cropper
        // aún no ha terminado de cargar y computar el área de recorte.
        // Antes esto causaba un return silencioso: el modal no se cerraba,
        // no se añadía la foto, y el usuario no sabía qué pasó.
        // Ahora esperamos hasta 3 segundos a que croppedAreaPixels esté listo.
        // Si no llega, mostramos un error visible en lugar de fallar en silencio.
        // ──
        if (!croppedAreaPixels) {
            // Reintentar: esperar a que react-easy-crop dispare onCropComplete
            setProcesando(true)
            setErrorRecorte(null)
            const inicio = Date.now()
            const esperar = (): Promise<Area | null> => {
                return new Promise(resolve => {
                    const check = () => {
                        // croppedAreaPixels se actualiza via setCroppedAreaPixels
                        // en onCropAreaComplete. Lo leemos del estado actual.
                        if (croppedAreaPixelsRef.current) {
                            resolve(croppedAreaPixelsRef.current)
                        } else if (Date.now() - inicio > 3000) {
                            resolve(null) // timeout: la imagen no cargó
                        } else {
                            setTimeout(check, 50)
                        }
                    }
                    check()
                })
            }
            const area = await esperar()
            setProcesando(false)
            if (!area) {
                setErrorRecorte("La imagen no terminó de cargar. Intenta de nuevo o usa otra foto.")
                return
            }
            // Si llegamos aquí, la imagen ya cargó. Continuar con el recorte.
            setProcesando(true)
        }

        // ── Rect de recorte REAL en píxeles de la imagen, sin el clamp de
        // react-easy-crop (que limitaba el área a la imagen y recortaba un eje).
        // Puede exceder los límites de la imagen: así los márgenes del zoom out
        // se exportan con el color de Fondo, como se ve en el preview.
        // ──
        const rect = resolveCropRect() ?? croppedAreaPixelsRef.current ?? croppedAreaPixels
        if (!rect) {
            setErrorRecorte("No se pudo calcular el recorte. Intenta de nuevo.")
            setProcesando(false)
            return
        }

        setErrorRecorte(null)

        // Geometría del recorte en fracciones de la imagen natural: la usa el
        // render de la tarjeta de post para re-encuadrar la foto SIN subir nada.
        const imgW = imageNaturalSize.width
        const imgH = imageNaturalSize.height
        if (imgW > 0 && imgH > 0) {
            onGeometryChange?.({
                fx: rect.x / imgW,
                fy: rect.y / imgH,
                fw: rect.width / imgW,
                fh: rect.height / imgH,
                fondo,
            })
        }

        if (onCropComplete) {
            try {
                const blob = await getCroppedImg(imageUrl, rect, fondo === "negro" ? "#000000" : "#ffffff")
                onCropComplete(blob)
            } catch (e) {
                console.error("Error al recortar imagen:", e)
                // Fallback: devolver la imagen original completa
                try {
                    const resp = await fetch(imageUrl)
                    const blob = await resp.blob()
                    onCropComplete(blob)
                } catch {
                    setErrorRecorte("Error al procesar la imagen. Intenta con otra foto.")
                    setProcesando(false)
                }
            }
        }
    }, [imageUrl, croppedAreaPixels, onCropComplete, procesando, resolveCropRect, fondo, onGeometryChange, imageNaturalSize])

    // ── Texto contextual del zoom ──
    const zoomLabel = useMemo(() => {
        const zc = zoomContainRef.current
        if (sliderValue >= 90) return "Vista ampliada"
        if (sliderValue >= 48 && sliderValue <= 52) return "Imagen ajustada al marco"
        if (Math.abs(zoom - zc) <= 0.005) return "Imagen completa dentro del marco"
        if (sliderValue < 48) return "Mostrando más imagen"
        return "Acercando para detalle"
    }, [sliderValue, zoom])

    // ── Modo "imagen más pequeña que el marco": el zoom out superó el contain
    // y el área vacía se rellena con el color de Fondo ──
    const esModoContain = zoom < zoomContainRef.current - 0.005

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
            onClick={(e) => {
                // No burbujear a modales/backdrops de atrás (ej. el modal de
                // post): el cropper es un overlay propio y sus clicks no deben
                // cerrar lo que hay debajo. Solo se cancela al hacer click en
                // el backdrop del PROPIO cropper.
                e.stopPropagation()
                if (e.target === e.currentTarget) onCancel()
            }}
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
                    {dimensionLabel && (
                        <span style={{
                            padding: "3px 10px", borderRadius: 999,
                            background: "var(--primary-soft)", color: "var(--primary-mid)",
                            fontSize: "0.68rem", fontWeight: 800, letterSpacing: 0.3,
                        }}>
                            {dimensionLabel}
                        </span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Arrastra para posicionar
                    </span>
                </div>

                {/* ── Cropper ── */}
                <div
                    ref={containerRef}
                    style={{
                        position: "relative",
                        width: "100%",
                        height: 360,
                        // WYSIWYG: el área vacía del preview muestra el mismo
                        // color de Fondo que se exportará al guardar.
                        background: fondo === "negro" ? "#000000" : "#ffffff",
                    }}
                >
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspectRatio}
                        minZoom={zoomOutMinRef.current}
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

                    {/* Fondo del área vacía (transparencia PNG o zoom-out).
                        Sin rellenar, el JPEG exporta esas zonas en negro. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Fondo
                        </span>
                        <button
                            type="button"
                            onClick={() => setFondo("blanco")}
                            title="Rellenar el vacío de blanco"
                            style={{
                                width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
                                background: "#ffffff",
                                border: fondo === "blanco" ? "2px solid var(--primary-mid)" : "1px solid var(--border-primary)",
                                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setFondo("negro")}
                            title="Rellenar el vacío de negro"
                            style={{
                                width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
                                background: "#111111",
                                border: fondo === "negro" ? "2px solid var(--primary-mid)" : "1px solid var(--border-primary)",
                            }}
                        />
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
                                Imagen más pequeña que el marco — el espacio se rellena con el Fondo
                            </>
                        ) : (
                            <>{zoomLabel}</>
                        )}
                    </p>

                    {/* Mensaje de error visible si el recorte falló */}
                    {errorRecorte && (
                        <div style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#b91c1c",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}>
                            <Icon name="TriangleAlert" size={18} color="#b91c1c" />
                            {errorRecorte}
                        </div>
                    )}

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
