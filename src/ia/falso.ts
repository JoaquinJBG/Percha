import type { EtiquetasPrenda } from '../datos/modelo.ts'
import { ErrorIA } from './errores.ts'
import {
  MAX_PRENDAS_POR_PETICION,
  type PeticionOutfits,
  type PrendaAEtiquetar,
  type PropuestaOutfit,
  type ProveedorIA,
  type ResultadoEtiquetado,
} from './tipos.ts'

export const ETIQUETAS_DE_PRUEBA: EtiquetasPrenda = {
  categoria: 'superior',
  subcategoria: 'camiseta',
  colores: ['blanco'],
  estampado: 'liso',
  estilos: ['casual', 'minimalista'],
  abrigo: 2,
  formalidad: 2,
  ocasiones: ['diario'],
  temporadas: ['primavera', 'verano'],
  notas: '',
}

export interface OpcionesProveedorFalso {
  /** Qué devuelve para cada prenda; por defecto, `ETIQUETAS_DE_PRUEBA`. */
  etiquetas?: (prenda: PrendaAEtiquetar, indice: number) => EtiquetasPrenda | null
  /** Qué outfits propone; por defecto, `outfitsDePrueba`. */
  outfits?: (peticion: PeticionOutfits) => PropuestaOutfit[]
  /** Si se da, todas las llamadas lo lanzan. */
  error?: ErrorIA
}

export interface ProveedorFalso extends ProveedorIA {
  /** Los lotes recibidos por `etiquetarPrendas`, en orden. */
  readonly lotes: PrendaAEtiquetar[][]
  /** Las peticiones recibidas por `elegirOutfits`, en orden. */
  readonly peticionesOutfits: PeticionOutfits[]
  readonly comprobaciones: number
}

/**
 * Hasta 4 outfits válidos y sencillos: la i-ésima prenda de arriba con la i-ésima de abajo (o el
 * i-ésimo vestido), un calzado y un abrigo si hace falta.
 */
export function outfitsDePrueba({ prendas, tiempo }: PeticionOutfits): PropuestaOutfit[] {
  const ids = (categoria: string) =>
    prendas.filter((p) => p.categoria === categoria).map((p) => p.id)
  const [superiores, inferiores, vestidos, calzados, abrigos] = [
    ids('superior'),
    ids('inferior'),
    ids('vestido'),
    ids('calzado'),
    ids('abrigo'),
  ]
  const bases: string[][] = [
    ...superiores.flatMap((arriba, i) => {
      const abajo = inferiores[i % Math.max(inferiores.length, 1)]
      return abajo ? [[arriba, abajo]] : []
    }),
    ...vestidos.map((vestido) => [vestido]),
  ]
  if (calzados.length === 0) return []
  return bases.slice(0, 4).map((base, i) => {
    const abrigo = tiempo.necesitaAbrigo ? abrigos[i % Math.max(abrigos.length, 1)] : undefined
    const calzado = calzados[i % calzados.length] ?? ''
    return {
      prendas: [...base, ...(abrigo ? [abrigo] : []), calzado],
      porque: `Outfit de prueba ${String(i + 1)}.`,
    }
  })
}

/** Proveedor sin red para los tests y para probar pantallas sin clave. */
export function crearProveedorFalso({
  etiquetas = () => ETIQUETAS_DE_PRUEBA,
  outfits = outfitsDePrueba,
  error,
}: OpcionesProveedorFalso = {}): ProveedorFalso {
  const lotes: PrendaAEtiquetar[][] = []
  const peticionesOutfits: PeticionOutfits[] = []
  let comprobaciones = 0
  return {
    lotes,
    peticionesOutfits,
    get comprobaciones() {
      return comprobaciones
    },
    etiquetarPrendas(prendas) {
      // Mismo contrato que Gemini: hasta 5 prendas con 1–2 fotos cada una.
      if (
        prendas.length > MAX_PRENDAS_POR_PETICION ||
        prendas.some(({ fotos }) => fotos.length < 1 || fotos.length > 2)
      ) {
        return Promise.reject(new RangeError('Lote no válido'))
      }
      lotes.push(prendas)
      if (error) return Promise.reject(error)
      const resultado: ResultadoEtiquetado = prendas.map(etiquetas)
      if (resultado.length > 0 && resultado.every((e) => e === null)) {
        return Promise.reject(new ErrorIA('respuesta'))
      }
      return Promise.resolve(resultado)
    },
    elegirOutfits(peticion) {
      peticionesOutfits.push(peticion)
      if (error) return Promise.reject(error)
      const propuestas = outfits(peticion)
      // Igual que Gemini: sin ningún outfit con forma válida, la respuesta no vale.
      return propuestas.length === 0
        ? Promise.reject(new ErrorIA('respuesta'))
        : Promise.resolve(propuestas)
    },
    comprobarClave() {
      comprobaciones++
      return error ? Promise.reject(error) : Promise.resolve()
    },
  }
}
