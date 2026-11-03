import type { Temporada } from '../../datos/modelo.ts'
import type { TiempoHoy } from '../../tiempo/tipos.ts'

/** Por debajo de esta sensación media (°C) el outfit lleva abrigo; el mismo corte que «fresco». */
export const LIMITE_ABRIGO = 16

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
