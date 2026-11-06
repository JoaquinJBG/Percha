import type { GenerateContentParameters } from '@google/genai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorIA } from './errores.ts'
import { esquemaEtiquetaParaGemini, leerRespuestaEtiqueta } from './esquema-etiqueta.ts'
import { crearProveedorFalso, ETIQUETA_DE_PRUEBA } from './falso.ts'
import { LADO_MAXIMO_ETIQUETA } from './fotos.ts'
import { crearProveedorGemini } from './gemini.ts'
import { INSTRUCCION_ETIQUETA } from './prompt-etiqueta.ts'

const foto = new Blob(['etiqueta'], { type: 'image/jpeg' })

function montar(responder: () => Promise<unknown>) {
  const peticiones: GenerateContentParameters[] = []
  const prepararFoto = vi.fn((_foto: Blob, _lado?: number) =>
    Promise.resolve({ datos: 'QUJD', tipo: 'image/jpeg' }),
  )
  const proveedor = crearProveedorGemini({
    clave: 'clave-falsa-de-test',
    modelo: 'gemini-de-prueba',
    crearCliente: () =>
      Promise.resolve({
        generateContent: (params: GenerateContentParameters) => {
          peticiones.push(params)
          return responder().then((json) => ({ text: JSON.stringify(json) }))
        },
        get: () => Promise.resolve({}),
      }),
    prepararFoto,
  })
  return { proveedor, peticiones, prepararFoto }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('leer la respuesta de la etiqueta', () => {
  it('deja fuera lo vacío y normaliza la composición', () => {
    expect(
      leerRespuestaEtiqueta(
        JSON.stringify({
          marca: '  Zara ',
          referencia: '4085/021',
          talla: '',
          composicion: [
            { material: 'Algodón', porcentaje: 60 },
            { material: 'poliéster', porcentaje: 0 },
            { material: '  ', porcentaje: 40 },
          ],
        }),
      ),
    ).toEqual({
      marca: 'Zara',
      referencia: '4085/021',
      composicion: [{ material: 'algodón', porcentaje: 60 }, { material: 'poliéster' }],
    })
  })

  it('una etiqueta sin nada legible da un objeto vacío, no un error', () => {
    expect(
      leerRespuestaEtiqueta('{"marca":"","referencia":"","talla":"","composicion":[]}'),
    ).toEqual({})
  })

  it('un campo con forma rara no tira el resto, y lo largo se corta', () => {
    expect(
      leerRespuestaEtiqueta(
        JSON.stringify({ marca: 7, talla: 'X'.repeat(50), composicion: 'algodón' }),
      ),
    ).toEqual({ talla: 'X'.repeat(20) })
  })

  it('si no llega un objeto JSON, es una respuesta mala', () => {
    expect(() => leerRespuestaEtiqueta('no es json')).toThrow(ErrorIA)
    expect(() => leerRespuestaEtiqueta('[1, 2]')).toThrow(ErrorIA)
    expect(() => leerRespuestaEtiqueta('null')).toThrow(ErrorIA)
  })

  it('el esquema para Gemini pide los cuatro campos', () => {
    const esquema = esquemaEtiquetaParaGemini()
    expect(esquema).not.toHaveProperty('$schema')
    expect(esquema.required).toEqual(['marca', 'referencia', 'talla', 'composicion'])
  })
})

describe('leer la etiqueta con Gemini', () => {
  it('manda una sola foto, más grande que las de las prendas, con su instrucción y su esquema', async () => {
    const { proveedor, peticiones, prepararFoto } = montar(() =>
      Promise.resolve({ marca: 'Nike', referencia: 'DD1391-100', talla: '42', composicion: [] }),
    )

    const datos = await proveedor.leerEtiqueta(foto)

    expect(datos).toEqual({ marca: 'Nike', referencia: 'DD1391-100', talla: '42' })
    expect(prepararFoto).toHaveBeenCalledWith(foto, LADO_MAXIMO_ETIQUETA)
    expect(peticiones).toHaveLength(1)
    const config = peticiones[0]?.config
    expect(config?.systemInstruction).toBe(INSTRUCCION_ETIQUETA)
    expect(config?.responseJsonSchema).toEqual(esquemaEtiquetaParaGemini())
    const partes = (peticiones[0]?.contents as { parts: unknown[] }[])[0]?.parts
    expect(partes).toEqual([{ inlineData: { data: 'QUJD', mimeType: 'image/jpeg' } }])
  })

  it('pasa la cancelación a Gemini', async () => {
    const { proveedor, peticiones } = montar(() => Promise.resolve({}))
    const control = new AbortController()

    await proveedor.leerEtiqueta(foto, { signal: control.signal })

    expect(peticiones[0]?.config?.abortSignal).toBe(control.signal)
  })

  it('traduce los errores como el resto: sin cupo, foto que no se abre, sin clave', async () => {
    const sinCupo = montar(() =>
      Promise.reject(Object.assign(new Error('{}'), { name: 'ApiError', status: 429 })),
    )
    await expect(sinCupo.proveedor.leerEtiqueta(foto)).rejects.toMatchObject({ tipo: 'sin-cupo' })

    const malaFoto = montar(() => Promise.resolve({}))
    malaFoto.prepararFoto.mockRejectedValueOnce(new Error('no se puede decodificar'))
    await expect(malaFoto.proveedor.leerEtiqueta(foto)).rejects.toMatchObject({ tipo: 'foto' })
    expect(malaFoto.peticiones).toHaveLength(0)

    const sinClave = crearProveedorGemini({ clave: null, modelo: 'm' })
    await expect(sinClave.leerEtiqueta(foto)).rejects.toMatchObject({ tipo: 'sin-clave' })
  })
})

describe('leer la etiqueta con el proveedor falso', () => {
  it('devuelve la etiqueta de prueba y apunta la foto', async () => {
    const proveedor = crearProveedorFalso()

    expect(await proveedor.leerEtiqueta(foto)).toEqual(ETIQUETA_DE_PRUEBA)
    expect(proveedor.etiquetasLeidas).toEqual([foto])
  })

  it('devuelve lo que se le diga o falla con el error dado', async () => {
    const vacia = crearProveedorFalso({ etiqueta: () => ({}) })
    const sinRed = crearProveedorFalso({ error: new ErrorIA('sin-red') })

    expect(await vacia.leerEtiqueta(foto)).toEqual({})
    await expect(sinRed.leerEtiqueta(foto)).rejects.toMatchObject({ tipo: 'sin-red' })
  })
})
