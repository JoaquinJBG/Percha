import type { Capa } from '../../datos/modelo.ts'
import type { ExteriorHoy } from '../../ia/tipos.ts'
import type { Contexto } from '../reglas/index.ts'

// Los mismos umbrales que propone el §1.5 de la investigación y que usa T6.2 en las reglas: al juntar las
// ramas, que salgan de un solo sitio.
/** Por debajo de esta sensación media (°C), capa exterior obligatoria. */
export const LIMITE_EXTERIOR = 14
/** Hasta esta sensación media (°C), una capa media o exterior ligera es una tercera pieza opcional. */
export const LIMITE_TERCERA_PIEZA = 23
/** Por encima de esto la lluvia se lleva sin capa exterior (como en las reglas). */
const LIMITE_CALOR = 24
/** Una tercera pieza sin frío tiene que ser ligera: como mucho este nivel de abrigo. */
export const ABRIGO_MAXIMO_OPCIONAL = 3

/** Cuántas capas visibles arriba como mucho; con mucho frío cabe una cuarta. */
export const MAX_CAPAS = 3
const LIMITE_CUARTA_CAPA = 3

export function exteriorDeHoy({ temperatura, precipitacion, ocasion }: Contexto): ExteriorHoy {
  if (precipitacion && (temperatura === null || temperatura < LIMITE_CALOR)) return 'obligatoria'
  // Sin temperatura: en casa no cuenta el tiempo de fuera; si no, no se sabe y se deja elegir.
  if (temperatura === null) return ocasion === 'casa' ? 'no' : 'opcional'
  if (temperatura < LIMITE_EXTERIOR) return 'obligatoria'
  if (temperatura <= LIMITE_TERCERA_PIEZA) return 'opcional'
  return 'no'
}

export function maxCapas(temperatura: number | null): number {
  return temperatura !== null && temperatura <= LIMITE_CUARTA_CAPA ? MAX_CAPAS + 1 : MAX_CAPAS
}

/** Una prenda de arriba que no puede ir de base: solo hace de capa media o exterior. */
export function soloEncima(capas: readonly Capa[]): boolean {
  return capas.length > 0 && !capas.includes('base')
}
