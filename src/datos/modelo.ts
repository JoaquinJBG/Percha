import { z } from 'zod'

export const CATEGORIAS = [
  'superior',
  'inferior',
  'vestido',
  'abrigo',
  'calzado',
  'accesorio',
] as const

export const ESTILOS = [
  'casual',
  'smart casual',
  'elegante',
  'formal',
  'business',
  'minimalista',
  'old money / quiet luxury',
  'streetwear',
  'deportivo / athleisure',
  'gorpcore',
  'preppy',
  'boho',
  'vintage / retro',
  'rockero',
  'grunge',
  'y2k',
  'techwear',
  'romántico',
  'clean girl',
  'cowboy / western',
  'mediterráneo / verano',
] as const

export const OCASIONES = [
  'diario',
  'trabajo',
  'cita',
  'cena',
  'fiesta / noche',
  'evento formal',
  'boda',
  'deporte',
  'viaje',
  'playa / piscina',
  'casa',
] as const

export const TEMPORADAS = ['primavera', 'verano', 'otoño', 'invierno'] as const

export const MODELO_GEMINI_POR_DEFECTO = 'gemini-3.5-flash-lite'

export const categoriaSchema = z.enum(CATEGORIAS)
export const estiloSchema = z.enum(ESTILOS)
export const ocasionSchema = z.enum(OCASIONES)
export const temporadaSchema = z.enum(TEMPORADAS)
export const nivelSchema = z.int().min(1).max(5)

/** Minúsculas y sin espacios sobrantes, para que «Azul » y «azul» filtren igual. */
export function normalizarColor(color: string): string {
  return color.trim().toLocaleLowerCase('es')
}

const coloresSchema = z
  .array(z.string())
  .transform((colores) => [...new Set(colores.map(normalizarColor).filter(Boolean))])

/** Campos de la prenda salvo las fotos, que en la copia van como rutas dentro del zip. */
export const camposPrendaSchema = z.object({
  id: z.string().min(1),
  categoria: categoriaSchema,
  subcategoria: z.string().trim(),
  colores: coloresSchema,
  estampado: z.string().trim(),
  estilos: z.array(estiloSchema),
  abrigo: nivelSchema,
  formalidad: nivelSchema,
  ocasiones: z.array(ocasionSchema),
  temporadas: z.array(temporadaSchema),
  notas: z.string(),
  etiquetadaPor: z.enum(['ia', 'manual']),
  creadaEn: z.number().int().nonnegative(),
})

const blobSchema = z.instanceof(Blob)

/** Cada foto de la prenda: la original y, cuando ya se ha hecho, la recortada. */
export const fotoPrendaSchema = z.object({
  original: blobSchema,
  recortada: blobSchema.nullable(),
})

export const prendaSchema = camposPrendaSchema.extend({
  fotos: z.array(fotoPrendaSchema).min(1).max(2),
})

export const outfitSchema = z.object({
  id: z.string().min(1),
  prendas: z.array(z.string().min(1)).min(1),
  estilo: estiloSchema,
  ocasion: ocasionSchema,
  tiempo: z.object({ temperatura: z.number(), lluvia: z.boolean() }).nullable(),
  explicacion: z.string(),
  favorito: z.boolean(),
  creadoEn: z.number().int().nonnegative(),
})

export const perfilSchema = z.object({
  fotoCara: blobSchema.nullable(),
  fotoCuerpo: blobSchema.nullable(),
  ciudad: z.string().trim(),
  estilosFavoritos: z.array(estiloSchema),
})

export const ajustesSchema = z.object({
  claveGemini: z
    .string()
    .trim()
    .nullable()
    .transform((clave) => (clave === '' ? null : clave)),
  modeloGemini: z.string().trim().min(1),
})

export type Categoria = z.infer<typeof categoriaSchema>
export type Estilo = z.infer<typeof estiloSchema>
export type Ocasion = z.infer<typeof ocasionSchema>
export type Temporada = z.infer<typeof temporadaSchema>
export type FotoPrenda = z.infer<typeof fotoPrendaSchema>
export type Prenda = z.infer<typeof prendaSchema>
export type Outfit = z.infer<typeof outfitSchema>
export type Perfil = z.infer<typeof perfilSchema>
export type Ajustes = z.infer<typeof ajustesSchema>

/** Lo que pide `crearPrenda`: el `id` y la fecha los pone el repositorio. */
export type NuevaPrenda = Omit<Prenda, 'id' | 'creadaEn'>
export type CambiosPrenda = Partial<NuevaPrenda>
export type NuevoOutfit = Omit<Outfit, 'id' | 'creadoEn'>

export const PERFIL_VACIO: Perfil = {
  fotoCara: null,
  fotoCuerpo: null,
  ciudad: '',
  estilosFavoritos: [],
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  claveGemini: null,
  modeloGemini: MODELO_GEMINI_POR_DEFECTO,
}
