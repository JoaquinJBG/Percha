import type { Prenda } from '../datos/modelo.ts'

export type Zona = 'abajo' | 'arriba' | 'entero'

type PrendaProbador = Pick<Prenda, 'categoria' | 'abrigo'>

export interface SeleccionProbador<P extends PrendaProbador> {
  /** En el orden en que se visten: lo de abajo y luego lo de arriba, o el vestido solo. */
  envio: { prenda: P; zona: Zona }[]
  /** Ropa del outfit que el PC no viste porque taparía o sustituiría a otra (capas). */
  fuera: P[]
}

/** El abrigo va por fuera; entre las de arriba, la que más abriga (un jersey sobre una camiseta). */
function capa(prenda: PrendaProbador): number {
  return (prenda.categoria === 'abrigo' ? 10 : 0) + prenda.abrigo
}

/**
 * Qué prendas del outfit se mandan al probador del PC (contrato de T7.1): el vestido solo; si no, la
 * de abajo y **una** de arriba, la más exterior, porque una segunda de arriba sustituye a la primera
 * en vez de ponerse encima. El calzado y los accesorios no se mandan: el modelo no los viste.
 */
export function prendasParaProbador<P extends PrendaProbador>(
  prendas: readonly P[],
): SeleccionProbador<P> {
  const ropa = prendas.filter((p) => p.categoria !== 'calzado' && p.categoria !== 'accesorio')
  const vestido = ropa.find((p) => p.categoria === 'vestido')
  if (vestido) {
    return {
      envio: [{ prenda: vestido, zona: 'entero' }],
      fuera: ropa.filter((p) => p !== vestido),
    }
  }

  const abajo = ropa.find((p) => p.categoria === 'inferior')
  const arriba = ropa
    .filter((p) => p.categoria === 'superior' || p.categoria === 'abrigo')
    .reduce<P | undefined>((fuera, p) => (!fuera || capa(p) > capa(fuera) ? p : fuera), undefined)
  const envio: SeleccionProbador<P>['envio'] = []
  if (abajo) envio.push({ prenda: abajo, zona: 'abajo' })
  if (arriba) envio.push({ prenda: arriba, zona: 'arriba' })
  return { envio, fuera: ropa.filter((p) => p !== abajo && p !== arriba) }
}
