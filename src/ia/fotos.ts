/** Lado mayor de la foto que se manda. Gemini cobra igual en tokens; solo ahorra subida (S2). */
export const LADO_MAXIMO = 768

export interface FotoParaIA {
  /** Bytes en base64, sin el prefijo `data:`. */
  datos: string
  tipo: string
}

/** Una etiqueta tiene letra pequeña: con 768 px la referencia se lee mal. */
export const LADO_MAXIMO_ETIQUETA = 1536

/** Reduce la foto (a 768 px si no se dice otra cosa) y la pasa a JPEG con fondo blanco. */
export async function prepararFoto(foto: Blob, ladoMaximo = LADO_MAXIMO): Promise<FotoParaIA> {
  const mapa = await createImageBitmap(foto)
  try {
    const escala = Math.min(1, ladoMaximo / Math.max(mapa.width, mapa.height))
    const ancho = Math.max(1, Math.round(mapa.width * escala))
    const alto = Math.max(1, Math.round(mapa.height * escala))
    const lienzo = new OffscreenCanvas(ancho, alto)
    const contexto = lienzo.getContext('2d')
    if (!contexto) throw new Error('Sin contexto 2D')
    // El recorte deja el fondo transparente, que en JPEG saldría negro.
    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, ancho, alto)
    contexto.drawImage(mapa, 0, 0, ancho, alto)
    const jpeg = await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
    return { datos: await aBase64(jpeg), tipo: 'image/jpeg' }
  } finally {
    mapa.close()
  }
}

export async function aBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binario = ''
  // Por trozos: `String.fromCharCode(...bytes)` desborda la pila con fotos grandes.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binario)
}
