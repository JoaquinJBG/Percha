import { MEDIDAS, type Medida, type Perfil } from './modelo.ts'

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

const NOMBRE_MEDIDA: Record<Medida, string> = {
  altura: 'altura',
  peso: 'peso',
  pecho: 'pecho',
  cintura: 'cintura',
  cadera: 'cadera',
  largoPierna: 'largo de pierna',
}

function conUnidad(medida: Medida, valor: number): string {
  return `${numero.format(valor)} ${MEDIDAS[medida].unidad}`
}

/**
 * El cuerpo en una línea corta para un prompt: «176 cm, 100 kg, complexión grande, hombros anchos».
 * Vacía si el perfil no tiene nada del cuerpo. No se manda a ningún sitio: lo decide T8.4.
 */
export function resumenCuerpo({ cuerpo }: Pick<Perfil, 'cuerpo'>): string {
  if (!cuerpo) return ''
  const partes: string[] = []
  if (cuerpo.altura !== undefined) partes.push(conUnidad('altura', cuerpo.altura))
  if (cuerpo.peso !== undefined) partes.push(conUnidad('peso', cuerpo.peso))
  if (cuerpo.complexion) partes.push(`complexión ${cuerpo.complexion}`)
  for (const medida of ['pecho', 'cintura', 'cadera', 'largoPierna'] as const) {
    const valor = cuerpo[medida]
    if (valor !== undefined) partes.push(`${NOMBRE_MEDIDA[medida]} ${conUnidad(medida, valor)}`)
  }
  const notas = cuerpo.notas?.trim()
  if (notas) partes.push(notas)
  return partes.join(', ')
}
