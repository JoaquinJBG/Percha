import type { Cuerpo, Oficina } from '../../datos/modelo.ts'
import type { PerfilParaOutfits } from '../../ia/tipos.ts'
import { tipoCuerpo, type PerfilReglas } from '../reglas/perfil.ts'
import { normalizar } from '../reglas/texto.ts'

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

/**
 * Rasgos de las notas que sirven para vestir. Las notas son texto libre y pueden llevar medidas en letra
 * o datos de salud: solo sale lo que está en esta lista, con su forma fija.
 */
const RASGOS: readonly [RegExp, string][] = [
  [/hombros? anchos?|espalda ancha/, 'hombros anchos'],
  [/hombros? estrechos?|espalda estrecha/, 'hombros estrechos'],
  [/muslos? (grandes?|anchos?|gruesos?)|piernas? (anchas?|gruesas?)/, 'muslo ancho'],
  [/piernas? largas?/, 'piernas largas'],
  [/piernas? cortas?/, 'piernas cortas'],
  [/(torso|tronco) largo/, 'torso largo'],
  [/(torso|tronco) corto/, 'torso corto'],
  [/brazos? largos?/, 'brazos largos'],
  [/brazos? cortos?/, 'brazos cortos'],
  [/cuello corto/, 'cuello corto'],
  [/cuello largo/, 'cuello largo'],
]

/**
 * El cuerpo que se manda a Gemini: altura, complexión (la del perfil o «grande» si las reglas lo ven
 * así) y los rasgos conocidos de las notas. Nunca el peso, el pecho, la cintura, la cadera, el largo de
 * pierna ni el resto de las notas: son datos personales que no hacen falta para vestir (T8.4).
 */
export function cuerpoParaIA(cuerpo: Cuerpo | undefined): string {
  if (!cuerpo) return ''
  const partes: string[] = []
  if (cuerpo.altura !== undefined) partes.push(`${numero.format(cuerpo.altura)} cm`)
  if (cuerpo.complexion) partes.push(`complexión ${cuerpo.complexion}`)
  else if (tipoCuerpo(cuerpo) === 'grande') partes.push('complexión grande')
  const notas = normalizar(cuerpo.notas ?? '')
  for (const [patron, rasgo] of RASGOS) if (patron.test(notas)) partes.push(rasgo)
  return partes.join(', ')
}

export function oficinaParaIA(oficina: Oficina | undefined): string {
  if (!oficina) return ''
  return `oficina ${oficina.tipo}${oficina.viernesCasual ? ', con viernes casual' : ''}`
}

/** Lo que va del perfil en la petición a Gemini, solo si lo hay. */
export function perfilParaIA(perfil: PerfilReglas | undefined): PerfilParaOutfits | undefined {
  const cuerpo = cuerpoParaIA(perfil?.cuerpo)
  const oficina = oficinaParaIA(perfil?.oficina)
  if (!cuerpo && !oficina) return undefined
  return { ...(cuerpo && { cuerpo }), ...(oficina && { oficina }) }
}
