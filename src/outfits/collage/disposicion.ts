import type { Categoria } from '../../datos/modelo.ts'

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

const COLUMNA_CENTRAL = 0.62
const ORDEN_CENTRAL: readonly Categoria[] = ['superior', 'vestido', 'inferior', 'calzado']
const PESO: Record<Categoria, number> = {
  superior: 4,
  inferior: 4,
  vestido: 8,
  calzado: 2.5,
  abrigo: 3,
  accesorio: 1.5,
}

function apilar(indices: number[], categorias: readonly Categoria[], caja: Rect, rects: Rect[]) {
  const total = indices.reduce((suma, i) => suma + PESO[categorias[i] ?? 'accesorio'], 0)
  let y = caja.y
  for (const i of indices) {
    const alto = (caja.alto * PESO[categorias[i] ?? 'accesorio']) / total
    rects[i] = { x: caja.x, y, ancho: caja.ancho, alto }
    y += alto
  }
}

/**
 * Dónde va cada prenda dentro de la caja, en el mismo orden que `categorias`: en el centro, de arriba
 * abajo, la parte de arriba (o el vestido), la de abajo y el calzado; el abrigo y los accesorios, en
 * una columna a la derecha. Sin abrigo ni accesorios, el centro ocupa todo el ancho.
 */
export function disponer(categorias: readonly Categoria[], caja: Rect): Rect[] {
  const lado = categorias.flatMap((c, i) => (c === 'abrigo' || c === 'accesorio' ? [i] : []))
  const centro = categorias
    .flatMap((_, i) => (lado.includes(i) ? [] : [i]))
    .sort((a, b) => {
      const orden = (i: number) => ORDEN_CENTRAL.indexOf(categorias[i] ?? 'superior')
      return orden(a) - orden(b) || a - b
    })
  // Abrigo antes que accesorios, y si no hay nada en el centro, la columna lateral ocupa todo.
  lado.sort((a, b) => Number(categorias[a] === 'accesorio') - Number(categorias[b] === 'accesorio'))

  const rects: Rect[] = categorias.map(() => ({ ...caja }))
  const anchoCentro =
    lado.length === 0 ? caja.ancho : centro.length === 0 ? 0 : caja.ancho * COLUMNA_CENTRAL
  apilar(centro, categorias, { ...caja, ancho: anchoCentro }, rects)
  apilar(
    lado,
    categorias,
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
