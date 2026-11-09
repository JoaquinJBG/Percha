import { describe, expect, it } from 'vitest'
import { candidatos } from './candidatos.ts'
import { comprobarOutfit, cuatroOutfits, ranurasDe } from './outfits.ts'
import { armarioConCapas, prenda, tiempo } from './pruebas.ts'
import type { OutfitReglas, Peticion, PrendaReglas, Ranura } from './tipos.ts'

function peticion(prendas: PrendaReglas[], cambios: Partial<Peticion> = {}): Peticion {
  return { prendas, estilo: 'casual', ocasion: 'diario', tiempo: null, ...cambios }
}

function enRanura(outfit: OutfitReglas, ranura: Ranura): string[] {
  return outfit.prendas.filter((_, i) => outfit.ranuras?.[i] === ranura).map((p) => p.id)
}

/** El armario mínimo con capas del encargo de T6.2. */
function basico(): PrendaReglas[] {
  return [
    prenda({ id: 'camiseta', subcategoria: 'camiseta', colores: ['blanco'], abrigo: 1 }),
    prenda({
      id: 'sobrecamisa',
      categoria: 'abrigo',
      subcategoria: 'sobrecamisa',
      colores: ['verde caqui'],
      abrigo: 3,
      capas: ['media', 'exterior'],
    }),
    prenda({
      id: 'abrigo',
      categoria: 'abrigo',
      subcategoria: 'abrigo de paño',
      colores: ['azul marino'],
      abrigo: 4,
      capas: ['exterior'],
    }),
    prenda({ id: 'vaqueros', categoria: 'inferior', subcategoria: 'vaqueros', abrigo: 3 }),
    prenda({ id: 'zapatillas', categoria: 'calzado', subcategoria: 'zapatillas', abrigo: 2 }),
  ]
}

describe('capas de hoy en los candidatos', () => {
  const capasDe = (resultado: ReturnType<typeof candidatos>, id: string) =>
    resultado.candidatos.find((c) => c.prenda.id === id)

  it('entre 14 y 23 °C la sobrecamisa es una tercera pieza opcional', () => {
    const resultado = candidatos(peticion(basico(), { tiempo: tiempo(18) }))
    expect(resultado.contexto).toMatchObject({ necesitaAbrigo: false, terceraPieza: true })
    expect(capasDe(resultado, 'sobrecamisa')).toMatchObject({
      capas: ['media', 'exterior'],
      opcional: true,
    })
    expect(capasDe(resultado, 'camiseta')).toMatchObject({ capas: ['base'], opcional: false })
  })

  it('entre 14 y 23 °C lo que abriga más de 3 no va encima', () => {
    const ochos = prenda({ id: 'ochos', subcategoria: 'jersey de ochos', abrigo: 4 })
    const resultado = candidatos(peticion([ochos], { tiempo: tiempo(20) }))
    expect(resultado.descartadas[0]?.motivo).toBe('demasiado abrigo para llevarla encima a 20 °C')
  })

  it('por debajo de 14 °C la exterior es obligatoria y no opcional', () => {
    const resultado = candidatos(peticion(basico(), { tiempo: tiempo(13) }))
    expect(resultado.contexto).toMatchObject({ necesitaAbrigo: true, terceraPieza: false })
    expect(capasDe(resultado, 'sobrecamisa')?.opcional).toBe(false)
    expect(capasDe(resultado, 'abrigo')?.capas).toEqual(['exterior'])
  })

  it('con calor solo base: la sobrecamisa se queda fuera', () => {
    const resultado = candidatos(peticion(basico(), { tiempo: tiempo(26) }))
    expect(resultado.contexto.terceraPieza).toBe(false)
    expect(resultado.descartadas.find((d) => d.prenda.id === 'sobrecamisa')?.motivo).toBe(
      'hace calor para abrigo a 26 °C',
    )
    const camisa = prenda({ id: 'camisa', subcategoria: 'camisa de lino', abrigo: 1 })
    const conCamisa = candidatos(peticion([camisa], { tiempo: tiempo(26) }))
    expect(conCamisa.candidatos[0]?.capas).toEqual(['base'])
  })

  it('un chaleco de punto no va de exterior con frío, aunque lo diga a mano', () => {
    const chaleco = prenda({
      id: 'chaleco',
      subcategoria: 'chaleco de punto',
      abrigo: 2,
      capas: ['media', 'exterior'],
    })
    expect(candidatos(peticion([chaleco], { tiempo: tiempo(10) })).candidatos[0]?.capas).toEqual([
      'media',
    ])
  })

  it('en casa no hay exterior', () => {
    const resultado = candidatos(peticion(basico(), { ocasion: 'casa', tiempo: tiempo(5) }))
    expect(resultado.descartadas.find((d) => d.prenda.id === 'abrigo')?.motivo).toBe(
      'en casa no hace falta abrigo',
    )
    expect(capasDe(resultado, 'sobrecamisa')?.capas).toEqual(['media'])
  })

  it('las capas guardadas mandan sobre las de por defecto', () => {
    const camisa = prenda({ subcategoria: 'camisa', capas: ['base'] })
    const [candidato] = candidatos(peticion([camisa], { tiempo: tiempo(10) })).candidatos
    expect(candidato?.capas).toEqual(['base'])
  })

  it('una parte de arriba que solo va encima no cuenta como base', () => {
    const cardigan = prenda({ subcategoria: 'cárdigan', abrigo: 3 })
    const avisos = candidatos(
      peticion([cardigan, prenda({ categoria: 'inferior' }), prenda({ categoria: 'calzado' })], {
        tiempo: tiempo(18),
      }),
    ).avisos
    expect(avisos).toEqual(['te falta una parte de arriba (o un vestido)'])
  })
})

describe('cuatroOutfits con capas', () => {
  it('a 18 °C: camiseta con sobrecamisa abierta encima (P1)', () => {
    const { outfits } = cuatroOutfits(peticion(basico(), { tiempo: tiempo(18) }))
    expect(outfits).toHaveLength(1)
    const [outfit] = outfits
    expect(outfit?.prendas.map((p) => p.id)).toEqual([
      'camiseta',
      'sobrecamisa',
      'vaqueros',
      'zapatillas',
    ])
    expect(outfit?.ranuras).toEqual(['base', 'exterior', 'inferior', 'calzado'])
    expect(outfit?.motivo).toMatch(/^con sobrecamisa para 18 °C/)
  })

  it('a 8 °C: la sobrecamisa pasa a media bajo el abrigo', () => {
    const [outfit] = cuatroOutfits(peticion(basico(), { tiempo: tiempo(8) })).outfits
    expect(outfit?.ranuras).toEqual(['base', 'media', 'exterior', 'inferior', 'calzado'])
    expect(outfit && enRanura(outfit, 'media')).toEqual(['sobrecamisa'])
    expect(outfit && enRanura(outfit, 'exterior')).toEqual(['abrigo'])
    expect(outfit?.motivo).toMatch(/^abrigo por 8 °C/)
  })

  it('a 26 °C, solo la base', () => {
    const [outfit] = cuatroOutfits(peticion(basico(), { tiempo: tiempo(26) })).outfits
    expect(outfit?.ranuras).toEqual(['base', 'inferior', 'calzado'])
  })

  it('por debajo de 14 °C todos llevan exterior; por encima de 23, ninguno lleva nada encima', () => {
    const armario = armarioConCapas()
    for (const outfit of cuatroOutfits(peticion(armario, { tiempo: tiempo(11) })).outfits) {
      expect(enRanura(outfit, 'exterior')).toHaveLength(1)
    }
    for (const outfit of cuatroOutfits(peticion(armario, { tiempo: tiempo(27) })).outfits) {
      expect(enRanura(outfit, 'media')).toEqual([])
      expect(enRanura(outfit, 'exterior')).toEqual([])
    }
  })

  it('camisa con jersey encima y abrigo para el trabajo (P3)', () => {
    const { outfits } = cuatroOutfits(
      peticion(armarioConCapas(), {
        estilo: 'smart casual',
        ocasion: 'trabajo',
        tiempo: tiempo(8),
      }),
    )
    const conPunto = outfits.find((o) => o.motivo.includes('cuello de la camisa por fuera'))
    expect(conPunto).toBeDefined()
    expect(conPunto && enRanura(conPunto, 'media')).toHaveLength(1)
  })

  it('a 18 °C hay outfits con tercera pieza y alguno sin ella', () => {
    const { outfits } = cuatroOutfits(peticion(armarioConCapas(), { tiempo: tiempo(18) }))
    const conTercera = outfits.filter((o) =>
      o.ranuras?.some((r) => r === 'media' || r === 'exterior'),
    )
    expect(conTercera.length).toBeGreaterThan(0)
  })

  it('la misma capa de fuera no sale en los cuatro si hay otra', () => {
    const armario = [
      ...['a', 'b', 'c', 'd'].map((id) => prenda({ id, subcategoria: 'camiseta', abrigo: 1 })),
      prenda({ id: 'vaqueros', categoria: 'inferior', abrigo: 3 }),
      prenda({ id: 'zapatillas', categoria: 'calzado', abrigo: 2 }),
      prenda({ id: 'parka', categoria: 'abrigo', subcategoria: 'parka', abrigo: 5 }),
      prenda({
        id: 'abrigo',
        categoria: 'abrigo',
        subcategoria: 'abrigo de paño',
        abrigo: 4,
        colores: ['negro'],
      }),
    ]
    for (let semilla = 1; semilla <= 10; semilla++) {
      const { outfits } = cuatroOutfits(peticion(armario, { tiempo: tiempo(6) }), semilla)
      expect(outfits).toHaveLength(4)
      expect(new Set(outfits.map((o) => enRanura(o, 'exterior')[0])).size).toBeGreaterThan(1)
    }
  })

  it('con un solo abrigo y frío, los cuatro lo llevan', () => {
    const armario = [
      ...['a', 'b', 'c', 'd'].map((id) => prenda({ id, subcategoria: 'camiseta', abrigo: 1 })),
      prenda({ id: 'vaqueros', categoria: 'inferior', abrigo: 3 }),
      prenda({ id: 'zapatillas', categoria: 'calzado', abrigo: 2 }),
      prenda({ id: 'abrigo', categoria: 'abrigo', subcategoria: 'plumífero', abrigo: 5 }),
    ]
    const { outfits } = cuatroOutfits(peticion(armario, { tiempo: tiempo(6) }))
    expect(outfits.map((o) => enRanura(o, 'exterior'))).toEqual([
      ['abrigo'],
      ['abrigo'],
      ['abrigo'],
      ['abrigo'],
    ])
  })

  it('un vestido con cárdigan por encima', () => {
    const armario = [
      prenda({ id: 'vestido', categoria: 'vestido', abrigo: 2, colores: ['negro'] }),
      prenda({ id: 'cardigan', subcategoria: 'cárdigan', abrigo: 3, colores: ['crudo'] }),
      prenda({ id: 'bailarinas', categoria: 'calzado', abrigo: 2 }),
    ]
    const [outfit] = cuatroOutfits(peticion(armario, { tiempo: tiempo(17) })).outfits
    expect(outfit?.ranuras).toEqual(['vestido', 'media', 'calzado'])
  })

  it('sin capas que encajen con la base de hoy, prueba con otra base', () => {
    const armario = [
      prenda({ id: 'jersey-ochos', subcategoria: 'jersey de ochos', abrigo: 4 }),
      prenda({ id: 'camisa', subcategoria: 'camisa', abrigo: 2 }),
      prenda({ id: 'americana', categoria: 'abrigo', subcategoria: 'americana', abrigo: 4 }),
      prenda({ id: 'vaqueros', categoria: 'inferior', abrigo: 3 }),
      prenda({ id: 'zapatillas', categoria: 'calzado', abrigo: 2 }),
    ]
    const { outfits } = cuatroOutfits(peticion(armario, { tiempo: tiempo(12) }))
    expect(outfits.map((o) => o.principal.id)).toEqual(['camisa'])
  })
})

describe('comprobarOutfit con capas', () => {
  const armario = armarioConCapas()
  const deHoy = candidatos(peticion(armario, { estilo: 'smart casual', tiempo: tiempo(8) }))

  it('reparte base, media y exterior aunque lleguen desordenadas', () => {
    const resultado = comprobarOutfit(
      ['gabardina', 'chinos-beige', 'cardigan-crudo', 'mocasines', 'camisa-blanca'],
      deHoy,
    )
    expect('error' in resultado ? resultado.error : resultado.ranuras).toEqual([
      'base',
      'media',
      'exterior',
      'inferior',
      'calzado',
    ])
    expect('principal' in resultado && resultado.principal.id).toBe('camisa-blanca')
  })

  it('rechaza una pila que no se lleva', () => {
    expect(
      comprobarOutfit(
        ['camisa-blanca', 'americana-marino', 'cazadora-vaquera', 'chinos-beige', 'mocasines'],
        deHoy,
      ),
    ).toEqual({ error: 'sobre la americana solo va un abrigo' })
  })

  it('más de 3 accesorios o de 8 prendas, no', () => {
    const accesorios = ['g1', 'g2', 'g3', 'g4'].map((id) =>
      prenda({ id, categoria: 'accesorio', estilos: [], formalidad: 2, abrigo: 1 }),
    )
    const conAccesorios = candidatos(
      peticion([...armario, ...accesorios], { estilo: 'smart casual', tiempo: tiempo(8) }),
    )
    expect(
      comprobarOutfit(
        ['camisa-blanca', 'gabardina', 'chinos-beige', 'mocasines', 'g1', 'g2', 'g3', 'g4'],
        conAccesorios,
      ),
    ).toEqual({ error: 'lleva más de 3 accesorios' })
    expect(
      comprobarOutfit(
        [
          'camiseta-blanca',
          'camisa-azul',
          'jersey-gris',
          'gabardina',
          'chinos-beige',
          'mocasines',
          'g1',
          'g2',
          'g3',
        ],
        conAccesorios,
      ),
    ).toEqual({ error: 'lleva más de 8 prendas' })
  })
})

describe('ranurasDe', () => {
  it('usa las del outfit si las trae', () => {
    const prendas = [prenda(), prenda({ categoria: 'inferior' })]
    expect(ranurasDe({ prendas, ranuras: ['base', 'inferior'] })).toEqual(['base', 'inferior'])
  })

  it('sin ellas, las deduce del orden de dentro afuera', () => {
    const prendas = [
      prenda(),
      prenda(),
      prenda({ categoria: 'abrigo' }),
      prenda({ categoria: 'inferior' }),
      prenda({ categoria: 'calzado' }),
    ]
    expect(ranurasDe({ prendas })).toEqual(['base', 'media', 'exterior', 'inferior', 'calzado'])
    const conVestido = [prenda({ categoria: 'vestido' }), prenda({ categoria: 'abrigo' })]
    expect(ranurasDe({ prendas: conVestido })).toEqual(['vestido', 'exterior'])
  })
})
