import type { Categoria } from '../../datos/modelo.ts'
import type { Ranura } from '../reglas/tipos.ts'

export interface Rect {
  x: number
  y: number
  ancho: number
  alto: number
}

/** Lado de la imagen: 1080×1350 (4:5, vertical), lo que mejor se ve al compartirla en el móvil. */
export const ANCHO_COLLAGE = 1080
export const ALTO_COLLAGE = 1350
export const MARGEN = 24
/** Banda de cada recuadro donde va el motivo (dos líneas). */
export const ALTO_TEXTO = 104

/** Los cuatro recuadros del 2×2, de izquierda a derecha y de arriba abajo. */
export function recuadros(ancho = ANCHO_COLLAGE, alto = ALTO_COLLAGE, margen = MARGEN): Rect[] {
  const anchoCelda = (ancho - margen * 3) / 2
  const altoCelda = (alto - margen * 3) / 2
  return [0, 1, 2, 3].map((i) => ({
    x: margen + (i % 2) * (anchoCelda + margen),
    y: margen + Math.floor(i / 2) * (altoCelda + margen),
    ancho: anchoCelda,
    alto: altoCelda,
  }))
}

/** Dónde va una prenda: su ranura en el outfit o, si no se sabe, su categoría. */
export type Lugar = Ranura | Categoria

const COLUMNA_CENTRAL = 0.62
/** Con cuatro o más cosas en la columna de la derecha, se le da algo más de ancho. */
const COLUMNA_CENTRAL_LLENA = 0.55
const DE_CATEGORIA: Record<Lugar, Ranura> = {
  superior: 'base',
  abrigo: 'exterior',
  base: 'base',
  media: 'media',
  exterior: 'exterior',
  vestido: 'vestido',
  inferior: 'inferior',
  calzado: 'calzado',
  accesorio: 'accesorio',
}
const EN_EL_CENTRO: readonly Ranura[] = ['base', 'vestido', 'inferior', 'calzado']
const EN_EL_LADO: readonly Ranura[] = ['exterior', 'media', 'accesorio']
const PESO: Record<Ranura, number> = {
  base: 4,
  inferior: 4,
  vestido: 8,
  calzado: 2.5,
  exterior: 3.5,
  media: 3,
  accesorio: 1.5,
}

function apilar(indices: number[], ranuras: readonly Ranura[], caja: Rect, rects: Rect[]) {
  const total = indices.reduce((suma, i) => suma + PESO[ranuras[i] ?? 'accesorio'], 0)
  let y = caja.y
  for (const i of indices) {
    const alto = (caja.alto * PESO[ranuras[i] ?? 'accesorio']) / total
    rects[i] = { x: caja.x, y, ancho: caja.ancho, alto }
    y += alto
  }
}

/**
 * Dónde va cada prenda dentro de la caja, en el mismo orden que `lugares`. En el centro, de arriba
 * abajo, la base (o el vestido), la de abajo y el calzado; a la derecha, de fuera adentro, la exterior
 * y las medias, y debajo los accesorios. Sin nada a la derecha, el centro ocupa todo el ancho.
 */
export function disponer(lugares: readonly Lugar[], caja: Rect): Rect[] {
  const ranuras = lugares.map((l) => DE_CATEGORIA[l])
  const indices = ranuras.map((_, i) => i)
  const orden = (lista: readonly Ranura[]) => (a: number, b: number) =>
    lista.indexOf(ranuras[a] ?? 'base') - lista.indexOf(ranuras[b] ?? 'base') ||
    // Las medias, de fuera adentro: la última en llegar (la más de fuera), arriba.
    (ranuras[a] === 'media' ? b - a : a - b)
  const centro = indices.filter((i) => EN_EL_CENTRO.includes(ranuras[i] ?? 'base'))
  const lado = indices.filter((i) => EN_EL_LADO.includes(ranuras[i] ?? 'base'))
  centro.sort(orden(EN_EL_CENTRO))
  lado.sort(orden(EN_EL_LADO))

  const rects: Rect[] = lugares.map(() => ({ ...caja }))
  const proporcion = lado.length >= 4 ? COLUMNA_CENTRAL_LLENA : COLUMNA_CENTRAL
  const anchoCentro =
    lado.length === 0 ? caja.ancho : centro.length === 0 ? 0 : caja.ancho * proporcion
  apilar(centro, ranuras, { ...caja, ancho: anchoCentro }, rects)
  apilar(
    lado,
    ranuras,
    { ...caja, x: caja.x + anchoCentro, ancho: caja.ancho - anchoCentro },
    rects,
  )
  return rects
}

/** La imagen cabe entera en la caja, centrada y sin deformarse. */
export function encajar(ancho: number, alto: number, caja: Rect): Rect {
  if (ancho <= 0 || alto <= 0) return { ...caja, ancho: 0, alto: 0 }
  const escala = Math.min(caja.ancho / ancho, caja.alto / alto)
  const a = ancho * escala
  const h = alto * escala
  return { x: caja.x + (caja.ancho - a) / 2, y: caja.y + (caja.alto - h) / 2, ancho: a, alto: h }
}
