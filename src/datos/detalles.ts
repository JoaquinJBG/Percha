import {
  CORTES_ABRIGO,
  CORTES_CAMISA,
  CORTES_CAMISETA,
  CORTES_PANTALON,
  CUELLOS,
  LARGOS_ABRIGO,
  LARGOS_CAMISETA,
  LARGOS_PANTALON,
  MANGAS,
  TIROS,
  type Corte,
  type Cuello,
  type Largo,
  type Manga,
  type Prenda,
  type Tiro,
} from './modelo.ts'

export const CAMPOS_DETALLE = ['corte', 'tiro', 'largo', 'manga', 'cuello'] as const
export type CampoDetalle = (typeof CAMPOS_DETALLE)[number]

export interface DetallesPrenda {
  corte?: Corte | undefined
  tiro?: Tiro | undefined
  largo?: Largo | undefined
  manga?: Manga | undefined
  cuello?: Cuello | undefined
}

/** Para cada campo que aplica, sus opciones; los que no aplican no están. */
export interface OpcionesDetalles {
  corte?: readonly Corte[]
  tiro?: readonly Tiro[]
  largo?: readonly Largo[]
  manga?: readonly Manga[]
  cuello?: readonly Cuello[]
}

type DatosTipo = Pick<Prenda, 'categoria' | 'subcategoria'>

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
}

/** Qué se puede decir de una prenda según su tipo. Vestidos, calzado y accesorios: nada. */
export function detallesQueAplican({ categoria, subcategoria }: DatosTipo): OpcionesDetalles {
  const tipo = normalizar(subcategoria)
  switch (categoria) {
    case 'inferior':
      if (tipo.includes('falda')) return {}
      // Unos shorts tienen corte y tiro, pero no largo de pantalón.
      if (/short|bermuda/.test(tipo)) return { corte: CORTES_PANTALON, tiro: TIROS }
      return { corte: CORTES_PANTALON, tiro: TIROS, largo: LARGOS_PANTALON }
    case 'superior':
      // «camisa» y «sobrecamisa», pero no «camiseta».
      if (/camisa(?!eta)/.test(tipo) || tipo.includes('overshirt')) {
        return { corte: CORTES_CAMISA, manga: MANGAS, cuello: CUELLOS }
      }
      return { corte: CORTES_CAMISETA, largo: LARGOS_CAMISETA, manga: MANGAS }
    case 'abrigo':
      return { corte: CORTES_ABRIGO, largo: LARGOS_ABRIGO }
    default:
      return {}
  }
}

/**
 * Los detalles que valen para el tipo de la prenda; los demás quedan en `undefined`. Las claves van
 * siempre, para que al editar `actualizarPrenda` borre lo que ya no aplica (p. ej. al cambiar el tipo).
 */
export function soloLosQueAplican(
  prenda: DatosTipo & Partial<Record<CampoDetalle, unknown>>,
): Required<DetallesPrenda> {
  const opciones = detallesQueAplican(prenda)
  const elegir = <C extends CampoDetalle>(campo: C) => {
    const valor = prenda[campo]
    const validas = opciones[campo] as readonly unknown[] | undefined
    return (validas?.includes(valor) ? valor : undefined) as Required<DetallesPrenda>[C]
  }
  return {
    corte: elegir('corte'),
    tiro: elegir('tiro'),
    largo: elegir('largo'),
    manga: elegir('manga'),
    cuello: elegir('cuello'),
  }
}

/** «Zara · balloon · 44»: marca, corte y talla de un vistazo; vacío si no hay ninguno. */
export function resumenCorte(prenda: Pick<Prenda, 'marca' | 'corte' | 'talla'>): string {
  return [prenda.marca, prenda.corte, prenda.talla].filter(Boolean).join(' · ')
}
