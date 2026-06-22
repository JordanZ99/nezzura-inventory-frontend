// ==============================================================================
// src/lib/image-utils.ts
// Compresión agresiva de imágenes en el navegador.
// Convierte a WebP con calidad reducida para que ocupen ~40-80 KB.
// ==============================================================================

/**
 * Lee un archivo como Data URL usando FileReader.
 */
function leerArchivoComoDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Error al leer el archivo"));
    });
}

/**
 * Carga una imagen desde una URL (puede ser Data URL).
 */
function cargarImagenDesdeURL(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Error al cargar la imagen"));
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
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D");

    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
}

/**
 * Convierte un canvas a Blob WebP con la calidad indicada.
 */
function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Error al generar el blob"));
            },
            "image/webp",
            quality
        );
    });
}

/**
 * Comprime una imagen a WebP con calidad muy reducida.
 *
 * Estrategia:
 * 1. Redimensiona a máximo 600px (lado más grande) — suficiente para
 *    una foto de producto en catálogo.
 * 2. Empieza con calidad 0.3 y va bajando progresivamente hasta que
 *    el archivo pese menos de 80 KB.
 * 3. Si incluso en calidad mínima (0.1) supera 80 KB, lo entrega igual.
 *
 * @param file Archivo original seleccionado por el usuario.
 * @returns Un File en formato WebP, extremadamente ligero.
 */
export async function comprimirImagen(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file;

    const dataUrl = await leerArchivoComoDataURL(file);
    const img = await cargarImagenDesdeURL(dataUrl);
    const canvas = redimensionar(img, 600, 600);

    // Compresión progresiva: empieza con 0.3 y baja hasta 0.1
    const MAX_SIZE_KB = 80;
    let quality = 0.3;

    for (let intento = 0; intento < 10; intento++) {
        const blob = await canvasToBlob(canvas, quality);
        const kb = blob.size / 1024;

        if (kb <= MAX_SIZE_KB || quality <= 0.1) {
            const nombreBase = file.name.replace(/\.[^.]+$/, "");
            const webpFile = new File([blob], `${nombreBase}.webp`, {
                type: "image/webp",
                lastModified: Date.now(),
            });
            return webpFile;
        }

        // Reducir calidad un escalón
        quality = Math.max(0.1, quality - 0.05);
    }

    // Último recurso: calidad 0.1
    const blob = await canvasToBlob(canvas, 0.1);
    const nombreBase = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${nombreBase}.webp`, {
        type: "image/webp",
        lastModified: Date.now(),
    });
}
