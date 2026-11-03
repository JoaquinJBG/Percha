import { ESTILOS, type Estilo } from '../../datos/modelo.ts'

// Se escribe en un sentido y se completa en el otro: si A es afín a B, B lo es a A.
const AFINES_DECLARADOS: Record<Estilo, readonly Estilo[]> = {
  casual: ['smart casual', 'minimalista', 'streetwear', 'preppy', 'clean girl'],
  'smart casual': ['business', 'minimalista', 'preppy', 'old money / quiet luxury', 'elegante'],
  elegante: ['formal', 'old money / quiet luxury', 'romántico', 'minimalista'],
  formal: ['business', 'old money / quiet luxury'],
  business: ['minimalista', 'old money / quiet luxury'],
  minimalista: ['clean girl', 'old money / quiet luxury', 'techwear'],
  'old money / quiet luxury': ['preppy'],
  streetwear: ['deportivo / athleisure', 'y2k', 'techwear', 'grunge', 'rockero'],
  'deportivo / athleisure': ['gorpcore', 'casual', 'clean girl'],
  gorpcore: ['techwear', 'streetwear'],
  preppy: ['vintage / retro'],
  boho: ['romántico', 'vintage / retro', 'mediterráneo / verano', 'cowboy / western'],
  'vintage / retro': ['rockero', 'y2k'],
  rockero: ['grunge', 'cowboy / western'],
  grunge: ['vintage / retro'],
  y2k: ['clean girl'],
  techwear: [],
  romántico: ['clean girl', 'mediterráneo / verano'],
  'clean girl': [],
  'cowboy / western': ['vintage / retro'],
  'mediterráneo / verano': ['casual', 'minimalista'],
}

const AFINES = new Map<Estilo, Set<Estilo>>(ESTILOS.map((estilo) => [estilo, new Set()]))
for (const estilo of ESTILOS) {
  for (const afin of AFINES_DECLARADOS[estilo]) {
    AFINES.get(estilo)?.add(afin)
    AFINES.get(afin)?.add(estilo)
  }
}

export function estilosAfines(estilo: Estilo): Estilo[] {
  return ESTILOS.filter((otro) => AFINES.get(estilo)?.has(otro))
}

/** `comodin`: la prenda no tiene estilos y vale para cualquiera. */
export type Afinidad = 'exacto' | 'afin' | 'comodin' | 'ninguno'

export function afinidad(estilosPrenda: readonly Estilo[], elegido: Estilo): Afinidad {
  if (estilosPrenda.length === 0) return 'comodin'
  if (estilosPrenda.includes(elegido)) return 'exacto'
  if (estilosPrenda.some((estilo) => AFINES.get(elegido)?.has(estilo))) return 'afin'
  return 'ninguno'
}
