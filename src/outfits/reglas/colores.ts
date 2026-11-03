import { algunaPalabra, normalizar, palabras } from './texto.ts'
import type { PrendaReglas } from './tipos.ts'

// Regla: los neutros van con todo, como mucho un color fuerte por outfit y como mucho una prenda estampada.

const NEUTROS = [
  'negro',
  'blanco',
  'gris',
  'antracita',
  'beige',
  'crema',
  'crudo',
  'hueso',
  'marfil',
  'arena',
  'nude',
  'taupe',
  'topo',
  'marron',
  'camel',
  'tostado',
  'chocolate',
  'caqui',
  'kaki',
  'marino',
  'vaquero',
  'denim',
  'plata',
  'plateado',
  'dorado',
  'oro',
] as const

const VAQUERO = ['vaquero', 'vaqueros', 'vaquera', 'vaqueras', 'jean', 'jeans', 'denim'] as const

const LISO = new Set(['', 'liso', 'lisa', 'ninguno', 'ninguna', 'sin estampado', 'no'])

export function esNeutro(color: string): boolean {
  return algunaPalabra(palabras(color), NEUTROS)
}

/** Familia de un color fuerte: «azul claro» y «azul» son la misma; `null` si es neutro. */
export function familiaColor(color: string): string | null {
  if (esNeutro(color)) return null
  const familia = normalizar(color).split(/\s+/)[0]
  return familia === undefined || familia === '' ? null : familia
}

export function esEstampada(prenda: Pick<PrendaReglas, 'estampado'>): boolean {
  return !LISO.has(normalizar(prenda.estampado))
}

/** Familias de color fuerte de una prenda. El vaquero cuenta como neutro aunque sea azul. */
export function coloresFuertes(
  prenda: Pick<PrendaReglas, 'colores' | 'subcategoria' | 'notas'>,
): Set<string> {
  if (algunaPalabra(palabras(prenda.subcategoria, prenda.notas), VAQUERO)) return new Set()
  return new Set(prenda.colores.map(familiaColor).filter((familia) => familia !== null))
}

export interface Armonia {
  combina: boolean
  /** El color fuerte del outfit, si hay uno solo. */
  colorFuerte: string | null
}

export function armonia(prendas: readonly PrendaReglas[]): Armonia {
  const fuertes = new Set(prendas.flatMap((prenda) => [...coloresFuertes(prenda)]))
  const estampadas = prendas.filter(esEstampada).length
  return {
    combina: fuertes.size <= 1 && estampadas <= 1,
    colorFuerte: fuertes.size === 1 ? ([...fuertes][0] ?? null) : null,
  }
}
