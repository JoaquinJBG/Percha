import type { GenerateContentParameters } from '@google/genai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { esquemaOutfitsParaGemini } from './esquema-outfits.ts'
import { crearProveedorFalso } from './falso.ts'
import { crearProveedorGemini, type ClienteGemini } from './gemini.ts'
import { INSTRUCCION_OUTFITS } from './prompt-outfits.ts'
import type { PeticionOutfits, PrendaParaOutfit } from './tipos.ts'

const CLAVE_FALSA = 'clave-falsa-de-test'
const MODELO = 'gemini-de-prueba'

function prenda(id: string, categoria: PrendaParaOutfit['categoria']): PrendaParaOutfit {
  return {
    id,
    categoria,
    subcategoria: categoria === 'calzado' ? 'zapatillas' : 'camiseta',
    colores: ['blanco'],
    estampado: 'liso',
    estilos: ['casual'],
    abrigo: 2,
    formalidad: 2,
    notas: '',
  }
}

const peticion: PeticionOutfits = {
  prendas: [
    prenda('uuid-camiseta', 'superior'),
    prenda('uuid-vaquero', 'inferior'),
    prenda('uuid-zapatillas', 'calzado'),
  ],
  estilo: 'casual',
  ocasion: 'diario',
  tiempo: { temperatura: 12, precipitacion: 'lluvia', necesitaAbrigo: true, temporada: 'otoño' },
  semilla: 7,
}

function errorDeApi(status: number, cuerpo: string) {
  return Object.assign(new Error(cuerpo), { name: 'ApiError', status })
}

function montar(responder: () => Promise<unknown>, crudo = false) {
  const peticiones: GenerateContentParameters[] = []
  const generateContent = vi.fn((params: GenerateContentParameters) => {
    peticiones.push(params)
    return responder().then((json) => ({ text: crudo ? String(json) : JSON.stringify(json) }))
  })
  const cliente: ClienteGemini = { generateContent, get: vi.fn() }
  const crearCliente = vi.fn(() => Promise.resolve(cliente))
  const proveedor = crearProveedorGemini({ clave: CLAVE_FALSA, modelo: MODELO, crearCliente })
  return { proveedor, crearCliente, peticiones }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('elegir outfits con Gemini', () => {
  it('manda una sola parte de texto, sin fotos, con referencias cortas en vez de ids', async () => {
    const { proveedor, peticiones } = montar(() =>
      Promise.resolve({ outfits: [{ prendas: ['P1', 'P2', 'P3'], porque: 'Cómodo.' }] }),
    )

    await proveedor.elegirOutfits(peticion)

    expect(peticiones).toHaveLength(1)
    const [enviada] = peticiones
    expect(enviada?.model).toBe(MODELO)
    const partes = (enviada?.contents as { parts: Record<string, unknown>[] }[])[0]?.parts ?? []
    expect(partes).toHaveLength(1)
    expect(Object.keys(partes[0] ?? {})).toEqual(['text'])
    const texto = String(partes[0]?.text)
    expect(texto).toContain('Estilo: casual')
    expect(texto).toContain('Ocasión: diario')
    expect(texto).toContain(
      'Tiempo: 12 °C de sensación, lluvia, otoño. Haría falta abrigo, pero no hay',
    )
    expect(texto).toContain('P1 · superior · camiseta · blanco · liso')
    expect(texto).toContain('P3 · calzado · zapatillas')
    expect(texto).not.toContain('uuid-')
    expect(enviada?.config).toMatchObject({
      systemInstruction: INSTRUCCION_OUTFITS,
      responseMimeType: 'application/json',
      responseJsonSchema: esquemaOutfitsParaGemini(),
      seed: 7,
    })
  })

  it('dice si hace falta abrigo y recorta las notas largas', async () => {
    const { proveedor, peticiones } = montar(() =>
      Promise.resolve({ outfits: [{ prendas: ['P1'], porque: 'Vale.' }] }),
    )
    const conAbrigo: PeticionOutfits = {
      ...peticion,
      prendas: [
        ...peticion.prendas,
        { ...prenda('uuid-gabardina', 'abrigo'), notas: `algodón\n${'x'.repeat(500)}` },
      ],
    }

    await proveedor.elegirOutfits(conAbrigo)

    const partes = (peticiones[0]?.contents as { parts: { text: string }[] }[])[0]?.parts ?? []
    const texto = partes[0]?.text ?? ''
    expect(texto).toContain('otoño. Hace falta abrigo.')
    const linea = texto.split('\n').find((l) => l.startsWith('P4 ')) ?? ''
    expect(linea).toContain('algodón x')
    expect(linea.length).toBeLessThan(220)
  })

  it('devuelve los ids de las prendas y la frase de cada outfit', async () => {
    const { proveedor } = montar(() =>
      Promise.resolve({
        outfits: [{ prendas: ['P1', ' p2 ', 'P3'], porque: '  Cómodo   para la lluvia. ' }],
      }),
    )

    expect(await proveedor.elegirOutfits(peticion)).toEqual([
      {
        prendas: ['uuid-camiseta', 'uuid-vaquero', 'uuid-zapatillas'],
        porque: 'Cómodo para la lluvia.',
      },
    ])
  })

  it('deja tal cual una referencia que no se envió, para que se vea que no existe', async () => {
    const { proveedor } = montar(() =>
      Promise.resolve({ outfits: [{ prendas: ['P1', 'P9', 'P3'], porque: 'Inventado.' }] }),
    )

    const [outfit] = await proveedor.elegirOutfits(peticion)

    expect(outfit?.prendas).toEqual(['uuid-camiseta', 'P9', 'uuid-zapatillas'])
  })

  it('quita los outfits sin forma válida y se queda con 4 como mucho', async () => {
    const bueno = { prendas: ['P1', 'P2', 'P3'], porque: 'Vale.' }
    const { proveedor } = montar(() =>
      Promise.resolve({
        outfits: [
          { prendas: 'P1', porque: 'No es lista.' },
          { prendas: ['P1'], porque: '   ' },
          { prendas: [], porque: 'Vacío.' },
          bueno,
          bueno,
          bueno,
          bueno,
          bueno,
        ],
      }),
    )

    expect(await proveedor.elegirOutfits(peticion)).toHaveLength(4)
  })

  it.each([
    ['no es JSON', 'esto no es JSON'],
    ['no trae outfits', JSON.stringify({ prendas: [] })],
    ['ningún outfit vale', JSON.stringify({ outfits: [{ prendas: [1, 2], porque: '' }] })],
  ])('rechaza la respuesta si %s', async (_, texto) => {
    const { proveedor } = montar(() => Promise.resolve(texto), true)

    await expect(proveedor.elegirOutfits(peticion)).rejects.toMatchObject({ tipo: 'respuesta' })
  })

  it('con un 429 lanza «sin cupo»', async () => {
    const { proveedor } = montar(() =>
      Promise.reject(errorDeApi(429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}')),
    )

    await expect(proveedor.elegirOutfits(peticion)).rejects.toMatchObject({
      tipo: 'sin-cupo',
      estado: 429,
    })
  })

  it('sin clave avisa sin crear el cliente', async () => {
    const crearCliente = vi.fn()
    const proveedor = crearProveedorGemini({ clave: null, modelo: MODELO, crearCliente })

    await expect(proveedor.elegirOutfits(peticion)).rejects.toMatchObject({ tipo: 'sin-clave' })
    expect(crearCliente).not.toHaveBeenCalled()
  })

  it('una cancelación llega tal cual', async () => {
    const cancelada = new DOMException('Cancelada', 'AbortError')
    const { proveedor } = montar(() => Promise.reject(cancelada))

    await expect(proveedor.elegirOutfits(peticion)).rejects.toBe(cancelada)
  })
})

describe('elegir outfits con el proveedor falso', () => {
  it('apunta la petición y propone outfits con las prendas que recibe', async () => {
    const proveedor = crearProveedorFalso()

    const outfits = await proveedor.elegirOutfits(peticion)

    expect(proveedor.peticionesOutfits).toEqual([peticion])
    expect(outfits).toEqual([
      {
        prendas: ['uuid-camiseta', 'uuid-vaquero', 'uuid-zapatillas'],
        porque: 'Outfit de prueba 1.',
      },
    ])
  })

  it('sin ningún outfit falla como una respuesta inválida', async () => {
    const proveedor = crearProveedorFalso({ outfits: () => [] })

    await expect(proveedor.elegirOutfits(peticion)).rejects.toMatchObject({ tipo: 'respuesta' })
  })
})
