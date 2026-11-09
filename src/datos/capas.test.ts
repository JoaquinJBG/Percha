import { describe, expect, it } from 'vitest'
import { capasDe, capasPorDefecto } from './capas.ts'
import { capasSchema, type Capa, type Categoria } from './modelo.ts'

describe('capas por defecto (tabla §1.2)', () => {
  it.each<[Categoria, string, Capa[]]>([
    ['superior', 'camiseta', ['base']],
    ['superior', 'camiseta de tirantes', ['base']],
    ['superior', 'Camiseta térmica', ['base']],
    ['superior', 'polo de punto', ['base']],
    ['superior', 'henley', ['base']],
    ['superior', 'camisa', ['base', 'media']],
    ['superior', 'camisa oxford', ['base', 'media']],
    ['superior', 'camisa vaquera', ['base', 'media']],
    ['superior', 'camisa de lino', ['base', 'media', 'exterior']],
    ['superior', 'jersey', ['base', 'media']],
    ['superior', 'jersey de cuello alto', ['base', 'media']],
    ['superior', 'jersey grueso de ochos', ['media', 'exterior']],
    ['superior', 'cárdigan', ['media']],
    ['superior', 'cardigan grueso', ['media', 'exterior']],
    ['superior', 'chaqueta de punto', ['media']],
    ['superior', 'sudadera con capucha', ['media', 'exterior']],
    ['superior', 'chaleco de punto', ['media']],
    ['superior', 'sobrecamisa', ['media', 'exterior']],
    ['superior', '', ['base']],
    ['superior', 'algo raro', ['base']],
    ['abrigo', 'sobrecamisa', ['media', 'exterior']],
    ['abrigo', 'Shacket', ['media', 'exterior']],
    ['abrigo', 'americana', ['media', 'exterior']],
    ['abrigo', 'blazer', ['media', 'exterior']],
    ['abrigo', 'cazadora vaquera', ['media', 'exterior']],
    ['abrigo', 'chaleco acolchado', ['media', 'exterior']],
    ['abrigo', 'cazadora de piel', ['exterior']],
    ['abrigo', 'bomber', ['exterior']],
    ['abrigo', 'abrigo de paño', ['exterior']],
    ['abrigo', 'chaquetón', ['exterior']],
    ['abrigo', 'gabardina', ['exterior']],
    ['abrigo', 'plumífero', ['exterior']],
    ['abrigo', '', ['exterior']],
    // Casos de la autorevisión: abrigos que no son base, femeninos, sinónimos y espacios.
    ['abrigo', 'parka con capucha', ['exterior']],
    ['abrigo', 'abrigo de punto', ['exterior']],
    ['abrigo', 'chaqueta térmica', ['exterior']],
    ['abrigo', 'chaqueta de traje', ['media', 'exterior']],
    ['abrigo', 'chaqueta  tejana', ['media', 'exterior']],
    ['abrigo', 'cazadora de denim', ['media', 'exterior']],
    ['abrigo', 'chaleco de plumas', ['media', 'exterior']],
    ['abrigo', 'forro polar', ['media', 'exterior']],
    ['superior', 'chaleco', ['media']],
    ['superior', 'chaleco de lana', ['media']],
    ['superior', 'rebeca gruesa', ['media', 'exterior']],
    ['superior', 'chaqueta de punto gruesa', ['media', 'exterior']],
    ['superior', 'jersey de lana gruesa', ['media', 'exterior']],
    ['superior', 'jersey gordo', ['media', 'exterior']],
    ['superior', 'forro polar', ['media', 'exterior']],
    ['superior', 'cazadora', ['exterior']],
  ])('%s «%s» → %j', (categoria, subcategoria, capas) => {
    expect(capasPorDefecto({ categoria, subcategoria })).toEqual(capas)
  })

  it.each<Categoria>(['inferior', 'vestido', 'calzado', 'accesorio'])(
    '%s no lleva capas',
    (categoria) => {
      expect(capasPorDefecto({ categoria, subcategoria: 'camisa' })).toEqual([])
    },
  )
})

describe('capas de una prenda', () => {
  it('usa las guardadas si las hay', () => {
    expect(
      capasDe({ categoria: 'superior', subcategoria: 'camiseta', capas: ['exterior'] }),
    ).toEqual(['exterior'])
  })

  it('sin capas guardadas (prendas de antes) o con la lista vacía, las de por defecto', () => {
    expect(capasDe({ categoria: 'abrigo', subcategoria: 'sobrecamisa' })).toEqual([
      'media',
      'exterior',
    ])
    expect(capasDe({ categoria: 'superior', subcategoria: 'camisa', capas: [] })).toEqual([
      'base',
      'media',
    ])
  })

  it('lo que no es de arriba no tiene capas aunque se hayan guardado', () => {
    expect(capasDe({ categoria: 'inferior', subcategoria: 'vaquero', capas: ['base'] })).toEqual([])
  })

  it('el esquema las deja sin repetidos y de dentro afuera', () => {
    expect(capasSchema.parse(['exterior', 'base', 'exterior'])).toEqual(['base', 'exterior'])
  })
})
