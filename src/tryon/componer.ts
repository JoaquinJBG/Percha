import type { Prenda } from '../datos/modelo.ts'
import { encajar, fotoDe, type Rect } from '../outfits/collage/index.ts'
import { ordenarPrendas, promptTryOn, type EtiquetasTryOn } from './prompt.ts'

export type PrendaTryOn = EtiquetasTryOn & Pick<Prenda, 'fotos'>

/** Lo que usa la composición del contexto 2D; los tests pasan uno falso. */
export type PincelTryOn = Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect' | 'drawImage'>

export interface ImagenCargada {
  imagen: CanvasImageSource
  ancho: number
  alto: number
  cerrar?: () => void
}

interface Lienzo {
  pincel: PincelTryOn
  aBlob: () => Promise<Blob>
}

export interface OpcionesTryOn {
  cargar?: (foto: Blob, altoMaximo?: number) => Promise<ImagenCargada>
  crearLienzo?: (ancho: number, alto: number) => Lienzo
}

/** La imagen y el texto que se mandan a Gemini. */
export interface TryOn {
  fichero: File
  texto: string
}

export class ErrorTryOn extends Error {
  readonly motivo: 'foto-persona' | 'sin-prendas'

  constructor(motivo: 'foto-persona' | 'sin-prendas') {
    super(
      motivo === 'foto-persona'
        ? 'No se pudo leer la foto de cuerpo entero.'
        : 'No se pudo leer ninguna foto de las prendas.',
    )
    this.name = 'ErrorTryOn'
    this.motivo = motivo
  }
}

/** 4:5 vertical, como la variante C/D de S3: la persona ocupa 3/5 a la izquierda. */
export const ANCHO_TRYON = 1200
export const ALTO_TRYON = 1500
const ANCHO_PERSONA = 720
const MARGEN = 24
const COLORES = { fondo: '#ffffff', separador: '#d0d0d0' }
/** Alto al que se decodifica cada prenda: de sobra para su hueco de la columna. */
const ALTO_MAXIMO_PRENDA = 720
export const NOMBRE_FICHERO_TRYON = 'percha-pruebatelo.jpg'
const TIPO = 'image/jpeg'
const CALIDAD_JPEG = 0.9

async function cargarConBitmap(foto: Blob, altoMaximo?: number): Promise<ImagenCargada> {
  const bitmap = await createImageBitmap(
    foto,
    altoMaximo ? { resizeHeight: altoMaximo, resizeQuality: 'high' } : {},
  )
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
  if (!pincel) throw new Error('Este navegador no puede dibujar la imagen.')
  return {
    pincel,
    aBlob: () =>
      new Promise((resolver, rechazar) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolver(blob)
            else rechazar(new Error('No se pudo crear la imagen.'))
          },
          TIPO,
          CALIDAD_JPEG,
        )
      }),
  }
}

/** Huecos de la columna de la derecha, de arriba abajo, uno por prenda. */
export function huecosPrendas(cuantas: number): Rect[] {
  const alto = (ALTO_TRYON - MARGEN) / Math.max(cuantas, 1)
  return Array.from({ length: cuantas }, (_, i) => ({
    x: ANCHO_PERSONA + MARGEN,
    y: MARGEN + i * alto,
    ancho: ANCHO_TRYON - ANCHO_PERSONA - 2 * MARGEN,
    alto: alto - MARGEN,
  }))
}

export const HUECO_PERSONA: Rect = {
  x: MARGEN,
  y: MARGEN,
  ancho: ANCHO_PERSONA - 2 * MARGEN,
  alto: ALTO_TRYON - 2 * MARGEN,
}

function dibujar(pincel: PincelTryOn, imagen: ImagenCargada, hueco: Rect) {
  const destino = encajar(imagen.ancho, imagen.alto, hueco)
  pincel.drawImage(imagen.imagen, destino.x, destino.y, destino.ancho, destino.alto)
}

/** Fondo blanco, la persona a la izquierda, una raya y las prendas en columna a la derecha. */
export function dibujarTryOn(
  pincel: PincelTryOn,
  persona: ImagenCargada,
  prendas: readonly ImagenCargada[],
): void {
  pincel.fillStyle = COLORES.fondo
  pincel.fillRect(0, 0, ANCHO_TRYON, ALTO_TRYON)
  dibujar(pincel, persona, HUECO_PERSONA)
  pincel.fillStyle = COLORES.separador
  pincel.fillRect(ANCHO_PERSONA, MARGEN, 3, ALTO_TRYON - 2 * MARGEN)
  const huecos = huecosPrendas(prendas.length)
  prendas.forEach((prenda, i) => {
    const hueco = huecos[i]
    if (hueco) dibujar(pincel, prenda, hueco)
  })
}

/**
 * La imagen compuesta (JPEG 1200×1500) y el prompt del *try-on*. Una prenda cuya foto no se puede leer
 * se queda fuera de la imagen y del texto, para que los dos digan lo mismo.
 */
export async function prepararTryOn(
  fotoCuerpo: Blob,
  prendas: readonly PrendaTryOn[],
  { cargar = cargarConBitmap, crearLienzo = lienzoDelDocumento }: OpcionesTryOn = {},
): Promise<TryOn> {
  const cargadas: ImagenCargada[] = []
  try {
    let persona: ImagenCargada
    try {
      persona = await cargar(fotoCuerpo)
    } catch (fallo) {
      console.warn('No se pudo leer la foto de cuerpo entero', fallo)
      throw new ErrorTryOn('foto-persona')
    }
    cargadas.push(persona)

    const incluidas: { prenda: PrendaTryOn; imagen: ImagenCargada }[] = []
    // De una en una, por la memoria del móvil.
    for (const prenda of ordenarPrendas(prendas)) {
      const foto = fotoDe(prenda)
      if (!foto) continue
      try {
        const imagen = await cargar(foto, ALTO_MAXIMO_PRENDA)
        cargadas.push(imagen)
        incluidas.push({ prenda, imagen })
      } catch (fallo) {
        console.warn('No se pudo leer la foto de una prenda', fallo)
      }
    }
    if (incluidas.length === 0) throw new ErrorTryOn('sin-prendas')

    const lienzo = crearLienzo(ANCHO_TRYON, ALTO_TRYON)
    dibujarTryOn(
      lienzo.pincel,
      persona,
      incluidas.map((i) => i.imagen),
    )
    const blob = await lienzo.aBlob()
    return {
      fichero: new File([blob], NOMBRE_FICHERO_TRYON, { type: TIPO }),
      texto: promptTryOn(incluidas.map((i) => i.prenda)),
    }
  } finally {
    for (const imagen of cargadas) imagen.cerrar?.()
  }
}
