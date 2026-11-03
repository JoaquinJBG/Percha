import { proveedorConClave, type ObtenerProveedor } from '../../componentes/etiquetado-ia/index.ts'
import type { Prenda } from '../../datos/modelo.ts'
import { elegirOutfitsConIA, type OutfitIA } from '../../outfits/ia/index.ts'
import { cuatroOutfits, type Peticion, type ResultadoOutfits } from '../../outfits/reglas/index.ts'

/** Un outfit con quién lo eligió: `ia` (su `motivo` es la frase de Gemini) o `reglas`. */
export type OutfitElegido = OutfitIA<Prenda>

export interface ResultadoSelector extends ResultadoOutfits<Prenda> {
  outfits: OutfitElegido[]
  /** Por qué Gemini no eligió esta vez, listo para el usuario; `null` si eligió o si no hay clave. */
  avisoIA: string | null
}

export interface OpcionesSelector {
  signal?: AbortSignal
  /** Se llama antes de esperar a la IA, para que la pantalla diga «Gemini está eligiendo…». */
  alPreguntarIA?: () => void
}

/**
 * Elige hasta 4 outfits para la petición. `intento` empieza en 1 y sube cada vez que se pulsa
 * «Generar», para que salga otra tanda: es la semilla de las reglas y de Gemini. Nunca debería rechazar
 * por falta de prendas (eso va en `avisos`) ni por la IA (eso va en `avisoIA`); solo con `AbortError`.
 */
export type SelectorOutfits = (
  peticion: Peticion<Prenda>,
  intento: number,
  opciones?: OpcionesSelector,
) => Promise<ResultadoSelector>

export const outfitsPorReglas: SelectorOutfits = (peticion, intento) => {
  const { outfits, ...resto } = cuatroOutfits(peticion, intento)
  return Promise.resolve({
    ...resto,
    outfits: outfits.map((o) => ({ ...o, origen: 'reglas' as const })),
    avisoIA: null,
  })
}

/** Así empieza el aviso que añade `elegirOutfitsConIA` cuando no pudo usar la IA. */
const PREFIJO_SIN_IA = 'outfits sin IA:'

/**
 * Con clave de Gemini, `elegirOutfitsConIA` (con las reglas de respaldo); sin clave, las reglas sin
 * avisar de nada. El aviso de la IA sale de `avisos` a `avisoIA`: no es ropa que falte.
 */
export function crearSelectorConIA(obtener: ObtenerProveedor = proveedorConClave): SelectorOutfits {
  return async (peticion, intento, { signal, alPreguntarIA } = {}) => {
    const reglas = await outfitsPorReglas(peticion, intento)
    // Sin ningún outfit por reglas falta base o calzado: la IA tampoco puede y no se le pregunta.
    if (reglas.outfits.length === 0) return reglas
    const proveedor = await obtener()
    if (!proveedor) return reglas
    signal?.throwIfAborted()
    alPreguntarIA?.()
    const { avisos, outfits, contexto } = await elegirOutfitsConIA(peticion, intento, {
      proveedor,
      ...(signal && { signal }),
    })
    const avisoIA = avisos.find((aviso) => aviso.startsWith(PREFIJO_SIN_IA)) ?? null
    return { contexto, outfits, avisos: avisos.filter((aviso) => aviso !== avisoIA), avisoIA }
  }
}

export const outfitsConIAoReglas = crearSelectorConIA()
