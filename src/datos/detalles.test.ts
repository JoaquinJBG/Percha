import { describe, expect, it } from 'vitest'
import { detallesQueAplican, resumenCorte, soloLosQueAplican } from './detalles.ts'
import { CORTES_CAMISA, CORTES_PANTALON, type Categoria } from './modelo.ts'

describe('detalles que aplican por tipo', () => {
  it.each<[Categoria, string, string[]]>([
    ['inferior', 'vaquero', ['corte', 'tiro', 'largo']],
    ['inferior', 'pantalón chino', ['corte', 'tiro', 'largo']],
    ['inferior', 'bermuda', ['corte', 'tiro']],
    ['inferior', 'Shorts', ['corte', 'tiro']],
    ['inferior', 'falda midi', []],
    ['superior', 'camiseta', ['corte', 'largo', 'manga']],
    ['superior', 'sudadera', ['corte', 'largo', 'manga']],
    ['superior', 'camisa', ['corte', 'manga', 'cuello']],
    ['superior', 'Camisa de lino', ['corte', 'manga', 'cuello']],
    ['superior', 'sobrecamisa', ['corte', 'manga', 'cuello']],
    ['abrigo', 'chaquetón', ['corte', 'largo']],
    ['vestido', 'vestido', []],
    ['calzado', 'zapatillas', []],
    ['accesorio', 'gorra', []],
  ])('%s «%s» → %j', (categoria, subcategoria, campos) => {
    expect(Object.keys(detallesQueAplican({ categoria, subcategoria }))).toEqual(campos)
  })

  it('cada tipo tiene su lista de cortes', () => {
    expect(detallesQueAplican({ categoria: 'inferior', subcategoria: 'vaquero' }).corte).toBe(
      CORTES_PANTALON,
    )
    expect(detallesQueAplican({ categoria: 'superior', subcategoria: 'camisa' }).corte).toBe(
      CORTES_CAMISA,
    )
  })
})

describe('solo los detalles que aplican', () => {
  it('quita lo que no vale para el tipo y deja las claves en undefined', () => {
    expect(
      soloLosQueAplican({
        categoria: 'inferior',
        subcategoria: 'vaquero',
        corte: 'balloon',
        tiro: 'alto',
        largo: 'medio muslo',
        manga: 'corta',
        cuello: 'mao',
      }),
    ).toEqual({
      corte: 'balloon',
      tiro: 'alto',
      largo: undefined,
      manga: undefined,
      cuello: undefined,
    })
  })

  it('un corte de otra lista no vale (boxy no es de camisa)', () => {
    expect(
      soloLosQueAplican({ categoria: 'superior', subcategoria: 'camisa', corte: 'boxy' }).corte,
    ).toBeUndefined()
  })

  it('en calzado no queda nada y con valores raros tampoco', () => {
    expect(
      Object.values(
        soloLosQueAplican({ categoria: 'calzado', subcategoria: 'bota', corte: 'slim' }),
      ),
    ).toEqual([undefined, undefined, undefined, undefined, undefined])
    expect(
      soloLosQueAplican({ categoria: 'inferior', subcategoria: 'vaquero', corte: 7 }).corte,
    ).toBeUndefined()
  })
})

describe('resumen de corte', () => {
  it('marca, corte y talla con puntos; sin huecos si falta algo', () => {
    expect(resumenCorte({ marca: 'Zara', corte: 'balloon', talla: '44' })).toBe(
      'Zara · balloon · 44',
    )
    expect(resumenCorte({ corte: 'slim' })).toBe('slim')
    expect(resumenCorte({})).toBe('')
  })
})
