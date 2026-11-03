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
import { elegirOutfitsConIA, MAX_POR_CATEGORIA, type OutfitIA } from './elegir.ts'

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
    expect(enviada?.tiempo).toMatchObject({ temperatura: 8, necesitaAbrigo: true })
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

  it(`no le manda más de ${String(MAX_POR_CATEGORIA)} candidatas por categoría`, async () => {
    const muchas = Array.from({ length: 30 }, (_, i) =>
      prenda({ id: `camiseta-${String(i)}`, categoria: 'superior' }),
    )
    const peticion: Peticion = {
      prendas: [
        ...muchas,
        prenda({ id: 'vaquero', categoria: 'inferior', subcategoria: 'vaqueros' }),
        prenda({ id: 'zapatillas', categoria: 'calzado', subcategoria: 'zapatillas' }),
      ],
      estilo: 'casual',
      ocasion: 'diario',
      tiempo: tiempo(22),
    }
    const proveedor = crearProveedorFalso()

    await elegirOutfitsConIA(peticion, 1, { proveedor })

    const enviadas = proveedor.peticionesOutfits[0]?.prendas ?? []
    expect(enviadas.filter((p) => p.categoria === 'superior')).toHaveLength(MAX_POR_CATEGORIA)
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

  it('no le manda abrigos si hoy no hacen falta ni accesorios de otro estilo, como las reglas', async () => {
    const peticion: Peticion = {
      prendas: [
        prenda({ id: 'camiseta' }),
        prenda({ id: 'vaquero', categoria: 'inferior', colores: ['vaquero'] }),
        prenda({ id: 'zapatillas', categoria: 'calzado' }),
        prenda({ id: 'cazadora', categoria: 'abrigo', abrigo: 3 }),
        prenda({ id: 'gorra-rockera', categoria: 'accesorio', estilos: ['rockero'] }),
      ],
      estilo: 'casual',
      ocasion: 'diario',
      tiempo: tiempo(22),
    }
    const proveedor = crearProveedorFalso()

    await elegirOutfitsConIA(peticion, 1, { proveedor })

    const enviadas = proveedor.peticionesOutfits[0]?.prendas.map((p) => p.id)
    expect(enviadas).toEqual(expect.arrayContaining(['camiseta', 'vaquero', 'zapatillas']))
    expect(enviadas).not.toContain('cazadora')
    expect(enviadas).not.toContain('gorra-rockera')
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
