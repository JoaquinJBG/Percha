import type { Categoria } from '../../datos/modelo.ts'
import {
  ALTO_COLLAGE,
  ALTO_TEXTO,
  ANCHO_COLLAGE,
  disponer,
  encajar,
  recuadros,
  type Rect,
} from './disposicion.ts'

/** Lo que usa el collage del contexto 2D; los tests pasan uno falso que lo apunta todo. */
export type Pincel = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'fillRect'
  | 'beginPath'
  | 'roundRect'
  | 'arc'
  | 'fill'
  | 'stroke'
  | 'drawImage'
  | 'fillText'
  | 'measureText'
>

export interface ImagenPrenda {
  categoria: Categoria
  /** `null` si la foto no se pudo leer: se pinta un hueco con el nombre. */
  imagen: CanvasImageSource | null
  ancho: number
  alto: number
  nombre: string
}

export interface RecuadroCollage {
  prendas: ImagenPrenda[]
  motivo: string
}

export const COLORES_COLLAGE = {
  fondo: '#faf7f2',
  recuadro: '#ffffff',
  borde: '#e7e1d8',
  hueco: '#f1ece4',
  tinta: '#3f3a36',
  suave: '#6f6760',
}

const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const RELLENO = 16
const SEPARACION = 8
const RADIO = 24
const LINEAS_MOTIVO = 2

/** Corta el texto en líneas que caben en `ancho`; la última acaba en «…» si no cabe todo. */
export function partirTexto(
  pincel: Pick<Pincel, 'measureText'>,
  texto: string,
  ancho: number,
  maxLineas: number,
): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean)
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    const probada = actual ? `${actual} ${palabra}` : palabra
    if (!actual || pincel.measureText(probada).width <= ancho) {
      actual = probada
      continue
    }
    lineas.push(actual)
    actual = palabra
  }
  if (actual) lineas.push(actual)
  if (lineas.length <= maxLineas) return lineas

  const visibles = lineas.slice(0, maxLineas)
  let ultima = `${visibles[maxLineas - 1] ?? ''}…`
  while (ultima.length > 1 && pincel.measureText(ultima).width > ancho) {
    ultima = `${ultima.slice(0, -2).trimEnd()}…`
  }
  visibles[maxLineas - 1] = ultima
  return visibles
}

function conMayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1)
}

function dibujarPrenda(pincel: Pincel, prenda: ImagenPrenda, caja: Rect) {
  const dentro = {
    x: caja.x + SEPARACION / 2,
    y: caja.y + SEPARACION / 2,
    ancho: caja.ancho - SEPARACION,
    alto: caja.alto - SEPARACION,
  }
  if (prenda.imagen) {
    const destino = encajar(prenda.ancho, prenda.alto, dentro)
    pincel.drawImage(prenda.imagen, destino.x, destino.y, destino.ancho, destino.alto)
    return
  }
  pincel.fillStyle = COLORES_COLLAGE.hueco
  pincel.beginPath()
  pincel.roundRect(dentro.x, dentro.y, dentro.ancho, dentro.alto, 12)
  pincel.fill()
  pincel.fillStyle = COLORES_COLLAGE.suave
  pincel.font = `500 22px ${FUENTE}`
  pincel.textAlign = 'center'
  pincel.textBaseline = 'middle'
  const [linea = ''] = partirTexto(pincel, prenda.nombre, dentro.ancho - 16, 1)
  pincel.fillText(linea, dentro.x + dentro.ancho / 2, dentro.y + dentro.alto / 2)
}

function dibujarRecuadro(pincel: Pincel, recuadro: RecuadroCollage, celda: Rect, numero: number) {
  pincel.fillStyle = COLORES_COLLAGE.recuadro
  pincel.strokeStyle = COLORES_COLLAGE.borde
  pincel.lineWidth = 2
  pincel.beginPath()
  pincel.roundRect(celda.x, celda.y, celda.ancho, celda.alto, RADIO)
  pincel.fill()
  pincel.stroke()

  const zonaPrendas = {
    x: celda.x + RELLENO,
    y: celda.y + RELLENO,
    ancho: celda.ancho - RELLENO * 2,
    alto: celda.alto - RELLENO * 2 - ALTO_TEXTO,
  }
  const cajas = disponer(
    recuadro.prendas.map((p) => p.categoria),
    zonaPrendas,
  )
  recuadro.prendas.forEach((prenda, i) => {
    const caja = cajas[i]
    if (caja) dibujarPrenda(pincel, prenda, caja)
  })

  // Número en la esquina, para casar la imagen con la lista de motivos de la pantalla.
  pincel.fillStyle = COLORES_COLLAGE.tinta
  pincel.beginPath()
  pincel.arc(celda.x + 36, celda.y + 36, 20, 0, Math.PI * 2)
  pincel.fill()
  pincel.fillStyle = COLORES_COLLAGE.recuadro
  pincel.font = `600 22px ${FUENTE}`
  pincel.textAlign = 'center'
  pincel.textBaseline = 'middle'
  pincel.fillText(String(numero), celda.x + 36, celda.y + 37)

  pincel.fillStyle = COLORES_COLLAGE.tinta
  pincel.font = `500 26px ${FUENTE}`
  pincel.textAlign = 'left'
  pincel.textBaseline = 'top'
  const anchoTexto = celda.ancho - RELLENO * 2
  const lineas = partirTexto(pincel, conMayuscula(recuadro.motivo), anchoTexto, LINEAS_MOTIVO)
  const arriba = celda.y + celda.alto - RELLENO - ALTO_TEXTO + 16
  lineas.forEach((linea, i) => {
    pincel.fillText(linea, celda.x + RELLENO, arriba + i * 34)
  })
}

/**
 * Pinta el collage 2×2 en un lienzo de `ANCHO_COLLAGE`×`ALTO_COLLAGE`: un outfit por recuadro (hasta 4;
 * los que faltan quedan vacíos) sobre fondo claro, con su número y su motivo.
 */
export function dibujarCollage(pincel: Pincel, outfits: readonly RecuadroCollage[]): void {
  pincel.fillStyle = COLORES_COLLAGE.fondo
  pincel.fillRect(0, 0, ANCHO_COLLAGE, ALTO_COLLAGE)
  recuadros().forEach((celda, i) => {
    const recuadro = outfits[i]
    if (recuadro) {
      dibujarRecuadro(pincel, recuadro, celda, i + 1)
      return
    }
    pincel.fillStyle = COLORES_COLLAGE.hueco
    pincel.beginPath()
    pincel.roundRect(celda.x, celda.y, celda.ancho, celda.alto, RADIO)
    pincel.fill()
  })
}
