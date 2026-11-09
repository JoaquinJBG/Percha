import { capasDe } from '../../datos/capas.ts'
import { abrigoDeArriba, LIMITE_EXTERIOR, rangoArriba } from './clima.ts'
import { armonia, claridad, esEstampada, tono } from './colores.ts'
import { normalizar, palabras } from './texto.ts'
import type { Contexto, PrendaReglas } from './tipos.ts'

/**
 * La parte de arriba de un outfit, de dentro afuera: la base (una prenda de arriba o el vestido), 0–2
 * medias y 0–1 exterior.
 */
export interface Pila<P extends PrendaReglas = PrendaReglas> {
  base: P
  medias: P[]
  exterior: P | null
}

/** Tope de prendas por outfit; el mismo número que `MAX_PRENDAS_POR_OUTFIT` de la IA (T6.3). */
export const MAX_PRENDAS_POR_OUTFIT = 8
export const MAX_ACCESORIOS = 3
/**
 * Por debajo (°C), la exterior debería ser un abrigo largo o algo que abrigue 4 o más (§1.5: de paño o
 * acolchada); a 3 °C o menos, sí o sí.
 */
const FRIO_DE_ABRIGO = 9
const FRIO_EXTREMO = 3
/** Sin tiempo, lo que va encima no puede abrigar más que una tercera pieza ligera. */
const ABRIGO_SIN_TIEMPO = 3

const LARGO = /abrigo|gabardina|trench|parka|plumifero|chaqueton|anorak|pano/
const AMERICANA = /americana|blazer|chaqueta (de traje|sastre|de vestir)/
const CHALECO_PUNTO = /chaleco de punto|chaleco punto/
const SHACKET = /shacket|sobrecamisa (gruesa|acolchada)/
const SOBRECAMISA = /sobrecamisa|overshirt|shacket/
const CAMISETA = /camiseta|tirantes|\btop\b/
const PUNTO = /jersey|sueter|pullover|punto|cardigan|rebeca/
const GRUESO = /grues[oa]|gord[oa]|ochos|pescador/
const CAPUCHA = /sudadera|hoodie|capucha/
const RUGOSOS = ['pana', 'tweed', 'borreguito', 'ochos', 'pescador', 'franela', 'boucle'] as const

function tipo(prenda: PrendaReglas): string {
  return normalizar(prenda.subcategoria)
}

const es = (patron: RegExp, prenda: PrendaReglas) => patron.test(tipo(prenda))
const esCamisa = (prenda: PrendaReglas) =>
  /\bcamisa\b/.test(tipo(prenda)) && !es(SOBRECAMISA, prenda)
const esPuntoGrueso = (prenda: PrendaReglas) =>
  es(PUNTO, prenda) &&
  (GRUESO.test(`${tipo(prenda)} ${normalizar(prenda.notas)}`) || prenda.abrigo >= 4)

export function esChalecoDePunto(prenda: PrendaReglas): boolean {
  return (
    es(CHALECO_PUNTO, prenda) ||
    (prenda.categoria === 'superior' && tipo(prenda).includes('chaleco'))
  )
}

function abrigaDeVerdad(prenda: PrendaReglas): boolean {
  return es(LARGO, prenda) || prenda.abrigo >= 4
}

/** De dentro afuera. */
export function capasDeLaPila<P extends PrendaReglas>(pila: Pila<P>): P[] {
  return [pila.base, ...pila.medias, ...(pila.exterior ? [pila.exterior] : [])]
}

/**
 * Las reglas duras de capa (C1–C4, C9, C10 y el abrigo de la parte de arriba): el motivo por el que la
 * pila no vale o `null`. `puedeAbrigarse` dice si el armario tiene alguna capa más que poner: si no, el
 * poco abrigo solo resta.
 */
export function fallaPila(pila: Pila, contexto: Contexto, puedeAbrigarse: boolean): string | null {
  const capas = capasDeLaPila(pila)
  const { temperatura, ocasion } = contexto

  for (let i = 1; i < capas.length; i++) {
    // C1 con un nivel de margen: el `abrigo` de una gabardina y el de un jersey no se miden igual.
    if ((capas[i]?.abrigo ?? 0) < (capas[i - 1]?.abrigo ?? 0) - 1) {
      return 'una capa abriga mucho menos que la de debajo'
    }
  }
  if (capas.length > 4) return 'demasiadas capas'
  if (capas.length === 4) {
    const cuartaFina = pila.medias.some((m) => m.abrigo <= 2)
    if (temperatura === null || temperatura > 3 || !cuartaFina)
      return 'cuatro capas solo con 3 °C o menos'
  }
  if (pila.medias.some((m) => es(LARGO, m))) return 'un abrigo largo va siempre fuera'
  // C3 y C4 sin campo `largo`: una chaqueta (americana, cazadora, sobrecamisa) de media solo va bajo un
  // abrigo largo, y nada va entre ella y el abrigo.
  const chaqueta = pila.medias.findIndex((m) => m.categoria === 'abrigo')
  if (chaqueta >= 0) {
    const nombre = es(AMERICANA, pila.medias[chaqueta] ?? pila.base)
      ? 'la americana'
      : 'una chaqueta'
    if (chaqueta < pila.medias.length - 1) return `sobre ${nombre} solo va un abrigo`
    if (pila.exterior && !es(LARGO, pila.exterior)) return `sobre ${nombre} solo va un abrigo`
  }
  if (pila.exterior?.categoria === 'superior' && pila.medias.length > 0) {
    return 'un jersey o una sudadera no va encima de otra capa'
  }
  if (
    pila.exterior &&
    temperatura !== null &&
    temperatura <= FRIO_EXTREMO &&
    !abrigaDeVerdad(pila.exterior)
  ) {
    return `a ${String(temperatura)} °C lo de fuera tiene que ser un abrigo de verdad`
  }
  if (
    temperatura === null &&
    !contexto.necesitaAbrigo &&
    [...pila.medias, pila.exterior].some((c) => c && c.abrigo > ABRIGO_SIN_TIEMPO)
  ) {
    return 'sin saber el tiempo, encima solo algo ligero'
  }
  if (contexto.precipitacion && pila.exterior?.categoria === 'superior') {
    return `con ${contexto.precipitacion} lo de fuera tiene que ser un abrigo`
  }
  if (pila.base.categoria === 'vestido') {
    if ([...pila.medias, pila.exterior].some((c) => c && capasDe(c).includes('base'))) {
      return 'sobre un vestido no va otra parte de arriba'
    }
  } else if (pila.medias.some(esCamisa) && !es(CAMISETA, pila.base)) {
    // P2: la camisa abierta va sobre una camiseta, no sobre otra camisa o un jersey.
    return 'una camisa abierta va sobre una camiseta'
  }
  if (capas.filter(esEstampada).length > 1) return 'dos estampados en las capas'

  if (
    pila.exterior &&
    es(SHACKET, pila.exterior) &&
    pila.medias.length === 0 &&
    es(CAMISETA, pila.base)
  ) {
    return 'una sobrecamisa gruesa no va sobre una camiseta sola'
  }
  const debajoDeAmericana = (() => {
    const i = capas.findIndex((c, j) => j > 0 && es(AMERICANA, c))
    return i < 0 ? [] : capas.slice(0, i)
  })()
  if (debajoDeAmericana.some(esPuntoGrueso)) return 'un jersey grueso no va bajo la americana'
  if (ocasion === 'trabajo' && debajoDeAmericana.some((c) => es(CAPUCHA, c))) {
    return 'capucha bajo americana no va al trabajo'
  }
  if (
    pila.exterior &&
    esChalecoDePunto(pila.exterior) &&
    temperatura !== null &&
    temperatura < LIMITE_EXTERIOR
  ) {
    return 'un chaleco de punto no abriga como exterior'
  }

  if (temperatura !== null) {
    const [minimo, maximo] = rangoArriba(temperatura)
    const abrigo = abrigoDeArriba(capas)
    if (abrigo > maximo + 1) return `demasiado abrigo arriba para ${String(temperatura)} °C`
    if (abrigo < minimo - 1 && puedeAbrigarse)
      return `poco abrigo arriba para ${String(temperatura)} °C`
  }
  return null
}

export interface NotaPila {
  puntos: number
  /** Un consejo de cómo llevarlo (C11, C12), o `null`. */
  consejo: string | null
}

/** Las reglas blandas de capa (C5–C8, C13 y el abrigo justo): suman o restan. */
export function puntuarPila(
  pila: Pila,
  contexto: Contexto,
  resto: readonly PrendaReglas[],
): NotaPila {
  const capas = capasDeLaPila(pila)
  let puntos = 0

  if (contexto.temperatura !== null) {
    const [minimo, maximo] = rangoArriba(contexto.temperatura)
    const abrigo = abrigoDeArriba(capas)
    if (abrigo >= minimo && abrigo <= maximo) puntos += 1
    else puntos -= abrigo < minimo - 1 ? 3 : 1
  }
  // C1 suave: una capa que abriga un nivel menos que la de debajo.
  for (let i = 1; i < capas.length; i++) {
    if ((capas[i]?.abrigo ?? 0) < (capas[i - 1]?.abrigo ?? 0)) puntos -= 1
  }
  const { temperatura } = contexto
  if (
    pila.exterior &&
    temperatura !== null &&
    temperatura < FRIO_DE_ABRIGO &&
    !abrigaDeVerdad(pila.exterior)
  ) {
    puntos -= 2
  }
  // C5: sin la exterior, lo de dentro también tiene que verse bien.
  if (pila.exterior && !armonia([...capas.slice(0, -1), ...resto]).combina) puntos -= 1
  // C6: claro dentro, oscuro fuera.
  const fuera = capas.at(-1)
  if (capas.length > 1 && fuera && claridad(fuera) < claridad(pila.base)) puntos += 0.5
  // C7: dos capas seguidas del mismo tono se funden.
  for (let i = 1; i < capas.length; i++) {
    const dentro = capas[i - 1]
    const encima = capas[i]
    if (dentro && encima && tono(dentro) === tono(encima)) puntos -= 1
  }
  // C8: liso con rugoso; dos rugosas iguales, o tres rugosas, cargan.
  const rugosas = capas
    .map((c) => RUGOSOS.find((r) => palabras(c.subcategoria, c.notas).has(r)))
    .filter((r) => r !== undefined)
  if (rugosas.length >= 3 || new Set(rugosas).size < rugosas.length) puntos -= 1
  // C13: camiseta + camisa abierta + sobrecamisa + abrigo es una capa de más.
  if (
    capas.length === 4 &&
    pila.medias.some(esCamisa) &&
    pila.medias.some((m) => es(SOBRECAMISA, m))
  ) {
    puntos -= 3
  }

  let consejo: string | null = null
  if (esCamisa(pila.base) && pila.medias.some((m) => es(PUNTO, m))) {
    consejo = 'cuello de la camisa por fuera'
  } else if (
    pila.exterior &&
    capas.length > 1 &&
    (esEstampada(pila.base) || pila.medias.length > 0)
  ) {
    consejo = 'lo de fuera, abierto'
  }
  return { puntos, consejo }
}
