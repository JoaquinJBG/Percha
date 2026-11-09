import type { GenerateContentParameters } from '@google/genai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  esquemaOutfitsParaGemini,
  leerRespuestaOutfits,
  MAX_PRENDAS_POR_OUTFIT,
  referencias,
} from './esquema-outfits.ts'
import { crearProveedorFalso, outfitsDePrueba } from './falso.ts'
import { crearProveedorGemini, type ClienteGemini } from './gemini.ts'
import { INSTRUCCION_OUTFITS, textoPeticionOutfits } from './prompt-outfits.ts'
import type { PeticionOutfits, PrendaParaOutfit } from './tipos.ts'

const CLAVE_FALSA = 'clave-falsa-de-test'
const MODELO = 'gemini-de-prueba'

const TIPO_POR_CATEGORIA: Partial<Record<PrendaParaOutfit['categoria'], string>> = {
  calzado: 'zapatillas',
  inferior: 'vaqueros',
  abrigo: 'gabardina',
}

function prenda(
  id: string,
  categoria: PrendaParaOutfit['categoria'],
  cambios: Partial<PrendaParaOutfit> = {},
): PrendaParaOutfit {
  return {
    id,
    categoria,
    subcategoria: TIPO_POR_CATEGORIA[categoria] ?? 'camiseta',
    colores: ['blanco'],
    estampado: 'liso',
    estilos: ['casual'],
    abrigo: 2,
    formalidad: 2,
    notas: '',
    ...cambios,
  }
}

/** Lo que se le mandaría a Gemini para esta petición. */
function texto(peticion: PeticionOutfits): string {
  return textoPeticionOutfits(peticion, referencias(peticion.prendas.length))
}

function linea(enviado: string, referencia: string): string {
  return enviado.split('\n').find((l) => l.startsWith(`${referencia} `)) ?? ''
}

const peticion: PeticionOutfits = {
  prendas: [
    prenda('uuid-camiseta', 'superior'),
    prenda('uuid-vaquero', 'inferior'),
    prenda('uuid-zapatillas', 'calzado'),
  ],
  estilo: 'casual',
  ocasion: 'diario',
  tiempo: { temperatura: 12, precipitacion: 'lluvia', temporada: 'otoño', exterior: 'obligatoria' },
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
      'Tiempo: 12 °C de sensación, lluvia, otoño. Haría falta capa exterior, pero no hay ninguna',
    )
    expect(texto).toContain('P1 · superior · camiseta · blanco · liso · capas: base · estilos')
    expect(texto).toContain('P3 · calzado · zapatillas · blanco · liso · estilos')
    expect(texto).not.toContain('uuid-')
    expect(enviada?.config).toMatchObject({
      systemInstruction: INSTRUCCION_OUTFITS,
      responseMimeType: 'application/json',
      responseJsonSchema: esquemaOutfitsParaGemini(),
      seed: 7,
    })
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

describe('prompt v2 de outfits', () => {
  it('la instrucción habla de capas, formalidad, color y variedad, y aún no de perfil', () => {
    for (const fragmento of [
      'base, media, exterior',
      'Como mucho 2 prendas de categoría «superior» y 2 de categoría «abrigo»',
      '13 °C o menos, 3 con exterior',
      'De fino a grueso',
      'nada encima de una americana salvo un abrigo',
      'Entre 14 y 23 °C',
      'Las prendas marcadas «opcional»',
      'Entre la prenda más formal y la más informal, como mucho 2 puntos',
      'Parejas que funcionan: azul marino con gris',
      'al menos uno tonal',
      'máximo 25 palabras',
    ]) {
      expect(INSTRUCCION_OUTFITS).toContain(fragmento)
    }
    expect(INSTRUCCION_OUTFITS).not.toMatch(/perfil|cuerpo|oliva/i)
  })

  it('manda las capas de cada prenda de arriba: las guardadas o las de por defecto', () => {
    const enviado = texto({
      ...peticion,
      prendas: [
        prenda('a', 'superior', { subcategoria: 'camisa oxford' }),
        prenda('b', 'superior', { subcategoria: 'camisa', capas: ['media'] }),
        prenda('c', 'abrigo', { subcategoria: 'sobrecamisa' }),
        prenda('d', 'inferior'),
      ],
    })

    expect(linea(enviado, 'P1')).toBe(
      'P1 · superior · camisa oxford · blanco · liso · capas: base, media · estilos: casual · ' +
        'abrigo 2/5 · formalidad 2/5',
    )
    expect(linea(enviado, 'P2')).toContain('capas: media ·')
    expect(linea(enviado, 'P3')).toContain('capas: media, exterior ·')
    expect(linea(enviado, 'P4')).not.toContain('capas')
  })

  it('manda la composición de la etiqueta cuando la hay', () => {
    const enviado = texto({
      ...peticion,
      prendas: [
        prenda('a', 'superior', {
          composicion: [
            { material: 'algodón', porcentaje: 60 },
            { material: 'lino', porcentaje: 40 },
            { material: 'forro de poliéster' },
          ],
        }),
      ],
    })

    expect(linea(enviado, 'P1')).toContain(
      'formalidad 2/5 · 60 % algodón, 40 % lino, forro de poliéster',
    )
  })

  it('entre 14 y 23 °C marca las terceras piezas como opcionales', () => {
    const enviado = texto({
      ...peticion,
      tiempo: { temperatura: 19, precipitacion: null, temporada: 'otoño', exterior: 'opcional' },
      prendas: [
        prenda('a', 'superior'),
        prenda('b', 'abrigo', { subcategoria: 'sobrecamisa', opcional: true }),
      ],
    })

    expect(enviado).toContain(
      'Tiempo: 19 °C de sensación, otoño. No hace falta abrigo; una capa media o exterior ligera ' +
        'es opcional',
    )
    expect(linea(enviado, 'P2')).toMatch(/formalidad 2\/5 · opcional$/)
    expect(linea(enviado, 'P1')).not.toContain('opcional')
  })

  it.each([
    ['obligatoria', 'Hace falta capa exterior.'],
    ['no', 'No hace falta capa exterior.'],
  ] as const)('con capa exterior «%s» lo dice', (exterior, frase) => {
    const enviado = texto({
      ...peticion,
      tiempo: { ...peticion.tiempo, exterior },
      prendas: [...peticion.prendas, prenda('g', 'abrigo')],
    })

    expect(enviado).toContain(frase)
  })

  it('recorta las notas largas', () => {
    const enviado = texto({
      ...peticion,
      prendas: [prenda('a', 'abrigo', { notas: `algodón\n${'x'.repeat(500)}` })],
    })

    expect(linea(enviado, 'P1')).toContain('algodón x')
    expect(linea(enviado, 'P1').length).toBeLessThan(230)
  })
})

describe('esquema de outfits', () => {
  const idPorReferencia = new Map(referencias(9).map((ref) => [ref, `id-${ref}`]))

  it(`admite outfits de hasta ${String(MAX_PRENDAS_POR_OUTFIT)} prendas`, () => {
    const [outfit] = leerRespuestaOutfits(
      JSON.stringify({ outfits: [{ prendas: referencias(8), porque: 'Cuatro capas.' }] }),
      idPorReferencia,
    )

    expect(MAX_PRENDAS_POR_OUTFIT).toBe(8)
    expect(outfit?.prendas).toEqual(referencias(8).map((ref) => `id-${ref}`))
  })

  it('descarta un outfit de 9 prendas', () => {
    expect(() =>
      leerRespuestaOutfits(
        JSON.stringify({ outfits: [{ prendas: referencias(9), porque: 'Demasiado.' }] }),
        idPorReferencia,
      ),
    ).toThrow(expect.objectContaining({ tipo: 'respuesta' }))
  })

  it('el esquema de Gemini dice el máximo', () => {
    expect(JSON.stringify(esquemaOutfitsParaGemini())).toContain('"maxItems":8')
  })
})

describe('elegir outfits con el proveedor falso', () => {
  it('con capa exterior obligatoria pone una; con tercera pieza opcional, en el 1.º y el 3.º', () => {
    const prendas = [
      prenda('camiseta-1', 'superior'),
      prenda('camiseta-2', 'superior'),
      prenda('camiseta-3', 'superior'),
      prenda('vaquero', 'inferior'),
      prenda('zapatillas', 'calzado'),
      prenda('sobrecamisa', 'abrigo', { subcategoria: 'sobrecamisa', opcional: true }),
    ]

    const conFrio = outfitsDePrueba({ ...peticion, prendas })
    const templado = outfitsDePrueba({
      ...peticion,
      prendas,
      tiempo: { temperatura: 19, precipitacion: null, temporada: 'otoño', exterior: 'opcional' },
    })

    expect(conFrio.every((o) => o.prendas.includes('sobrecamisa'))).toBe(true)
    expect(templado.map((o) => o.prendas.includes('sobrecamisa'))).toEqual([true, false, true])
  })

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
