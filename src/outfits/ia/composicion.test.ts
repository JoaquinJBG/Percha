import { describe, expect, it } from 'vitest'
import type { PrendaReglas } from '../reglas/index.ts'
import { prenda } from '../reglas/pruebas.ts'
import { comprobarConCapas, type Hoy } from './composicion.ts'

const armario = [
  prenda({ id: 'camiseta', subcategoria: 'camiseta' }),
  prenda({ id: 'polo', subcategoria: 'polo' }),
  prenda({ id: 'camisa', subcategoria: 'camisa oxford' }),
  prenda({ id: 'jersey', subcategoria: 'jersey de merino', abrigo: 3 }),
  prenda({ id: 'cardigan', subcategoria: 'cárdigan', abrigo: 3 }),
  prenda({ id: 'sobrecamisa', categoria: 'abrigo', subcategoria: 'sobrecamisa', abrigo: 3 }),
  prenda({ id: 'americana', categoria: 'abrigo', subcategoria: 'americana', abrigo: 3 }),
  prenda({ id: 'abrigo', categoria: 'abrigo', subcategoria: 'abrigo de paño', abrigo: 5 }),
  prenda({ id: 'gabardina', categoria: 'abrigo', subcategoria: 'gabardina', abrigo: 4 }),
  prenda({ id: 'chinos', categoria: 'inferior', subcategoria: 'chinos' }),
  prenda({ id: 'vestido', categoria: 'vestido', subcategoria: 'vestido midi' }),
  prenda({ id: 'botas', categoria: 'calzado', subcategoria: 'botas' }),
  prenda({ id: 'reloj', categoria: 'accesorio', subcategoria: 'reloj' }),
  prenda({ id: 'bufanda', categoria: 'accesorio', subcategoria: 'bufanda' }),
  prenda({ id: 'cinturon', categoria: 'accesorio', subcategoria: 'cinturón' }),
]
const frio: Hoy = { exterior: 'obligatoria', temperatura: 8 }
const muchoFrio: Hoy = { exterior: 'obligatoria', temperatura: 2 }
const templado: Hoy = { exterior: 'opcional', temperatura: 19 }
const calor: Hoy = { exterior: 'no', temperatura: 28 }

function comprobar(
  lista: readonly string[],
  hoy: Hoy,
  enviadas: readonly PrendaReglas[] = armario,
) {
  return comprobarConCapas(lista, enviadas, hoy)
}

/** Los ids en el orden devuelto, o el error. */
function ids(resultado: ReturnType<typeof comprobar>): string[] | string {
  return 'error' in resultado ? resultado.error : resultado.prendas.map((p) => p.id)
}

describe('comprobar un outfit con capas', () => {
  it('acepta camiseta + sobrecamisa + abrigo con frío, de dentro afuera', () => {
    const resultado = comprobar(['abrigo', 'botas', 'sobrecamisa', 'chinos', 'camiseta'], frio)

    expect(ids(resultado)).toEqual(['camiseta', 'chinos', 'sobrecamisa', 'abrigo', 'botas'])
    expect('principal' in resultado && resultado.principal.id).toBe('camiseta')
  })

  it('con mucho frío acepta 4 capas, dos de arriba y dos abrigos, y dos accesorios: 8 prendas', () => {
    const resultado = comprobar(
      ['camisa', 'jersey', 'sobrecamisa', 'abrigo', 'chinos', 'botas', 'reloj', 'bufanda'],
      muchoFrio,
    )

    expect(ids(resultado)).toEqual([
      'camisa',
      'jersey',
      'chinos',
      'sobrecamisa',
      'abrigo',
      'botas',
      'reloj',
      'bufanda',
    ])
  })

  it('acepta americana bajo abrigo (media + exterior)', () => {
    expect(ids(comprobar(['camisa', 'americana', 'abrigo', 'chinos', 'botas'], frio))).toEqual([
      'camisa',
      'chinos',
      'americana',
      'abrigo',
      'botas',
    ])
  })

  it('una tercera pieza entre 14 y 23 °C es opcional: vale con y sin ella', () => {
    expect(ids(comprobar(['camiseta', 'sobrecamisa', 'chinos', 'botas'], templado))).toHaveLength(4)
    expect(ids(comprobar(['camiseta', 'chinos', 'botas'], templado))).toHaveLength(3)
  })

  it('un vestido hace de base y admite un cárdigan encima', () => {
    const resultado = comprobar(['cardigan', 'vestido', 'botas'], templado)

    expect('principal' in resultado && resultado.principal.id).toBe('vestido')
  })

  it.each<[string, string[], Hoy, string]>([
    [
      'tres de arriba',
      ['camiseta', 'camisa', 'jersey', 'chinos', 'botas'],
      frio,
      'más de dos partes',
    ],
    [
      'tres abrigos',
      ['camiseta', 'sobrecamisa', 'americana', 'abrigo', 'chinos', 'botas'],
      muchoFrio,
      'más de dos abrigos',
    ],
    [
      'cuatro capas sin mucho frío',
      ['camisa', 'jersey', 'sobrecamisa', 'abrigo', 'chinos', 'botas'],
      frio,
      'más de 3 capas',
    ],
    [
      'tres capas con calor',
      ['camiseta', 'camisa', 'sobrecamisa', 'chinos', 'botas'],
      calor,
      'más de 2 capas',
    ],
    ['dos bases', ['camiseta', 'polo', 'chinos', 'botas'], templado, 'las capas no encajan'],
    [
      'dos exteriores',
      ['camiseta', 'gabardina', 'abrigo', 'chinos', 'botas'],
      frio,
      'las capas no encajan',
    ],
    ['sin exterior con frío', ['camiseta', 'jersey', 'chinos', 'botas'], frio, 'falta la exterior'],
    ['sin base', ['sobrecamisa', 'chinos', 'botas'], templado, 'las capas no encajan'],
    ['sin nada arriba', ['chinos', 'botas'], templado, 'necesita una parte de arriba'],
    ['sin calzado', ['camiseta', 'chinos'], templado, 'necesita un calzado'],
    [
      'tres accesorios',
      ['camiseta', 'chinos', 'botas', 'reloj', 'bufanda', 'cinturon'],
      templado,
      'más de dos accesorios',
    ],
    ['vestido y pantalón', ['vestido', 'chinos', 'botas'], templado, 'algo de abajo o un vestido'],
    ['una prenda repetida', ['camiseta', 'camiseta', 'chinos', 'botas'], templado, 'repite'],
    ['un id inventado', ['camiseta', 'inventada', 'chinos', 'botas'], templado, 'no está entre'],
  ])('rechaza %s', (_, lista, hoy, error) => {
    expect(ids(comprobar(lista, hoy))).toContain(error)
  })

  it('sin ninguna exterior entre las enviadas no la exige', () => {
    const sinExterior = armario.filter((p) => p.categoria !== 'abrigo')

    expect(ids(comprobar(['camiseta', 'chinos', 'botas'], frio, sinExterior))).toHaveLength(3)
  })

  it('usa las capas guardadas antes que las de por defecto', () => {
    const soloMedia = {
      ...prenda({ id: 'camisa-media', subcategoria: 'camisa' }),
      capas: ['media'],
    }

    expect(
      ids(comprobar(['camisa-media', 'chinos', 'botas'], templado, [...armario, soloMedia])),
    ).toContain('las capas no encajan')
  })
})
