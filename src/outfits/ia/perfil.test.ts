import { describe, expect, it } from 'vitest'
import type { Cuerpo } from '../../datos/modelo.ts'
import { crearProveedorFalso } from '../../ia/index.ts'
import { textoPeticionOutfits } from '../../ia/prompt-outfits.ts'
import type { Peticion } from '../reglas/index.ts'
import { armarioEjemplo, tiempo } from '../reglas/pruebas.ts'
import { elegirOutfitsConIA } from './elegir.ts'
import { cuerpoParaIA, oficinaParaIA, perfilParaIA } from './perfil.ts'

const CUERPO_COMPLETO: Cuerpo = {
  altura: 176,
  peso: 100,
  pecho: 112,
  cintura: 98,
  cadera: 106,
  largoPierna: 81,
  complexion: 'grande',
  notas: 'hombros anchos, pecho 112, muslo grande',
}

/** Nada de esto puede ir a Gemini: el peso y las medidas de pecho, cintura, cadera y pierna. */
const PROHIBIDO = [
  /100 ?kg/,
  /\b112\b/,
  /\b98\b/,
  /\b106\b/,
  /\b81\b/,
  /pecho/i,
  /cintura/i,
  /cadera/i,
  /pierna/i,
  /peso/i,
]

function sinMedidas(texto: string) {
  for (const patron of PROHIBIDO) expect(texto).not.toMatch(patron)
}

describe('perfil para Gemini', () => {
  it('el cuerpo va sin peso ni medidas: altura, complexión y notas sin cifras', () => {
    const texto = cuerpoParaIA(CUERPO_COMPLETO)
    expect(texto).toBe('176 cm, complexión grande, hombros anchos, muslo grande')
    sinMedidas(texto)
  })

  it('notas con medidas sueltas no dejan restos', () => {
    expect(cuerpoParaIA({ notas: 'cintura 98; hombros anchos. 1,80 de alto' })).toBe(
      'hombros anchos',
    )
    expect(cuerpoParaIA({ peso: 90, cintura: 90 })).toBe('')
  })

  it('oficina en texto', () => {
    expect(oficinaParaIA({ tipo: 'creativa', viernesCasual: true })).toBe(
      'oficina creativa, con viernes casual',
    )
    expect(oficinaParaIA(undefined)).toBe('')
  })

  it('sin cuerpo ni oficina no va perfil; la sensación térmica sola tampoco', () => {
    expect(perfilParaIA(undefined)).toBeUndefined()
    expect(perfilParaIA({ sensacionTermica: 'friolero' })).toBeUndefined()
    expect(perfilParaIA({ oficina: { tipo: 'estándar', viernesCasual: false } })).toEqual({
      oficina: 'oficina estándar',
    })
  })
})

describe('petición a Gemini con perfil y corte', () => {
  const armario = armarioEjemplo().map((p) =>
    p.id === 'vaqueros' ? { ...p, corte: 'regular / recto' as const, tiro: 'medio' as const } : p,
  )
  const peticion: Peticion = {
    prendas: armario,
    estilo: 'casual',
    ocasion: 'trabajo',
    tiempo: tiempo(18),
    perfil: {
      cuerpo: CUERPO_COMPLETO,
      oficina: { tipo: 'estándar', viernesCasual: false },
      sensacionTermica: 'caluroso',
    },
  }

  it('manda el resumen del cuerpo y la oficina, nunca las medidas', async () => {
    const proveedor = crearProveedorFalso()
    await elegirOutfitsConIA(peticion, 1, { proveedor })
    const [enviada] = proveedor.peticionesOutfits
    expect(enviada?.perfil).toEqual({
      cuerpo: '176 cm, complexión grande, hombros anchos, muslo grande',
      oficina: 'oficina estándar',
    })
    if (!enviada) throw new Error('no se pidió nada a la IA')
    const texto = textoPeticionOutfits(enviada, [])
    expect(texto).toContain(
      'Perfil: 176 cm, complexión grande, hombros anchos, muslo grande. oficina estándar.',
    )
    sinMedidas(JSON.stringify(enviada))
  })

  it('manda el corte y los detalles de cada prenda', async () => {
    const proveedor = crearProveedorFalso()
    // En diario: en una oficina estándar el vaquero (formalidad 2) se queda corto y no va.
    await elegirOutfitsConIA({ ...peticion, ocasion: 'diario' }, 1, { proveedor })
    const [enviada] = proveedor.peticionesOutfits
    const vaqueros = enviada?.prendas.find((p) => p.id === 'vaqueros')
    expect(vaqueros).toMatchObject({ corte: 'regular / recto', tiro: 'medio' })
    const referencias = (enviada?.prendas ?? []).map((_, i) => `P${String(i + 1)}`)
    expect(enviada && textoPeticionOutfits(enviada, referencias)).toMatch(
      /vaqueros · azul .*corte regular \/ recto · tiro medio/,
    )
  })

  it('sin perfil no va la línea «Perfil»', async () => {
    const proveedor = crearProveedorFalso()
    await elegirOutfitsConIA({ ...peticion, perfil: {} }, 1, { proveedor })
    const [enviada] = proveedor.peticionesOutfits
    expect(enviada?.perfil).toBeUndefined()
    expect(enviada && textoPeticionOutfits(enviada, [])).not.toContain('Perfil:')
  })
})
