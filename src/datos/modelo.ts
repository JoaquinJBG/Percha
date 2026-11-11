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

/** Corte y detalles por tipo (T8.1, D20). Qué lista vale para cada prenda lo dice `src/datos/detalles.ts`. */
export const CORTES_PANTALON = [
  'skinny',
  'slim',
  'regular / recto',
  'relaxed',
  'baggy',
  'wide leg',
  'balloon',
  'bootcut',
  'flare',
  'tapered',
  'cargo',
] as const
export const CORTES_CAMISETA = ['slim', 'regular', 'relaxed', 'oversize', 'boxy'] as const
export const CORTES_CAMISA = ['slim', 'regular', 'relaxed', 'oversize', 'overshirt'] as const
export const CORTES_ABRIGO = ['entallado', 'recto', 'oversize', 'boxy', 'cropped'] as const
export const TIROS = ['bajo', 'medio', 'alto'] as const
export const LARGOS_PANTALON = ['completo', 'tobillero', 'cropped'] as const
export const LARGOS_CAMISETA = ['cropped', 'regular', 'largo'] as const
export const LARGOS_ABRIGO = ['corto', 'cadera', 'medio muslo', 'largo'] as const
export const MANGAS = ['corta', 'larga', 'sin manga'] as const
export const CUELLOS = ['clásico', 'mao', 'cubano'] as const

function union<T extends string>(...listas: (readonly T[])[]): [T, ...T[]] {
  return [...new Set(listas.flat())] as [T, ...T[]]
}

export const CORTES = union(CORTES_PANTALON, CORTES_CAMISETA, CORTES_CAMISA, CORTES_ABRIGO)
export const LARGOS = union(LARGOS_PANTALON, LARGOS_CAMISETA, LARGOS_ABRIGO)

/** Papeles que puede hacer una prenda de arriba en un outfit con capas, de dentro afuera (D18). */
export const CAPAS = ['base', 'media', 'exterior'] as const

export const MODELO_GEMINI_POR_DEFECTO = 'gemini-3.5-flash-lite'

export const categoriaSchema = z.enum(CATEGORIAS)
export const estiloSchema = z.enum(ESTILOS)
export const ocasionSchema = z.enum(OCASIONES)
export const temporadaSchema = z.enum(TEMPORADAS)
export const nivelSchema = z.int().min(1).max(5)
export const capaSchema = z.enum(CAPAS)
export const corteSchema = z.enum(CORTES)
export const tiroSchema = z.enum(TIROS)
export const largoSchema = z.enum(LARGOS)
export const mangaSchema = z.enum(MANGAS)
export const cuelloSchema = z.enum(CUELLOS)

/** Sin repetidos y siempre de dentro afuera, para que comparar y pintar sea estable. */
export const capasSchema = z
  .array(capaSchema)
  .transform((capas) => CAPAS.filter((capa) => capas.includes(capa)))

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
  // Opcional: las prendas y copias de antes no lo tienen; se deduce con `capasDe` (src/datos/capas.ts).
  capas: capasSchema.optional(),
  // Opcionales (T8.1): solo los que aplican al tipo de prenda (`detallesQueAplican`).
  corte: corteSchema.optional(),
  tiro: tiroSchema.optional(),
  largo: largoSchema.optional(),
  manga: mangaSchema.optional(),
  cuello: cuelloSchema.optional(),
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
  /** La foto del probador del PC con este outfit puesto (T7.1, D19). Los de antes no la tienen. */
  prueba: blobSchema.optional(),
})

export const COMPLEXIONES = ['atlética', 'grande', 'delgada', 'media'] as const
export const TIPOS_TALLA = ['parte de arriba', 'pantalón', 'calzado'] as const
export const TIPOS_OFICINA = ['conservadora', 'estándar', 'creativa'] as const
export const SENSACIONES_TERMICAS = ['caluroso', 'normal', 'friolero'] as const

/** Medidas del cuerpo que admite el perfil, con su unidad y el rango que se acepta. */
export const MEDIDAS = {
  altura: { unidad: 'cm', min: 100, max: 230 },
  peso: { unidad: 'kg', min: 30, max: 250 },
  pecho: { unidad: 'cm', min: 50, max: 200 },
  cintura: { unidad: 'cm', min: 40, max: 200 },
  cadera: { unidad: 'cm', min: 50, max: 200 },
  largoPierna: { unidad: 'cm', min: 40, max: 120 },
} as const
export type Medida = keyof typeof MEDIDAS

const medidaSchema = (medida: Medida) => {
  const { unidad, min, max } = MEDIDAS[medida]
  return z
    .number()
    .min(min, `Entre ${String(min)} y ${String(max)} ${unidad}.`)
    .max(max, `Entre ${String(min)} y ${String(max)} ${unidad}.`)
    .optional()
}

/**
 * El cuerpo del usuario (T8.2). Todo es opcional: los perfiles y las copias de antes no lo tienen. Son
 * datos personales que se quedan en el móvil; T8.4 decide qué parte va al prompt.
 */
export const cuerpoSchema = z.object({
  altura: medidaSchema('altura'),
  peso: medidaSchema('peso'),
  pecho: medidaSchema('pecho'),
  cintura: medidaSchema('cintura'),
  cadera: medidaSchema('cadera'),
  largoPierna: medidaSchema('largoPierna'),
  complexion: z.enum(COMPLEXIONES).optional(),
  /** Una línea libre: «hombros anchos, muslo grande». */
  notas: z.string().trim().max(120).optional(),
})

export const MAX_TALLAS = 30

/** La talla que usa en una marca para un tipo de prenda: «Zara · pantalón · 44». */
export const tallaMarcaSchema = z.object({
  marca: z.string().trim().min(1).max(40),
  tipo: z.enum(TIPOS_TALLA),
  talla: z.string().trim().min(1).max(20),
})

/** Medidas de una fila de la tabla de tallas (T10.1, D22), siempre en cm. */
export const MEDIDAS_TALLA = [
  'pecho',
  'cintura',
  'cadera',
  'hombros',
  'manga',
  'largo',
  'largoPierna',
  'pie',
] as const
export type MedidaTalla = (typeof MEDIDAS_TALLA)[number]

/** Qué medidas se enseñan y se piden para cada tipo de tabla. */
export const MEDIDAS_POR_TIPO: Record<TipoTalla, readonly MedidaTalla[]> = {
  'parte de arriba': ['pecho', 'cintura', 'cadera', 'hombros', 'manga', 'largo'],
  pantalón: ['cintura', 'cadera', 'largoPierna', 'largo'],
  calzado: ['pie'],
}

export const MEDIDA_DE = ['cuerpo', 'prenda'] as const
export const MAX_FILAS_TABLA = 30

// Se redondea antes de validar: 0,04 quedaría en 0 y la copia que lo lleve no se podría importar.
const cmSchema = z
  .number()
  .transform((cm) => Math.round(cm * 10) / 10)
  .pipe(z.number().positive().max(300))

export const filaTallaSchema = z.object({
  talla: z.string().trim().min(1).max(20),
  ...Object.fromEntries(MEDIDAS_TALLA.map((medida) => [medida, cmSchema.optional()])),
} as { talla: z.ZodString } & Record<MedidaTalla, z.ZodOptional<typeof cmSchema>>)

/** Lo que se lee de la foto o se escribe a mano. La marca puede faltar si la guía no la dice. */
export const datosTablaTallasSchema = z.object({
  marca: z.string().trim().min(1).max(40),
  tipo: z.enum(TIPOS_TALLA),
  /** La guía de Zara da medidas del cuerpo; otras, de la prenda en plano (S4 §3). */
  medidaDe: z.enum(MEDIDA_DE),
  filas: z
    .array(filaTallaSchema)
    .min(1)
    .max(MAX_FILAS_TABLA)
    .refine(
      (filas) => new Set(filas.map((f) => f.talla.toLocaleLowerCase('es'))).size === filas.length,
      'Hay una talla repetida.',
    ),
})

/** Una por marca y tipo: guardar otra con la misma marca (sin mayúsculas) y tipo la sustituye. */
export const tablaTallasSchema = datosTablaTallasSchema.extend({
  id: z.string().min(1),
  actualizadaEn: z.number().int().nonnegative(),
})

/** El `id` de la tabla de una marca y un tipo. */
export function idTablaTallas(marca: string, tipo: TipoTalla): string {
  return `${marca.trim().toLocaleLowerCase('es')}|${tipo}`
}

export const oficinaSchema = z.object({
  tipo: z.enum(TIPOS_OFICINA),
  viernesCasual: z.boolean(),
})

/**
 * Lo que nunca sale del móvil (D21): la foto en ropa interior para el probador del PC. Va en su propia
 * tabla y no en el perfil, para que ni la copia ni Gemini, que leen el perfil, puedan llevársela.
 */
export const privadoSchema = z.object({ fotoInterior: blobSchema.nullable() })

export const perfilSchema = z.object({
  fotoCara: blobSchema.nullable(),
  fotoCuerpo: blobSchema.nullable(),
  ciudad: z.string().trim(),
  estilosFavoritos: z.array(estiloSchema),
  cuerpo: cuerpoSchema.optional(),
  tallas: z.array(tallaMarcaSchema).max(MAX_TALLAS).optional(),
  oficina: oficinaSchema.optional(),
  sensacionTermica: z.enum(SENSACIONES_TERMICAS).optional(),
})

export const ajustesSchema = z.object({
  claveGemini: z
    .string()
    .trim()
    .nullable()
    .transform((clave) => (clave === '' ? null : clave)),
  modeloGemini: z.string().trim().min(1),
  // Probador del PC (D19). Con `default` para que los ajustes guardados antes de T7.1 sigan valiendo.
  urlProbador: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .transform((url) => (url === '' ? null : url)),
  claveProbador: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .transform((clave) => (clave === '' ? null : clave)),
})

export type Categoria = z.infer<typeof categoriaSchema>
export type Estilo = z.infer<typeof estiloSchema>
export type Ocasion = z.infer<typeof ocasionSchema>
export type Temporada = z.infer<typeof temporadaSchema>
export type Capa = z.infer<typeof capaSchema>
export type Corte = z.infer<typeof corteSchema>
export type Tiro = z.infer<typeof tiroSchema>
export type Largo = z.infer<typeof largoSchema>
export type Manga = z.infer<typeof mangaSchema>
export type Cuello = z.infer<typeof cuelloSchema>
export type FotoPrenda = z.infer<typeof fotoPrendaSchema>
export type Prenda = z.infer<typeof prendaSchema>
export type Outfit = z.infer<typeof outfitSchema>
export type Perfil = z.infer<typeof perfilSchema>
export type Privado = z.infer<typeof privadoSchema>
export type Cuerpo = z.infer<typeof cuerpoSchema>
export type Complexion = (typeof COMPLEXIONES)[number]
export type TallaMarca = z.infer<typeof tallaMarcaSchema>
export type FilaTalla = z.infer<typeof filaTallaSchema>
export type DatosTablaTallas = z.infer<typeof datosTablaTallasSchema>
export type TablaTallas = z.infer<typeof tablaTallasSchema>
export type TipoTalla = (typeof TIPOS_TALLA)[number]
export type Oficina = z.infer<typeof oficinaSchema>
export type TipoOficina = (typeof TIPOS_OFICINA)[number]
export type SensacionTermica = (typeof SENSACIONES_TERMICAS)[number]
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

export const PRIVADO_VACIO: Privado = { fotoInterior: null }

export const AJUSTES_POR_DEFECTO: Ajustes = {
  claveGemini: null,
  modeloGemini: MODELO_GEMINI_POR_DEFECTO,
  urlProbador: null,
  claveProbador: null,
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
  capas: true,
  corte: true,
  tiro: true,
  largo: true,
  manga: true,
  cuello: true,
  marca: true,
  referencia: true,
  talla: true,
  composicion: true,
  enlace: true,
})

export type EtiquetasPrenda = z.infer<typeof etiquetasPrendaSchema>
