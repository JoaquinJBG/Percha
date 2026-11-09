import type { Temporada } from '../../datos/modelo.ts'
import type { TiempoHoy } from '../../tiempo/tipos.ts'

/** Por debajo de esta sensación media (°C) el outfit lleva capa exterior sí o sí (§1.5). */
export const LIMITE_EXTERIOR = 14
/** Hasta aquí (°C, incluido) una media o una exterior ligera es una «tercera pieza» opcional (P3). */
export const LIMITE_TERCERA_PIEZA = 23

/** Sensación térmica media del día, redondeada; `null` sin tiempo o con datos rotos. */
export function temperaturaDe(tiempo: TiempoHoy | null): number | null {
  if (!tiempo) return null
  const media = (tiempo.sensacion.minima + tiempo.sensacion.maxima) / 2
  // `|| 0` quita el -0 que daría «-0 °C».
  return Number.isFinite(media) ? Math.round(media) || 0 : null
}

/** Nivel de abrigo (1–5) que pide la temperatura para la ropa de base. */
export function abrigoObjetivo(temperatura: number): number {
  if (temperatura >= 26) return 1
  if (temperatura >= 20) return 2
  if (temperatura >= 14) return 3
  if (temperatura >= 8) return 4
  return 5
}

const TEMPORADA_POR_MES: readonly Temporada[] = [
  'invierno',
  'invierno',
  'primavera',
  'primavera',
  'primavera',
  'verano',
  'verano',
  'verano',
  'otoño',
  'otoño',
  'otoño',
  'invierno',
]

const OPUESTA: Record<Temporada, Temporada> = {
  primavera: 'otoño',
  verano: 'invierno',
  otoño: 'primavera',
  invierno: 'verano',
}

/** Temporada meteorológica de una fecha `AAAA-MM-DD`; al sur del ecuador, la opuesta. */
export function temporadaDe(fecha: string | undefined, latitud = 0): Temporada | null {
  const mes = Number(/^\d{4}-(\d{2})-\d{2}/.exec(fecha ?? '')?.[1])
  const temporada = TEMPORADA_POR_MES[mes - 1]
  if (!temporada) return null
  return latitud < 0 ? OPUESTA[temporada] : temporada
}

export function temporadaOpuesta(temporada: Temporada): Temporada {
  return OPUESTA[temporada]
}

/**
 * Abrigo que pide la parte de arriba entera, como `[mínimo, máximo]` de `abrigoDeArriba`: la capa más
 * gruesa más uno por cada capa de más (tabla del §1.5 de la investigación).
 */
export function rangoArriba(temperatura: number): [number, number] {
  if (temperatura >= 26) return [1, 2]
  if (temperatura >= 22) return [1, 4]
  if (temperatura >= 18) return [2, 4]
  if (temperatura >= 14) return [3, 5]
  if (temperatura >= 9) return [4, 6]
  if (temperatura >= 4) return [5, 8]
  return [6, 9]
}

export function abrigoDeArriba(capas: readonly { abrigo: number }[]): number {
  if (capas.length === 0) return 0
  return Math.max(...capas.map((c) => c.abrigo)) + capas.length - 1
}
