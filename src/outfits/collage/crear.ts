import type { Prenda } from '../../datos/modelo.ts'
import { ranurasDe } from '../reglas/outfits.ts'
import type { Ranura } from '../reglas/tipos.ts'
import { dibujarCollage, type ImagenPrenda, type Pincel } from './dibujar.ts'
import { ALTO_COLLAGE, ANCHO_COLLAGE } from './disposicion.ts'

export interface OutfitCollage {
  prendas: readonly Pick<Prenda, 'categoria' | 'subcategoria' | 'fotos' | 'capas'>[]
  /** La ranura de cada prenda; si falta, se deduce del orden y la categoría (`ranurasDe`). */
  ranuras?: readonly Ranura[] | undefined
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

/** Alto al que se decodifica cada foto: de sobra para su hueco y la memoria no se dispara en el móvil. */
const ALTO_MAXIMO_FOTO = 640

async function cargarConBitmap(foto: Blob): Promise<ImagenCargada> {
  const bitmap = await createImageBitmap(foto, {
    resizeHeight: ALTO_MAXIMO_FOTO,
    resizeQuality: 'high',
  })
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
  // Una vez por foto aunque la prenda salga en varios outfits, y de una en una, por la memoria.
  const cargadas = new Map<Blob, ImagenCargada | null>()
  try {
    for (const outfit of outfits) {
      for (const prenda of outfit.prendas) {
        const foto = fotoDe(prenda)
        if (!foto || cargadas.has(foto)) continue
        try {
          cargadas.set(foto, await cargar(foto))
        } catch (fallo) {
          console.warn('No se pudo leer una foto del collage', fallo)
          cargadas.set(foto, null)
        }
      }
    }
    const recuadros = outfits.map((outfit) => {
      const ranuras = ranurasDe(outfit)
      return {
        motivo: outfit.motivo,
        prendas: outfit.prendas.map((prenda, i): ImagenPrenda => {
          const foto = fotoDe(prenda)
          const imagen = foto ? cargadas.get(foto) : null
          return {
            categoria: prenda.categoria,
            ranura: ranuras[i] ?? 'accesorio',
            nombre: prenda.subcategoria || prenda.categoria,
            imagen: imagen?.imagen ?? null,
            ancho: imagen?.ancho ?? 0,
            alto: imagen?.alto ?? 0,
          }
        }),
      }
    })
    const lienzo = crearLienzo(ANCHO_COLLAGE, ALTO_COLLAGE)
    dibujarCollage(lienzo.pincel, recuadros)
    return await lienzo.aBlob()
  } finally {
    for (const imagen of cargadas.values()) imagen?.cerrar?.()
  }
}
