import type { Estilo, Ocasion, Prenda, Temporada } from '../../datos/modelo.ts'
import type { Precipitacion, TiempoHoy } from '../../tiempo/tipos.ts'

/** Lo que miran las reglas de una prenda: todo menos las fotos y los datos de alta. */
export type PrendaReglas = Pick<
  Prenda,
  | 'id'
  | 'categoria'
  | 'subcategoria'
  | 'colores'
  | 'estampado'
  | 'estilos'
  | 'abrigo'
  | 'formalidad'
  | 'ocasiones'
  | 'temporadas'
  | 'notas'
>

export interface Peticion<P extends PrendaReglas = PrendaReglas> {
  prendas: readonly P[]
  estilo: Estilo
  ocasion: Ocasion
  /** `null` si no se sabe: entonces no se filtra por temperatura ni lluvia. */
  tiempo: TiempoHoy | null
  /** Fecha `AAAA-MM-DD` para la temporada cuando no hay tiempo (si lo hay, manda `tiempo.fecha`). */
  fecha?: string
}

export interface Contexto {
  /** Sensación térmica media del día en °C, redondeada; `null` sin tiempo. */
  temperatura: number | null
  precipitacion: Precipitacion | null
  /** Hace falta abrigo: sensación media por debajo de 16 °C, lluvia o nieve. */
  necesitaAbrigo: boolean
  temporada: Temporada | null
  /** Rango de formalidad (1–5) que pide la ocasión. */
  formalidad: { minima: number; maxima: number }
  estilo: Estilo
  ocasion: Ocasion
  /** Estilos que se aceptan como cercanos al elegido. */
  estilosAfines: readonly Estilo[]
}

/**
 * `pleno`: cumple estilo y formalidad. `parcial`: le falla uno de los dos por poco; solo se usa si no
 * hay prendas plenas de su categoría.
 */
export type Ajuste = 'pleno' | 'parcial'

export interface Candidato<P extends PrendaReglas = PrendaReglas> {
  prenda: P
  /** Más es mejor; sirve para ordenar dentro de la misma petición. */
  puntos: number
  ajuste: Ajuste
  /** Por qué encaja o no del todo, en frases cortas («estilo afín», «de verano»…). */
  motivos: string[]
}

export interface Descartada<P extends PrendaReglas = PrendaReglas> {
  prenda: P
  motivo: string
}

export interface ResultadoCandidatos<P extends PrendaReglas = PrendaReglas> {
  contexto: Contexto
  /** Ordenados de más a menos puntos. */
  candidatos: Candidato<P>[]
  descartadas: Descartada<P>[]
  /** Lo que falta para poder vestirse hoy, en frases para el usuario. */
  avisos: string[]
}

export interface OutfitReglas<P extends PrendaReglas = PrendaReglas> {
  /** En orden de collage: superior + inferior (o vestido), abrigo, calzado y accesorio. */
  prendas: P[]
  /** La parte de arriba o el vestido: no se repite entre outfits si se puede. */
  principal: P
  puntos: number
  /** «abrigo por 8 °C, formal para trabajo». */
  motivo: string
}

export interface ResultadoOutfits<P extends PrendaReglas = PrendaReglas> {
  contexto: Contexto
  /** Hasta 4, todos distintos; menos si el armario no da para más. */
  outfits: OutfitReglas<P>[]
  avisos: string[]
}
