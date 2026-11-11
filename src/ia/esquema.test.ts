import { describe, expect, it } from 'vitest'
import { CAPAS, COLORES } from '../datos/modelo.ts'
import { esquemaParaGemini } from './esquema.ts'
import { aBase64 } from './fotos.ts'

describe('esquema para Gemini', () => {
  const esquema = esquemaParaGemini()
  const texto = JSON.stringify(esquema)

  it('no lleva $schema ni los límites de entero de JavaScript', () => {
    expect(esquema).not.toHaveProperty('$schema')
    expect(texto).not.toContain(String(Number.MAX_SAFE_INTEGER))
  })

  it('cierra los colores con la lista fija', () => {
    expect(texto).toContain(JSON.stringify([...COLORES]))
  })

  it('pide corte, tiro, largo, manga y cuello como opcionales', () => {
    const prendas = (
      esquema.properties as {
        prendas: { items: { properties: object; required: string[] } }
      }
    ).prendas.items
    for (const campo of ['corte', 'tiro', 'largo', 'manga', 'cuello']) {
      expect(Object.keys(prendas.properties)).toContain(campo)
      expect(prendas.required).not.toContain(campo)
    }
    expect(JSON.stringify(prendas.properties)).toContain('"balloon"')
  })

  it('pide las capas con la lista cerrada de papeles', () => {
    const propiedades = (esquema.properties as { prendas: { items: { properties: object } } })
      .prendas.items.properties
    expect(JSON.stringify(propiedades)).toContain(JSON.stringify([...CAPAS]))
    expect(Object.keys(propiedades)).toContain('capas')
  })
})

describe('fotos en base64', () => {
  it('codifica bien una foto más grande que un trozo', async () => {
    const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => i % 256)

    const base64 = await aBase64(new Blob([bytes]))

    expect(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))).toEqual(bytes)
  })
})
