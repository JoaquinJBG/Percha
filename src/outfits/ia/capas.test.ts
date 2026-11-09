import { describe, expect, it } from 'vitest'
import { crearContexto } from '../reglas/index.ts'
import type { Peticion } from '../reglas/index.ts'
import { tiempo } from '../reglas/pruebas.ts'
import { exteriorDeHoy, LIMITE_EXTERIOR, LIMITE_TERCERA_PIEZA, maxCapas } from './capas.ts'

function hoy(cambios: Partial<Peticion>) {
  return exteriorDeHoy(
    crearContexto({ prendas: [], estilo: 'casual', ocasion: 'diario', tiempo: null, ...cambios }),
  )
}

describe('capa exterior según el día', () => {
  it.each([
    [LIMITE_EXTERIOR - 1, 'obligatoria'],
    [LIMITE_EXTERIOR, 'opcional'],
    [LIMITE_TERCERA_PIEZA, 'opcional'],
    [LIMITE_TERCERA_PIEZA + 1, 'no'],
  ] as const)('con %i °C de sensación es %s', (sensacion, esperado) => {
    expect(hoy({ tiempo: tiempo(sensacion) })).toBe(esperado)
  })

  it('con lluvia es obligatoria hasta 23 °C; con 24 °C o más, no', () => {
    expect(hoy({ tiempo: tiempo(20, { precipitacion: 'lluvia' }) })).toBe('obligatoria')
    expect(hoy({ tiempo: tiempo(23, { precipitacion: 'lluvia' }) })).toBe('obligatoria')
    expect(hoy({ tiempo: tiempo(24, { precipitacion: 'nieve' }) })).toBe('no')
  })

  it('sin tiempo es opcional; en casa, nunca', () => {
    expect(hoy({ tiempo: null })).toBe('opcional')
    expect(hoy({ tiempo: tiempo(5), ocasion: 'casa' })).toBe('no')
  })

  it('una cuarta capa solo con 3 °C o menos', () => {
    expect(maxCapas(4)).toBe(3)
    expect(maxCapas(3)).toBe(4)
    expect(maxCapas(null)).toBe(3)
  })
})
