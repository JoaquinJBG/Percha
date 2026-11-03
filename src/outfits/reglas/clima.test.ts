import { describe, expect, it } from 'vitest'
import { abrigoObjetivo, temperaturaDe, temporadaDe } from './clima.ts'
import { tiempo } from './pruebas.ts'

describe('temperaturaDe', () => {
  it('usa la sensación térmica media del día', () => {
    const hoy = tiempo(10)
    hoy.sensacion = { actual: 4, minima: 3, maxima: 12 }
    hoy.temperatura = { actual: 20, minima: 20, maxima: 20 }
    expect(temperaturaDe(hoy)).toBe(8)
  })

  it('sin tiempo es null', () => {
    expect(temperaturaDe(null)).toBeNull()
  })

  it('con datos rotos es null', () => {
    const hoy = tiempo(10)
    hoy.sensacion.minima = Number.NaN
    expect(temperaturaDe(hoy)).toBeNull()
  })

  it('no da -0', () => {
    const hoy = tiempo(0)
    hoy.sensacion = { actual: 0, minima: -1, maxima: 0.2 }
    expect(Object.is(temperaturaDe(hoy), -0)).toBe(false)
  })
})

describe('abrigoObjetivo', () => {
  it.each([
    [35, 1],
    [26, 1],
    [22, 2],
    [15, 3],
    [10, 4],
    [-5, 5],
  ])('%i °C pide nivel %i', (grados, nivel) => {
    expect(abrigoObjetivo(grados)).toBe(nivel)
  })
})

describe('temporadaDe', () => {
  it.each([
    ['2026-01-10', 'invierno'],
    ['2026-04-01', 'primavera'],
    ['2026-07-15', 'verano'],
    ['2026-11-03', 'otoño'],
    ['2026-12-01', 'invierno'],
  ])('%s es %s', (fecha, temporada) => {
    expect(temporadaDe(fecha)).toBe(temporada)
  })

  it('al sur del ecuador es la opuesta', () => {
    expect(temporadaDe('2026-07-15', -34)).toBe('invierno')
  })

  it('sin fecha o con una fecha rota es null', () => {
    expect(temporadaDe(undefined)).toBeNull()
    expect(temporadaDe('mañana')).toBeNull()
    expect(temporadaDe('2026-13-01')).toBeNull()
  })
})
