// ==============================================================================
// src/lib/image-utils.ts
// Compresión de imágenes en el navegador.
// Convierte a WebP con calidad reducida para que ocupen muy poco espacio.
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
 * Comprime una imagen a WebP con calidad reducida.
 *
 * 1. Redimensiona a máximo 1200px (lado más grande).
 * 2. Convierte a WebP con calidad 0.5 (balance entre peso y calidad).
 * 3. NO impone un límite de KB — confía en que WebP + redimensionamiento
 *    reducirá drásticamente el peso.
 *
 * @param file Archivo original seleccionado por el usuario.
 * @returns Un File en formato WebP, listo para subir.
 */
export async function comprimirImagen(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file;

    const dataUrl = await leerArchivoComoDataURL(file);
    const img = await cargarImagenDesdeURL(dataUrl);
    const canvas = redimensionar(img, 1200, 1200);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Error al generar el blob"));
                    return;
                }
                const nombreBase = file.name.replace(/\.[^.]+$/, "");
                const webpFile = new File([blob], `${nombreBase}.webp`, {
                    type: "image/webp",
                    lastModified: Date.now(),
                });
                resolve(webpFile);
            },
            "image/webp",
            0.5
        );
    });
}
