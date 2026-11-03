import { proveedorDesdeAjustes } from '../../ia/index.ts'
import type { Peticion, PrendaReglas } from '../reglas/index.ts'
import { elegirOutfitsConIA, type ResultadoOutfitsIA } from './elegir.ts'

export {
  elegirOutfitsConIA,
  MAX_POR_CATEGORIA,
  type OpcionesOutfitsIA,
  type OutfitIA,
  type ResultadoOutfitsIA,
} from './elegir.ts'

/**
 * `elegirOutfitsConIA` con la clave y el modelo de Ajustes: la misma firma que `cuatroOutfits`, pero
 * asíncrona, para que la pantalla cambie una por otra.
 */
export function outfitsConIA<P extends PrendaReglas>(
  peticion: Peticion<P>,
  semilla = 1,
  signal?: AbortSignal,
): Promise<ResultadoOutfitsIA<P>> {
  return elegirOutfitsConIA(peticion, semilla, {
    proveedor: proveedorDesdeAjustes,
    ...(signal && { signal }),
  })
}
