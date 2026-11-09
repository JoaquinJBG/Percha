import { z } from 'zod'
import {
  datosEtiquetaSchema,
  MAX_COMPONENTES,
  type Componente,
  type DatosEtiqueta,
} from '../datos/modelo.ts'
import { ErrorIA } from './errores.ts'

/** Para Gemini todo es obligatorio (responde mejor así); «no se ve» es vacío. */
const etiquetaIASchema = z.object({
  marca: z.string().describe('Marca como se escribe. Vacío si no se ve.'),
  referencia: z
    .string()
    .describe('Código del modelo, sin código de barras ni lote. Vacío si no se ve.'),
  talla: z.string().describe('Talla española o europea si hay varias. Vacío si no se ve.'),
  composicion: z
    .array(
      z.object({
        material: z.string().describe('En español y minúsculas: algodón, poliéster…'),
        porcentaje: z.number().min(0).max(100).describe('0 si la etiqueta no lo dice.'),
      }),
    )
    .max(MAX_COMPONENTES),
})

/** JSON Schema para `responseJsonSchema`. */
export function esquemaEtiquetaParaGemini(): Record<string, unknown> {
  const json = z.toJSONSchema(etiquetaIASchema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >
  delete json.$schema
  return json
}

/** Recorta y descarta lo vacío; lo que pase de largo se corta en vez de tirar la lectura entera. */
function texto(valor: unknown, maximo: number): string | undefined {
  if (typeof valor !== 'string') return undefined
  const limpio = valor.replace(/\s+/g, ' ').trim().slice(0, maximo).trim()
  return limpio === '' ? undefined : limpio
}

function componentes(valor: unknown): Componente[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const leidos: Componente[] = []
  for (const candidato of valor as unknown[]) {
    if (!candidato || typeof candidato !== 'object') continue
    const { material, porcentaje } = candidato as { material?: unknown; porcentaje?: unknown }
    // En minúsculas antes de cortar: alguna letra crece al pasar a minúscula («İ»).
    const nombre = texto(typeof material === 'string' ? material.toLowerCase() : material, 40)
    if (!nombre) continue
    const componente: Componente = { material: nombre }
    if (typeof porcentaje === 'number' && porcentaje > 0 && porcentaje <= 100) {
      componente.porcentaje = porcentaje
    }
    leidos.push(componente)
  }
  return leidos.length === 0 ? undefined : leidos.slice(0, MAX_COMPONENTES)
}

/**
 * Lee la respuesta campo a campo: uno que no valga se queda fuera sin tirar el resto. Devuelve `{}` si
 * la etiqueta no dice nada legible. Solo lanza `ErrorIA('respuesta')` si no llega un objeto JSON.
 */
export function leerRespuestaEtiqueta(textoRespuesta: string): DatosEtiqueta {
  let json: unknown
  try {
    json = JSON.parse(textoRespuesta)
  } catch {
    throw new ErrorIA('respuesta')
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new ErrorIA('respuesta')
  const crudo = json as Record<string, unknown>
  const datos: DatosEtiqueta = {}
  const marca = texto(crudo.marca, 60)
  const referencia = texto(crudo.referencia, 40)
  const talla = texto(crudo.talla, 20)
  const composicion = componentes(crudo.composicion)
  if (marca) datos.marca = marca
  if (referencia) datos.referencia = referencia
  if (talla) datos.talla = talla
  if (composicion) datos.composicion = composicion
  return datosEtiquetaSchema.parse(datos)
}
