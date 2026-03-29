// ==============================================================================
// src/lib/image-utils.ts
// Utilidades para procesamiento de imágenes en el cliente (browser).
// ==============================================================================

/**
 * Comprime y redimensiona una imagen en el navegador usando Canvas.
 * @param file El archivo original (Input File).
 * @param maxWidth Ancho máximo (por defecto 800px).
 * @param maxHeight Alto máximo (por defecto 800px).
 * @param quality Calidad de compresión JPEG (0.0 a 1.0, defecto 0.7).
 * @returns Un nuevo objeto File comprimido.
 */
export async function comprimirImagen(
    file: File, 
    maxWidth: number = 800, 
    maxHeight: number = 800, 
    quality: number = 0.7
): Promise<File> {
    // Si no es una imagen, devolvemos el original
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Cálculo de redimensión proporcional
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

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("No se pudo obtener el contexto del Canvas"));
                    return;
                }

                // Dibujar la imagen redimensionada
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a Blob (JPEG para mejor compresión)
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // Crear un nuevo File a partir del Blob
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            reject(new Error("Error al generar el Blob de la imagen"));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            
            img.onerror = () => reject(new Error("Error al cargar la imagen en el objeto Image"));
        };
        
        reader.onerror = () => reject(new Error("Error al leer el archivo con FileReader"));
    });
}
