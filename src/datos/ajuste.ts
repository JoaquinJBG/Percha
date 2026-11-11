import type { Corte, Cuerpo, FilaTalla, Largo, TablaTallas, TipoTalla } from './modelo.ts'

/** Lo que se compara: los contornos y el largo de pierna, que el perfil tiene (T8.2). */
export const MEDIDAS_AJUSTE = ['pecho', 'cintura', 'cadera', 'largoPierna'] as const
export type MedidaAjuste = (typeof MEDIDAS_AJUSTE)[number]

export type Veredicto = 'justa' | 'bien' | 'holgada' | 'corta' | 'larga'

export interface AjusteMedida {
  medida: MedidaAjuste
  veredicto: Veredicto
  /** Lo que sobra (+) o falta (−), en cm: la talla menos tu medida y, si es de la prenda, su holgura. */
  diferencia: number
}

export interface Ajuste {
  talla: string
  medidas: AjusteMedida[]
  /** Medidas que la tabla da pero tu perfil no tiene: sin ellas no se puede decir nada. */
  faltan: MedidaAjuste[]
}

/** Con tablas del cuerpo, menos de 2 cm de diferencia es tu talla (las tiendas van de 4 en 4 cm). */
export const TOLERANCIA_CUERPO_CM = 2
/** Con tablas de la prenda hay más margen (menos de 3 cm): la holgura de cada corte es aproximada. */
export const TOLERANCIA_PRENDA_CM = 3

/**
 * Holgura de contorno (pecho en lo de arriba, cadera en pantalones) que se espera entre la prenda,
 * medida en plano y doblada, y el cuerpo, según el corte (T8.1). Cifras de patronaje aproximadas, entre
 * punto y tejido plano: ceñido ~6 cm, regular ~10, amplio ~14, oversize ~22. Un pantalón deja algo menos.
 */
const HOLGURA_POR_CORTE: Partial<Record<Corte, number>> = {
  skinny: 2,
  slim: 6,
  entallado: 6,
  regular: 10,
  'regular / recto': 8,
  recto: 10,
  tapered: 8,
  bootcut: 8,
  cargo: 12,
  relaxed: 14,
  boxy: 14,
  'wide leg': 16,
  flare: 12,
  balloon: 18,
  oversize: 22,
  overshirt: 16,
  baggy: 20,
  cropped: 12,
}
const HOLGURA_SIN_CORTE: Record<TipoTalla, number> = {
  'parte de arriba': 10,
  pantalón: 8,
  calzado: 0,
}
/** La cintura de un pantalón va sujeta (cinturilla o cinturón): casi sin holgura, sea cual sea el corte. */
const HOLGURA_CINTURA_PANTALON = 2

/** Un tobillero o un cropped se hacen cortos a propósito: se espera que la pierna quede así de corta. */
const PIERNA_MAS_CORTA_CM: Partial<Record<Largo, number>> = { tobillero: 7, cropped: 12 }

export interface PrendaAjuste {
  corte?: Corte | undefined
  largo?: Largo | undefined
}

function holguraEsperada(medida: MedidaAjuste, tipo: TipoTalla, prenda: PrendaAjuste): number {
  if (medida === 'largoPierna') {
    return -(prenda.largo ? (PIERNA_MAS_CORTA_CM[prenda.largo] ?? 0) : 0)
  }
  if (medida === 'cintura' && tipo === 'pantalón') return HOLGURA_CINTURA_PANTALON
  return (prenda.corte ? HOLGURA_POR_CORTE[prenda.corte] : undefined) ?? HOLGURA_SIN_CORTE[tipo]
}

function redondear(cm: number): number {
  return Math.round(cm * 2) / 2
}

function buscarFila(tabla: TablaTallas, talla: string): FilaTalla | undefined {
  const buscada = talla.trim().toLocaleLowerCase('es')
  return tabla.filas.find((fila) => fila.talla.toLocaleLowerCase('es') === buscada)
}

/**
 * Cómo te queda una talla de la tabla, medida a medida. `null` si la talla no está en la tabla. Todo es
 * local: las medidas del cuerpo nunca salen del móvil (D23).
 */
export function ajusteDeTalla(
  tabla: TablaTallas,
  talla: string,
  cuerpo: Cuerpo | undefined,
  prenda: PrendaAjuste = {},
): Ajuste | null {
  const fila = buscarFila(tabla, talla)
  if (!fila) return null
  const tolerancia = tabla.medidaDe === 'cuerpo' ? TOLERANCIA_CUERPO_CM : TOLERANCIA_PRENDA_CM
  const medidas: AjusteMedida[] = []
  const faltan: MedidaAjuste[] = []
  for (const medida of MEDIDAS_AJUSTE) {
    const deLaTalla = fila[medida]
    if (deLaTalla === undefined) continue
    const tuya = cuerpo?.[medida]
    if (tuya === undefined) {
      faltan.push(medida)
      continue
    }
    const holgura = tabla.medidaDe === 'prenda' ? holguraEsperada(medida, tabla.tipo, prenda) : 0
    // Se compara sin redondear; solo se redondea lo que se enseña.
    const exacta = deLaTalla - tuya - holgura
    const diferencia = redondear(exacta)
    const esLargo = medida === 'largoPierna'
    const veredicto: Veredicto =
      Math.abs(exacta) < tolerancia
        ? 'bien'
        : diferencia < 0
          ? esLargo
            ? 'corta'
            : 'justa'
          : esLargo
            ? 'larga'
            : 'holgada'
    medidas.push({ medida, veredicto, diferencia })
  }
  return { talla: fila.talla, medidas, faltan }
}

export interface Recomendacion {
  mejor: string
  alternativa: string | null
}

/** Quedar justo molesta más que quedar holgado: cuenta el doble al elegir. */
const PESO_JUSTA = 2

/** La media por medida: una talla con menos medidas en la tabla no sale ganando por tener menos. */
function puntos(ajuste: Ajuste): number {
  const suma = ajuste.medidas.reduce(
    (total, { diferencia }) => total + (diferencia < 0 ? -diferencia * PESO_JUSTA : diferencia),
    0,
  )
  return suma / ajuste.medidas.length
}

/**
 * La talla de la tabla que mejor te queda y la siguiente mejor. `null` si no hay ninguna medida que
 * comparar (la tabla y el perfil no comparten ninguna).
 */
export function tallaRecomendada(
  tabla: TablaTallas,
  cuerpo: Cuerpo | undefined,
  prenda: PrendaAjuste = {},
): Recomendacion | null {
  const candidatas = tabla.filas
    .map((fila) => ajusteDeTalla(tabla, fila.talla, cuerpo, prenda))
    .filter((ajuste): ajuste is Ajuste => ajuste !== null && ajuste.medidas.length > 0)
    .map((ajuste, orden) => ({ talla: ajuste.talla, puntos: puntos(ajuste), orden }))
    // En empate, la mayor (las tablas van de menor a mayor): mejor holgada que justa.
    .sort((a, b) => a.puntos - b.puntos || b.orden - a.orden)
  const [mejor, segunda] = candidatas
  return mejor ? { mejor: mejor.talla, alternativa: segunda?.talla ?? null } : null
}

const NOMBRE: Record<MedidaAjuste, string> = {
  pecho: 'pecho',
  cintura: 'cintura',
  cadera: 'cadera',
  largoPierna: 'pierna',
}
const NOMBRE_CUERPO: Record<MedidaAjuste, string> = {
  pecho: 'tu pecho',
  cintura: 'tu cintura',
  cadera: 'tu cadera',
  largoPierna: 'tu largo de pierna',
}

const cm = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

// Espacio sin salto de línea: «−2 cm» no se parte en dos renglones.
const ESPACIO_FIJO = String.fromCharCode(0xa0)

function conSigno(diferencia: number): string {
  return `${diferencia < 0 ? '−' : '+'}${cm.format(Math.abs(diferencia))}${ESPACIO_FIJO}cm`
}

function enumerar(partes: string[]): string {
  return partes.length <= 1
    ? (partes[0] ?? '')
    : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1) ?? ''}`
}

/** «justa de cintura (−2 cm) y larga de pierna (+4 cm)», o «bien de cintura y de cadera». */
export function resumenAjuste(ajuste: Ajuste): string {
  const fuera = ajuste.medidas.filter((m) => m.veredicto !== 'bien')
  if (fuera.length === 0) {
    return `bien ${enumerar(ajuste.medidas.map((m) => `de ${NOMBRE[m.medida]}`))}`
  }
  return enumerar(
    fuera.map((m) => `${m.veredicto} de ${NOMBRE[m.medida]} (${conSigno(m.diferencia)})`),
  )
}

/**
 * La frase entera: «Con la 44: te quedará justa de cintura (−2 cm) y larga de pierna (+4 cm). Mejor la
 * 46.». Si no hay nada que comparar, `null`.
 */
export function textoAjuste(ajuste: Ajuste, recomendacion: Recomendacion | null): string | null {
  if (ajuste.medidas.length === 0) return null
  const mejor =
    recomendacion && recomendacion.mejor !== ajuste.talla ? ` Mejor la ${recomendacion.mejor}.` : ''
  return `Con la ${ajuste.talla}: te quedará ${resumenAjuste(ajuste)}.${mejor}`
}

/** «Según la tabla, tu talla es la 44 (o la 46).» */
export function textoRecomendacion({ mejor, alternativa }: Recomendacion): string {
  return `Según la tabla, tu talla es la ${mejor}${alternativa ? ` (o la ${alternativa})` : ''}.`
}

/** «Apunta tu cintura y tu largo de pierna en Perfil para saber cómo te queda.» */
export function textoFaltan(faltan: readonly MedidaAjuste[]): string {
  return `Apunta ${enumerar(faltan.map((m) => NOMBRE_CUERPO[m]))} en Perfil para saber cómo te queda.`
}

/** Las medidas que da la tabla (en alguna talla) y que tu perfil no tiene. */
export function medidasQueFaltan(tabla: TablaTallas, cuerpo: Cuerpo | undefined): MedidaAjuste[] {
  return MEDIDAS_AJUSTE.filter(
    (m) => tabla.filas.some((fila) => fila[m] !== undefined) && cuerpo?.[m] === undefined,
  )
}
