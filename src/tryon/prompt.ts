import type { Categoria, Prenda } from '../datos/modelo.ts'

export type EtiquetasTryOn = Pick<Prenda, 'categoria' | 'subcategoria' | 'colores' | 'estampado'>

/** De arriba abajo, como se lleva puesto: así la columna de la imagen se lee igual que el prompt. */
const ORDEN: readonly Categoria[] = [
  'abrigo',
  'superior',
  'vestido',
  'inferior',
  'calzado',
  'accesorio',
]

const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  superior: 'prenda de arriba',
  inferior: 'prenda de abajo',
  vestido: 'vestido',
  abrigo: 'abrigo',
  calzado: 'calzado',
  accesorio: 'accesorio',
}

/** Estampados que se dicen con «de»: «de rayas». El resto, «con estampado …». */
const ESTAMPADO_CON_DE = new Set(['rayas', 'cuadros', 'lunares', 'flores', 'camuflaje'])
const SIN_ESTAMPADO = new Set(['', 'liso', 'otro'])

export function ordenarPrendas<T extends Pick<Prenda, 'categoria'>>(prendas: readonly T[]): T[] {
  return [...prendas].sort((a, b) => ORDEN.indexOf(a.categoria) - ORDEN.indexOf(b.categoria))
}

function enumerar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1) ?? ''}`
}

/**
 * La prenda en pocas palabras para el prompt: «camiseta de color verde y blanco, de rayas». El color va
 * con «de color» para no tener que concordar el género con la prenda.
 */
export function describirPrenda(prenda: EtiquetasTryOn): string {
  let texto = prenda.subcategoria.trim() || NOMBRE_CATEGORIA[prenda.categoria]
  const colores = prenda.colores.map((c) => c.trim()).filter(Boolean)
  if (colores.length > 0) texto += ` de color ${enumerar(colores)}`
  const estampado = prenda.estampado.trim().toLocaleLowerCase('es')
  if (!SIN_ESTAMPADO.has(estampado)) {
    const dicho = estampado.replaceAll(' / ', ' o ')
    if (colores.length > 0) texto += ','
    texto += ESTAMPADO_CON_DE.has(estampado) ? ` de ${dicho}` : ` con estampado ${dicho}`
  }
  return texto
}

/**
 * Prompt del *try-on* para la imagen compuesta (variante D de S3): va en primera persona porque lo envía
 * el propio usuario desde su cuenta de Gemini. Las prendas, en el orden de la columna de la imagen.
 */
export function promptTryOn(prendas: readonly EtiquetasTryOn[]): string {
  const lista = prendas.map(describirPrenda).join('; ')
  const cuantas =
    prendas.length === 1 ? 'una prenda de ropa' : `${String(prendas.length)} prendas de ropa`
  return [
    `Te paso una imagen: a la izquierda estoy yo y a la derecha, en columna y de arriba abajo, ${cuantas}: ${lista}.`,
    '',
    'Crea una imagen fotorrealista de mí llevando puesto este outfit completo.',
    '- Mantén mi cara, mi pelo, mi tono de piel, mi cuerpo y mis proporciones exactamente como en la foto: no cambies mis rasgos, mi edad, mi altura ni mi talla.',
    '- Copia cada prenda tal cual: color, estampado, tejido, largo y corte. No añadas otras prendas ni accesorios; si falta alguna parte (por ejemplo, el calzado), elige algo sencillo y neutro que combine.',
    '- Plano de cuerpo entero, de pie y de frente, con luz natural y fondo liso claro.',
    '- Sin texto ni marcas de agua.',
  ].join('\n')
}
