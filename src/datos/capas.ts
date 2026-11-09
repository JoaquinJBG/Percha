import type { Capa, Categoria, Prenda } from './modelo.ts'

type DatosCapas = Pick<Prenda, 'categoria' | 'subcategoria'>

/** Solo las prendas de arriba tienen capas; lo de abajo, el calzado y los accesorios van en su ranura. */
export function llevaCapas(categoria: Categoria): boolean {
  return categoria === 'superior' || categoria === 'abrigo'
}

/** Minúsculas y sin tildes: «Cárdigan» y «cardigan» son lo mismo. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
}

/**
 * La tabla del §1.2 de `docs/investigacion/reglas-outfits.md`, de lo más concreto a lo más general.
 * Va en orden: «sobrecamisa» antes que «camisa», «chaqueta de punto» antes que «chaqueta»…
 */
const REGLAS: [RegExp, Capa[]][] = [
  [/sobrecamisa|overshirt|shacket/, ['media', 'exterior']],
  [/americana|blazer/, ['media', 'exterior']],
  [/(cazadora|chaqueta|chaqueton) (vaquer|denim)|trucker/, ['media', 'exterior']],
  [/chaleco de punto|chaleco punto/, ['media']],
  [/chaleco/, ['media', 'exterior']],
  [/cardigan|chaqueta de punto|rebeca/, ['media']],
  [/sudadera|hoodie|capucha/, ['media', 'exterior']],
  [/(jersey|sueter).*(grueso|ochos|pescador)/, ['media', 'exterior']],
  [/camiseta|tirantes|\btop\b|henley|termica|\bpolo\b/, ['base']],
  [
    /jersey|sueter|pullover|punto|merino|quarter|cuello alto|cuello vuelto|turtleneck/,
    ['base', 'media'],
  ],
  [/camisa.*lino/, ['base', 'media', 'exterior']],
  [/camisa/, ['base', 'media']],
  [
    /abrigo|gabardina|trench|chaqueton|parka|plumifero|anorak|bomber|harrington|cazadora|chaqueta|cortavientos|impermeable|field/,
    ['exterior'],
  ],
]

/** Los papeles que suele poder hacer una prenda, según su categoría y su tipo. */
export function capasPorDefecto({ categoria, subcategoria }: DatosCapas): Capa[] {
  if (!llevaCapas(categoria)) return []
  const tipo = normalizar(subcategoria)
  // Un cárdigan grueso también vale de exterior en días suaves.
  if (/cardigan|chaqueta de punto|rebeca/.test(tipo) && /grueso|gorda/.test(tipo)) {
    return ['media', 'exterior']
  }
  const regla = REGLAS.find(([patron]) => patron.test(tipo))
  if (regla) return [...regla[1]]
  return categoria === 'abrigo' ? ['exterior'] : ['base']
}

/**
 * Los papeles de la prenda: los guardados o, si no hay (prendas de antes de T6.1), los de por defecto.
 * Una lista vacía cuenta como que no hay: una prenda de arriba siempre hace algún papel.
 */
export function capasDe(prenda: DatosCapas & Pick<Prenda, 'capas'>): Capa[] {
  if (!llevaCapas(prenda.categoria)) return []
  return prenda.capas && prenda.capas.length > 0 ? prenda.capas : capasPorDefecto(prenda)
}
