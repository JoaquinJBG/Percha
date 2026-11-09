import { z } from 'zod'
import { ErrorIA } from './errores.ts'
import type { PropuestaOutfit } from './tipos.ts'

export const OUTFITS_POR_PETICION = 4
/** Hasta 3 capas arriba (4 con mucho frío), abajo, calzado y hasta dos accesorios. */
export const MAX_PRENDAS_POR_OUTFIT = 8
const MAX_LARGO_PORQUE = 200

const outfitIASchema = z.object({
  prendas: z
    .array(z.string().describe('Referencia de la prenda: P1, P2…'))
    .min(1)
    .max(MAX_PRENDAS_POR_OUTFIT),
  porque: z.string().describe('Una frase corta, de tú, que diga por qué funciona hoy.'),
})

const respuestaSchema = z.object({
  outfits: z.array(outfitIASchema).min(1).max(OUTFITS_POR_PETICION),
})

/** JSON Schema para `responseJsonSchema`. */
export function esquemaOutfitsParaGemini(): Record<string, unknown> {
  const json = z.toJSONSchema(respuestaSchema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >
  delete json.$schema
  return json
}

/** P1, P2…: más cortas y más fáciles de copiar sin errores que los UUID de las prendas. */
export function referencias(cuantas: number): string[] {
  return Array.from({ length: cuantas }, (_, i) => `P${String(i + 1)}`)
}

/**
 * Valida la respuesta outfit a outfit y traduce cada referencia a su id. Una referencia que no se envió
 * se deja tal cual, para que quien llama vea que no existe. Si no vale ningún outfit, lanza
 * `ErrorIA('respuesta')`.
 */
export function leerRespuestaOutfits(
  texto: string,
  idPorReferencia: ReadonlyMap<string, string>,
): PropuestaOutfit[] {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new ErrorIA('respuesta')
  }
  const envoltorio = z.object({ outfits: z.array(z.unknown()) }).safeParse(json)
  if (!envoltorio.success) throw new ErrorIA('respuesta')

  const propuestas: PropuestaOutfit[] = []
  for (const candidato of envoltorio.data.outfits) {
    const leido = outfitIASchema.safeParse(candidato)
    if (!leido.success) continue
    const porque = leido.data.porque.replace(/\s+/g, ' ').trim().slice(0, MAX_LARGO_PORQUE)
    if (!porque) continue
    const prendas = leido.data.prendas.map((referencia) => {
      const limpia = referencia.trim().toUpperCase()
      return idPorReferencia.get(limpia) ?? referencia
    })
    propuestas.push({ prendas, porque })
    if (propuestas.length === OUTFITS_POR_PETICION) break
  }
  if (propuestas.length === 0) throw new ErrorIA('respuesta')
  return propuestas
}
