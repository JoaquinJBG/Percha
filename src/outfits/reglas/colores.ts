import { algunaPalabra, normalizar, palabras } from './texto.ts'
import type { PrendaReglas } from './tipos.ts'

// Neutros con todo; un color fuerte (o varios de una prenda, si el resto repite uno) y una estampada.

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

const LISO = [
  'liso',
  'lisa',
  'lisos',
  'lisas',
  'unicolor',
  'solido',
  'solida',
  'ninguno',
  'ninguna',
  'sin',
  'no',
] as const

// Tonos que se leen como el mismo color al combinar.
const SINONIMOS: Record<string, string> = {
  celeste: 'azul',
  cobalto: 'azul',
  añil: 'azul',
  anil: 'azul',
  turquesa: 'azul',
  granate: 'rojo',
  burdeos: 'rojo',
  fucsia: 'rosa',
  coral: 'rosa',
  mostaza: 'amarillo',
  lila: 'morado',
  lavanda: 'morado',
  violeta: 'morado',
}

export function esNeutro(color: string): boolean {
  return algunaPalabra(palabras(color), NEUTROS)
}

/** Familia de un color fuerte: «azul claro», «celeste» y «azul» son la misma; `null` si es neutro. */
export function familiaColor(color: string): string | null {
  if (esNeutro(color)) return null
  const familia = normalizar(color).split(/\s+/)[0]
  if (familia === undefined || familia === '') return null
  return SINONIMOS[familia] ?? familia
}

export function esEstampada(prenda: Pick<PrendaReglas, 'estampado'>): boolean {
  const texto = palabras(prenda.estampado)
  return texto.size > 0 && !algunaPalabra(texto, LISO)
}

// Por identidad: las prendas no se modifican mientras se generan los outfits.
const CACHE_FUERTES = new WeakMap<object, Set<string>>()

/** Familias de color fuerte de una prenda. El vaquero cuenta como neutro aunque sea azul. */
export function coloresFuertes(
  prenda: Pick<PrendaReglas, 'colores' | 'subcategoria' | 'notas'>,
): Set<string> {
  const guardados = CACHE_FUERTES.get(prenda)
  if (guardados) return guardados
  const fuertes = algunaPalabra(palabras(prenda.subcategoria, prenda.notas), VAQUERO)
    ? new Set<string>()
    : new Set(prenda.colores.map(familiaColor).filter((familia) => familia !== null))
  CACHE_FUERTES.set(prenda, fuertes)
  return fuertes
}

export interface Armonia {
  combina: boolean
  /** El color fuerte del outfit, si hay uno solo. */
  colorFuerte: string | null
}

export function armonia(prendas: readonly PrendaReglas[]): Armonia {
  const porPrenda = prendas.map(coloresFuertes).filter((fuertes) => fuertes.size > 0)
  const todos = new Set(porPrenda.flatMap((fuertes) => [...fuertes]))
  // La prenda con más colores (una estampada) puede llevar varios; el resto, como mucho uno de ellos.
  const protagonista = porPrenda.reduce<Set<string>>(
    (mayor, fuertes) => (fuertes.size > mayor.size ? fuertes : mayor),
    new Set(),
  )
  const resto = new Set(
    porPrenda.filter((fuertes) => fuertes !== protagonista).flatMap((fuertes) => [...fuertes]),
  )
  const coloresBien =
    todos.size <= 1 || (resto.size <= 1 && [...resto].every((color) => protagonista.has(color)))
  return {
    combina: coloresBien && prendas.filter(esEstampada).length <= 1,
    colorFuerte: todos.size === 1 ? ([...todos][0] ?? null) : null,
  }
}

const CLAROS = [
  'blanco',
  'crema',
  'crudo',
  'hueso',
  'marfil',
  'beige',
  'arena',
  'nude',
  'celeste',
  'claro',
  'clara',
  'pastel',
  'palo',
] as const
const OSCUROS = [
  'negro',
  'marino',
  'antracita',
  'chocolate',
  'burdeos',
  'granate',
  'botella',
  'oscuro',
  'oscura',
  'carbon',
] as const

/** -1 oscuro, 0 medio, 1 claro, por el primer color de la prenda. */
export function claridad(prenda: Pick<PrendaReglas, 'colores'>): number {
  const texto = palabras(prenda.colores[0] ?? '')
  if (algunaPalabra(texto, OSCUROS)) return -1
  if (algunaPalabra(texto, CLAROS)) return 1
  return 0
}

/** Familia (o neutro) y claridad del color principal: dos capas con el mismo tono se funden. */
export function tono(prenda: Pick<PrendaReglas, 'colores'>): string {
  const color = prenda.colores[0] ?? ''
  const neutro = NEUTROS.find((n) => palabras(color).has(n))
  return `${neutro ?? familiaColor(color) ?? ''}:${String(claridad(prenda))}`
}
