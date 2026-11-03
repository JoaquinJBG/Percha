import type { GenerateContentParameters } from '@google/genai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorIA } from './errores.ts'
import { ETIQUETAS_DE_PRUEBA } from './falso.ts'
import { crearProveedorGemini, type ClienteGemini } from './gemini.ts'

const CLAVE_FALSA = 'clave-falsa-de-test'
const MODELO = 'gemini-de-prueba'
const foto = () => new Blob(['foto'], { type: 'image/png' })

/** Lo que devolvería Gemini para la prenda `indice`. */
function etiquetasIA(indice: number, cambios: Record<string, unknown> = {}) {
  return { indice, ...ETIQUETAS_DE_PRUEBA, ...cambios }
}

function errorDeApi(status: number, cuerpo: string) {
  return Object.assign(new Error(cuerpo), { name: 'ApiError', status })
}

function montar(responder: () => Promise<unknown>) {
  const peticiones: GenerateContentParameters[] = []
  const generateContent = vi.fn((params: GenerateContentParameters) => {
    peticiones.push(params)
    return responder().then((json) => ({ text: JSON.stringify(json) }))
  })
  const get = vi.fn(() => responder())
  const cliente: ClienteGemini = { generateContent, get }
  const crearCliente = vi.fn(() => Promise.resolve(cliente))
  const proveedor = crearProveedorGemini({
    clave: CLAVE_FALSA,
    modelo: MODELO,
    crearCliente,
    prepararFoto: () => Promise.resolve({ datos: 'QUJD', tipo: 'image/jpeg' }),
  })
  return { proveedor, generateContent, get, crearCliente, peticiones }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('etiquetar con Gemini', () => {
  it('manda todas las prendas en una petición, cada una tras su línea «Prenda N»', async () => {
    const { proveedor, peticiones, crearCliente } = montar(() =>
      Promise.resolve({ prendas: [etiquetasIA(1), etiquetasIA(2)] }),
    )

    await proveedor.etiquetarPrendas([{ fotos: [foto(), foto()] }, { fotos: [foto()] }])

    expect(crearCliente).toHaveBeenCalledWith(CLAVE_FALSA)
    expect(peticiones).toHaveLength(1)
    const [peticion] = peticiones
    expect(peticion?.model).toBe(MODELO)
    const partes = (peticion?.contents as { parts: { text?: string }[] }[])[0]?.parts ?? []
    expect(partes.map((parte) => parte.text ?? 'foto')).toEqual([
      'Prenda 1',
      'foto',
      'foto',
      'Prenda 2',
      'foto',
    ])
    expect(peticion?.config?.responseMimeType).toBe('application/json')
    expect(peticion?.config?.responseJsonSchema).toBeDefined()
    expect(JSON.stringify(peticion)).not.toContain(CLAVE_FALSA)
  })

  it('casa cada respuesta con su prenda por el índice, aunque lleguen desordenadas', async () => {
    const { proveedor } = montar(() =>
      Promise.resolve({
        prendas: [etiquetasIA(2, { categoria: 'calzado' }), etiquetasIA(1)],
      }),
    )

    const resultado = await proveedor.etiquetarPrendas([{ fotos: [foto()] }, { fotos: [foto()] }])

    expect(resultado.map((etiquetas) => etiquetas?.categoria)).toEqual(['superior', 'calzado'])
  })

  it('sin prendas no llama a Gemini', async () => {
    const { proveedor, crearCliente } = montar(() => Promise.resolve({ prendas: [] }))

    expect(await proveedor.etiquetarPrendas([])).toEqual([])
    expect(crearCliente).not.toHaveBeenCalled()
  })

  it('rechaza lotes de más de 5 prendas o prendas sin fotos', async () => {
    const { proveedor } = montar(() => Promise.resolve({ prendas: [] }))
    const seis = Array.from({ length: 6 }, () => ({ fotos: [foto()] }))

    await expect(proveedor.etiquetarPrendas(seis)).rejects.toBeInstanceOf(RangeError)
    await expect(proveedor.etiquetarPrendas([{ fotos: [] }])).rejects.toBeInstanceOf(RangeError)
  })

  it('sin clave avisa sin crear el cliente', async () => {
    const crearCliente = vi.fn()
    const proveedor = crearProveedorGemini({ clave: null, modelo: MODELO, crearCliente })

    await expect(proveedor.etiquetarPrendas([{ fotos: [foto()] }])).rejects.toMatchObject({
      tipo: 'sin-clave',
    })
    await expect(proveedor.comprobarClave()).rejects.toMatchObject({ tipo: 'sin-clave' })
    expect(crearCliente).not.toHaveBeenCalled()
  })
})

describe('respuestas inválidas de la IA', () => {
  async function etiquetarCon(respuesta: unknown, cuantas = 1) {
    const { proveedor } = montar(() => Promise.resolve(respuesta))
    return proveedor.etiquetarPrendas(Array.from({ length: cuantas }, () => ({ fotos: [foto()] })))
  }

  it.each([
    ['sin la lista de prendas', { otra: 1 }],
    ['con un estilo inventado', { prendas: [etiquetasIA(1, { estilos: ['galáctico'] })] }],
    ['con un abrigo fuera de 1–5', { prendas: [etiquetasIA(1, { abrigo: 7 })] }],
    ['con un color fuera de la lista', { prendas: [etiquetasIA(1, { colores: ['fucsia'] })] }],
    ['con un índice que no existe', { prendas: [etiquetasIA(3)] }],
  ])('la rechaza %s', async (_caso, respuesta) => {
    await expect(etiquetarCon(respuesta)).rejects.toMatchObject({ tipo: 'respuesta' })
  })

  it('la rechaza si no es JSON', async () => {
    const { proveedor, generateContent } = montar(() => Promise.resolve({}))
    generateContent.mockResolvedValue({ text: 'Lo siento, no puedo' })

    await expect(proveedor.etiquetarPrendas([{ fotos: [foto()] }])).rejects.toMatchObject({
      tipo: 'respuesta',
    })
  })

  it('si solo falla una prenda del lote, deja su hueco vacío y devuelve las demás', async () => {
    const resultado = await etiquetarCon(
      { prendas: [etiquetasIA(1, { formalidad: 0 }), etiquetasIA(2)] },
      2,
    )

    expect(resultado).toEqual([null, ETIQUETAS_DE_PRUEBA])
  })

  it('quita repetidos y normaliza lo que el modelo de datos normaliza', async () => {
    const [etiquetas] = await etiquetarCon({
      prendas: [
        etiquetasIA(1, {
          estilos: ['casual', 'casual'],
          temporadas: ['verano', 'verano'],
          subcategoria: '  camiseta ',
        }),
      ],
    })

    expect(etiquetas).toMatchObject({
      estilos: ['casual'],
      temporadas: ['verano'],
      subcategoria: 'camiseta',
    })
  })

  it('se queda con la primera respuesta si un índice viene repetido', async () => {
    const [etiquetas] = await etiquetarCon({
      prendas: [etiquetasIA(1), etiquetasIA(1, { categoria: 'calzado' })],
    })

    expect(etiquetas?.categoria).toBe('superior')
  })
})

describe('errores de Gemini', () => {
  it.each([
    [
      'clave-mala',
      errorDeApi(400, '{"error":{"status":"INVALID_ARGUMENT","details":["API_KEY_INVALID"]}}'),
    ],
    ['clave-mala', errorDeApi(401, '{}')],
    ['clave-mala', errorDeApi(403, '{"error":{"status":"PERMISSION_DENIED"}}')],
    ['sin-cupo', errorDeApi(429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}')],
    ['modelo', errorDeApi(404, '{}')],
    ['no-disponible', errorDeApi(503, '{}')],
    ['otro', errorDeApi(400, '{"error":{"status":"FAILED_PRECONDITION"}}')],
    ['sin-red', new TypeError('Failed to fetch')],
    ['otro', new Error('raro')],
  ])('da «%s» para %s', async (tipo, fallo) => {
    const { proveedor } = montar(() => Promise.reject(fallo))

    const etiquetar = proveedor.etiquetarPrendas([{ fotos: [foto()] }])
    await expect(etiquetar).rejects.toBeInstanceOf(ErrorIA)
    await expect(etiquetar).rejects.toMatchObject({ tipo })
    await expect(proveedor.comprobarClave()).rejects.toMatchObject({ tipo })
  })

  it('el mensaje del modelo que no existe dice cuál es', async () => {
    const { proveedor } = montar(() => Promise.reject(errorDeApi(404, '{}')))

    await expect(proveedor.comprobarClave()).rejects.toThrow('«gemini-de-prueba»')
  })

  it('sin conexión no llega a llamar', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { proveedor, crearCliente } = montar(() => Promise.resolve({}))

    await expect(proveedor.comprobarClave()).rejects.toMatchObject({ tipo: 'sin-red' })
    expect(crearCliente).not.toHaveBeenCalled()
  })

  it('una cancelación llega tal cual, sin convertirse en error de Gemini', async () => {
    const cancelada = new DOMException('Cancelada', 'AbortError')
    const { proveedor } = montar(() => Promise.reject(cancelada))

    await expect(proveedor.etiquetarPrendas([{ fotos: [foto()] }])).rejects.toBe(cancelada)
  })

  it('nunca pone la clave ni el texto de Google en el mensaje', async () => {
    const fallo = errorDeApi(400, `{"error":{"message":"API key not valid: ${CLAVE_FALSA}"}}`)
    const { proveedor } = montar(() => Promise.reject(fallo))

    const error = await proveedor.comprobarClave().catch((e: unknown) => e)

    expect(error).toMatchObject({ tipo: 'clave-mala', estado: 400 })
    expect(JSON.stringify(error)).not.toContain(CLAVE_FALSA)
    expect((error as Error).message).not.toContain(CLAVE_FALSA)
    expect((error as Error).cause).toBeUndefined()
  })

  it('comprobar la clave pide los datos del modelo, sin generar nada', async () => {
    const { proveedor, generateContent, get } = montar(() => Promise.resolve({ name: MODELO }))

    await proveedor.comprobarClave()

    expect(get).toHaveBeenCalledWith(expect.objectContaining({ model: MODELO }))
    expect(generateContent).not.toHaveBeenCalled()
  })
})
