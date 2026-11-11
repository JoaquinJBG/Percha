import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  crearProveedorFalso,
  crearProveedorGemini,
  ErrorIA,
  outfitsDePrueba,
} from '../../ia/index.ts'
import type { PeticionOutfits, PropuestaOutfit } from '../../ia/index.ts'
import { candidatos, comprobarOutfit, cuatroOutfits } from '../reglas/index.ts'
import type { Peticion, PrendaReglas, ResultadoOutfits } from '../reglas/index.ts'
import { armarioEjemplo, prenda, tiempo } from '../reglas/pruebas.ts'
import {
  elegirOutfitsConIA,
  MAX_POR_CATEGORIA,
  MAX_POR_CATEGORIA_ARRIBA,
  type OutfitIA,
} from './elegir.ts'

const trabajoConFrio: Peticion = {
  prendas: armarioEjemplo(),
  estilo: 'business',
  ocasion: 'trabajo',
  tiempo: tiempo(8),
}

function ids(outfits: readonly { prendas: readonly PrendaReglas[] }[]): string[] {
  return outfits.map((o) => o.prendas.map((p) => p.id).join('+'))
}

/** Cada outfit como conjunto, sin importar el orden. */
function conjuntos(outfits: readonly { prendas: readonly PrendaReglas[] }[]): string[] {
  return outfits.map((o) =>
    o.prendas
      .map((p) => p.id)
      .sort()
      .join('+'),
  )
}

function esValido(outfit: OutfitIA, peticion: Peticion): boolean {
  const comprobado = comprobarOutfit(
    outfit.prendas.map((p) => p.id),
    candidatos(peticion),
  )
  return 'prendas' in comprobado
}

/** Las propuestas buenas del proveedor falso, con la primera cambiada. */
function conLaPrimera(
  cambio: (buena: PropuestaOutfit, peticion: PeticionOutfits) => PropuestaOutfit,
) {
  return (peticion: PeticionOutfits) => {
    const [primera, ...resto] = outfitsDePrueba(peticion)
    return primera ? [cambio(primera, peticion), ...resto] : resto
  }
}

function sinCategoria(categoria: string) {
  return (buena: PropuestaOutfit, peticion: PeticionOutfits): PropuestaOutfit => {
    const deEsa = new Set(
      peticion.prendas.filter((p) => p.categoria === categoria).map((p) => p.id),
    )
    return { ...buena, prendas: buena.prendas.filter((id) => !deEsa.has(id)) }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('elegir outfits con IA', () => {
  it('con una respuesta buena devuelve los 4 de la IA, válidos y con su frase', async () => {
    const proveedor = crearProveedorFalso()

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })

    expect(resultado.errorIA).toBeNull()
    expect(resultado.outfits).toHaveLength(4)
    expect(resultado.outfits.map((o) => o.origen)).toEqual(['ia', 'ia', 'ia', 'ia'])
    expect(resultado.outfits.map((o) => o.motivo)).toEqual([
      'Outfit de prueba 1.',
      'Outfit de prueba 2.',
      'Outfit de prueba 3.',
      'Outfit de prueba 4.',
    ])
    for (const outfit of resultado.outfits) {
      expect(esValido(outfit, trabajoConFrio)).toBe(true)
      expect(outfit.principal).toBe(outfit.prendas[0])
      expect(outfit.prendas.some((p) => p.categoria === 'abrigo')).toBe(true)
    }
    expect(resultado.contexto.temperatura).toBe(8)
  })

  it('le manda a la IA solo texto: ids y etiquetas de las candidatas, estilo, ocasión y tiempo', async () => {
    const proveedor = crearProveedorFalso()

    await elegirOutfitsConIA(trabajoConFrio, 3, { proveedor })

    const [enviada] = proveedor.peticionesOutfits
    expect(enviada?.estilo).toBe('business')
    expect(enviada?.ocasion).toBe('trabajo')
    expect(enviada?.semilla).toBe(3)
    expect(enviada?.tiempo).toEqual({
      temperatura: 8,
      temperaturaVestir: 8,
      precipitacion: null,
      temporada: 'otoño',
      exterior: 'obligatoria',
    })
    const candidatas = new Set(candidatos(trabajoConFrio).candidatos.map((c) => c.prenda.id))
    expect(enviada?.prendas.length).toBeGreaterThan(0)
    for (const p of enviada?.prendas ?? []) {
      expect(candidatas.has(p.id)).toBe(true)
      expect(Object.keys(p).sort()).toEqual(
        [
          'abrigo',
          'categoria',
          'colores',
          'estampado',
          'estilos',
          'formalidad',
          'id',
          'notas',
          'subcategoria',
        ].sort(),
      )
    }
  })

  it(`no le manda más de ${String(MAX_POR_CATEGORIA_ARRIBA)} de arriba ni ${String(MAX_POR_CATEGORIA)} del resto por categoría`, async () => {
    const muchas = Array.from({ length: 30 }, (_, i) =>
      prenda({ id: `camiseta-${String(i)}`, categoria: 'superior' }),
    )
    const vaqueros = Array.from({ length: 12 }, (_, i) =>
      prenda({ id: `vaquero-${String(i)}`, categoria: 'inferior', subcategoria: 'vaqueros' }),
    )
    const peticion: Peticion = {
      prendas: [
        ...muchas,
        ...vaqueros,
        prenda({ id: 'zapatillas', categoria: 'calzado', subcategoria: 'zapatillas' }),
      ],
      estilo: 'casual',
      ocasion: 'diario',
      tiempo: tiempo(22),
    }
    const proveedor = crearProveedorFalso()

    await elegirOutfitsConIA(peticion, 1, { proveedor })

    const enviadas = proveedor.peticionesOutfits[0]?.prendas ?? []
    expect(enviadas.filter((p) => p.categoria === 'superior')).toHaveLength(
      MAX_POR_CATEGORIA_ARRIBA,
    )
    expect(enviadas.filter((p) => p.categoria === 'inferior')).toHaveLength(MAX_POR_CATEGORIA)
  })

  it('cambia por uno de las reglas el outfit con ids inventados', async () => {
    const proveedor = crearProveedorFalso({
      outfits: conLaPrimera((buena) => ({ ...buena, prendas: [...buena.prendas, 'no-existe'] })),
    })

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })

    expect(resultado.errorIA).toBeNull()
    expect(resultado.outfits).toHaveLength(4)
    expect(resultado.outfits.map((o) => o.origen)).toEqual(['ia', 'ia', 'ia', 'reglas'])
    expect(ids(resultado.outfits).join()).not.toContain('no-existe')
    // El relleno de reglas no repite la parte de arriba de los de la IA si puede.
    expect(new Set(resultado.outfits.map((o) => o.principal.id)).size).toBe(4)
    for (const outfit of resultado.outfits) expect(esValido(outfit, trabajoConFrio)).toBe(true)
  })

  it('no acepta una prenda del armario que las reglas descartaron hoy', async () => {
    const peticion: Peticion = {
      ...trabajoConFrio,
      prendas: [...armarioEjemplo(), prenda({ id: 'chanclas', categoria: 'calzado', abrigo: 1 })],
    }
    const proveedor = crearProveedorFalso({
      outfits: conLaPrimera((buena, enviada) => {
        const sinCalzado = sinCategoria('calzado')(buena, enviada)
        return { ...sinCalzado, prendas: [...sinCalzado.prendas, 'chanclas'] }
      }),
    })

    const resultado = await elegirOutfitsConIA(peticion, 1, { proveedor })

    expect(candidatos(peticion).descartadas.map((d) => d.prenda.id)).toContain('chanclas')
    expect(ids(resultado.outfits).join()).not.toContain('chanclas')
    expect(resultado.outfits.map((o) => o.origen)).toEqual(['ia', 'ia', 'ia', 'reglas'])
  })

  it.each([
    ['sin calzado', sinCategoria('calzado')],
    ['sin abrigo con 8 °C', sinCategoria('abrigo')],
    ['sin parte de abajo', sinCategoria('inferior')],
    ['sin prendas', (p: PropuestaOutfit) => ({ ...p, prendas: [] })],
    [
      'con una prenda repetida',
      (p: PropuestaOutfit) => ({ ...p, prendas: [...p.prendas, p.prendas[0] ?? ''] }),
    ],
  ])('cambia por uno de las reglas el outfit incompleto o mal hecho (%s)', async (_, cambio) => {
    const proveedor = crearProveedorFalso({ outfits: conLaPrimera(cambio) })

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })

    expect(resultado.outfits).toHaveLength(4)
    expect(resultado.outfits.filter((o) => o.origen === 'ia')).toHaveLength(3)
    for (const outfit of resultado.outfits) expect(esValido(outfit, trabajoConFrio)).toBe(true)
  })

  it('no repite un outfit que la IA propone dos veces', async () => {
    const proveedor = crearProveedorFalso({
      outfits: (peticion) => {
        const [primera] = outfitsDePrueba(peticion)
        return primera ? [primera, { ...primera, prendas: [...primera.prendas].reverse() }] : []
      },
    })

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })

    expect(new Set(conjuntos(resultado.outfits)).size).toBe(4)
    expect(resultado.outfits.map((o) => o.origen)).toEqual(['ia', 'reglas', 'reglas', 'reglas'])
  })

  it.each([
    [
      'respuesta inválida',
      new ErrorIA('respuesta'),
      'respuesta',
      'Gemini ha devuelto algo que no se entiende. Prueba otra vez.',
    ],
    ['429 sin cupo', new ErrorIA('sin-cupo', { estado: 429 }), 'sin-cupo', null],
    ['sin red', new ErrorIA('sin-red'), 'sin-red', null],
  ] as const)('con %s devuelve las reglas con un aviso', async (_, error, tipo, mensaje) => {
    const proveedor = crearProveedorFalso({ error })

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 5, { proveedor })

    const reglas = cuatroOutfits(trabajoConFrio, 5)
    expect(resultado.errorIA).toBe(tipo)
    expect(ids(resultado.outfits)).toEqual(ids(reglas.outfits))
    expect(resultado.outfits.map((o) => o.origen)).toEqual(['reglas', 'reglas', 'reglas', 'reglas'])
    expect(resultado.avisos).toContain(`outfits sin IA: ${mensaje ?? error.message}`)
    expect(resultado.avisos.join()).not.toContain('etiqueta a mano')
  })

  it('si la IA no devuelve ningún outfit con forma válida, salen las reglas', async () => {
    const proveedor = crearProveedorFalso({ outfits: () => [] })

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })

    expect(resultado.errorIA).toBe('respuesta')
    expect(resultado.outfits).toHaveLength(4)
  })

  it('si la IA responde pero no vale ninguno de sus outfits, lo avisa como respuesta inválida', async () => {
    const proveedor = crearProveedorFalso({
      outfits: (peticion) =>
        outfitsDePrueba(peticion).map((o) => ({ ...o, prendas: [...o.prendas, 'inventada'] })),
    })

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })

    expect(resultado.errorIA).toBe('respuesta')
    expect(resultado.outfits.map((o) => o.origen)).toEqual(['reglas', 'reglas', 'reglas', 'reglas'])
    expect(resultado.avisos.some((a) => a.startsWith('outfits sin IA: '))).toBe(true)
  })

  describe('capas y tercera pieza', () => {
    function armario() {
      return [
        prenda({ id: 'camiseta', abrigo: 2 }),
        prenda({ id: 'chinos', categoria: 'inferior', subcategoria: 'chinos', colores: ['beige'] }),
        prenda({ id: 'zapatillas', categoria: 'calzado', subcategoria: 'zapatillas' }),
        {
          ...prenda({
            id: 'sobrecamisa',
            categoria: 'abrigo',
            subcategoria: 'sobrecamisa',
            colores: ['caqui'],
            abrigo: 3,
          }),
          composicion: [{ material: 'algodón', porcentaje: 100 }],
        },
        prenda({
          id: 'plumifero',
          categoria: 'abrigo',
          subcategoria: 'plumífero',
          colores: ['azul marino'],
          abrigo: 5,
        }),
        prenda({ id: 'gorra-rockera', categoria: 'accesorio', estilos: ['rockero'] }),
      ]
    }

    function enviadasCon(sensacion: number) {
      const proveedor = crearProveedorFalso()
      const peticion: Peticion = {
        prendas: armario(),
        estilo: 'casual',
        ocasion: 'diario',
        tiempo: tiempo(sensacion),
      }
      return elegirOutfitsConIA(peticion, 1, { proveedor }).then(() => {
        const [enviada] = proveedor.peticionesOutfits
        return enviada
      })
    }

    it('entre 14 y 23 °C manda la sobrecamisa como tercera pieza opcional, no el plumífero', async () => {
      const enviada = await enviadasCon(20)

      expect(enviada?.tiempo.exterior).toBe('opcional')
      const sobrecamisa = enviada?.prendas.find((p) => p.id === 'sobrecamisa')
      expect(sobrecamisa).toMatchObject({
        opcional: true,
        composicion: [{ material: 'algodón', porcentaje: 100 }],
      })
      expect(enviada?.prendas.map((p) => p.id)).not.toContain('plumifero')
      expect(enviada?.prendas.find((p) => p.id === 'camiseta')?.opcional).toBeUndefined()
    })

    it.each([14, 16])(
      'a %i °C manda los puntos gruesos, que son capa media aunque abriguen',
      async (sensacion) => {
        const proveedor = crearProveedorFalso()
        const peticion: Peticion = {
          prendas: [
            ...armario(),
            prenda({ id: 'jersey-ochos', subcategoria: 'jersey grueso de ochos', abrigo: 4 }),
            prenda({ id: 'cardigan-grueso', subcategoria: 'cárdigan grueso', abrigo: 4 }),
          ],
          estilo: 'casual',
          ocasion: 'diario',
          tiempo: tiempo(sensacion),
        }

        await elegirOutfitsConIA(peticion, 1, { proveedor })

        const ids = proveedor.peticionesOutfits[0]?.prendas.map((p) => p.id)
        expect(ids).toEqual(expect.arrayContaining(['jersey-ochos', 'cardigan-grueso']))
        expect(ids).not.toContain('plumifero')
      },
    )

    it('con calor no manda abrigos; los accesorios de otro estilo, nunca', async () => {
      const enviada = await enviadasCon(27)

      const ids = enviada?.prendas.map((p) => p.id)
      expect(enviada?.tiempo.exterior).toBe('no')
      expect(ids).toEqual(expect.arrayContaining(['camiseta', 'chinos', 'zapatillas']))
      expect(ids).not.toContain('sobrecamisa')
      expect(ids).not.toContain('gorra-rockera')
    })

    it('acepta camiseta + sobrecamisa + abrigo y los ordena de dentro afuera', async () => {
      const peticion: Peticion = {
        prendas: armario(),
        estilo: 'casual',
        ocasion: 'diario',
        tiempo: tiempo(9),
      }
      const proveedor = crearProveedorFalso({
        outfits: () => [
          {
            prendas: ['plumifero', 'sobrecamisa', 'camiseta', 'chinos', 'zapatillas'],
            porque: 'Tres capas de fino a grueso.',
          },
        ],
      })

      const resultado = await elegirOutfitsConIA(peticion, 1, { proveedor })

      const [primero] = resultado.outfits
      expect(resultado.errorIA).toBeNull()
      expect(primero?.origen).toBe('ia')
      expect(primero?.prendas.map((p) => p.id)).toEqual([
        'camiseta',
        'chinos',
        'sobrecamisa',
        'plumifero',
        'zapatillas',
      ])
      expect(primero?.principal.id).toBe('camiseta')
      expect(primero?.motivo).toBe('Tres capas de fino a grueso.')
    })

    it('con frío cambia por uno de las reglas el outfit sin capa exterior', async () => {
      const peticion: Peticion = {
        prendas: armario(),
        estilo: 'casual',
        ocasion: 'diario',
        tiempo: tiempo(9),
      }
      const proveedor = crearProveedorFalso({
        outfits: () => [{ prendas: ['camiseta', 'chinos', 'zapatillas'], porque: 'Sin abrigo.' }],
      })

      const resultado = await elegirOutfitsConIA(peticion, 1, { proveedor })

      expect(resultado.outfits.every((o) => o.origen === 'reglas')).toBe(true)
      expect(resultado.errorIA).toBe('respuesta')
    })
  })

  it('sin clave no llama a Gemini y salen las reglas con el aviso de Ajustes', async () => {
    const crearCliente = vi.fn()
    const proveedor = crearProveedorGemini({
      clave: null,
      modelo: 'gemini-de-prueba',
      crearCliente,
    })

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })

    expect(crearCliente).not.toHaveBeenCalled()
    expect(resultado.errorIA).toBe('sin-clave')
    expect(resultado.outfits).toHaveLength(4)
    expect(resultado.avisos.join()).toContain('Ajustes')
  })

  it('sin red no llama a Gemini y salen las reglas', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const crearCliente = vi.fn()
    const proveedor = crearProveedorGemini({
      clave: 'clave-falsa-de-test',
      modelo: 'm',
      crearCliente,
    })

    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })

    expect(crearCliente).not.toHaveBeenCalled()
    expect(resultado.errorIA).toBe('sin-red')
    expect(resultado.outfits).toHaveLength(4)
  })

  it('un fallo inesperado (al leer Ajustes, p. ej.) tampoco llega a la pantalla', async () => {
    const resultado = await elegirOutfitsConIA(trabajoConFrio, 1, {
      proveedor: () => Promise.reject(new Error('IndexedDB cerrada')),
    })

    expect(resultado.errorIA).toBe('otro')
    expect(resultado.outfits).toHaveLength(4)
    expect(resultado.avisos.join()).not.toContain('IndexedDB')
  })

  it('si se cancela, lanza el AbortError', async () => {
    const cancelacion = new DOMException('cancelado', 'AbortError')
    const proveedor = crearProveedorFalso()
    vi.spyOn(proveedor, 'elegirOutfits').mockRejectedValue(cancelacion)

    await expect(elegirOutfitsConIA(trabajoConFrio, 1, { proveedor })).rejects.toBe(cancelacion)
  })

  it('sin base o sin calzado no gasta cupo: devuelve lo de las reglas', async () => {
    const proveedor = crearProveedorFalso()
    const peticion: Peticion = {
      ...trabajoConFrio,
      prendas: [prenda(), prenda({ categoria: 'inferior' })],
    }

    const resultado = await elegirOutfitsConIA(peticion, 1, { proveedor })

    expect(proveedor.peticionesOutfits).toHaveLength(0)
    expect(resultado.outfits).toEqual([])
    expect(resultado.avisos).toEqual(cuatroOutfits(peticion).avisos)
  })

  it('con un armario pequeño avisa de que salen menos de 4', async () => {
    const proveedor = crearProveedorFalso()
    const peticion: Peticion = {
      prendas: [
        prenda({ id: 'camiseta-a' }),
        prenda({ id: 'camiseta-b' }),
        prenda({ id: 'vaquero', categoria: 'inferior', colores: ['vaquero'] }),
        prenda({ id: 'zapatillas', categoria: 'calzado' }),
      ],
      estilo: 'casual',
      ocasion: 'diario',
      tiempo: tiempo(22),
    }

    const resultado = await elegirOutfitsConIA(peticion, 1, { proveedor })

    expect(resultado.outfits).toHaveLength(2)
    expect(resultado.avisos).toContain('solo salen 2 outfits distintos: añade prendas para tener 4')
  })

  it('se puede usar donde se espera un selector como cuatroOutfits', async () => {
    const proveedor = crearProveedorFalso()
    const selector: (
      peticion: Peticion,
      semilla?: number,
    ) => ResultadoOutfits | Promise<ResultadoOutfits> = (peticion, semilla) =>
      elegirOutfitsConIA(peticion, semilla, { proveedor })

    const resultado = await selector(trabajoConFrio)

    expect(resultado.outfits).toHaveLength(4)
  })
})
