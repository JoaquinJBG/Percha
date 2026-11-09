import { describe, expect, it } from 'vitest'
import { crearContexto } from './candidatos.ts'
import { fallaPila, puntuarPila, type Pila } from './pilas.ts'
import { prenda, tiempo } from './pruebas.ts'
import type { Contexto, Peticion, PrendaReglas } from './tipos.ts'

function contexto(cambios: Partial<Peticion> = {}): Contexto {
  return crearContexto({
    prendas: [],
    estilo: 'casual',
    ocasion: 'diario',
    tiempo: tiempo(10),
    ...cambios,
  })
}

function pila(
  base: PrendaReglas,
  medias: PrendaReglas[] = [],
  exterior: PrendaReglas | null = null,
): Pila {
  return { base, medias, exterior }
}

const camiseta = prenda({ subcategoria: 'camiseta', abrigo: 1, colores: ['blanco'] })
const camisa = prenda({ subcategoria: 'camisa oxford', abrigo: 2, colores: ['celeste'] })
const jersey = prenda({ subcategoria: 'jersey de merino', abrigo: 3, colores: ['gris'] })
const jerseyGrueso = prenda({ subcategoria: 'jersey de ochos', abrigo: 4, colores: ['crudo'] })
const sudadera = prenda({ subcategoria: 'sudadera con capucha', abrigo: 3, colores: ['gris'] })
const chalecoPunto = prenda({ subcategoria: 'chaleco de punto', abrigo: 2, colores: ['marrón'] })
const sobrecamisa = prenda({ categoria: 'abrigo', subcategoria: 'sobrecamisa', abrigo: 3 })
const shacket = prenda({ categoria: 'abrigo', subcategoria: 'shacket', abrigo: 4 })
const americana = prenda({
  categoria: 'abrigo',
  subcategoria: 'americana',
  abrigo: 3,
  colores: ['azul marino'],
})
const cazadora = prenda({ categoria: 'abrigo', subcategoria: 'cazadora vaquera', abrigo: 3 })
const abrigoPano = prenda({
  categoria: 'abrigo',
  subcategoria: 'abrigo de paño',
  abrigo: 4,
  colores: ['negro'],
})
const plumifero = prenda({ categoria: 'abrigo', subcategoria: 'plumífero', abrigo: 5 })
const vestido = prenda({ categoria: 'vestido', subcategoria: 'vestido midi', abrigo: 2 })

describe('fallaPila: reglas duras', () => {
  it('pilas buenas de la investigación pasan', () => {
    const frio = contexto({ tiempo: tiempo(8) })
    expect(fallaPila(pila(camiseta, [sobrecamisa], abrigoPano), frio, true)).toBeNull() // P1 con frío
    expect(fallaPila(pila(camisa, [jersey], abrigoPano), frio, true)).toBeNull() // P3
    expect(fallaPila(pila(camisa, [americana], abrigoPano), frio, true)).toBeNull() // P10
    expect(
      fallaPila(pila(camiseta, [], sobrecamisa), contexto({ tiempo: tiempo(18) }), true),
    ).toBeNull()
    expect(fallaPila(pila(vestido, [], abrigoPano), frio, true)).toBeNull()
  })

  it('C1: una capa que abriga mucho menos que la de debajo', () => {
    const fina = prenda({ categoria: 'abrigo', subcategoria: 'chubasquero', abrigo: 1 })
    expect(fallaPila(pila(camisa, [jerseyGrueso], fina), contexto(), true)).toBe(
      'una capa abriga mucho menos que la de debajo',
    )
  })

  it('C2: cuatro capas solo con 3 °C o menos y con una fina', () => {
    const cuatro = pila(camiseta, [camisa, jersey], abrigoPano)
    expect(fallaPila(cuatro, contexto({ tiempo: tiempo(8) }), true)).toBe(
      'cuatro capas solo con 3 °C o menos',
    )
    const conFina = pila(camiseta, [chalecoPunto, jersey], plumifero)
    expect(fallaPila(conFina, contexto({ tiempo: tiempo(1) }), true)).toBeNull()
  })

  it('C3: el abrigo largo va siempre fuera', () => {
    expect(
      fallaPila(pila(camiseta, [abrigoPano], plumifero), contexto({ tiempo: tiempo(2) }), true),
    ).toBe('un abrigo largo va siempre fuera')
  })

  it('C4: sobre la americana solo va un abrigo', () => {
    expect(fallaPila(pila(camisa, [americana], cazadora), contexto(), true)).toBe(
      'sobre la americana solo va un abrigo',
    )
    expect(fallaPila(pila(camiseta, [cazadora], sobrecamisa), contexto(), true)).toBe(
      'sobre una chaqueta solo va un abrigo',
    )
  })

  it('C9: un solo estampado entre las capas', () => {
    const rayas = prenda({ subcategoria: 'camiseta', abrigo: 1, estampado: 'rayas' })
    const cuadros = prenda({
      categoria: 'abrigo',
      subcategoria: 'sobrecamisa',
      abrigo: 3,
      estampado: 'cuadros',
    })
    expect(fallaPila(pila(rayas, [], cuadros), contexto({ tiempo: tiempo(18) }), true)).toBe(
      'dos estampados en las capas',
    )
  })

  it('C10: las combinaciones prohibidas', () => {
    const templado = contexto({ tiempo: tiempo(16) })
    expect(fallaPila(pila(camiseta, [], shacket), templado, true)).toBe(
      'una sobrecamisa gruesa no va sobre una camiseta sola',
    )
    expect(fallaPila(pila(jerseyGrueso, [], americana), templado, true)).toBe(
      'un jersey grueso no va bajo la americana',
    )
    const trabajo = contexto({ tiempo: tiempo(16), ocasion: 'trabajo' })
    expect(fallaPila(pila(sudadera, [], americana), trabajo, true)).toBe(
      'capucha bajo americana no va al trabajo',
    )
    expect(fallaPila(pila(sudadera, [], americana), templado, true)).toBeNull()
    expect(fallaPila(pila(camisa, [], chalecoPunto), contexto({ tiempo: tiempo(10) }), true)).toBe(
      'un chaleco de punto no abriga como exterior',
    )
  })

  it('patrones que no se llevan', () => {
    const fresco = contexto({ tiempo: tiempo(12) })
    expect(fallaPila(pila(camisa, [camisa], abrigoPano), fresco, true)).toBe(
      'una camisa abierta va sobre una camiseta',
    )
    expect(fallaPila(pila(vestido, [camiseta], abrigoPano), fresco, true)).toBe(
      'sobre un vestido no va otra parte de arriba',
    )
    expect(fallaPila(pila(camiseta, [jersey], sudadera), fresco, true)).toBe(
      'un jersey o una sudadera no va encima de otra capa',
    )
    const lluvia = contexto({ tiempo: tiempo(15, { precipitacion: 'lluvia' }) })
    expect(fallaPila(pila(camiseta, [], sudadera), lluvia, true)).toBe(
      'con lluvia lo de fuera tiene que ser un abrigo',
    )
  })

  it('con 3 °C o menos lo de fuera tiene que abrigar de verdad', () => {
    expect(fallaPila(pila(camisa, [jersey], cazadora), contexto({ tiempo: tiempo(2) }), true)).toBe(
      'a 2 °C lo de fuera tiene que ser un abrigo de verdad',
    )
  })

  it('abrigo de toda la parte de arriba según la temperatura', () => {
    expect(fallaPila(pila(camiseta), contexto({ tiempo: tiempo(8) }), true)).toBe(
      'poco abrigo arriba para 8 °C',
    )
    // Si el armario no tiene nada que ponerse encima, el poco abrigo solo resta.
    expect(fallaPila(pila(camiseta), contexto({ tiempo: tiempo(8) }), false)).toBeNull()
    expect(fallaPila(pila(camiseta, [], plumifero), contexto({ tiempo: tiempo(22) }), true)).toBe(
      'demasiado abrigo arriba para 22 °C',
    )
  })

  it('sin tiempo, encima solo algo ligero', () => {
    expect(fallaPila(pila(camiseta, [], abrigoPano), contexto({ tiempo: null }), true)).toBe(
      'sin saber el tiempo, encima solo algo ligero',
    )
    expect(fallaPila(pila(camiseta, [], sobrecamisa), contexto({ tiempo: null }), true)).toBeNull()
  })
})

describe('puntuarPila: reglas blandas', () => {
  const frio = contexto({ tiempo: tiempo(8) })

  it('C6: claro dentro y oscuro fuera suma', () => {
    const clara = prenda({
      categoria: 'abrigo',
      subcategoria: 'abrigo de paño',
      abrigo: 4,
      colores: ['beige'],
    })
    const oscuro = puntuarPila(pila(camiseta, [jersey], abrigoPano), frio, []).puntos
    const claro = puntuarPila(pila(camiseta, [jersey], clara), frio, []).puntos
    expect(oscuro - claro).toBe(0.5)
  })

  it('C7: dos capas seguidas del mismo tono restan', () => {
    const jerseyNegro = prenda({ subcategoria: 'jersey', abrigo: 3, colores: ['negro'] })
    const jerseyGris = prenda({ subcategoria: 'jersey', abrigo: 3, colores: ['gris'] })
    const igual = puntuarPila(pila(camiseta, [jerseyNegro], abrigoPano), frio, []).puntos
    const distinto = puntuarPila(pila(camiseta, [jerseyGris], abrigoPano), frio, []).puntos
    expect(distinto - igual).toBe(1)
  })

  it('C8: dos rugosas iguales restan', () => {
    const pana = prenda({ subcategoria: 'camisa de pana', abrigo: 2, colores: ['marrón'] })
    const sobrecamisaPana = prenda({
      categoria: 'abrigo',
      subcategoria: 'sobrecamisa de pana',
      abrigo: 3,
      colores: ['verde caqui'],
    })
    const lisa = prenda({
      categoria: 'abrigo',
      subcategoria: 'sobrecamisa',
      abrigo: 3,
      colores: ['verde caqui'],
    })
    const templado = contexto({ tiempo: tiempo(18) })
    const rugosas = puntuarPila(pila(pana, [], sobrecamisaPana), templado, []).puntos
    const mezcla = puntuarPila(pila(pana, [], lisa), templado, []).puntos
    expect(mezcla - rugosas).toBe(1)
  })

  it('C13: camiseta + camisa + sobrecamisa + abrigo resta mucho', () => {
    const camisaAbierta = prenda({
      subcategoria: 'camisa de franela',
      abrigo: 2,
      colores: ['rojo'],
    })
    const helado = contexto({ tiempo: tiempo(1) })
    const caqui = prenda({
      categoria: 'abrigo',
      subcategoria: 'sobrecamisa',
      abrigo: 3,
      colores: ['caqui'],
    })
    const cuatro = pila(camiseta, [camisaAbierta, caqui], plumifero)
    const tres = pila(camiseta, [caqui], plumifero)
    expect(
      puntuarPila(tres, helado, []).puntos - puntuarPila(cuatro, helado, []).puntos,
    ).toBeGreaterThanOrEqual(3)
  })

  it('el abrigo justo suma y la tercera pieza a 19 °C sale mejor que la camiseta sola', () => {
    const templado = contexto({ tiempo: tiempo(19) })
    const sola = puntuarPila(pila(camiseta), templado, []).puntos
    const conSobrecamisa = puntuarPila(pila(camiseta, [], sobrecamisa), templado, []).puntos
    expect(conSobrecamisa).toBeGreaterThan(sola)
  })

  it('C11 y C12: consejos de cómo llevarlo', () => {
    expect(puntuarPila(pila(camisa, [jersey], abrigoPano), frio, []).consejo).toBe(
      'cuello de la camisa por fuera',
    )
    expect(puntuarPila(pila(camiseta, [sobrecamisa], abrigoPano), frio, []).consejo).toBe(
      'lo de fuera, abierto',
    )
    expect(puntuarPila(pila(camiseta), contexto({ tiempo: tiempo(28) }), []).consejo).toBeNull()
  })
})
