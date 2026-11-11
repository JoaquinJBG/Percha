import type { GenerateContentParameters } from '@google/genai'
import { describe, expect, it, vi } from 'vitest'
import { ErrorIA } from './errores.ts'
import { esquemaTablaTallasParaGemini, leerRespuestaTablaTallas } from './esquema-tabla-tallas.ts'
import { crearProveedorFalso, TABLA_TALLAS_DE_PRUEBA } from './falso.ts'
import { crearProveedorGemini } from './gemini.ts'

const VACIA = {
  pecho: 0,
  cintura: 0,
  cadera: 0,
  hombros: 0,
  manga: 0,
  largo: 0,
  largoPierna: 0,
  pie: 0,
}

function respuesta(cambios: Record<string, unknown> = {}) {
  return JSON.stringify({
    marca: 'Zara',
    tipo: 'pantalón',
    medidaDe: 'cuerpo',
    unidad: 'cm',
    filas: [
      { ...VACIA, talla: '40', cintura: 78, cadera: 96 },
      { ...VACIA, talla: '42', cintura: 82, cadera: 100 },
    ],
    ...cambios,
  })
}

describe('leer la tabla de tallas', () => {
  it('se queda con las medidas que hay, en cm, y quita los ceros', () => {
    expect(leerRespuestaTablaTallas(respuesta())).toEqual({
      marca: 'Zara',
      tipo: 'pantalón',
      medidaDe: 'cuerpo',
      filas: [
        { talla: '40', cintura: 78, cadera: 96 },
        { talla: '42', cintura: 82, cadera: 100 },
      ],
    })
  })

  it('pasa las pulgadas a cm con un decimal', () => {
    const tabla = leerRespuestaTablaTallas(
      respuesta({
        unidad: 'pulgadas',
        filas: [{ ...VACIA, talla: '32', cintura: 32, largoPierna: 30.5 }],
      }),
    )

    expect(tabla.filas).toEqual([{ talla: '32', cintura: 81.3, largoPierna: 77.5 }])
  })

  it('sin marca en la captura no la inventa', () => {
    expect(leerRespuestaTablaTallas(respuesta({ marca: '  ' }))).not.toHaveProperty('marca')
  })

  it('quita filas sin talla, sin medidas o repetidas, y medidas imposibles', () => {
    const tabla = leerRespuestaTablaTallas(
      respuesta({
        filas: [
          { ...VACIA, talla: 'M', cintura: 80, cadera: 900 },
          { ...VACIA, talla: 'm', cintura: 81 },
          { ...VACIA, talla: '', cintura: 70 },
          { ...VACIA, talla: 'L' },
          { talla: 'XL', cintura: 'mucha' },
          'basura',
        ],
      }),
    )

    expect(tabla.filas).toEqual([{ talla: 'M', cintura: 80 }])
  })

  it.each([
    ['no es JSON', 'Lo siento'],
    ['sin filas que valgan', respuesta({ filas: [{ ...VACIA, talla: 'M' }] })],
    ['con un tipo que no existe', respuesta({ tipo: 'sombrero' })],
  ])('%s no vale', (_caso, texto) => {
    expect(() => leerRespuestaTablaTallas(texto)).toThrow(ErrorIA)
  })

  it('el esquema para Gemini pide todas las medidas y la unidad', () => {
    const texto = JSON.stringify(esquemaTablaTallasParaGemini())
    for (const campo of ['unidad', 'medidaDe', 'largoPierna', 'pie', '"pulgadas"']) {
      expect(texto).toContain(campo)
    }
    expect(texto).not.toContain('$schema')
  })
})

describe('leerTablaTallas con Gemini', () => {
  it('manda la foto grande, con esquema, y devuelve la tabla leída', async () => {
    const peticiones: GenerateContentParameters[] = []
    const prepararFoto = vi.fn(() => Promise.resolve({ datos: 'QUJD', tipo: 'image/jpeg' }))
    const proveedor = crearProveedorGemini({
      clave: 'clave-falsa-de-test',
      modelo: 'gemini-de-prueba',
      crearCliente: () =>
        Promise.resolve({
          generateContent: (params: GenerateContentParameters) => {
            peticiones.push(params)
            return Promise.resolve({ text: respuesta() })
          },
          get: vi.fn(),
        }),
      prepararFoto,
    })

    const tabla = await proveedor.leerTablaTallas(new Blob(['captura']))

    expect(tabla.filas).toHaveLength(2)
    expect(prepararFoto).toHaveBeenCalledWith(expect.any(Blob), 1536)
    expect(peticiones[0]?.model).toBe('gemini-de-prueba')
    expect(peticiones[0]?.config?.responseJsonSchema).toBeDefined()
  })

  it('un 429 da sin cupo', async () => {
    const proveedor = crearProveedorGemini({
      clave: 'clave-falsa-de-test',
      modelo: 'x',
      crearCliente: () =>
        Promise.resolve({
          generateContent: () => Promise.reject(Object.assign(new Error('{}'), { status: 429 })),
          get: vi.fn(),
        }),
      prepararFoto: () => Promise.resolve({ datos: 'QUJD', tipo: 'image/jpeg' }),
    })

    await expect(proveedor.leerTablaTallas(new Blob(['x']))).rejects.toMatchObject({
      tipo: 'sin-cupo',
    })
  })
})

describe('leerTablaTallas del falso', () => {
  it('da la tabla de prueba y apunta la foto', async () => {
    const falso = crearProveedorFalso()
    const foto = new Blob(['captura'])

    expect(await falso.leerTablaTallas(foto)).toEqual(TABLA_TALLAS_DE_PRUEBA)
    expect(falso.tablasLeidas).toEqual([foto])
  })
})
