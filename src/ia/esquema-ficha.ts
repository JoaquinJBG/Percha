import { z } from 'zod'
import { esEnlaceWeb } from '../datos/modelo.ts'
import { ErrorIA } from './errores.ts'
import type { CandidataFicha } from './tipos.ts'

/** Como mucho 3 candidatas: el usuario elige entre pocas (S9). */
export const MAX_CANDIDATAS = 3

const enlaceWeb = z.string().trim().refine(esEnlaceWeb)

const candidataSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  enlace: enlaceWeb,
  // La foto puede faltar o venir mal sin que la candidata deje de valer.
  foto: z
    .unknown()
    .optional()
    .transform((valor) => {
      const leida = enlaceWeb.safeParse(valor)
      return leida.success ? leida.data : null
    }),
  tienda: z
    .unknown()
    .optional()
    .transform((valor) =>
      typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, 80) : null,
    ),
})

/** El JSON de la respuesta, aunque venga entre ```json … ``` o con texto alrededor. */
function extraerJSON(texto: string): unknown {
  const inicio = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (inicio === -1 || fin < inicio) throw new ErrorIA('respuesta')
  try {
    return JSON.parse(texto.slice(inicio, fin + 1))
  } catch {
    throw new ErrorIA('respuesta')
  }
}

/**
 * Con la búsqueda de Google, Gemini 2.5 no admite salida con esquema: el JSON va en el texto y se valida
 * aquí candidata a candidata. Sin ninguna válida se devuelve `[]` (no la ha encontrado, que también es
 * un resultado); si no hay JSON, lanza `ErrorIA('respuesta')`.
 */
export function leerCandidatas(texto: string): CandidataFicha[] {
  const envoltorio = z.object({ candidatas: z.array(z.unknown()) }).safeParse(extraerJSON(texto))
  if (!envoltorio.success) throw new ErrorIA('respuesta')
  const vistas = new Set<string>()
  const candidatas: CandidataFicha[] = []
  for (const cruda of envoltorio.data.candidatas) {
    const leida = candidataSchema.safeParse(cruda)
    if (!leida.success || vistas.has(leida.data.enlace)) continue
    vistas.add(leida.data.enlace)
    candidatas.push(leida.data)
  }
  return candidatas.slice(0, MAX_CANDIDATAS)
}
