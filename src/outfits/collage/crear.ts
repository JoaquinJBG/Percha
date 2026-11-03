import type { Prenda } from '../../datos/modelo.ts'
import { dibujarCollage, type ImagenPrenda, type Pincel } from './dibujar.ts'
import { ALTO_COLLAGE, ANCHO_COLLAGE } from './disposicion.ts'

export interface OutfitCollage {
  prendas: readonly Pick<Prenda, 'categoria' | 'subcategoria' | 'fotos'>[]
  motivo: string
}

interface ImagenCargada {
  imagen: CanvasImageSource
  ancho: number
  alto: number
  cerrar?: () => void
}

interface Lienzo {
  pincel: Pincel
  aBlob: () => Promise<Blob>
}

export interface OpcionesCollage {
  cargar?: (foto: Blob) => Promise<ImagenCargada>
  crearLienzo?: (ancho: number, alto: number) => Lienzo
}

export const TIPO_COLLAGE = 'image/jpeg'
const CALIDAD_JPEG = 0.9

async function cargarConBitmap(foto: Blob): Promise<ImagenCargada> {
  const bitmap = await createImageBitmap(foto)
  return {
    imagen: bitmap,
    ancho: bitmap.width,
    alto: bitmap.height,
    cerrar: () => {
      bitmap.close()
    },
  }
}

function lienzoDelDocumento(ancho: number, alto: number): Lienzo {
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const pincel = canvas.getContext('2d')
  if (!pincel) throw new Error('Este navegador no puede dibujar el collage.')
  return {
    pincel,
    aBlob: () =>
      new Promise((resolver, rechazar) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolver(blob)
            else rechazar(new Error('No se pudo crear la imagen del collage.'))
          },
          TIPO_COLLAGE,
          CALIDAD_JPEG,
        )
      }),
  }
}

/** La recortada si la hay; si no, la original. */
export function fotoDe(prenda: Pick<Prenda, 'fotos'>): Blob | null {
  const foto = prenda.fotos[0]
  return foto ? (foto.recortada ?? foto.original) : null
}

/**
 * El collage 2×2 de los outfits como JPEG de 1080×1350. Una foto que no se puede leer no rompe el
 * collage: su sitio queda como un hueco con el nombre de la prenda.
 */
export async function crearCollage(
  outfits: readonly OutfitCollage[],
  { cargar = cargarConBitmap, crearLienzo = lienzoDelDocumento }: OpcionesCollage = {},
): Promise<Blob> {
  const cargadas: ImagenCargada[] = []
  try {
    const recuadros = await Promise.all(
      outfits.map(async (outfit) => ({
        motivo: outfit.motivo,
        prendas: await Promise.all(
          outfit.prendas.map(async (prenda): Promise<ImagenPrenda> => {
            const sinImagen = {
              categoria: prenda.categoria,
              nombre: prenda.subcategoria || prenda.categoria,
              imagen: null,
              ancho: 0,
              alto: 0,
            }
            const foto = fotoDe(prenda)
            if (!foto) return sinImagen
            try {
              const imagen = await cargar(foto)
              cargadas.push(imagen)
              return { ...sinImagen, ...imagen }
            } catch (fallo) {
              console.warn('No se pudo leer una foto del collage', fallo)
              return sinImagen
            }
          }),
        ),
      })),
    )
    const lienzo = crearLienzo(ANCHO_COLLAGE, ALTO_COLLAGE)
    dibujarCollage(lienzo.pincel, recuadros)
    return await lienzo.aBlob()
  } finally {
    for (const imagen of cargadas) imagen.cerrar?.()
  }
}
