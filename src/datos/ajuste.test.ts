import { describe, expect, it } from 'vitest'
import {
  ajusteDeTalla,
  medidasQueFaltan,
  tallaRecomendada,
  textoAjuste,
  textoFaltan,
  textoRecomendacion,
} from './ajuste.ts'
import { idTablaTallas, type Cuerpo, type TablaTallas } from './modelo.ts'

function tabla(cambios: Partial<TablaTallas> = {}): TablaTallas {
  return {
    id: idTablaTallas('Zara', 'pantalón'),
    marca: 'Zara',
    tipo: 'pantalón',
    medidaDe: 'cuerpo',
    filas: [
      { talla: '42', cintura: 82, cadera: 100, largoPierna: 82 },
      { talla: '44', cintura: 86, cadera: 104, largoPierna: 84 },
      { talla: '46', cintura: 90, cadera: 108, largoPierna: 86 },
    ],
    actualizadaEn: 1,
    ...cambios,
  }
}

const cuerpo: Cuerpo = { cintura: 88, cadera: 104, largoPierna: 80 }

describe('ajuste de una talla con una tabla del cuerpo', () => {
  it('compara cada medida con la tuya, con la diferencia en cm', () => {
    expect(ajusteDeTalla(tabla(), '44', cuerpo)).toEqual({
      talla: '44',
      medidas: [
        { medida: 'cintura', veredicto: 'justa', diferencia: -2 },
        { medida: 'cadera', veredicto: 'bien', diferencia: 0 },
        { medida: 'largoPierna', veredicto: 'larga', diferencia: 4 },
      ],
      faltan: [],
    })
  })

  it('menos de 2 cm es «bien»; holgada y corta a partir de ahí', () => {
    const ajuste = ajusteDeTalla(tabla(), '46', { cintura: 88.5, cadera: 104, largoPierna: 90 })

    expect(ajuste?.medidas.map((m) => [m.medida, m.veredicto, m.diferencia])).toEqual([
      ['cintura', 'bien', 1.5],
      ['cadera', 'holgada', 4],
      ['largoPierna', 'corta', -4],
    ])
  })

  it('la talla se busca sin mayúsculas ni espacios; si no está, null', () => {
    const conLetras = tabla({ filas: [{ talla: 'M', pecho: 100 }] })
    expect(ajusteDeTalla(conLetras, ' m ', { pecho: 100 })?.talla).toBe('M')
    expect(ajusteDeTalla(tabla(), '48', cuerpo)).toBeNull()
  })

  it('apunta las medidas que la tabla da y tu perfil no tiene', () => {
    expect(ajusteDeTalla(tabla(), '44', { cintura: 86 })).toMatchObject({
      medidas: [{ medida: 'cintura', veredicto: 'bien' }],
      faltan: ['cadera', 'largoPierna'],
    })
    expect(ajusteDeTalla(tabla(), '44', undefined)?.faltan).toEqual([
      'cintura',
      'cadera',
      'largoPierna',
    ])
    expect(medidasQueFaltan(tabla(), { cadera: 100 })).toEqual(['cintura', 'largoPierna'])
  })
})

describe('ajuste con una tabla de la prenda', () => {
  const prenda = tabla({
    medidaDe: 'prenda',
    filas: [{ talla: 'M', pecho: 108, cintura: 90, largoPierna: 76 }],
  })

  it('descuenta la holgura del corte: un slim de pecho 108 a un pecho de 100 queda bien', () => {
    const slim = ajusteDeTalla(prenda, 'M', { pecho: 100 }, { corte: 'slim' })
    const oversize = ajusteDeTalla(prenda, 'M', { pecho: 100 }, { corte: 'oversize' })

    expect(slim?.medidas[0]).toEqual({ medida: 'pecho', veredicto: 'holgada', diferencia: 4 })
    expect(oversize?.medidas[0]).toEqual({ medida: 'pecho', veredicto: 'justa', diferencia: -10 })
  })

  it('sin corte se toma regular; la cintura de un pantalón ancho sigue sujeta', () => {
    expect(ajusteDeTalla(prenda, 'M', { pecho: 100 })?.medidas[0]?.veredicto).toBe('bien')
    expect(
      ajusteDeTalla(prenda, 'M', { cintura: 86 }, { corte: 'baggy' })?.medidas[0]?.veredicto,
    ).toBe('bien')
  })

  it('un tobillero se espera más corto que la pierna', () => {
    expect(
      ajusteDeTalla(prenda, 'M', { largoPierna: 83 }, { largo: 'tobillero' })?.medidas[0],
    ).toEqual({ medida: 'largoPierna', veredicto: 'bien', diferencia: 0 })
    expect(ajusteDeTalla(prenda, 'M', { largoPierna: 83 })?.medidas[0]?.veredicto).toBe('corta')
  })
})

describe('talla recomendada', () => {
  it('elige la que mejor queda, con la siguiente de alternativa; justa pesa más', () => {
    expect(tallaRecomendada(tabla(), { cintura: 88, cadera: 106, largoPierna: 85 })).toEqual({
      mejor: '46',
      alternativa: '44',
    })
  })

  it('sin medidas en común, null; con una sola talla, sin alternativa', () => {
    expect(tallaRecomendada(tabla(), { pecho: 100 })).toBeNull()
    expect(tallaRecomendada(tabla({ filas: [{ talla: 'U', cintura: 80 }] }), cuerpo)).toEqual({
      mejor: 'U',
      alternativa: null,
    })
  })
})

describe('textos', () => {
  it('la frase del ajuste con la mejor talla si es otra', () => {
    const ajuste = ajusteDeTalla(tabla(), '44', cuerpo)
    if (!ajuste) throw new Error('falta el ajuste')

    expect(textoAjuste(ajuste, { mejor: '46', alternativa: '44' })).toBe(
      'Con la 44: te quedará justa de cintura (−2 cm) y larga de pierna (+4 cm). Mejor la 46.',
    )
    expect(textoAjuste(ajuste, { mejor: '44', alternativa: '46' })).toBe(
      'Con la 44: te quedará justa de cintura (−2 cm) y larga de pierna (+4 cm).',
    )
  })

  it('si todo queda bien, lo dice; sin nada que comparar, null', () => {
    const bien = ajusteDeTalla(tabla(), '44', { cintura: 86, cadera: 104 })
    const nada = ajusteDeTalla(tabla(), '44', {})
    if (!bien || !nada) throw new Error('faltan ajustes')

    expect(textoAjuste(bien, null)).toBe('Con la 44: te quedará bien de cintura y de cadera.')
    expect(textoAjuste(nada, null)).toBeNull()
  })

  it('recomendación y medidas que faltan', () => {
    expect(textoRecomendacion({ mejor: '44', alternativa: '46' })).toBe(
      'Según la tabla, tu talla es la 44 (o la 46).',
    )
    expect(textoRecomendacion({ mejor: 'U', alternativa: null })).toBe(
      'Según la tabla, tu talla es la U.',
    )
    expect(textoFaltan(['cintura', 'largoPierna'])).toBe(
      'Apunta tu cintura y tu largo de pierna en Perfil para saber cómo te queda.',
    )
  })

  it('los decimales van con coma', () => {
    const ajuste = ajusteDeTalla(tabla(), '46', { cintura: 87.5 })
    if (!ajuste) throw new Error('falta el ajuste')

    expect(textoAjuste(ajuste, null)).toBe('Con la 46: te quedará holgada de cintura (+2,5 cm).')
  })
})
