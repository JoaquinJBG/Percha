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

/** El texto acabado en «…», acortado hasta que quepa en `ancho`. */
function conPuntos(pincel: Pick<Pincel, 'measureText'>, texto: string, ancho: number): string {
  let corto = texto
  while (corto.length > 0 && pincel.measureText(`${corto}…`).width > ancho) {
    corto = corto.slice(0, -1).trimEnd()
  }
  return `${corto}…`
}

function recortar(pincel: Pick<Pincel, 'measureText'>, texto: string, ancho: number): string {
  return pincel.measureText(texto).width <= ancho ? texto : conPuntos(pincel, texto, ancho)
}

/**
 * Corta el texto en líneas que caben en `ancho`; si no cabe todo, la última acaba en «…». Una palabra
 * más ancha que la línea también se corta con «…».
 */
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

  const visibles = lineas.slice(0, maxLineas)
  const sobra = lineas.length > maxLineas
  return visibles.map((linea, i) =>
    sobra && i === visibles.length - 1
      ? conPuntos(pincel, linea, ancho)
      : recortar(pincel, linea, ancho),
  )
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
  pincel.font = `500 26px ${FUENTE}`
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

  // Número junto al motivo, para casar la imagen con la lista de la pantalla. Abajo y no en la
  // esquina, para no tapar la parte de arriba.
  const arriba = celda.y + celda.alto - RELLENO - ALTO_TEXTO + 12
  const centro = { x: celda.x + RELLENO + 24, y: arriba + 37 }
  pincel.fillStyle = COLORES_COLLAGE.tinta
  pincel.beginPath()
  pincel.arc(centro.x, centro.y, 24, 0, Math.PI * 2)
  pincel.fill()
  pincel.fillStyle = COLORES_COLLAGE.recuadro
  pincel.font = `600 28px ${FUENTE}`
  pincel.textAlign = 'center'
  pincel.textBaseline = 'middle'
  pincel.fillText(String(numero), centro.x, centro.y + 1)

  pincel.fillStyle = COLORES_COLLAGE.tinta
  pincel.font = `500 32px ${FUENTE}`
  pincel.textAlign = 'left'
  pincel.textBaseline = 'top'
  const sangria = RELLENO + 60
  const lineas = partirTexto(
    pincel,
    conMayuscula(recuadro.motivo),
    celda.ancho - sangria - RELLENO,
    LINEAS_MOTIVO,
  )
  // Con una sola línea, centrada junto al número.
  const primera = lineas.length === 1 ? arriba + 16 : arriba
  lineas.forEach((linea, i) => {
    pincel.fillText(linea, celda.x + sangria, primera + i * 42)
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
