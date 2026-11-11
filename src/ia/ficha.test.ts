import type { GenerateContentParameters } from '@google/genai'
import { describe, expect, it, vi } from 'vitest'
import { nuevaPrenda } from '../datos/pruebas.ts'
import { ErrorIA } from './errores.ts'
import { leerCandidatas } from './esquema-ficha.ts'
import { crearProveedorFalso, fichaDePrueba } from './falso.ts'
import { crearProveedorGemini, MODELO_BUSQUEDA, type RespuestaGemini } from './gemini.ts'

const CLAVE_FALSA = 'clave-falsa-de-test'
const prenda = nuevaPrenda({
  categoria: 'inferior',
  subcategoria: 'vaquero',
  colores: ['vaquero'],
  marca: 'Zara',
  referencia: '4085/021',
  corte: 'balloon',
})

function montar(responder: () => Promise<RespuestaGemini>) {
  const peticiones: GenerateContentParameters[] = []
  const generateContent = vi.fn((params: GenerateContentParameters) => {
    peticiones.push(params)
    return responder()
  })
  const proveedor = crearProveedorGemini({
    clave: CLAVE_FALSA,
    modelo: 'gemini-3.5-flash-lite',
    crearCliente: () => Promise.resolve({ generateContent, get: vi.fn() }),
    prepararFoto: () => Promise.resolve({ datos: 'QUJD', tipo: 'image/jpeg' }),
  })
  return { proveedor, peticiones }
}

const candidata = (n: number, cambios: Record<string, unknown> = {}) => ({
  nombre: `Vaquero balloon ${String(n)}`,
  tienda: 'Zara',
  enlace: `https://www.zara.com/es/es/vaquero-p0408502${String(n)}.html`,
  foto: `https://static.zara.net/foto${String(n)}.jpg`,
  ...cambios,
})

function errorDeApi(status: number, cuerpo: string) {
  return Object.assign(new Error(cuerpo), { name: 'ApiError', status })
}

describe('buscar la ficha con Gemini y la búsqueda de Google', () => {
  it('usa 2.5 Flash con la búsqueda, manda la foto y lo que se sabe, y lee lo que encontró', async () => {
    const { proveedor, peticiones } = montar(() =>
      Promise.resolve({
        text: '```json\n' + JSON.stringify({ candidatas: [candidata(1)] }) + '\n```',
        usageMetadata: { promptTokenCount: 1300, candidatesTokenCount: 90, totalTokenCount: 1500 },
        candidates: [
          {
            groundingMetadata: {
              webSearchQueries: ['zara vaquero balloon 4085/021'],
              groundingChunks: [
                { web: { uri: 'https://vertexaisearch.cloud.google.com/x', title: 'zara.com' } },
                { web: {} },
              ],
            },
          },
        ],
      }),
    )

    const resultado = await proveedor.buscarFicha(prenda)

    const [peticion] = peticiones
    expect(peticion?.model).toBe(MODELO_BUSQUEDA)
    expect(peticion?.config?.tools).toEqual([{ googleSearch: {} }])
    expect(peticion?.config?.responseJsonSchema).toBeUndefined()
    const texto = JSON.stringify(peticion?.contents)
    expect(texto).toContain('Marca: Zara')
    expect(texto).toContain('Referencia: 4085/021')
    expect(texto).toContain('Corte: balloon')
    expect(texto).toContain('inlineData')
    expect(texto).not.toContain(CLAVE_FALSA)
    expect(resultado).toMatchObject({
      candidatas: [candidata(1)],
      fuentes: [{ titulo: 'zara.com', enlace: 'https://vertexaisearch.cloud.google.com/x' }],
      busquedas: ['zara vaquero balloon 4085/021'],
      tokens: { entrada: 1300, salida: 90, total: 1500 },
      modelo: MODELO_BUSQUEDA,
    })
    expect(resultado.ms).toBeGreaterThanOrEqual(0)
  })

  it('sin uso ni metadatos devuelve nulos y listas vacías', async () => {
    const { proveedor } = montar(() => Promise.resolve({ text: '{"candidatas": []}' }))

    expect(await proveedor.buscarFicha(prenda)).toMatchObject({
      candidatas: [],
      fuentes: [],
      busquedas: [],
      tokens: { entrada: null, salida: null, total: null },
    })
  })

  it.each([
    ['sin cupo', errorDeApi(429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}'), 'sin-cupo'],
    [
      'sin cupo aunque hable de facturación',
      errorDeApi(
        429,
        '{"error":{"message":"You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 10"}}',
      ),
      'sin-cupo',
    ],
    [
      'de pago (límite gratis 0)',
      errorDeApi(
        429,
        '{"error":{"message":"You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/grounding_free_tier_requests, limit: 0"}}',
      ),
      'de-pago',
    ],
    ['sin red', new TypeError('Failed to fetch'), 'sin-red'],
    ['clave mala', errorDeApi(400, '{"error":{"details":["API_KEY_INVALID"]}}'), 'clave-mala'],
  ])('%s da su ErrorIA', async (_caso, fallo, tipo) => {
    const { proveedor } = montar(() => Promise.reject(fallo))

    await expect(proveedor.buscarFicha(prenda)).rejects.toMatchObject({ tipo })
  })

  it('si el modelo no existe, dice que es el de la búsqueda', async () => {
    const { proveedor } = montar(() => Promise.reject(errorDeApi(404, '{}')))

    await expect(proveedor.buscarFicha(prenda)).rejects.toThrow('«gemini-2.5-flash»')
  })

  it('sin clave no llama', async () => {
    const crearCliente = vi.fn()
    const proveedor = crearProveedorGemini({ clave: null, modelo: 'x', crearCliente })

    await expect(proveedor.buscarFicha(prenda)).rejects.toBeInstanceOf(ErrorIA)
    expect(crearCliente).not.toHaveBeenCalled()
  })
})

describe('leer las candidatas', () => {
  it('quita las que no tienen nombre o enlace web, las repetidas y las que sobran de 3', () => {
    const texto = JSON.stringify({
      candidatas: [
        candidata(1),
        candidata(1),
        candidata(2, { enlace: 'javascript:alert(1)' }),
        candidata(3, { nombre: '' }),
        candidata(4, { foto: 'ftp://x', tienda: '  ' }),
        candidata(5, { foto: null, tienda: undefined }),
        candidata(6),
        candidata(7),
      ],
    })

    const candidatas = leerCandidatas(`Aquí tienes: ${texto} ¡Suerte!`)

    expect(candidatas.map((c) => c.nombre)).toEqual([
      'Vaquero balloon 1',
      'Vaquero balloon 4',
      'Vaquero balloon 5',
    ])
    expect(candidatas[1]).toMatchObject({ foto: null, tienda: null })
  })

  it.each([
    ['texto sin JSON', 'No he encontrado nada.'],
    ['JSON roto', '{"candidatas": [}'],
    ['JSON sin candidatas', '{"otra": 1}'],
  ])('%s no se entiende', (_caso, texto) => {
    expect(() => leerCandidatas(texto)).toThrow(ErrorIA)
  })
})

describe('buscar la ficha con el proveedor falso', () => {
  it('devuelve dos candidatas con la marca y apunta la prenda', async () => {
    const falso = crearProveedorFalso()

    const resultado = await falso.buscarFicha(prenda)

    expect(resultado).toEqual(fichaDePrueba(prenda))
    expect(resultado.candidatas).toHaveLength(2)
    expect(resultado.candidatas[0]?.nombre).toBe('vaquero Zara (prueba)')
    expect(falso.fichasBuscadas).toEqual([prenda])
  })

  it('falla con el error que se le diga', async () => {
    const falso = crearProveedorFalso({ error: new ErrorIA('de-pago') })

    await expect(falso.buscarFicha(prenda)).rejects.toMatchObject({ tipo: 'de-pago' })
  })
})
