import { describe, expect, it } from 'vitest'
import { resumenCuerpo } from './cuerpo.ts'

describe('resumenCuerpo', () => {
  it('resume altura, peso, complexión y la línea libre', () => {
    expect(
      resumenCuerpo({
        cuerpo: { altura: 176, peso: 100, complexion: 'grande', notas: 'hombros anchos' },
      }),
    ).toBe('176 cm, 100 kg, complexión grande, hombros anchos')
  })

  it('añade las medidas que haya, con coma decimal', () => {
    expect(
      resumenCuerpo({
        cuerpo: { altura: 176, pecho: 112, cintura: 98.5, cadera: 110, largoPierna: 80 },
      }),
    ).toBe('176 cm, pecho 112 cm, cintura 98,5 cm, cadera 110 cm, largo de pierna 80 cm')
  })

  it('devuelve un texto vacío si no hay nada del cuerpo', () => {
    expect(resumenCuerpo({})).toBe('')
    expect(resumenCuerpo({ cuerpo: {} })).toBe('')
    expect(resumenCuerpo({ cuerpo: { notas: '  ' } })).toBe('')
  })
})
