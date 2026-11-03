import type { FiltrosPrendas } from '../../datos/repositorio.ts'
import type { Categoria, Estilo, Prenda } from '../../datos/modelo.ts'

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  superior: 'Parte de arriba',
  inferior: 'Parte de abajo',
  vestido: 'Vestido',
  abrigo: 'Abrigo',
  calzado: 'Calzado',
  accesorio: 'Accesorio',
}

export function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1)
}

/** La subcategoría («camiseta») dice más que la categoría; si falta, la categoría. */
export function nombrePrenda(prenda: Pick<Prenda, 'categoria' | 'subcategoria'>): string {
  return prenda.subcategoria === ''
    ? ETIQUETA_CATEGORIA[prenda.categoria]
    : capitalizar(prenda.subcategoria)
}

export function contar(n: number, singular: string, plural: string): string {
  return `${String(n)} ${n === 1 ? singular : plural}`
}

/** Foto que se enseña de una prenda: la primera, recortada si ya lo está. */
export function fotoPortada(prenda: Prenda): Blob | undefined {
  const foto = prenda.fotos[0]
  return foto ? (foto.recortada ?? foto.original) : undefined
}

export interface Filtros {
  categoria: Categoria | null
  estilo: Estilo | null
  color: string | null
}

export const SIN_FILTROS: Filtros = { categoria: null, estilo: null, color: null }

export function hayFiltros(filtros: Filtros): boolean {
  return filtros.categoria !== null || filtros.estilo !== null || filtros.color !== null
}

/** Lo que pide `listarPrendas`: sin las claves de los filtros que no se usan. */
export function aFiltrosPrendas({ categoria, estilo, color }: Filtros): FiltrosPrendas {
  return {
    ...(categoria !== null && { categoria }),
    ...(estilo !== null && { estilo }),
    ...(color !== null && { color }),
  }
}
