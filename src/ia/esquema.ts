import { z } from 'zod'
import {
  categoriaSchema,
  COLORES,
  ESTAMPADOS,
  estiloSchema,
  etiquetasPrendaSchema,
  nivelSchema,
  ocasionSchema,
  temporadaSchema,
} from '../datos/modelo.ts'
import { ErrorIA } from './errores.ts'
import type { ResultadoEtiquetado } from './tipos.ts'

/** Más estricto que el modelo de datos: a la IA solo se le admiten las listas cerradas. */
const etiquetasIASchema = z.object({
  indice: z.int().min(1).describe('Número de la prenda (1, 2, 3…) en el orden en que se enviaron.'),
  categoria: categoriaSchema,
  subcategoria: z
    .string()
    .describe('Tipo concreto en minúsculas y singular: camiseta, vaqueros, zapatillas, blazer…'),
  colores: z.array(z.enum(COLORES)).min(1).max(3).describe('De más a menos presente.'),
  estampado: z.enum(ESTAMPADOS),
  estilos: z.array(estiloSchema).min(1).max(4),
  abrigo: nivelSchema.describe(
    '1 = muy fresco (tirantes, sandalias) … 5 = muy abrigado (plumífero).',
  ),
  formalidad: nivelSchema.describe('1 = deporte o casa … 5 = etiqueta (traje, vestido de gala).'),
  ocasiones: z.array(ocasionSchema).min(1).max(5),
  temporadas: z.array(temporadaSchema).min(1).max(4),
  notas: z
    .string()
    .describe('Material, corte o detalle útil para combinar. Cadena vacía si no hay nada.'),
})

const respuestaSchema = z.object({ prendas: z.array(etiquetasIASchema).min(1) })

/** JSON Schema para `responseJsonSchema`, sin lo que Gemini no admite o ignora. */
export function esquemaParaGemini(): Record<string, unknown> {
  const json = z.toJSONSchema(respuestaSchema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >
  delete json.$schema
  return limpiar(json) as Record<string, unknown>
}

// z.int() añade los límites de entero seguro de JS; sobran y ensucian el esquema.
function limpiar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(limpiar)
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {}
    for (const [clave, dentro] of Object.entries(valor)) {
      const esLimiteDeJs =
        (clave === 'minimum' || clave === 'maximum') &&
        typeof dentro === 'number' &&
        Math.abs(dentro) >= Number.MAX_SAFE_INTEGER
      if (!esLimiteDeJs) salida[clave] = limpiar(dentro)
    }
    return salida
  }
  return valor
}

function sinRepetidos<T>(lista: T[]): T[] {
  return [...new Set(lista)]
}

/**
 * Valida la respuesta de Gemini prenda a prenda: si una no vale, su hueco queda en `null`.
 * Si no vale ninguna, lanza `ErrorIA('respuesta')`.
 */
export function leerRespuesta(texto: string, cuantas: number): ResultadoEtiquetado {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new ErrorIA('respuesta')
  }
  const envoltorio = z.object({ prendas: z.array(z.unknown()) }).safeParse(json)
  if (!envoltorio.success) throw new ErrorIA('respuesta')

  const resultado: ResultadoEtiquetado = Array.from({ length: cuantas }, () => null)
  for (const candidata of envoltorio.data.prendas) {
    const leida = etiquetasIASchema.safeParse(candidata)
    if (!leida.success) continue
    const { indice, ...etiquetas } = leida.data
    // Gemini ignora `uniqueItems`, así que los repetidos se quitan aquí.
    const limpias = etiquetasPrendaSchema.safeParse({
      ...etiquetas,
      estilos: sinRepetidos(etiquetas.estilos),
      ocasiones: sinRepetidos(etiquetas.ocasiones),
      temporadas: sinRepetidos(etiquetas.temporadas),
    })
    if (limpias.success && indice <= cuantas && resultado[indice - 1] === null) {
      resultado[indice - 1] = limpias.data
    }
  }
  if (resultado.every((etiquetas) => etiquetas === null)) throw new ErrorIA('respuesta')
  return resultado
}
