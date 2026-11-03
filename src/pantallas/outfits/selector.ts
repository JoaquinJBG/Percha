import type { Prenda } from '../../datos/modelo.ts'
import { cuatroOutfits, type Peticion, type ResultadoOutfits } from '../../outfits/reglas/index.ts'

/**
 * Elige hasta 4 outfits para la petición. `intento` empieza en 1 y sube cada vez que se pulsa
 * «Generar», para que salga otra tanda. Las reglas lo usan como semilla; la IA (T2.5) puede ignorarlo.
 * Nunca debería rechazar por falta de prendas: eso va en `avisos`.
 */
export type SelectorOutfits = (
  peticion: Peticion<Prenda>,
  intento: number,
) => Promise<ResultadoOutfits<Prenda>>

export const outfitsPorReglas: SelectorOutfits = (peticion, intento) =>
  Promise.resolve(cuatroOutfits(peticion, intento))
