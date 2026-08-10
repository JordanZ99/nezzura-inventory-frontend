// ==============================================================================
// src/lib/image-utils.ts
// Compresión de imágenes en el navegador.
// Redimensiona y comprime a JPEG (compatible con todos los navegadores)
// para que las fotos de productos pesen ~40-80 KB.
// ==============================================================================

/** Tamaño máximo del archivo original que aceptamos (10 MB) */
const MAX_ORIGINAL_SIZE_MB = 10;

/**
 * Lee un archivo como Data URL usando FileReader.
 */
function leerArchivoComoDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === "string" && result.length > 0) {
                resolve(result);
            } else {
                reject(new Error("El FileReader devolvió un resultado vacío"));
            }
        };
        reader.onerror = () => reject(new Error("Error al leer el archivo"));
        reader.readAsDataURL(file);
    });
}

/**
 * Carga una imagen desde una URL (puede ser Data URL).
 */
function cargarImagenDesdeURL(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Validar que la imagen tenga dimensiones reales
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                reject(new Error("La imagen cargó con dimensiones 0x0"));
                return;
            }
            resolve(img);
        };
        img.onerror = () => reject(new Error("Error al cargar la imagen. El formato puede no ser compatible."));
        img.src = url;
    });
}

/**
 * Redimensiona una imagen manteniendo la proporción,
 * sin superar las dimensiones máximas.
 */
function redimensionar(img: HTMLImageElement, maxWidth: number, maxHeight: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    let { width, height } = img;

    if (width > height) {
        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }
    } else {
        if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
        }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
}

/**
 * Convierte un canvas a Blob JPEG con la calidad indicada.
 * JPEG es compatible con todos los navegadores (a diferencia de WebP).
 */
function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob || blob.size === 0) {
                    reject(new Error("El navegador generó una imagen vacía al comprimir"));
                    return;
                }
                resolve(blob);
            },
            "image/jpeg",
            quality
        );
    });
}

/**
 * Comprime una imagen a JPEG con calidad reducida.
 *
 * Estrategia:
 * 1. Valida que el archivo no supere 10 MB.
 * 2. Redimensiona a máximo 600px (lado más grande) — suficiente para
 *    una foto de producto en catálogo.
 * 3. Empieza con calidad 0.5 y va bajando progresivamente hasta que
 *    el archivo pese menos de 80 KB.
 * 4. Si incluso en calidad mínima (0.15) supera 80 KB, lo entrega igual.
 *
 * @param file Archivo original seleccionado por el usuario.
 * @returns Un File en formato JPEG, ligero y compatible con todos los navegadores.
 * @throws Error si el archivo es demasiado grande o el navegador no puede procesarlo.
 */
export async function comprimirImagen(file: File): Promise<File> {
    // Si no es imagen, devolver tal cual
    if (!file.type.startsWith("image/")) return file;

    // Validar tamaño máximo del archivo original
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_ORIGINAL_SIZE_MB) {
        throw new Error(
            `La imagen pesa ${sizeMB.toFixed(1)} MB. El máximo permitido es ${MAX_ORIGINAL_SIZE_MB} MB. ` +
            `Intenta con una foto más pequeña.`
        );
    }

    const dataUrl = await leerArchivoComoDataURL(file);
    const img = await cargarImagenDesdeURL(dataUrl);
    const canvas = redimensionar(img, 600, 600);

    // Compresión progresiva: empieza con 0.5 y baja hasta 0.15
    const MAX_SIZE_KB = 80;
    let quality = 0.5;

    for (let intento = 0; intento < 10; intento++) {
        const blob = await canvasToBlob(canvas, quality);
        const kb = blob.size / 1024;

        if (kb <= MAX_SIZE_KB || quality <= 0.15) {
            const nombreBase = file.name.replace(/\.[^.]+$/, "");
            const jpegFile = new File([blob], `${nombreBase}.jpg`, {
                type: "image/jpeg",
                lastModified: Date.now(),
            });
            return jpegFile;
        }

        // Reducir calidad un escalón
        quality = Math.max(0.15, quality - 0.05);
    }

    // Último recurso: calidad 0.15
    const blob = await canvasToBlob(canvas, 0.15);
    const nombreBase = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${nombreBase}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
    });
}

/**
 * Comprime una imagen a JPEG conservando las dimensiones de un banner.
 *
 * A diferencia de comprimirImagen (que reduce a 600px y ~80KB para fotos
 * de producto), esta versión:
 *   - Redimensiona solo si supera maxWidth×maxHeight (default 1920×800),
 *     para no perder resolución en un banner de escritorio (1920×373).
 *   - Comprime hasta pesar menos de ~350 KB (los banners pesan más que una
 *     foto de producto; el endpoint acepta hasta 1 MB).
 *
 * @param file Archivo o recorte (Blob como File) seleccionado por el usuario.
 * @param maxWidth Ancho máximo tras redimensionar (default 1920).
 * @param maxHeight Alto máximo tras redimensionar (default 800).
 * @returns Un File en formato JPEG con calidad suficiente para un banner.
 */
export async function comprimirBanner(file: File, maxWidth = 1920, maxHeight = 800): Promise<File> {
    // Si no es imagen, devolver tal cual
    if (!file.type.startsWith("image/")) return file

    // Validar tamaño máximo del archivo original
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > MAX_ORIGINAL_SIZE_MB) {
        throw new Error(
            `La imagen pesa ${sizeMB.toFixed(1)} MB. El máximo permitido es ${MAX_ORIGINAL_SIZE_MB} MB. ` +
            `Intenta con una foto más pequeña.`
        )
    }

    const dataUrl = await leerArchivoComoDataURL(file)
    const img = await cargarImagenDesdeURL(dataUrl)
    const canvas = redimensionar(img, maxWidth, maxHeight)

    // Compresión progresiva: empieza con 0.7 y baja hasta 0.35
    const MAX_SIZE_KB = 350
    let quality = 0.7

    for (let intento = 0; intento < 10; intento++) {
        const blob = await canvasToBlob(canvas, quality)
        const kb = blob.size / 1024

        if (kb <= MAX_SIZE_KB || quality <= 0.35) {
            const nombreBase = file.name.replace(/\.[^.]+$/, "")
            return new File([blob], `${nombreBase}.jpg`, {
                type: "image/jpeg",
                lastModified: Date.now(),
            })
        }

        // Reducir calidad un escalón
        quality = Math.max(0.35, quality - 0.05)
    }

    // Último recurso: calidad 0.35
    const blob = await canvasToBlob(canvas, 0.35)
    const nombreBase = file.name.replace(/\.[^.]+$/, "")
    return new File([blob], `${nombreBase}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
    })
}
