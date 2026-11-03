import type { EtiquetasPrenda } from '../datos/modelo.ts'
import type { ErrorIA } from './errores.ts'
import {
  MAX_PRENDAS_POR_PETICION,
  type PrendaAEtiquetar,
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
  /** Si se da, todas las llamadas lo lanzan. */
  error?: ErrorIA
}

export interface ProveedorFalso extends ProveedorIA {
  /** Los lotes recibidos por `etiquetarPrendas`, en orden. */
  readonly lotes: PrendaAEtiquetar[][]
  readonly comprobaciones: number
}

/** Proveedor sin red para los tests y para probar pantallas sin clave. */
export function crearProveedorFalso({
  etiquetas = () => ETIQUETAS_DE_PRUEBA,
  error,
}: OpcionesProveedorFalso = {}): ProveedorFalso {
  const lotes: PrendaAEtiquetar[][] = []
  let comprobaciones = 0
  return {
    lotes,
    get comprobaciones() {
      return comprobaciones
    },
    etiquetarPrendas(prendas) {
      if (prendas.length > MAX_PRENDAS_POR_PETICION) {
        return Promise.reject(new RangeError('Demasiadas prendas'))
      }
      lotes.push(prendas)
      if (error) return Promise.reject(error)
      const resultado: ResultadoEtiquetado = prendas.map(etiquetas)
      return Promise.resolve(resultado)
    },
    comprobarClave() {
      comprobaciones++
      return error ? Promise.reject(error) : Promise.resolve()
    },
  }
}
