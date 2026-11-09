import { proveedorDesdeAjustes } from '../../ia/index.ts'
import type { Peticion } from '../reglas/index.ts'
import type { PrendaIA } from './composicion.ts'
import { elegirOutfitsConIA, type ResultadoOutfitsIA } from './elegir.ts'

export {
  ABRIGO_MAXIMO_OPCIONAL,
  exteriorDeHoy,
  LIMITE_EXTERIOR,
  LIMITE_TERCERA_PIEZA,
  MAX_CAPAS,
} from './capas.ts'
export { comprobarConCapas, type Hoy, type PrendaIA } from './composicion.ts'
export {
  elegirOutfitsConIA,
  MAX_POR_CATEGORIA,
  MAX_POR_CATEGORIA_ARRIBA,
  type OpcionesOutfitsIA,
  type OutfitIA,
  type ResultadoOutfitsIA,
} from './elegir.ts'

/**
 * `elegirOutfitsConIA` con la clave y el modelo de Ajustes: la misma firma que `cuatroOutfits`, pero
 * asíncrona, para que la pantalla cambie una por otra.
 */
export function outfitsConIA<P extends PrendaIA>(
  peticion: Peticion<P>,
  semilla = 1,
  signal?: AbortSignal,
): Promise<ResultadoOutfitsIA<P>> {
  return elegirOutfitsConIA(peticion, semilla, {
    proveedor: proveedorDesdeAjustes,
    ...(signal && { signal }),
  })
}
