import type {
  Capa,
  Componente,
  DatosEtiqueta,
  Estilo,
  EtiquetasPrenda,
  Ocasion,
  Temporada,
} from '../datos/modelo.ts'
import type { Precipitacion } from '../tiempo/tipos.ts'

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

/** Una prenda candidata para un outfit: solo su id y sus etiquetas, sin fotos (ahorra cupo). */
export type PrendaParaOutfit = Pick<
  EtiquetasPrenda,
  | 'categoria'
  | 'subcategoria'
  | 'colores'
  | 'estampado'
  | 'estilos'
  | 'abrigo'
  | 'formalidad'
  | 'notas'
> & {
  id: string
  /** Papeles de capa guardados; si faltan, el prompt usa los de por defecto (`capasDe`). */
  capas?: Capa[]
  /** La composición de la etiqueta (T5.1), si se sabe. */
  composicion?: Componente[]
  /** Capa media o exterior ligera que hoy puede ir o no («tercera pieza»). */
  opcional?: boolean
} & Partial<Pick<EtiquetasPrenda, 'corte' | 'tiro' | 'largo' | 'manga' | 'cuello'>>

/**
 * Lo que va del perfil a Gemini (T8.4), ya en texto corto. El cuerpo, sin medidas: altura, complexión y
 * una línea de notas sin cifras.
 */
export interface PerfilParaOutfits {
  cuerpo?: string
  oficina?: string
}

/**
 * Si hoy el outfit lleva capa exterior: `obligatoria` (frío o lluvia), `opcional` (tercera pieza
 * ligera) o `no` (calor, o en casa).
 */
export type ExteriorHoy = 'obligatoria' | 'opcional' | 'no'

/** Lo que importa del día para vestirse; sale del `Contexto` de `src/outfits/reglas/` y de `exteriorDeHoy`. */
export interface TiempoParaOutfits {
  /** Sensación térmica media en °C; `null` si no se sabe. */
  temperatura: number | null
  /** La que usan las reglas para vestir si el perfil es caluroso o friolero (±2 °C). */
  temperaturaVestir?: number | null
  precipitacion: Precipitacion | null
  temporada: Temporada | null
  exterior: ExteriorHoy
}

export interface PeticionOutfits {
  /** Las candidatas que ya han pasado las reglas. */
  prendas: readonly PrendaParaOutfit[]
  estilo: Estilo
  ocasion: Ocasion
  tiempo: TiempoParaOutfits
  /** Solo si el perfil lo tiene; la sensación térmica ya va dentro de `tiempo.exterior`. */
  perfil?: PerfilParaOutfits
  /** Otra semilla, otra tanda. */
  semilla?: number
}

/** Un outfit propuesto por la IA: ids de prendas (sin comprobar) y una frase de por qué. */
export interface PropuestaOutfit {
  prendas: string[]
  porque: string
}

export interface ProveedorIA {
  /** Lanza `ErrorIA` si no se puede etiquetar ninguna; `RangeError` si el lote no vale. */
  etiquetarPrendas(
    prendas: PrendaAEtiquetar[],
    opciones?: OpcionesPeticion,
  ): Promise<ResultadoEtiquetado>
  /**
   * Hasta 4 outfits elegidos entre las prendas de la petición, en una petición sin fotos. Los ids no se
   * comprueban: eso lo hace quien llama. Lanza `ErrorIA` si no llega ninguno con forma válida.
   */
  elegirOutfits(peticion: PeticionOutfits, opciones?: OpcionesPeticion): Promise<PropuestaOutfit[]>
  /**
   * Lee la foto de la etiqueta cosida: marca, referencia, talla y composición. Solo lo que se ve; puede
   * devolver `{}`. La foto no se guarda en ningún sitio. Lanza `ErrorIA` si no se puede leer.
   */
  leerEtiqueta(foto: Blob, opciones?: OpcionesPeticion): Promise<DatosEtiqueta>
  /** Se resuelve si la clave y el modelo valen; si no, lanza `ErrorIA`. */
  comprobarClave(opciones?: OpcionesPeticion): Promise<void>
}
