import type { Cuerpo, Oficina, Perfil, SensacionTermica } from '../../datos/modelo.ts'
import { normalizar } from './texto.ts'

/** Lo que miran las reglas del perfil: el cuerpo, la oficina y la sensación térmica (T8.2). */
export type PerfilReglas = Partial<Pick<Perfil, 'cuerpo' | 'oficina' | 'sensacionTermica'>>

/**
 * Grados que se suman a la sensación térmica para decidir la ropa. Un caluroso viste como si hiciera
 * 2 °C más (los límites de exterior, tercera pieza y punto grueso le bajan 2 °C); un friolero, 2 °C menos.
 */
export function ajusteTermico(sensacion: SensacionTermica | undefined): number {
  if (sensacion === 'caluroso') return 2
  if (sensacion === 'friolero') return -2
  return 0
}

/** `grande`: las reglas B1–B11 de la investigación (§6); `otro`: solo las de silueta. */
export type TipoCuerpo = 'grande' | 'otro'

const ANCHO = /hombros? anchos?|espalda ancha|corpulent|grande|fuerte/
/** Índice de masa corporal a partir del cual cuentan las reglas de cuerpo grande. */
const IMC_GRANDE = 28

/** `null` si el perfil no dice nada del cuerpo: entonces no se aplica ninguna regla de cuerpo. */
export function tipoCuerpo(cuerpo: Cuerpo | undefined): TipoCuerpo | null {
  if (!cuerpo) return null
  const { altura, peso, complexion, notas } = cuerpo
  const hayAlgo = altura !== undefined || peso !== undefined || complexion !== undefined || !!notas
  if (!hayAlgo) return null
  if (complexion === 'grande' || complexion === 'atlética') return 'grande'
  if (notas && ANCHO.test(normalizar(notas))) return 'grande'
  if (altura !== undefined && peso !== undefined && peso / (altura / 100) ** 2 >= IMC_GRANDE) {
    return 'grande'
  }
  return 'otro'
}

/** El viernes de una fecha `AAAA-MM-DD`, sin depender de la zona horaria del móvil. */
function esViernes(fecha: string | undefined): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? '')
  if (!partes) return false
  const [, a, m, d] = partes.map(Number)
  return new Date(Date.UTC(a ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay() === 5
}

/**
 * Formalidad para «trabajo» según la oficina (§5 de la investigación): conservadora 4–5, estándar 3–4 y
 * creativa 2–3. El viernes casual baja un punto. Sin oficina, `null`: se queda la de siempre.
 */
export function formalidadTrabajo(
  oficina: Oficina | undefined,
  fecha: string | undefined,
): { minima: number; maxima: number } | null {
  if (!oficina) return null
  const base = { conservadora: 4, estándar: 3, creativa: 2 }[oficina.tipo]
  const minima = oficina.viernesCasual && esViernes(fecha) ? Math.max(base - 1, 2) : base
  return { minima, maxima: minima + 1 }
}
