import {
  etiquetasPrendaSchema,
  type Categoria,
  type Estilo,
  type EtiquetasPrenda,
  type Ocasion,
  type Temporada,
} from '../../datos/modelo.ts'

/** Lo que se está editando: como `EtiquetasPrenda`, pero la categoría puede faltar. */
export interface Borrador {
  categoria: Categoria | null
  subcategoria: string
  colores: string[]
  estampado: string
  estilos: Estilo[]
  abrigo: number
  formalidad: number
  ocasiones: Ocasion[]
  temporadas: Temporada[]
  notas: string
}

export type ErroresBorrador = Partial<Record<keyof Borrador, string>>

const NIVEL_POR_DEFECTO = 3

export const DESCRIPCION_ABRIGO = ['Muy fresco', 'Fresco', 'Medio', 'Abriga', 'Muy abrigado']
export const DESCRIPCION_FORMALIDAD = [
  'Deporte o casa',
  'Casual',
  'Smart casual',
  'Arreglado',
  'Etiqueta',
]

function nivel(valor: number | undefined): number {
  return valor !== undefined && Number.isInteger(valor) && valor >= 1 && valor <= 5
    ? valor
    : NIVEL_POR_DEFECTO
}

/** Copia solo los campos de etiquetas: se le puede pasar una prenda entera para editarla. */
export function borradorInicial(iniciales: Partial<EtiquetasPrenda> = {}): Borrador {
  return {
    categoria: iniciales.categoria ?? null,
    subcategoria: iniciales.subcategoria ?? '',
    colores: [...(iniciales.colores ?? [])],
    estampado: iniciales.estampado ?? '',
    estilos: [...(iniciales.estilos ?? [])],
    abrigo: nivel(iniciales.abrigo),
    formalidad: nivel(iniciales.formalidad),
    ocasiones: [...(iniciales.ocasiones ?? [])],
    temporadas: [...(iniciales.temporadas ?? [])],
    notas: iniciales.notas ?? '',
  }
}

export function validarBorrador(
  borrador: Borrador,
): { valido: true; etiquetas: EtiquetasPrenda } | { valido: false; errores: ErroresBorrador } {
  if (borrador.categoria === null) {
    return { valido: false, errores: { categoria: 'Elige una categoría.' } }
  }
  const leido = etiquetasPrendaSchema.safeParse(borrador)
  if (leido.success) return { valido: true, etiquetas: leido.data }
  const errores: ErroresBorrador = {}
  for (const problema of leido.error.issues) {
    errores[problema.path[0] as keyof Borrador] = 'Revisa este campo.'
  }
  return { valido: false, errores }
}

/** Añade o quita un valor de una lista, sin cambiar el orden del resto. */
export function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
}

/** Las opciones fijas más los valores que ya traía la prenda y no están en la lista. */
export function conExtras(opciones: readonly string[], elegidos: string[]): string[] {
  return [...opciones, ...elegidos.filter((valor) => valor && !opciones.includes(valor))]
}
