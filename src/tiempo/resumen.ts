import type { Precipitacion, Termico, TiempoHoy } from './tipos.ts'

// Umbrales pensados para elegir ropa, sobre la sensación térmica media del día.
const LIMITE_FRIO = 10
const LIMITE_FRESCO = 16
const LIMITE_CALOR = 24
const PROBABILIDAD_LLUVIA = 50
const CANTIDAD_LLUVIA_MM = 1
const VIENTO_KMH = 35

// Códigos WMO de nieve: 71-77 nevadas y granizo de nieve, 85-86 chubascos de nieve.
const CODIGOS_NIEVE = new Set([71, 73, 75, 77, 85, 86])

const NOMBRE_TERMICO: Record<Termico, string> = {
  frio: 'frío',
  fresco: 'fresco',
  templado: 'templado',
  calor: 'calor',
}

type Medidas = Pick<TiempoHoy, 'sensacion' | 'lluvia' | 'viento' | 'codigo'>

export function clasificar(medidas: Medidas): TiempoHoy['clima'] {
  const media = (medidas.sensacion.minima + medidas.sensacion.maxima) / 2
  const termico: Termico =
    media < LIMITE_FRIO
      ? 'frio'
      : media < LIMITE_FRESCO
        ? 'fresco'
        : media < LIMITE_CALOR
          ? 'templado'
          : 'calor'

  const llueve =
    (medidas.lluvia.probabilidad ?? 0) >= PROBABILIDAD_LLUVIA ||
    medidas.lluvia.cantidad >= CANTIDAD_LLUVIA_MM
  let precipitacion: Precipitacion | null = null
  if (CODIGOS_NIEVE.has(medidas.codigo)) precipitacion = 'nieve'
  else if (llueve) precipitacion = 'lluvia'

  return { termico, precipitacion, viento: medidas.viento.maximo >= VIENTO_KMH }
}

export function resumir(clima: TiempoHoy['clima']): string {
  const partes = [NOMBRE_TERMICO[clima.termico]]
  if (clima.precipitacion) partes.push(clima.precipitacion)
  if (clima.viento) partes.push('viento')
  if (partes.length === 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1) ?? ''}`
}
