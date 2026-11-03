import { describe, expect, it } from 'vitest'
import { candidatos, mejoresPorCategoria } from './candidatos.ts'
import { prenda, tiempo } from './pruebas.ts'
import type { Peticion, PrendaReglas } from './tipos.ts'

function peticion(prendas: PrendaReglas[], cambios: Partial<Peticion> = {}): Peticion {
  return { prendas, estilo: 'casual', ocasion: 'diario', tiempo: null, ...cambios }
}

function ids(lista: readonly { prenda: PrendaReglas }[]): string[] {
  return lista.map((c) => c.prenda.id)
}

function motivoDe(resultado: ReturnType<typeof candidatos>, id: string): string | undefined {
  return resultado.descartadas.find((d) => d.prenda.id === id)?.motivo
}

describe('contexto', () => {
  it('con frío pide abrigo y guarda la sensación media', () => {
    const { contexto } = candidatos(peticion([], { tiempo: tiempo(8) }))
    expect(contexto).toMatchObject({ temperatura: 8, necesitaAbrigo: true, temporada: 'otoño' })
  })

  it('con 20 °C y lluvia también pide abrigo', () => {
    const { contexto } = candidatos(
      peticion([], { tiempo: tiempo(20, { precipitacion: 'lluvia' }) }),
    )
    expect(contexto).toMatchObject({ precipitacion: 'lluvia', necesitaAbrigo: true })
  })

  it('sin tiempo no pide abrigo y saca la temporada de la fecha', () => {
    const { contexto } = candidatos(peticion([], { fecha: '2026-01-20' }))
    expect(contexto).toMatchObject({
      temperatura: null,
      necesitaAbrigo: false,
      temporada: 'invierno',
    })
  })

  it('lleva el rango de formalidad de la ocasión y los estilos afines', () => {
    const { contexto } = candidatos(peticion([], { ocasion: 'boda', estilo: 'formal' }))
    expect(contexto.formalidad).toEqual({ minima: 4, maxima: 5 })
    expect(contexto.estilosAfines).toContain('business')
  })
})

describe('abrigo según la temperatura', () => {
  it('con frío descarta lo de tirantes y los pantalones cortos', () => {
    const tirantes = prenda({ id: 'tirantes', abrigo: 1 })
    const cortos = prenda({ id: 'cortos', categoria: 'inferior', abrigo: 1 })
    const jersey = prenda({ id: 'jersey', abrigo: 4 })
    const resultado = candidatos(peticion([tirantes, cortos, jersey], { tiempo: tiempo(2) }))
    expect(ids(resultado.candidatos)).toEqual(['jersey'])
    expect(motivoDe(resultado, 'cortos')).toBe('poco abrigo para 2 °C')
  })

  it('con frío descarta las sandalias', () => {
    const sandalias = prenda({ id: 'sandalias', categoria: 'calzado', abrigo: 1 })
    const resultado = candidatos(peticion([sandalias], { tiempo: tiempo(3) }))
    expect(motivoDe(resultado, 'sandalias')).toBe('poco abrigo para 3 °C')
  })

  it('con calor descarta el jersey de lana y los abrigos', () => {
    const jersey = prenda({ id: 'jersey', abrigo: 4 })
    const gabardina = prenda({ id: 'gabardina', categoria: 'abrigo', abrigo: 2 })
    const camiseta = prenda({ id: 'camiseta', abrigo: 1 })
    const resultado = candidatos(peticion([jersey, gabardina, camiseta], { tiempo: tiempo(30) }))
    expect(ids(resultado.candidatos)).toEqual(['camiseta'])
    expect(motivoDe(resultado, 'jersey')).toBe('demasiado abrigo para 30 °C')
    expect(motivoDe(resultado, 'gabardina')).toBe('hace calor para abrigo a 30 °C')
  })

  it('con calor y lluvia deja un chubasquero ligero', () => {
    const chubasquero = prenda({ id: 'chubasquero', categoria: 'abrigo', abrigo: 1 })
    const resultado = candidatos(
      peticion([chubasquero], { tiempo: tiempo(27, { precipitacion: 'lluvia' }) }),
    )
    expect(ids(resultado.candidatos)).toEqual(['chubasquero'])
  })

  it('un accesorio fino no se descarta por frío', () => {
    const gafas = prenda({ id: 'gafas', categoria: 'accesorio', abrigo: 1 })
    expect(ids(candidatos(peticion([gafas], { tiempo: tiempo(0) })).candidatos)).toEqual(['gafas'])
  })

  it('puntúa más lo que se ajusta a la temperatura', () => {
    const justa = prenda({ id: 'justa', abrigo: 3 })
    const fresca = prenda({ id: 'fresca', abrigo: 1 })
    const resultado = candidatos(peticion([fresca, justa], { tiempo: tiempo(17) }))
    expect(ids(resultado.candidatos)).toEqual(['justa', 'fresca'])
  })

  it('sin tiempo no filtra por abrigo', () => {
    const plumifero = prenda({ id: 'plumifero', categoria: 'abrigo', abrigo: 5 })
    const cortos = prenda({ id: 'cortos', categoria: 'inferior', abrigo: 1 })
    expect(candidatos(peticion([plumifero, cortos])).descartadas).toEqual([])
  })
})

describe('lluvia y nieve', () => {
  const sandalias = prenda({ id: 'sandalias', categoria: 'calzado', subcategoria: 'Sandalias' })
  const ante = prenda({
    id: 'ante',
    categoria: 'calzado',
    subcategoria: 'botines',
    notas: 'de ante',
  })
  const elegantes = prenda({
    id: 'elegantes',
    categoria: 'calzado',
    subcategoria: 'zapatos',
    notas: 'muy elegantes',
  })
  const botasAgua = prenda({ id: 'botas', categoria: 'calzado', subcategoria: 'botas de agua' })

  it('con lluvia descarta el calzado abierto y el ante', () => {
    const resultado = candidatos(
      peticion([sandalias, ante, elegantes, botasAgua], {
        tiempo: tiempo(18, { precipitacion: 'lluvia' }),
      }),
    )
    expect(motivoDe(resultado, 'sandalias')).toBe('con lluvia no va calzado abierto')
    expect(motivoDe(resultado, 'ante')).toBe('con lluvia no va el ante ni el terciopelo')
    expect(ids(resultado.candidatos)).toEqual(['botas', 'elegantes'])
  })

  it('con nieve también', () => {
    const resultado = candidatos(
      peticion([sandalias, ante], { tiempo: tiempo(14, { precipitacion: 'nieve' }) }),
    )
    expect(resultado.candidatos).toEqual([])
    expect(motivoDe(resultado, 'sandalias')).toBe('con nieve no va calzado abierto')
  })

  it('sin lluvia las sandalias valen', () => {
    expect(ids(candidatos(peticion([sandalias], { tiempo: tiempo(25) })).candidatos)).toEqual([
      'sandalias',
    ])
  })
})

describe('temporada', () => {
  const deVerano = prenda({ id: 'verano', temporadas: ['verano'] })
  const todoElAno = prenda({ id: 'siempre', temporadas: [] })

  it('sin tiempo descarta lo de la temporada opuesta', () => {
    const resultado = candidatos(peticion([deVerano, todoElAno], { fecha: '2026-01-15' }))
    expect(ids(resultado.candidatos)).toEqual(['siempre'])
    expect(motivoDe(resultado, 'verano')).toBe('es de verano y estamos en invierno')
  })

  it('con tiempo manda la temperatura: solo puntúa menos', () => {
    const resultado = candidatos(
      peticion([deVerano, todoElAno], { tiempo: tiempo(25, { fecha: '2026-01-15' }) }),
    )
    expect(ids(resultado.candidatos)).toEqual(['siempre', 'verano'])
  })

  it('una prenda de primavera y verano no se descarta en invierno', () => {
    const entretiempo = prenda({ temporadas: ['primavera', 'verano'] })
    expect(candidatos(peticion([entretiempo], { fecha: '2026-01-15' })).descartadas).toEqual([])
  })

  it('sin tiempo ni fecha no filtra por temporada', () => {
    expect(candidatos(peticion([deVerano])).descartadas).toEqual([])
  })
})

describe('ocasión y formalidad', () => {
  it('para una boda descarta lo muy informal y deja como parcial lo casi formal', () => {
    const camiseta = prenda({ id: 'camiseta', formalidad: 1 })
    const camisa = prenda({ id: 'camisa', formalidad: 3, estilos: ['formal'] })
    const resultado = candidatos(
      peticion([camiseta, camisa], { ocasion: 'boda', estilo: 'formal' }),
    )
    expect(motivoDe(resultado, 'camiseta')).toBe('muy informal para boda')
    expect(resultado.candidatos).toMatchObject([{ prenda: { id: 'camisa' }, ajuste: 'parcial' }])
  })

  it('para deporte descarta el traje', () => {
    const traje = prenda({ id: 'traje', formalidad: 5 })
    expect(motivoDe(candidatos(peticion([traje], { ocasion: 'deporte' })), 'traje')).toBe(
      'demasiado formal para deporte',
    )
  })

  it('ir un punto más arreglado se tolera', () => {
    const americana = prenda({ formalidad: 5 })
    const [candidato] = candidatos(peticion([americana], { ocasion: 'trabajo' })).candidatos
    expect(candidato?.ajuste).toBe('pleno')
  })

  it('puntúa más lo que está etiquetado para la ocasión', () => {
    const paraCita = prenda({ id: 'cita', ocasiones: ['cita'] })
    const paraCasa = prenda({ id: 'casa', ocasiones: ['casa'] })
    const sinOcasion = prenda({ id: 'libre', ocasiones: [] })
    const resultado = candidatos(peticion([paraCasa, sinOcasion, paraCita], { ocasion: 'cita' }))
    expect(ids(resultado.candidatos)).toEqual(['cita', 'libre', 'casa'])
  })
})

describe('estilo', () => {
  it('ordena exacto, afín y otro estilo, y marca este último como parcial', () => {
    const exacta = prenda({ id: 'exacta', estilos: ['streetwear'] })
    const afin = prenda({ id: 'afin', estilos: ['y2k'] })
    const otra = prenda({ id: 'otra', estilos: ['old money / quiet luxury'] })
    const resultado = candidatos(peticion([otra, afin, exacta], { estilo: 'streetwear' }))
    expect(ids(resultado.candidatos)).toEqual(['exacta', 'afin', 'otra'])
    expect(resultado.candidatos.map((c) => c.ajuste)).toEqual(['pleno', 'pleno', 'parcial'])
  })

  it('una prenda sin estilos vale para cualquiera', () => {
    const [candidato] = candidatos(
      peticion([prenda({ estilos: [] })], { estilo: 'grunge' }),
    ).candidatos
    expect(candidato?.ajuste).toBe('pleno')
  })
})

describe('candidatos', () => {
  it('devuelve las mismas prendas que recibe, sin copiarlas', () => {
    const original = prenda()
    expect(candidatos(peticion([original])).candidatos[0]?.prenda).toBe(original)
  })

  it('a igualdad de puntos ordena por id, sea cual sea el orden de entrada', () => {
    const a = prenda({ id: 'a' })
    const b = prenda({ id: 'b' })
    expect(ids(candidatos(peticion([b, a])).candidatos)).toEqual(['a', 'b'])
  })
})

describe('avisos', () => {
  it('armario vacío', () => {
    expect(candidatos(peticion([])).avisos).toEqual([
      'tu armario está vacío: añade prendas para ver outfits',
    ])
  })

  it('falta calzado', () => {
    const avisos = candidatos(peticion([prenda(), prenda({ categoria: 'inferior' })])).avisos
    expect(avisos).toEqual(['te falta calzado'])
  })

  it('falta calzado por la lluvia, con el motivo', () => {
    const avisos = candidatos(
      peticion(
        [
          prenda(),
          prenda({ categoria: 'inferior' }),
          prenda({ categoria: 'abrigo', abrigo: 3 }),
          prenda({ categoria: 'calzado', subcategoria: 'chanclas' }),
        ],
        { tiempo: tiempo(15, { precipitacion: 'lluvia' }) },
      ),
    ).avisos
    expect(avisos).toEqual(['te falta calzado (con lluvia no va calzado abierto)'])
  })

  it('falta la parte de abajo', () => {
    const avisos = candidatos(peticion([prenda(), prenda({ categoria: 'calzado' })])).avisos
    expect(avisos).toEqual(['te falta una parte de abajo (o un vestido)'])
  })

  it('falta abrigo con frío', () => {
    const avisos = candidatos(
      peticion(
        [
          prenda({ abrigo: 3 }),
          prenda({ categoria: 'inferior', abrigo: 3 }),
          prenda({ categoria: 'calzado', abrigo: 3 }),
        ],
        { tiempo: tiempo(5) },
      ),
    ).avisos
    expect(avisos).toEqual(['te falta un abrigo para 5 °C'])
  })

  it('armario informal para una boda: dice por qué', () => {
    const informal = [
      prenda({ formalidad: 1 }),
      prenda({ categoria: 'inferior', formalidad: 2 }),
      prenda({ categoria: 'calzado', formalidad: 1 }),
    ]
    const avisos = candidatos(peticion(informal, { ocasion: 'boda', estilo: 'formal' })).avisos
    expect(avisos).toEqual([
      'te falta ropa: una parte de arriba y otra de abajo, o un vestido (muy informal para boda)',
      'te falta calzado (muy informal para boda)',
    ])
  })

  it('si solo hay prendas parciales, avisa de que usa lo más parecido', () => {
    const avisos = candidatos(
      peticion(
        [
          prenda({ estilos: ['boho'] }),
          prenda({ categoria: 'inferior', estilos: ['boho'] }),
          prenda({ categoria: 'calzado', estilos: ['casual'] }),
        ],
        { estilo: 'techwear' },
      ),
    ).avisos
    expect(avisos).toEqual([
      'no tienes ropa ni calzado que encaje del todo con techwear para diario: uso lo más parecido',
    ])
  })
})

describe('casos raros que encontró la revisión', () => {
  const lluvia = tiempo(15, { precipitacion: 'lluvia' })

  it('«ante» como preposición en las notas no descarta', () => {
    const camisa = prenda({ id: 'camisa', notas: 'Perfecta ante cualquier plan' })
    const botines = prenda({ id: 'botines', categoria: 'calzado', notas: 'Botines de ante' })
    const resultado = candidatos(peticion([camisa, botines], { tiempo: lluvia }))
    expect(ids(resultado.candidatos)).toEqual(['camisa'])
  })

  it('«agua» en las notas no la hace impermeable', () => {
    const lana = prenda({ categoria: 'abrigo', abrigo: 3, notas: 'lavar a mano con agua fría' })
    const [candidato] = candidatos(peticion([lana], { tiempo: lluvia })).candidatos
    expect(candidato?.motivos).not.toContain('para la lluvia')
  })

  it('sandalias marcadas como abrigadas tampoco con frío', () => {
    const sandalias = prenda({
      id: 's',
      categoria: 'calzado',
      subcategoria: 'sandalias',
      abrigo: 3,
    })
    expect(motivoDe(candidatos(peticion([sandalias], { tiempo: tiempo(5) })), 's')).toBe(
      'con 5 °C no va calzado abierto',
    )
  })

  it('pantalón corto a 15 °C fuera', () => {
    const cortos = prenda({ id: 'c', categoria: 'inferior', subcategoria: 'Shorts', abrigo: 2 })
    expect(motivoDe(candidatos(peticion([cortos], { tiempo: tiempo(15) })), 'c')).toBe(
      'con 15 °C no van pantalones cortos',
    )
  })

  it('con calor fuera botas de nieve y gorro de lana; a 15 °C, fuera el plumífero', () => {
    const botas = prenda({ categoria: 'calzado', abrigo: 4 })
    const gorro = prenda({ categoria: 'accesorio', abrigo: 3 })
    expect(candidatos(peticion([botas, gorro], { tiempo: tiempo(27) })).candidatos).toEqual([])
    const plumifero = prenda({ categoria: 'abrigo', abrigo: 5 })
    expect(candidatos(peticion([plumifero], { tiempo: tiempo(15) })).candidatos).toEqual([])
  })

  it('en casa no cuenta el tiempo de fuera', () => {
    const { contexto } = candidatos(peticion([], { ocasion: 'casa', tiempo: tiempo(3) }))
    expect(contexto).toMatchObject({ temperatura: null, necesitaAbrigo: false, temporada: 'otoño' })
  })

  it('con lluvia y calor no hace falta abrigo', () => {
    const { contexto } = candidatos(
      peticion([], { tiempo: tiempo(30, { precipitacion: 'lluvia' }) }),
    )
    expect(contexto.necesitaAbrigo).toBe(false)
  })

  it('otro estilo y además algo informal: fuera', () => {
    const sudadera = prenda({ id: 'sudadera', estilos: ['streetwear'], formalidad: 3 })
    const resultado = candidatos(peticion([sudadera], { ocasion: 'boda', estilo: 'formal' }))
    expect(motivoDe(resultado, 'sudadera')).toBe('de otro estilo y algo informal para boda')
  })

  it('los avisos y las descartadas no dependen del orden de entrada', () => {
    const armario = [
      prenda({ id: 'a' }),
      prenda({ id: 'b', categoria: 'inferior' }),
      prenda({ id: 'c', categoria: 'calzado', subcategoria: 'sandalias' }),
      prenda({ id: 'd', categoria: 'calzado', subcategoria: 'botines de ante' }),
    ]
    const ida = candidatos(peticion(armario, { tiempo: lluvia }))
    const vuelta = candidatos(peticion([...armario].reverse(), { tiempo: lluvia }))
    expect(vuelta.avisos).toEqual(ida.avisos)
    expect(ids(vuelta.descartadas)).toEqual(ids(ida.descartadas))
  })
})

describe('mejoresPorCategoria', () => {
  it('se queda con las n primeras de cada categoría', () => {
    const lista = candidatos(
      peticion([
        prenda({ id: 's1' }),
        prenda({ id: 's2' }),
        prenda({ id: 's3' }),
        prenda({ id: 'z1', categoria: 'calzado' }),
      ]),
    ).candidatos
    expect(ids(mejoresPorCategoria(lista, 2))).toEqual(['s1', 's2', 'z1'])
  })
})
