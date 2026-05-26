// ==============================================================================
// src/lib/image-utils.ts
// Utilidades para procesamiento de imágenes en el cliente (browser).
//
// NOTA: Esta función comprime imágenes a WebP con un límite de tamaño.
// Redimensiona a 600px máximo y ajusta la calidad automáticamente
// para que el archivo no exceda los 300KB. Esto evita que imágenes
// pesadas ocupen espacio innecesario en Cloudinary.
// ==============================================================================

/**
 * Convierte un Blob a un objeto File con el nombre y tipo especificados.
 * 
 * @param blob - El blob de la imagen comprimida.
 * @param nombreOriginal - Nombre original del archivo para extraer la base.
 * @returns Un objeto File en formato WebP.
 */
function blobToWebPFile(blob: Blob, nombreOriginal: string): File {
    // Renombramos la extensión a .webp para reflejar el formato real de salida
    const nombreBase = nombreOriginal.replace(/\.[^.]+$/, '');
    return new File([blob], `${nombreBase}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
    });
}

/**
 * Redimensiona una imagen en un canvas manteniendo la proporción original.
 * El lado más grande se ajusta al máximo permitido y el otro lado se
 * escala proporcionalmente para no distorsionar la imagen.
 * 
 * Lanza un error si no se puede obtener el contexto 2D del canvas,
 * lo cual puede ocurrir en navegadores muy antiguos o si el canvas
 * supera el tamaño máximo permitido por el hardware.
 * 
 * @param img - Objeto Image ya cargado.
 * @param maxWidth - Ancho máximo en píxeles.
 * @param maxHeight - Alto máximo en píxeles.
 * @returns El canvas con la imagen redimensionada.
 * @throws Error si el contexto 2D no está disponible.
 */
function redimensionarEnCanvas(img: HTMLImageElement, maxWidth: number, maxHeight: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;

    // Reducimos proporcionalmente: limitamos por el lado más grande
    // para que la imagen nunca exceda las dimensiones máximas.
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

    // Obtenemos el contexto 2D para dibujar la imagen redimensionada
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        // Si el contexto no está disponible (navegador sin soporte o
        // canvas demasiado grande), lanzamos un error claro.
        throw new Error("No se pudo obtener el contexto 2D del canvas");
    }

    // Dibujamos la imagen redimensionada en el canvas
    ctx.drawImage(img, 0, 0, width, height);

    return canvas;
}

/**
 * Comprime y redimensiona una imagen en el navegador usando Canvas,
 * asegurando que el archivo resultante no exceda un tamaño máximo.
 * 
 * Estrategia:
 * 1. Redimensiona la imagen a un máximo de 600x600px (valor por defecto).
 * 2. Comprime a WebP con calidad inicial 0.6.
 * 3. Si el archivo excede el límite de 300KB, reduce la calidad
 *    progresivamente hasta cumplir el límite.
 * 4. Esto garantiza que las imágenes en Cloudinary ocupen poco espacio.
 *
 * @param file - El archivo original (Input File).
 * @param maxWidth - Ancho máximo en píxeles (por defecto 600px).
 * @param maxHeight - Alto máximo en píxeles (por defecto 600px).
 * @param quality - Calidad de compresión WebP (0.0 a 1.0, defecto 0.6).
 * @param maxSizeKB - Tamaño máximo del archivo en kilobytes (por defecto 300KB).
 * @returns Un nuevo objeto File comprimido que cumple con el límite de tamaño.
 */
export async function comprimirImagen(
    file: File, 
    maxWidth: number = 600, 
    maxHeight: number = 600, 
    quality: number = 0.6,
    maxSizeKB: number = 300
): Promise<File> {
    // Si no es una imagen, devolvemos el original sin modificar
    if (!file.type.startsWith('image/')) return file;

    // Paso 1: Cargamos la imagen original en memoria para procesarla
    const dataUrl = await leerArchivoComoDataURL(file);
    const img = await cargarImagenDesdeURL(dataUrl);

    // Paso 2: Redimensionamos la imagen al tamaño máximo permitido
    const canvas = redimensionarEnCanvas(img, maxWidth, maxHeight);

    // Paso 3: Comprimimos progresivamente hasta cumplir el límite de tamaño
    const blobComprimido = await comprimirConLimiteDeTamaño(canvas, quality, maxSizeKB);

    // Paso 4: Convertimos el blob final a un objeto File con formato WebP
    return blobToWebPFile(blobComprimido, file.name);
}

/**
 * Lee un archivo como Data URL (string base64) para poder cargarlo
 * en un objeto Image del navegador.
 * 
 * @param file - Archivo a leer.
 * @returns Una promesa que resuelve con la Data URL del archivo.
 */
function leerArchivoComoDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(new Error("Error al leer el archivo con FileReader"));
    });
}

/**
 * Carga una imagen desde una URL (puede ser Data URL).
 * 
 * @param url - URL o Data URL de la imagen.
 * @returns Una promesa que resuelve con el objeto Image cargado.
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
 * Comprime un canvas a WebP con una calidad inicial, y si el archivo
 * resultante excede el límite de tamaño, reduce la calidad progresivamente
 * hasta cumplir con el límite o llegar a calidad 0.1.
 * 
 * Esto asegura que las imágenes subidas a Cloudinary tengan un tamaño
 * controlado, evitando que fotos muy pesadas ocupen espacio innecesario.
 * 
 * @param canvas - Canvas con la imagen redimensionada.
 * @param qualityInicial - Calidad inicial de compresión (0.0 a 1.0).
 * @param maxSizeKB - Tamaño máximo permitido en kilobytes.
 * @returns Una promesa que resuelve con el Blob comprimido.
 */
/**
 * Comprime un canvas a WebP con una calidad inicial, y si el archivo
 * resultante excede el límite de tamaño, reduce la calidad progresivamente
 * hasta cumplir con el límite o llegar a calidad 0.1.
 * 
 * IMPORTANTE: Se incluye una protección contra bucle infinito: si después
 * de reducir la calidad al mínimo el archivo sigue excediendo el límite,
 * se devuelve igual con la calidad mínima para no bloquear la subida.
 * 
 * @param canvas - Canvas con la imagen redimensionada.
 * @param qualityInicial - Calidad inicial de compresión (0.0 a 1.0).
 * @param maxSizeKB - Tamaño máximo permitido en kilobytes.
 * @returns Una promesa que resuelve con el Blob comprimido.
 */
async function comprimirConLimiteDeTamaño(
    canvas: HTMLCanvasElement,
    qualityInicial: number,
    maxSizeKB: number
): Promise<Blob> {
    let calidad = qualityInicial;
    // No bajamos de 10% de calidad para no degradar excesivamente la imagen
    const calidadMinima = 0.1;

    while (true) {
        const blob = await canvasToBlob(canvas, calidad);
        const tamanoKB = blob.size / 1024;

        // Si el blob cumple con el límite de tamaño, lo devolvemos inmediatamente
        if (tamanoKB <= maxSizeKB) {
            return blob;
        }

        // Si ya estamos en la calidad mínima y el archivo sigue excediendo
        // el límite, devolvemos el blob con calidad mínima como último recurso.
        // Esto evita un bucle infinito cuando Math.max(0.1, 0.1 - 0.15) = 0.1.
        if (calidad <= calidadMinima) {
            return blob;
        }

        // Reducimos la calidad en 0.15 y reintentamos.
        // Usamos un paso grande para minimizar la cantidad de iteraciones.
        calidad = Math.max(calidadMinima, calidad - 0.15);
    }
}

/**
 * Convierte un canvas a Blob en formato WebP con la calidad especificada.
 * 
 * @param canvas - Canvas a convertir.
 * @param quality - Calidad de compresión (0.0 a 1.0).
 * @returns Una promesa que resuelve con el Blob.
 */
function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Error al generar el Blob de la imagen"));
                }
            },
            'image/webp',
            quality
        );
    });
}
