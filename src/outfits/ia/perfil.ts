import type { Cuerpo, Oficina } from '../../datos/modelo.ts'
import type { PerfilParaOutfits } from '../../ia/tipos.ts'
import type { PerfilReglas } from '../reglas/perfil.ts'

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

/**
 * El cuerpo que se manda a Gemini: altura, complexión y la línea de notas sin cifras. Nunca el peso ni
 * el pecho, la cintura, la cadera o el largo de pierna: son datos personales que no hacen falta para
 * vestir (T8.4). Vacío si no hay nada.
 */
export function cuerpoParaIA(cuerpo: Cuerpo | undefined): string {
  if (!cuerpo) return ''
  const partes: string[] = []
  if (cuerpo.altura !== undefined) partes.push(`${numero.format(cuerpo.altura)} cm`)
  if (cuerpo.complexion) partes.push(`complexión ${cuerpo.complexion}`)
  // Cada trozo de la nota con una cifra fuera entero: «pecho 112» no deja «pecho» suelto.
  const notas = (cuerpo.notas ?? '')
    .split(/[,;.]/)
    .map((trozo) => trozo.replace(/\s+/g, ' ').trim())
    .filter((trozo) => trozo !== '' && !/\d/.test(trozo))
  partes.push(...notas)
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
