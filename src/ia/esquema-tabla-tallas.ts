import { z } from 'zod'
import {
  filaTallaSchema,
  MAX_FILAS_TABLA,
  MEDIDA_DE,
  MEDIDAS_TALLA,
  TIPOS_TALLA,
  type FilaTalla,
} from '../datos/modelo.ts'
import { ErrorIA } from './errores.ts'
import type { LecturaTablaTallas } from './tipos.ts'

const PULGADA_CM = 2.54

/** Para Gemini todo es obligatorio (responde mejor así); «no está» es 0 o vacío. */
const tablaIASchema = z.object({
  marca: z.string().describe('Marca si se ve en la captura. Vacío si no.'),
  tipo: z.enum(TIPOS_TALLA),
  medidaDe: z
    .enum(MEDIDA_DE)
    .describe('cuerpo si la guía dice medidas del cuerpo; prenda si son de la prenda en plano.'),
  unidad: z.enum(['cm', 'pulgadas']).describe('En qué unidad están los números de la tabla.'),
  filas: z
    .array(
      z.object({
        talla: z.string().describe('La talla como la escribe la tienda: XS, M, 42, 38…'),
        ...Object.fromEntries(
          MEDIDAS_TALLA.map((medida) => [
            medida,
            z.number().min(0).describe('0 si la tabla no lo dice. Con un rango, el punto medio.'),
          ]),
        ),
      }),
    )
    .max(MAX_FILAS_TABLA),
})

/** JSON Schema para `responseJsonSchema`. */
export function esquemaTablaTallasParaGemini(): Record<string, unknown> {
  const json = z.toJSONSchema(tablaIASchema, { target: 'draft-2020-12' }) as Record<string, unknown>
  delete json.$schema
  return json
}

/** Una fila con su talla y las medidas que valen, en cm; `null` si no queda ninguna medida. */
function leerFila(cruda: unknown, factor: number): FilaTalla | null {
  if (typeof cruda !== 'object' || cruda === null) return null
  const campos = cruda as Record<string, unknown>
  const fila: Record<string, unknown> = {
    talla: typeof campos.talla === 'string' ? campos.talla.trim().slice(0, 20) : '',
  }
  for (const medida of MEDIDAS_TALLA) {
    const valor = campos[medida]
    // Una medida rara se quita sola, sin tirar la fila entera.
    const cm = typeof valor === 'number' && valor > 0 ? valor * factor : undefined
    if (cm !== undefined && filaTallaSchema.shape[medida].safeParse(cm).success) fila[medida] = cm
  }
  const leida = filaTallaSchema.safeParse(fila)
  if (!leida.success) return null
  return MEDIDAS_TALLA.some((medida) => leida.data[medida] !== undefined) ? leida.data : null
}

/**
 * Valida la tabla que lee Gemini: pasa las pulgadas a cm, quita filas sin talla o sin medidas y tallas
 * repetidas. Sin ninguna fila válida, lanza `ErrorIA('respuesta')`.
 */
export function leerRespuestaTablaTallas(texto: string): LecturaTablaTallas {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new ErrorIA('respuesta')
  }
  const cabecera = z
    .object({
      marca: z.unknown(),
      tipo: z.enum(TIPOS_TALLA),
      medidaDe: z.enum(MEDIDA_DE),
      unidad: z.enum(['cm', 'pulgadas']).catch('cm'),
      filas: z.array(z.unknown()),
    })
    .safeParse(json)
  if (!cabecera.success) throw new ErrorIA('respuesta')
  const { marca, tipo, medidaDe, unidad } = cabecera.data
  const factor = unidad === 'pulgadas' ? PULGADA_CM : 1

  const vistas = new Set<string>()
  const filas: FilaTalla[] = []
  for (const cruda of cabecera.data.filas.slice(0, MAX_FILAS_TABLA)) {
    const fila = leerFila(cruda, factor)
    const clave = fila?.talla.toLocaleLowerCase('es')
    if (!fila || clave === undefined || vistas.has(clave)) continue
    vistas.add(clave)
    filas.push(fila)
  }
  if (filas.length === 0) throw new ErrorIA('respuesta')

  const marcaLimpia = typeof marca === 'string' ? marca.trim().slice(0, 40) : ''
  return { ...(marcaLimpia && { marca: marcaLimpia }), tipo, medidaDe, filas }
}
