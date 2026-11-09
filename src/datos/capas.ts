import type { Capa, Categoria, Prenda } from './modelo.ts'

type DatosCapas = Pick<Prenda, 'categoria' | 'subcategoria'>

/** Solo las prendas de arriba tienen capas; lo de abajo, el calzado y los accesorios van en su ranura. */
export function llevaCapas(categoria: Categoria): boolean {
  return categoria === 'superior' || categoria === 'abrigo'
}

/** Minúsculas, sin tildes y con un solo espacio: «Cárdigan  Grueso» y «cardigan grueso» son lo mismo. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim()
}

const GRUESO = /grues[oa]|gord[oa]|ochos|pescador/
const PUNTO = /cardigan|chaqueta de punto|rebeca/
const EXTERIOR =
  /abrigo|gabardina|trench|chaqueton|parka|plumifero|anorak|bomber|harrington|piel|cuero|\bante\b|cortavientos|impermeable|chubasquero|field|cazadora|chaqueta/

/** Las que valen igual en `superior` y en `abrigo`, por si la categoría no es la de siempre. */
const COMUNES: [RegExp, Capa[]][] = [
  [/sobrecamisa|overshirt|shacket/, ['media', 'exterior']],
  [/americana|blazer|chaqueta (de traje|sastre|de vestir)/, ['media', 'exterior']],
  [/(cazadora|chaqueta|chaqueton) (vaquer|tejan|de denim|denim)|trucker/, ['media', 'exterior']],
  [/chaleco de punto|chaleco punto/, ['media']],
]

/**
 * La tabla del §1.2 de `docs/investigacion/reglas-outfits.md`, de lo más concreto a lo más general:
 * «sobrecamisa» antes que «camisa», «chaqueta de punto» antes que «chaqueta»…
 */
function porTipo(categoria: 'superior' | 'abrigo', tipo: string): Capa[] {
  const comun = COMUNES.find(([patron]) => patron.test(tipo))
  if (comun) return comun[1]
  if (PUNTO.test(tipo)) return GRUESO.test(tipo) ? ['media', 'exterior'] : ['media']

  // Un abrigo va encima de otra cosa: nunca es base.
  if (categoria === 'abrigo') {
    if (tipo.includes('chaleco')) return ['media', 'exterior']
    if (EXTERIOR.test(tipo)) return ['exterior']
    if (/sudadera|hoodie|capucha|polar|jersey|punto/.test(tipo)) return ['media', 'exterior']
    return ['exterior']
  }

  // En `superior`, un chaleco es de punto: nunca va de exterior con frío.
  if (tipo.includes('chaleco')) return ['media']
  if (/sudadera|hoodie|capucha|polar/.test(tipo)) return ['media', 'exterior']
  if (/jersey|sueter|pullover/.test(tipo) && GRUESO.test(tipo)) return ['media', 'exterior']
  if (/camiseta|tirantes|\btop\b|henley|termica|\bpolo\b/.test(tipo)) return ['base']
  if (
    /jersey|sueter|pullover|punto|merino|quarter|cuello alto|cuello vuelto|turtleneck/.test(tipo)
  ) {
    return ['base', 'media']
  }
  if (tipo.includes('camisa')) {
    return tipo.includes('lino') ? ['base', 'media', 'exterior'] : ['base', 'media']
  }
  if (EXTERIOR.test(tipo)) return ['exterior']
  return ['base']
}

/** Los papeles que suele poder hacer una prenda, según su categoría y su tipo. */
export function capasPorDefecto({ categoria, subcategoria }: DatosCapas): Capa[] {
  if (categoria !== 'superior' && categoria !== 'abrigo') return []
  return [...porTipo(categoria, normalizar(subcategoria))]
}

/**
 * Los papeles de la prenda: los guardados o, si no hay (prendas de antes de T6.1), los de por defecto.
 * Una lista vacía cuenta como que no hay: una prenda de arriba siempre hace algún papel.
 */
export function capasDe(prenda: DatosCapas & Pick<Prenda, 'capas'>): Capa[] {
  if (!llevaCapas(prenda.categoria)) return []
  return prenda.capas && prenda.capas.length > 0 ? prenda.capas : capasPorDefecto(prenda)
}
