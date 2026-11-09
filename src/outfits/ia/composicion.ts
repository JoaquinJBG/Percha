import { capasDe } from '../../datos/capas.ts'
import type { Capa, Categoria, Prenda } from '../../datos/modelo.ts'
import type { ExteriorHoy } from '../../ia/tipos.ts'
import type { PrendaReglas } from '../reglas/index.ts'
import { maxCapas } from './capas.ts'

/** Lo que miran las reglas y, si la prenda los tiene, sus papeles de capa y su composición. */
export type PrendaIA = PrendaReglas & Partial<Pick<Prenda, 'capas' | 'composicion'>>

export interface Hoy {
  exterior: ExteriorHoy
  temperatura: number | null
}

const ORDEN_COLLAGE: readonly Categoria[] = [
  'superior',
  'inferior',
  'vestido',
  'abrigo',
  'calzado',
  'accesorio',
]
const ORDEN_CAPA: readonly Capa[] = ['base', 'media', 'exterior']
const MAX_POR_CATEGORIA_ARRIBA = 2
const MAX_ACCESORIOS = 2
/** Sin abrigo (calor o en casa) no se apilan más de 2 capas: base y como mucho una encima. */
const MAX_CAPAS_SIN_EXTERIOR = 2

/** Todas las formas de dar un papel a cada prenda de arriba, entre los que puede hacer. */
function* repartos(capas: readonly (readonly Capa[])[]): Generator<Capa[]> {
  const [primera, ...resto] = capas
  if (!primera) {
    yield []
    return
  }
  for (const capa of primera) {
    for (const siguiente of repartos(resto)) yield [capa, ...siguiente]
  }
}

/**
 * Comprueba un outfit con capas que propone la IA, contra las prendas que se le mandaron: abajo y
 * calzado, una base (o el vestido), hasta 2 medias y 1 exterior con los papeles que puede hacer cada
 * prenda, como mucho 2 «superior» y 2 «abrigo», y exterior si hoy hace falta y hay. Devuelve las prendas
 * en orden de collage (dentro de cada categoría, de dentro afuera) y la principal (la base o el vestido).
 * Las reglas finas de capas (C1–C13) son de T6.2.
 */
export function comprobarConCapas<P extends PrendaIA>(
  ids: readonly string[],
  enviadas: readonly P[],
  hoy: Hoy,
): { prendas: P[]; principal: P } | { error: string } {
  const porId = new Map(enviadas.map((p) => [p.id, p]))
  const prendas: P[] = []
  for (const id of ids) {
    const prenda = porId.get(id)
    if (!prenda) return { error: `la prenda ${id} no está entre las enviadas` }
    if (prendas.includes(prenda)) return { error: `repite la prenda ${id}` }
    prendas.push(prenda)
  }

  const de = (categoria: Categoria) => prendas.filter((p) => p.categoria === categoria)
  const vestido = de('vestido')
  const conPar = de('inferior').length === 1 && vestido.length === 0
  const conVestido = vestido.length === 1 && de('inferior').length === 0
  if (!conPar && !conVestido) return { error: 'necesita algo de abajo o un vestido' }
  if (de('calzado').length !== 1) return { error: 'necesita un calzado' }
  if (de('accesorio').length > MAX_ACCESORIOS) return { error: 'lleva más de dos accesorios' }
  if (de('superior').length > MAX_POR_CATEGORIA_ARRIBA) {
    return { error: 'lleva más de dos partes de arriba' }
  }
  if (de('abrigo').length > MAX_POR_CATEGORIA_ARRIBA) return { error: 'lleva más de dos abrigos' }

  const arriba = [...de('superior'), ...de('abrigo')]
  if (conPar && arriba.length === 0) return { error: 'necesita una parte de arriba' }
  const tope = hoy.exterior === 'no' ? MAX_CAPAS_SIN_EXTERIOR : maxCapas(hoy.temperatura)
  if (arriba.length + vestido.length > tope) {
    return { error: `lleva más de ${String(tope)} capas` }
  }

  const exteriorObligatoria =
    hoy.exterior === 'obligatoria' && enviadas.some((p) => capasDe(p).includes('exterior'))
  const papeles = arriba.map((p) => capasDe(p))
  let reparto: Capa[] | undefined
  for (const posible of repartos(papeles)) {
    const cuantas = (capa: Capa) => posible.filter((c) => c === capa).length
    if (cuantas('base') !== (conPar ? 1 : 0)) continue
    if (cuantas('media') > 2 || cuantas('exterior') > 1) continue
    if (exteriorObligatoria && cuantas('exterior') === 0) continue
    reparto = posible
    break
  }
  if (!reparto) {
    return {
      error: exteriorObligatoria
        ? 'las capas no encajan o falta la exterior'
        : 'las capas no encajan con los papeles de cada prenda',
    }
  }

  const papel = new Map(arriba.map((p, i) => [p, reparto[i] ?? 'base']))
  const principal = conVestido ? vestido[0] : arriba.find((p) => papel.get(p) === 'base')
  if (!principal) return { error: 'necesita una base' }
  const orden = (p: P) =>
    ORDEN_COLLAGE.indexOf(p.categoria) * ORDEN_CAPA.length +
    ORDEN_CAPA.indexOf(papel.get(p) ?? 'base')
  return { prendas: [...prendas].sort((a, b) => orden(a) - orden(b)), principal }
}
