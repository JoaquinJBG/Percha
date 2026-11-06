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

/** Un enlace que se puede abrir sin riesgo: solo `http:` o `https:`. */
export function esEnlaceWeb(texto: string): boolean {
  try {
    const { protocol } = new URL(texto)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export const MAX_COMPONENTES = 8

/** Una línea de la composición: «60 % algodón». El porcentaje falta a veces («forro: poliéster»). */
export const componenteSchema = z.object({
  material: z.string().trim().toLowerCase().min(1).max(40),
  porcentaje: z.number().min(0).max(100).optional(),
})

/**
 * Lo que dice la etiqueta cosida (T5.1). Todo es opcional: las prendas de antes no lo tienen y una
 * etiqueta puede no traer nada de esto. Quien escribe no guarda textos vacíos.
 */
export const datosEtiquetaSchema = z.object({
  marca: z.string().trim().max(60).optional(),
  referencia: z.string().trim().max(40).optional(),
  talla: z.string().trim().max(20).optional(),
  composicion: z.array(componenteSchema).max(MAX_COMPONENTES).optional(),
})

/** La ficha de la tienda que trae el usuario (compartida o pegada). Percha nunca la descarga. */
export const enlaceSchema = z
  .string()
  .trim()
  .max(2000)
  .refine(esEnlaceWeb, 'Tiene que ser un enlace web (https://…).')
  .optional()

/** Campos de la prenda salvo las fotos, que en la copia van como rutas dentro del zip. */
export const camposPrendaSchema = z.object({
  ...datosEtiquetaSchema.shape,
  enlace: enlaceSchema,
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
export type Componente = z.infer<typeof componenteSchema>
export type DatosEtiqueta = z.infer<typeof datosEtiquetaSchema>

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

/** Colores y estampados que proponen la IA y el formulario. El modelo admite cualquier texto. */
export const COLORES = [
  'blanco',
  'crudo',
  'negro',
  'gris',
  'beige',
  'camel',
  'marrón',
  'azul marino',
  'azul',
  'celeste',
  'vaquero',
  'verde',
  'caqui',
  'rojo',
  'granate',
  'rosa',
  'morado',
  'amarillo',
  'naranja',
  'dorado',
  'plateado',
] as const

export const ESTAMPADOS = [
  'liso',
  'rayas',
  'cuadros',
  'lunares',
  'flores',
  'animal',
  'geométrico',
  'figurativo',
  'gráfico / logo',
  'camuflaje',
  'tie-dye',
  'otro',
] as const

/** Lo que etiqueta la IA o el formulario: la prenda sin id, fotos, fecha ni origen. */
export const etiquetasPrendaSchema = camposPrendaSchema.pick({
  categoria: true,
  subcategoria: true,
  colores: true,
  estampado: true,
  estilos: true,
  abrigo: true,
  formalidad: true,
  ocasiones: true,
  temporadas: true,
  notas: true,
  marca: true,
  referencia: true,
  talla: true,
  composicion: true,
  enlace: true,
})

export type EtiquetasPrenda = z.infer<typeof etiquetasPrendaSchema>
