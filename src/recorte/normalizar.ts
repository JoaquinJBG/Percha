/** Lado mayor de las fotos que se guardan: de sobra para etiquetar y para el collage. */
export const LADO_MAXIMO = 1280
const CALIDAD_JPEG = 0.85

export class ErrorFoto extends Error {
  override name = 'ErrorFoto'
}

export function medidasReducidas(
  ancho: number,
  alto: number,
  ladoMaximo = LADO_MAXIMO,
): { ancho: number; alto: number } {
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto))
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  }
}

/**
 * Endereza la foto según su EXIF, la reduce a `LADO_MAXIMO` y la pasa a JPEG. Así ocupa poco y el
 * recorte trabaja sobre la misma imagen que se guarda.
 */
export async function normalizarFoto(foto: Blob): Promise<Blob> {
  let mapa: ImageBitmap
  try {
    mapa = await createImageBitmap(foto, { imageOrientation: 'from-image' })
  } catch {
    throw new ErrorFoto('No se pudo abrir la foto. Prueba con otra.')
  }
  try {
    const { ancho, alto } = medidasReducidas(mapa.width, mapa.height)
    const lienzo = new OffscreenCanvas(ancho, alto)
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new ErrorFoto('No se pudo preparar la foto.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(mapa, 0, 0, ancho, alto)
    return await lienzo.convertToBlob({ type: 'image/jpeg', quality: CALIDAD_JPEG })
  } finally {
    mapa.close()
  }
}
