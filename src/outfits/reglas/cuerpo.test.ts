import { describe, expect, it } from 'vitest'
import { candidatos, crearContexto } from './candidatos.ts'
import { puntosPrendaCuerpo, puntuarConjunto } from './cuerpo.ts'
import { cuatroOutfits } from './outfits.ts'
import { ajusteTermico, formalidadTrabajo, tipoCuerpo, type PerfilReglas } from './perfil.ts'
import { prenda, tiempo } from './pruebas.ts'
import type { Contexto, Peticion, PrendaReglas } from './tipos.ts'

const GRANDE: PerfilReglas = { cuerpo: { altura: 176, peso: 100, complexion: 'grande' } }

function peticion(prendas: PrendaReglas[], cambios: Partial<Peticion> = {}): Peticion {
  return { prendas, estilo: 'casual', ocasion: 'diario', tiempo: tiempo(20), ...cambios }
}

function contexto(cambios: Partial<Peticion> = {}): Contexto {
  return crearContexto(peticion([], cambios))
}

const camiseta = (cambios: Partial<PrendaReglas> = {}) =>
  prenda({ subcategoria: 'camiseta', abrigo: 1, colores: ['blanco'], ...cambios })
const pantalon = (cambios: Partial<PrendaReglas> = {}) =>
  prenda({
    categoria: 'inferior',
    subcategoria: 'vaqueros',
    abrigo: 2,
    colores: ['azul'],
    ...cambios,
  })

describe('perfil', () => {
  it('sin cuerpo no hay reglas de cuerpo; con complexión grande, IMC alto o notas de hombros, sí', () => {
    expect(tipoCuerpo(undefined)).toBeNull()
    expect(tipoCuerpo({})).toBeNull()
    expect(tipoCuerpo({ complexion: 'grande' })).toBe('grande')
    expect(tipoCuerpo({ complexion: 'atlética' })).toBe('grande')
    expect(tipoCuerpo({ altura: 176, peso: 100 })).toBe('grande')
    expect(tipoCuerpo({ notas: 'Hombros anchos' })).toBe('grande')
    expect(tipoCuerpo({ altura: 180, peso: 70, complexion: 'delgada' })).toBe('otro')
  })

  it('caluroso viste como si hiciera 2 °C más; friolero, 2 °C menos', () => {
    expect(ajusteTermico('caluroso')).toBe(2)
    expect(ajusteTermico('friolero')).toBe(-2)
    expect(ajusteTermico('normal')).toBe(0)
    expect(ajusteTermico(undefined)).toBe(0)
  })

  it('la oficina mueve la formalidad de «trabajo», y el viernes casual la baja', () => {
    expect(formalidadTrabajo(undefined, '2026-11-13')).toBeNull()
    expect(formalidadTrabajo({ tipo: 'conservadora', viernesCasual: false }, '2026-11-12')).toEqual(
      {
        minima: 4,
        maxima: 5,
      },
    )
    expect(formalidadTrabajo({ tipo: 'estándar', viernesCasual: true }, '2026-11-12')).toEqual({
      minima: 3,
      maxima: 4,
    })
    // 13/11/2026 es viernes.
    expect(formalidadTrabajo({ tipo: 'estándar', viernesCasual: true }, '2026-11-13')).toEqual({
      minima: 2,
      maxima: 3,
    })
    expect(formalidadTrabajo({ tipo: 'creativa', viernesCasual: true }, '2026-11-13')).toEqual({
      minima: 2,
      maxima: 3,
    })
  })
})

describe('sensación térmica en el contexto', () => {
  it('un caluroso a 13 °C no necesita exterior; un friolero a 15 °C, sí', () => {
    expect(
      contexto({ tiempo: tiempo(13), perfil: { sensacionTermica: 'caluroso' } }),
    ).toMatchObject({
      temperatura: 13,
      temperaturaVestir: 15,
      necesitaAbrigo: false,
      terceraPieza: true,
    })
    expect(
      contexto({ tiempo: tiempo(15), perfil: { sensacionTermica: 'friolero' } }),
    ).toMatchObject({
      temperatura: 15,
      temperaturaVestir: 13,
      necesitaAbrigo: true,
    })
    expect(contexto({ tiempo: tiempo(13) }).necesitaAbrigo).toBe(true)
  })

  it('la tercera pieza llega 2 °C más arriba para un friolero', () => {
    expect(contexto({ tiempo: tiempo(24) }).terceraPieza).toBe(false)
    expect(
      contexto({ tiempo: tiempo(24), perfil: { sensacionTermica: 'friolero' } }).terceraPieza,
    ).toBe(true)
  })

  it('el punto grueso de media llega a 19 °C para un friolero', () => {
    const ochos = prenda({ id: 'ochos', subcategoria: 'jersey de ochos', abrigo: 4 })
    const normal = candidatos(peticion([ochos], { tiempo: tiempo(19) }))
    const friolero = candidatos(
      peticion([ochos], { tiempo: tiempo(19), perfil: { sensacionTermica: 'friolero' } }),
    )
    expect(normal.candidatos).toEqual([])
    expect(friolero.candidatos[0]?.capas).toContain('media')
  })

  it('los motivos hablan de la temperatura de verdad', () => {
    const armario = [
      camiseta({ id: 'camiseta' }),
      pantalon({ id: 'vaqueros' }),
      prenda({ id: 'zapatillas', categoria: 'calzado', abrigo: 2 }),
      prenda({ id: 'abrigo', categoria: 'abrigo', subcategoria: 'abrigo de paño', abrigo: 4 }),
    ]
    const [outfit] = cuatroOutfits(
      peticion(armario, { tiempo: tiempo(15), perfil: { sensacionTermica: 'friolero' } }),
    ).outfits
    expect(outfit?.motivo).toMatch(/^abrigo por 15 °C/)
  })
})

describe('oficina en los candidatos', () => {
  it('en oficina conservadora una camisa de formalidad 3 se queda corta; en creativa vale', () => {
    const camisa = prenda({ subcategoria: 'camisa', formalidad: 3, estilos: [] })
    const conservadora = candidatos(
      peticion([camisa], {
        ocasion: 'trabajo',
        perfil: { oficina: { tipo: 'conservadora', viernesCasual: false } },
      }),
    )
    expect(conservadora.contexto.formalidad).toEqual({ minima: 4, maxima: 5 })
    expect(conservadora.candidatos[0]?.ajuste).toBe('parcial')
    const sudadera = prenda({ subcategoria: 'sudadera', formalidad: 2, estilos: [] })
    const creativa = candidatos(
      peticion([sudadera], {
        ocasion: 'trabajo',
        perfil: { oficina: { tipo: 'creativa', viernesCasual: false } },
      }),
    )
    expect(creativa.candidatos[0]?.ajuste).toBe('pleno')
  })

  it('fuera de «trabajo» la oficina no cambia nada', () => {
    expect(
      contexto({
        ocasion: 'cita',
        perfil: { oficina: { tipo: 'conservadora', viernesCasual: false } },
      }).formalidad,
    ).toEqual({ minima: 2, maxima: 4 })
  })
})

describe('reglas de cuerpo por prenda (B1, B6, B7, B9)', () => {
  const grande = contexto({ perfil: GRANDE })
  const sinCuerpo = contexto()
  const puntos = (p: PrendaReglas, c = grande) => puntosPrendaCuerpo(p, c).puntos

  it('sin cuerpo en el perfil no suman ni restan', () => {
    expect(puntosPrendaCuerpo(pantalon({ corte: 'skinny' }), sinCuerpo)).toEqual({
      puntos: 0,
      motivos: [],
    })
  })

  it('B1: el pitillo resta mucho y el recto o relaxed suma', () => {
    expect(puntos(pantalon({ corte: 'skinny' }))).toBe(-3)
    expect(puntos(pantalon({ corte: 'relaxed' }))).toBe(1)
    expect(puntos(pantalon({ corte: 'regular / recto' }))).toBe(1)
    expect(puntos(pantalon({ corte: 'wide leg' }))).toBe(-1)
    // En streetwear la pierna ancha no resta.
    expect(
      puntos(pantalon({ corte: 'wide leg' }), contexto({ perfil: GRANDE, estilo: 'streetwear' })),
    ).toBe(0)
  })

  it('B1 cambia el orden de los candidatos', () => {
    const pitillo = pantalon({ id: 'pitillo', corte: 'skinny' })
    const recto = pantalon({ id: 'recto', corte: 'regular / recto' })
    const ids = (p?: PerfilReglas) =>
      candidatos(peticion([pitillo, recto], p ? { perfil: p } : {})).candidatos.map(
        (c) => c.prenda.id,
      )
    expect(ids()).toEqual(['pitillo', 'recto'])
    expect(ids(GRANDE)).toEqual(['recto', 'pitillo'])
  })

  it('B6: escote abierto suma; cuello alto resta', () => {
    expect(puntos(camiseta({ subcategoria: 'henley' }))).toBe(0.5)
    expect(puntos(prenda({ subcategoria: 'camisa', cuello: 'cubano' }))).toBe(0.5)
    expect(puntos(prenda({ subcategoria: 'jersey de cuello alto' }))).toBe(-0.5)
  })

  it('B7: calzado con presencia suma; suela fina resta', () => {
    expect(puntos(prenda({ categoria: 'calzado', subcategoria: 'Botas Chelsea' }))).toBe(0.5)
    expect(puntos(prenda({ categoria: 'calzado', subcategoria: 'zapatillas de lona' }))).toBe(-0.5)
  })

  it('B8: abrigo largo en el trabajo', () => {
    const largo = prenda({ categoria: 'abrigo', subcategoria: 'abrigo', largo: 'largo' })
    expect(puntos(largo, contexto({ perfil: GRANDE, ocasion: 'trabajo' }))).toBe(0.5)
    expect(puntos(largo, contexto({ perfil: GRANDE, ocasion: 'diario' }))).toBe(0)
  })

  it('B9: raya vertical mejor que horizontal; nada de gráfico grande', () => {
    expect(puntos(camiseta({ estampado: 'rayas horizontales' }))).toBe(-1)
    expect(puntos(prenda({ subcategoria: 'camisa', estampado: 'rayas verticales' }))).toBe(0.5)
    expect(puntos(camiseta({ estampado: 'gráfico' }))).toBe(-1)
  })
})

describe('silueta y reglas de conjunto (B2–B5, B10, B11)', () => {
  const sinCuerpo = contexto()
  const grande = contexto({ perfil: GRANDE })
  const nota = (capas: PrendaReglas[], inferior: PrendaReglas | null, c: Contexto) =>
    puntuarConjunto(capas, inferior, c).puntos

  it('todo amplio resta, salvo en streetwear; amplio con ajustado suma', () => {
    const oversize = camiseta({ corte: 'oversize' })
    const baggy = pantalon({ corte: 'baggy' })
    expect(nota([oversize], baggy, sinCuerpo)).toBe(-2)
    expect(nota([oversize], baggy, contexto({ estilo: 'streetwear' }))).toBe(0)
    expect(nota([camiseta({ corte: 'slim' })], pantalon({ corte: 'wide leg' }), sinCuerpo)).toBe(1)
    expect(nota([oversize], pantalon({ corte: 'tapered' }), sinCuerpo)).toBe(1)
    expect(nota([camiseta()], pantalon(), sinCuerpo)).toBe(0)
  })

  it('B2: en un cuerpo grande, todo amplio resta más', () => {
    expect(
      nota([camiseta({ corte: 'boxy' })], pantalon({ corte: 'balloon' }), grande),
    ).toBeLessThan(-2)
  })

  it('B3: una capa abierta encima suma y lo dice', () => {
    const sobrecamisa = prenda({
      categoria: 'abrigo',
      subcategoria: 'sobrecamisa',
      abrigo: 3,
      colores: ['caqui'],
    })
    const resultado = puntuarConjunto([camiseta(), sobrecamisa], pantalon(), grande)
    expect(resultado.consejo).toBe('lo de fuera abierto, que alarga')
    expect(resultado.puntos).toBeGreaterThan(
      puntuarConjunto([camiseta()], pantalon(), grande).puntos,
    )
  })

  it('B4: columna de color en el trabajo', () => {
    const marino = (categoria: 'superior' | 'inferior') =>
      prenda({ categoria, subcategoria: 'jersey', colores: ['azul marino'], abrigo: 2 })
    const trabajo = contexto({ perfil: GRANDE, ocasion: 'trabajo' })
    expect(nota([marino('superior')], marino('inferior'), trabajo)).toBe(1)
  })

  it('B5: arriba claro y abajo oscuro resta', () => {
    const negro = pantalon({ colores: ['negro'] })
    expect(nota([camiseta({ colores: ['blanco'] })], negro, grande)).toBe(-0.5)
  })

  it('B10: punto fino bajo americana suma; dos capas gruesas seguidas restan', () => {
    const merino = prenda({ subcategoria: 'jersey de merino', abrigo: 3, colores: ['gris'] })
    const americana = prenda({
      categoria: 'abrigo',
      subcategoria: 'americana',
      abrigo: 3,
      colores: ['negro'],
    })
    expect(nota([merino, americana], pantalon({ colores: ['negro'] }), grande)).toBe(1.5)
    const gruesa = prenda({ subcategoria: 'jersey de ochos', abrigo: 4, colores: ['crudo'] })
    const parka = prenda({
      categoria: 'abrigo',
      subcategoria: 'parka',
      abrigo: 5,
      colores: ['crudo'],
    })
    expect(nota([gruesa, parka], pantalon({ colores: ['crudo'] }), grande)).toBeLessThan(1)
  })

  it('B11: sudadera sola y floja resta; con pantalón sastre, no', () => {
    const sudadera = prenda({ subcategoria: 'sudadera', abrigo: 3, colores: ['gris'] })
    expect(nota([sudadera], pantalon({ colores: ['gris'] }), grande)).toBe(-1)
    expect(
      nota([sudadera], pantalon({ subcategoria: 'pantalón de pinzas', colores: ['gris'] }), grande),
    ).toBe(0)
  })
})

describe('cuatroOutfits con un perfil de cuerpo', () => {
  const armario = [
    camiseta({ id: 'camiseta', corte: 'regular' }),
    camiseta({ id: 'camiseta-oversize', corte: 'oversize', colores: ['negro'] }),
    pantalon({ id: 'pitillo', corte: 'skinny' }),
    pantalon({ id: 'recto', corte: 'regular / recto', colores: ['beige'] }),
    pantalon({ id: 'baggy', corte: 'baggy', colores: ['gris'] }),
    prenda({ id: 'chelsea', categoria: 'calzado', subcategoria: 'botas chelsea', abrigo: 2 }),
  ]

  it('con cuerpo grande, el pitillo sale menos y no hay outfit todo amplio', () => {
    const veces = (p?: PerfilReglas) => {
      let pitillos = 0
      let amplios = 0
      for (let semilla = 1; semilla <= 10; semilla++) {
        for (const o of cuatroOutfits(peticion(armario, p ? { perfil: p } : {}), semilla).outfits) {
          const ids = o.prendas.map((x) => x.id)
          if (ids.includes('pitillo')) pitillos++
          if (ids.includes('camiseta-oversize') && ids.includes('baggy')) amplios++
        }
      }
      return { pitillos, amplios }
    }
    const sin = veces()
    const con = veces(GRANDE)
    expect(con.pitillos).toBeLessThan(sin.pitillos)
    expect(con.amplios).toBe(0)
  })

  it('con la exterior obligatoria y solo una sobrecamisa amplia, evita el pantalón amplio', () => {
    const conLluvia = [
      camiseta({ id: 'camiseta', corte: 'regular' }),
      prenda({
        id: 'henley',
        subcategoria: 'henley',
        abrigo: 2,
        corte: 'regular',
        colores: ['gris'],
      }),
      pantalon({ id: 'baggy', corte: 'baggy', colores: ['gris'] }),
      pantalon({ id: 'recto', corte: 'regular / recto', colores: ['azul marino'] }),
      pantalon({ id: 'chinos', subcategoria: 'chinos', corte: 'relaxed', colores: ['beige'] }),
      prenda({
        id: 'sobrecamisa',
        categoria: 'abrigo',
        subcategoria: 'sobrecamisa',
        abrigo: 3,
        corte: 'oversize',
        colores: ['verde caqui'],
      }),
      prenda({ id: 'chelsea', categoria: 'calzado', subcategoria: 'botas chelsea', abrigo: 2 }),
    ]
    for (let semilla = 1; semilla <= 5; semilla++) {
      const { outfits } = cuatroOutfits(
        peticion(conLluvia, { tiempo: tiempo(17, { precipitacion: 'lluvia' }), perfil: GRANDE }),
        semilla,
      )
      expect(outfits.length).toBeGreaterThan(0)
      for (const o of outfits) expect(o.prendas.map((p) => p.id)).not.toContain('baggy')
    }
  })

  it('sin perfil sale lo mismo que antes de T8.4', () => {
    const a = cuatroOutfits(peticion(armario), 3)
    const b = cuatroOutfits(peticion(armario, { perfil: {} }), 3)
    expect(b.outfits.map((o) => o.prendas.map((p) => p.id))).toEqual(
      a.outfits.map((o) => o.prendas.map((p) => p.id)),
    )
  })
})
