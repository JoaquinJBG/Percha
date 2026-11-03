import { describe, expect, it } from 'vitest'
import { armonia, esEstampada, esNeutro, familiaColor } from './colores.ts'
import { prenda } from './pruebas.ts'

describe('colores', () => {
  it.each(['negro', 'Blanco roto', 'azul marino', 'gris claro', 'marrón', 'verde caqui', 'Beige '])(
    '%s es neutro',
    (color) => {
      expect(esNeutro(color)).toBe(true)
    },
  )

  it.each(['rojo', 'azul', 'verde oliva', 'rosa palo'])('%s no es neutro', (color) => {
    expect(esNeutro(color)).toBe(false)
  })

  it('agrupa los tonos de un mismo color', () => {
    expect(familiaColor('Azul claro')).toBe('azul')
    expect(familiaColor('azul')).toBe('azul')
    expect(familiaColor('azul marino')).toBeNull()
  })

  it('liso, vacío o «sin estampado» no es estampado', () => {
    expect(esEstampada({ estampado: '' })).toBe(false)
    expect(esEstampada({ estampado: 'Liso' })).toBe(false)
    expect(esEstampada({ estampado: 'sin estampado' })).toBe(false)
    expect(esEstampada({ estampado: 'rayas' })).toBe(true)
  })
})

describe('armonia', () => {
  it('los neutros van con todo', () => {
    const resultado = armonia([prenda({ colores: ['negro'] }), prenda({ colores: ['beige'] })])
    expect(resultado).toEqual({ combina: true, colorFuerte: null })
  })

  it('un color fuerte con neutros combina', () => {
    const resultado = armonia([prenda({ colores: ['rojo'] }), prenda({ colores: ['gris'] })])
    expect(resultado).toEqual({ combina: true, colorFuerte: 'rojo' })
  })

  it('dos tonos del mismo color combinan', () => {
    expect(
      armonia([prenda({ colores: ['azul'] }), prenda({ colores: ['azul claro'] })]).combina,
    ).toBe(true)
  })

  it('dos colores fuertes no combinan', () => {
    expect(armonia([prenda({ colores: ['rojo'] }), prenda({ colores: ['verde'] })]).combina).toBe(
      false,
    )
  })

  it('el vaquero cuenta como neutro aunque sea azul', () => {
    const vaqueros = prenda({ categoria: 'inferior', subcategoria: 'Vaqueros', colores: ['azul'] })
    expect(armonia([prenda({ colores: ['rojo'] }), vaqueros]).combina).toBe(true)
  })

  it('dos estampados no combinan', () => {
    const rayas = prenda({ estampado: 'rayas' })
    const cuadros = prenda({ categoria: 'inferior', estampado: 'cuadros' })
    expect(armonia([rayas, cuadros]).combina).toBe(false)
    expect(armonia([rayas, prenda({ categoria: 'inferior' })]).combina).toBe(true)
  })
})

describe('prendas de varios colores', () => {
  const flores = prenda({ colores: ['rojo', 'verde'], estampado: 'flores' })

  it('una estampada de varios colores combina con neutros', () => {
    const vaqueros = prenda({ categoria: 'inferior', subcategoria: 'vaqueros', colores: ['azul'] })
    expect(armonia([flores, vaqueros, prenda({ categoria: 'calzado' })]).combina).toBe(true)
  })

  it('el resto puede repetir uno de sus colores, pero no traer otro', () => {
    const falda = (color: string) => prenda({ categoria: 'inferior', colores: [color] })
    expect(armonia([flores, falda('rojo')]).combina).toBe(true)
    expect(armonia([flores, falda('azul')]).combina).toBe(false)
  })

  it('celeste y azul son el mismo color', () => {
    expect(familiaColor('Celeste')).toBe('azul')
    expect(armonia([prenda({ colores: ['celeste'] }), prenda({ colores: ['azul'] })]).combina).toBe(
      true,
    )
  })

  it('«Unicolor», «sólido» o «Liso.» no son estampado', () => {
    for (const estampado of ['Unicolor', 'sólido', 'Liso.']) {
      expect(esEstampada({ estampado })).toBe(false)
    }
  })
})
