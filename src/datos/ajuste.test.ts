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
  const camiseta = tabla({
    tipo: 'parte de arriba',
    medidaDe: 'prenda',
    filas: [{ talla: 'M', pecho: 108, cintura: 104 }],
  })
  const vaquero = tabla({
    medidaDe: 'prenda',
    filas: [{ talla: '42', cintura: 84, largoPierna: 76 }],
  })

  it('descuenta la holgura del corte: un slim de pecho 108 a un pecho de 100 queda bien', () => {
    const slim = ajusteDeTalla(camiseta, 'M', { pecho: 100 }, { corte: 'slim' })
    const oversize = ajusteDeTalla(camiseta, 'M', { pecho: 100 }, { corte: 'oversize' })

    expect(slim?.medidas[0]).toEqual({ medida: 'pecho', veredicto: 'bien', diferencia: 2 })
    expect(oversize?.medidas[0]).toEqual({ medida: 'pecho', veredicto: 'justa', diferencia: -14 })
  })

  it('sin corte, regular; en lo de arriba la cintura lleva la misma holgura que el pecho', () => {
    expect(ajusteDeTalla(camiseta, 'M', { pecho: 98 })?.medidas[0]?.veredicto).toBe('bien')
    expect(
      ajusteDeTalla(camiseta, 'M', { cintura: 100 }, { corte: 'oversize' })?.medidas[0],
    ).toEqual({ medida: 'cintura', veredicto: 'justa', diferencia: -18 })
  })

  it('la cintura de un pantalón va casi sin holgura, aunque sea baggy', () => {
    expect(ajusteDeTalla(vaquero, '42', { cintura: 82 })?.medidas[0]).toEqual({
      medida: 'cintura',
      veredicto: 'bien',
      diferencia: 0,
    })
    expect(
      ajusteDeTalla(vaquero, '42', { cintura: 82 }, { corte: 'baggy' })?.medidas[0]?.veredicto,
    ).toBe('bien')
  })

  it('un tobillero se espera más corto que la pierna', () => {
    expect(
      ajusteDeTalla(vaquero, '42', { largoPierna: 83 }, { largo: 'tobillero' })?.medidas[0],
    ).toEqual({ medida: 'largoPierna', veredicto: 'bien', diferencia: 0 })
    expect(ajusteDeTalla(vaquero, '42', { largoPierna: 83 })?.medidas[0]?.veredicto).toBe('corta')
  })
})

describe('límites de la tolerancia', () => {
  it('se compara sin redondear: 1,8 cm es «bien» aunque se enseñe 2', () => {
    expect(ajusteDeTalla(tabla(), '44', { cintura: 84.2 })?.medidas[0]).toEqual({
      medida: 'cintura',
      veredicto: 'bien',
      diferencia: 2,
    })
    expect(ajusteDeTalla(tabla(), '44', { cintura: 84 })?.medidas[0]?.veredicto).toBe('holgada')
  })
})

describe('talla recomendada', () => {
  it('elige la que mejor queda, con la siguiente de alternativa; justa pesa más', () => {
    expect(tallaRecomendada(tabla(), { cintura: 88, cadera: 106, largoPierna: 85 })).toEqual({
      mejor: '46',
      alternativa: '44',
    })
  })

  it('una talla con menos medidas en la tabla no gana por eso', () => {
    const conHuecos = tabla({
      filas: [
        { talla: '42', cadera: 101 },
        { talla: '44', cintura: 88, cadera: 104 },
      ],
    })
    expect(tallaRecomendada(conHuecos, { cintura: 88, cadera: 104 })?.mejor).toBe('44')
  })

  it('en empate gana la mayor', () => {
    const empate = tabla({
      filas: [
        { talla: '40', cintura: 84 },
        { talla: '42', cintura: 88 },
      ],
    })
    expect(tallaRecomendada(empate, { cintura: 86 })?.mejor).toBe('42')
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
      'Con la 44: te quedará justa de cintura (−2 cm) y larga de pierna (+4 cm). Mejor la 46.',
    )
    expect(textoAjuste(ajuste, { mejor: '44', alternativa: '46' })).toBe(
      'Con la 44: te quedará justa de cintura (−2 cm) y larga de pierna (+4 cm).',
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

    expect(textoAjuste(ajuste, null)).toBe('Con la 46: te quedará holgada de cintura (+2,5 cm).')
  })
})
