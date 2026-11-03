import type { GenerateContentParameters, GetModelParameters, Part } from '@google/genai'
import { ErrorIA, traducirError } from './errores.ts'
import { esquemaParaGemini, leerRespuesta } from './esquema.ts'
import { prepararFoto as prepararFotoPorDefecto, type FotoParaIA } from './fotos.ts'
import { INSTRUCCION_ETIQUETADO, textoPrenda } from './prompt.ts'
import {
  MAX_PRENDAS_POR_PETICION,
  type OpcionesPeticion,
  type PrendaAEtiquetar,
  type ProveedorIA,
  type ResultadoEtiquetado,
} from './tipos.ts'

/** Lo que se usa de `GoogleGenAI.models`; en los tests se sustituye por uno falso. */
export interface ClienteGemini {
  generateContent(params: GenerateContentParameters): Promise<{ text?: string | undefined }>
  get(params: GetModelParameters): Promise<unknown>
}

export interface OpcionesGemini {
  clave: string | null
  modelo: string
  crearCliente?: (clave: string) => Promise<ClienteGemini>
  prepararFoto?: (foto: Blob) => Promise<FotoParaIA>
}

// El SDK pesa ~100 KB gzip: se carga solo cuando hace falta.
async function crearClienteReal(clave: string): Promise<ClienteGemini> {
  const { GoogleGenAI } = await import('@google/genai')
  return new GoogleGenAI({ apiKey: clave }).models
}

function comprobarLote(prendas: PrendaAEtiquetar[]) {
  if (prendas.length > MAX_PRENDAS_POR_PETICION) {
    throw new RangeError(`Como mucho ${String(MAX_PRENDAS_POR_PETICION)} prendas por petición`)
  }
  if (prendas.some(({ fotos }) => fotos.length < 1 || fotos.length > 2)) {
    throw new RangeError('Cada prenda lleva 1 o 2 fotos')
  }
}

export function crearProveedorGemini({
  clave,
  modelo,
  crearCliente = crearClienteReal,
  prepararFoto = prepararFotoPorDefecto,
}: OpcionesGemini): ProveedorIA {
  async function llamar<T>(tarea: (cliente: ClienteGemini) => Promise<T>): Promise<T> {
    if (!clave) throw new ErrorIA('sin-clave')
    if (!navigator.onLine) throw new ErrorIA('sin-red')
    try {
      return await tarea(await crearCliente(clave))
    } catch (error) {
      throw traducirError(error, modelo)
    }
  }

  return {
    async etiquetarPrendas(
      prendas: PrendaAEtiquetar[],
      { signal }: OpcionesPeticion = {},
    ): Promise<ResultadoEtiquetado> {
      comprobarLote(prendas)
      if (prendas.length === 0) return []
      const texto = await llamar(async (cliente) => {
        const partes: Part[] = []
        for (const [i, prenda] of prendas.entries()) {
          partes.push({ text: textoPrenda(i + 1) })
          for (const foto of prenda.fotos) {
            const { datos, tipo } = await prepararFoto(foto)
            partes.push({ inlineData: { data: datos, mimeType: tipo } })
          }
        }
        const respuesta = await cliente.generateContent({
          model: modelo,
          contents: [{ role: 'user', parts: partes }],
          config: {
            systemInstruction: INSTRUCCION_ETIQUETADO,
            responseMimeType: 'application/json',
            responseJsonSchema: esquemaParaGemini(),
            temperature: 0.2,
            ...(signal && { abortSignal: signal }),
          },
        })
        return respuesta.text ?? ''
      })
      return leerRespuesta(texto, prendas.length)
    },

    async comprobarClave({ signal }: OpcionesPeticion = {}): Promise<void> {
      // Pedir los datos del modelo no gasta cupo de generación y falla igual con una clave mala.
      await llamar((cliente) =>
        cliente.get({ model: modelo, config: signal ? { abortSignal: signal } : {} }),
      )
    },
  }
}
