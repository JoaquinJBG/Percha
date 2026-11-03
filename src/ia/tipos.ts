import type { EtiquetasPrenda } from '../datos/modelo.ts'

/** Lotes de hasta 5 prendas: con más, la respuesta tarda y puede degradarse (S2). */
export const MAX_PRENDAS_POR_PETICION = 5

/** Una prenda con sus 1–2 fotos (mejor las recortadas). */
export interface PrendaAEtiquetar {
  fotos: Blob[]
}

/** Una entrada por prenda, en el mismo orden; `null` si la IA no devolvió nada válido para ella. */
export type ResultadoEtiquetado = (EtiquetasPrenda | null)[]

export interface OpcionesPeticion {
  signal?: AbortSignal
}

export interface ProveedorIA {
  /** Lanza `ErrorIA` si no se puede etiquetar ninguna; `RangeError` si el lote no vale. */
  etiquetarPrendas(
    prendas: PrendaAEtiquetar[],
    opciones?: OpcionesPeticion,
  ): Promise<ResultadoEtiquetado>
  /** Se resuelve si la clave y el modelo valen; si no, lanza `ErrorIA`. */
  comprobarClave(opciones?: OpcionesPeticion): Promise<void>
}
