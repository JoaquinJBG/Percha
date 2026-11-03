import { describe, expect, it } from 'vitest'
import { ESTILOS } from '../../datos/modelo.ts'
import { afinidad, estilosAfines } from './estilos.ts'

describe('estilos afines', () => {
  it('la tabla es simétrica', () => {
    for (const estilo of ESTILOS) {
      for (const afin of estilosAfines(estilo)) expect(estilosAfines(afin)).toContain(estilo)
    }
  })

  it('todos los estilos tienen algún afín y ninguno es afín a sí mismo', () => {
    for (const estilo of ESTILOS) {
      expect(estilosAfines(estilo).length).toBeGreaterThan(0)
      expect(estilosAfines(estilo)).not.toContain(estilo)
    }
  })

  it('distingue exacto, afín, comodín y ninguno', () => {
    expect(afinidad(['formal', 'casual'], 'formal')).toBe('exacto')
    expect(afinidad(['business'], 'formal')).toBe('afin')
    expect(afinidad([], 'formal')).toBe('comodin')
    expect(afinidad(['streetwear'], 'formal')).toBe('ninguno')
  })
})
