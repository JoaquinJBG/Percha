import type { Ocasion } from '../../datos/modelo.ts'

/** Formalidad (1–5) que pide cada ocasión. */
export const FORMALIDAD_POR_OCASION: Record<Ocasion, { minima: number; maxima: number }> = {
  casa: { minima: 1, maxima: 2 },
  deporte: { minima: 1, maxima: 2 },
  'playa / piscina': { minima: 1, maxima: 2 },
  diario: { minima: 1, maxima: 3 },
  viaje: { minima: 1, maxima: 3 },
  cita: { minima: 2, maxima: 4 },
  cena: { minima: 2, maxima: 4 },
  trabajo: { minima: 2, maxima: 4 },
  'fiesta / noche': { minima: 2, maxima: 5 },
  'evento formal': { minima: 4, maxima: 5 },
  boda: { minima: 4, maxima: 5 },
}

/** Cuánto se sale una formalidad del rango: 0 si cae dentro. */
export function distanciaFormalidad(
  formalidad: number,
  { minima, maxima }: { minima: number; maxima: number },
): number {
  if (formalidad < minima) return minima - formalidad
  if (formalidad > maxima) return formalidad - maxima
  return 0
}

export function nombreFormalidad(formalidad: number): string {
  if (formalidad >= 4) return 'formal'
  if (formalidad >= 3) return 'arreglado'
  return 'informal'
}
