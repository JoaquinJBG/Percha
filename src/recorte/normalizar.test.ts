import { describe, expect, it } from 'vitest'
import { LADO_MAXIMO, medidasReducidas } from './normalizar.ts'

describe('medidasReducidas', () => {
  it('reduce el lado mayor al máximo y mantiene la proporción', () => {
    expect(medidasReducidas(4000, 3000)).toEqual({ ancho: LADO_MAXIMO, alto: 960 })
    expect(medidasReducidas(3000, 4000)).toEqual({ ancho: 960, alto: LADO_MAXIMO })
  })

  it('no amplía una foto pequeña', () => {
    expect(medidasReducidas(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('nunca deja un lado a 0 en una foto muy alargada', () => {
    expect(medidasReducidas(10000, 2)).toEqual({ ancho: LADO_MAXIMO, alto: 1 })
  })
})
