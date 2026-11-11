import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate'
import { z } from 'zod'
import { db, FILA_UNICA } from './db.ts'
import {
  AJUSTES_POR_DEFECTO,
  ajustesSchema,
  camposPrendaSchema,
  outfitSchema,
  perfilSchema,
  tablaTallasSchema,
  type FotoPrenda,
  type Outfit,
  type Perfil,
  type Prenda,
} from './modelo.ts'

export const FORMATO_COPIA = 'percha-copia'
export const VERSION_COPIA = 1
const MANIFIESTO = 'percha.json'

export const MENSAJE_COPIA_DANADA = 'El fichero no es una copia de Percha o está dañado.'

export class ErrorCopia extends Error {
  override name = 'ErrorCopia'
}

/**
 * `reemplazar` borra prendas, outfits, perfil y tablas de tallas antes; `fusionar` añade y, si el `id` coincide, gana la
 * copia (en el perfil, campo a campo y sin pisar con un campo vacío).
 */
export type ModoImportar = 'reemplazar' | 'fusionar'

export interface ResumenImportacion {
  prendas: number
  outfits: number
}

const refBlobSchema = z.object({ ruta: z.string().min(1), tipo: z.string() })
type RefBlob = z.infer<typeof refBlobSchema>

const cabeceraSchema = z.object({ formato: z.literal(FORMATO_COPIA), version: z.number() })

// Las claves (Gemini y probador) y la URL del PC se quedan en el móvil: la copia solo lleva el modelo.
const manifiestoSchema = z.object({
  formato: z.literal(FORMATO_COPIA),
  version: z.literal(VERSION_COPIA),
  exportadaEn: z.string(),
  prendas: z.array(
    camposPrendaSchema.extend({
      fotos: z
        .array(z.object({ original: refBlobSchema, recortada: refBlobSchema.nullable() }))
        .min(1)
        .max(2),
    }),
  ),
  outfits: z.array(outfitSchema.extend({ prueba: refBlobSchema.optional() })),
  perfil: perfilSchema
    .extend({ fotoCara: refBlobSchema.nullable(), fotoCuerpo: refBlobSchema.nullable() })
    .nullable(),
  ajustes: ajustesSchema.pick({ modeloGemini: true }),
  // Opcional: las copias de antes de T10.1 no las llevan.
  tablasTallas: z.array(tablaTallasSchema).optional(),
})
type Manifiesto = z.input<typeof manifiestoSchema>

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
}

export function nombreFicheroCopia(fecha = new Date()): string {
  const dia = [fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate()]
    .map((parte) => String(parte).padStart(2, '0'))
    .join('-')
  return `percha-copia-${dia}.zip`
}

/** Todo el armario en un zip: `percha.json` y las fotos en `fotos/`. */
export async function exportarCopia(): Promise<Blob> {
  const [prendas, outfits, perfil, ajustes, tablasTallas] = await db.transaction(
    'r',
    [db.prendas, db.outfits, db.perfil, db.ajustes, db.tablasTallas],
    () =>
      Promise.all([
        db.prendas.toArray(),
        db.outfits.toArray(),
        db.perfil.get(FILA_UNICA),
        db.ajustes.get(FILA_UNICA),
        db.tablasTallas.toArray(),
      ]),
  )

  const ficheros: Zippable = {}
  let contador = 0
  async function meterBlob(blob: Blob): Promise<RefBlob> {
    contador += 1
    const ruta = `fotos/${String(contador)}${EXTENSIONES[blob.type] ?? '.bin'}`
    // Las fotos ya vienen comprimidas: se guardan tal cual para no gastar CPU del móvil.
    ficheros[ruta] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
    return { ruta, tipo: blob.type }
  }
  async function meterBlobOpcional(blob: Blob | null): Promise<RefBlob | null> {
    return blob ? meterBlob(blob) : null
  }

  const manifiesto: Manifiesto = {
    formato: FORMATO_COPIA,
    version: VERSION_COPIA,
    exportadaEn: new Date().toISOString(),
    prendas: [],
    outfits: [],
    perfil: null,
    ajustes: { modeloGemini: (ajustes ?? AJUSTES_POR_DEFECTO).modeloGemini },
    tablasTallas,
  }
  for (const { fotos, ...campos } of prendas) {
    const refs = []
    for (const foto of fotos) {
      refs.push({
        original: await meterBlob(foto.original),
        recortada: await meterBlobOpcional(foto.recortada),
      })
    }
    manifiesto.prendas.push({ ...campos, fotos: refs })
  }
  for (const { prueba, ...campos } of outfits) {
    manifiesto.outfits.push(prueba ? { ...campos, prueba: await meterBlob(prueba) } : campos)
  }
  if (perfil) {
    manifiesto.perfil = {
      ...perfil,
      fotoCara: await meterBlobOpcional(perfil.fotoCara),
      fotoCuerpo: await meterBlobOpcional(perfil.fotoCuerpo),
    }
  }

  ficheros[MANIFIESTO] = strToU8(JSON.stringify(manifiesto))
  return new Blob([zipSync(ficheros)], { type: 'application/zip' })
}

/**
 * Valida la copia entera antes de escribir nada y la mete en una sola transacción:
 * si algo falla, la base se queda como estaba.
 */
export async function importarCopia(
  fichero: Blob,
  modo: ModoImportar,
): Promise<ResumenImportacion> {
  const { prendas, outfits, perfil, modeloGemini, tablasTallas } = leerCopia(
    new Uint8Array(await fichero.arrayBuffer()),
  )

  const tablas = [db.prendas, db.outfits, db.perfil, db.ajustes, db.tablasTallas]
  await db.transaction('rw', tablas, async () => {
    if (modo === 'reemplazar') {
      await Promise.all([
        db.prendas.clear(),
        db.outfits.clear(),
        db.perfil.clear(),
        db.tablasTallas.clear(),
      ])
    }
    await db.prendas.bulkPut(prendas)
    await db.tablasTallas.bulkPut(tablasTallas)
    await db.outfits.bulkPut(outfits)
    if (perfil) {
      const local = modo === 'fusionar' ? await db.perfil.get(FILA_UNICA) : undefined
      await db.perfil.put(local ? fusionarPerfil(local, perfil) : perfil, FILA_UNICA)
    }
    const ajustes = (await db.ajustes.get(FILA_UNICA)) ?? AJUSTES_POR_DEFECTO
    await db.ajustes.put({ ...ajustes, modeloGemini }, FILA_UNICA)
  })

  return {
    prendas: new Set(prendas.map(({ id }) => id)).size,
    outfits: new Set(outfits.map(({ id }) => id)).size,
  }
}

function sinVacios<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, valor]) => valor !== undefined && valor !== ''),
  ) as Partial<T>
}

/** Al fusionar, un campo vacío en la copia no borra lo que ya hay en el móvil (p. ej. la foto de cara). */
function fusionarPerfil(local: Perfil, copia: Perfil): Perfil {
  return {
    fotoCara: copia.fotoCara ?? local.fotoCara,
    fotoCuerpo: copia.fotoCuerpo ?? local.fotoCuerpo,
    ciudad: copia.ciudad || local.ciudad,
    estilosFavoritos:
      copia.estilosFavoritos.length > 0 ? copia.estilosFavoritos : local.estilosFavoritos,
    // Las medidas también van una a una: una copia sin la cadera (o con las notas vacías) no borra lo que ya hay.
    cuerpo:
      copia.cuerpo || local.cuerpo
        ? { ...local.cuerpo, ...sinVacios(copia.cuerpo ?? {}) }
        : undefined,
    tallas: copia.tallas?.length ? copia.tallas : local.tallas,
    oficina: copia.oficina ?? local.oficina,
    sensacionTermica: copia.sensacionTermica ?? local.sensacionTermica,
  }
}

const TIPOS_IMAGEN = new Set(Object.keys(EXTENSIONES))
const MAX_BYTES_FICHERO = 64 * 1024 * 1024

function leerCopia(bytes: Uint8Array) {
  let zip: Unzipped
  let json: unknown
  try {
    // Solo se descomprime lo que usa Percha, y con tope, para que un zip manipulado no tumbe la pestaña.
    zip = unzipSync(bytes, {
      filter: ({ name, originalSize }) =>
        (name === MANIFIESTO || name.startsWith('fotos/')) && originalSize <= MAX_BYTES_FICHERO,
    })
    const manifiesto = zip[MANIFIESTO]
    if (!manifiesto) throw new Error(`Falta ${MANIFIESTO}`)
    json = JSON.parse(strFromU8(manifiesto))
  } catch (error) {
    throw new ErrorCopia(MENSAJE_COPIA_DANADA, { cause: error })
  }

  const cabecera = cabeceraSchema.safeParse(json)
  if (!cabecera.success) throw new ErrorCopia(MENSAJE_COPIA_DANADA, { cause: cabecera.error })
  const { version } = cabecera.data
  if (version > VERSION_COPIA) {
    throw new ErrorCopia(
      `Esta copia es de una versión más nueva de Percha (v${String(version)}). Actualiza la app y vuelve a importarla.`,
    )
  }
  if (version !== VERSION_COPIA) {
    throw new ErrorCopia(
      `Esta copia es de una versión de Percha que no se puede leer (v${String(version)}).`,
    )
  }

  const resultado = manifiestoSchema.safeParse(json)
  if (!resultado.success) throw new ErrorCopia(MENSAJE_COPIA_DANADA, { cause: resultado.error })
  const manifiesto = resultado.data

  function sacarBlob({ ruta, tipo }: RefBlob): Blob {
    const datos = Object.hasOwn(zip, ruta) ? zip[ruta] : undefined
    if (!datos) throw new ErrorCopia(MENSAJE_COPIA_DANADA, { cause: new Error(`Falta ${ruta}`) })
    // Un tipo que no es de imagen (p. ej. text/html) podría ejecutarse si alguien abre la foto.
    return new Blob([datos], { type: TIPOS_IMAGEN.has(tipo) ? tipo : 'application/octet-stream' })
  }
  function sacarBlobOpcional(ref: RefBlob | null): Blob | null {
    return ref ? sacarBlob(ref) : null
  }

  const prendas: Prenda[] = manifiesto.prendas.map(({ fotos, ...campos }) => ({
    ...campos,
    fotos: fotos.map((foto): FotoPrenda => ({
      original: sacarBlob(foto.original),
      recortada: sacarBlobOpcional(foto.recortada),
    })),
  }))
  const perfil: Perfil | null = manifiesto.perfil && {
    ...manifiesto.perfil,
    fotoCara: sacarBlobOpcional(manifiesto.perfil.fotoCara),
    fotoCuerpo: sacarBlobOpcional(manifiesto.perfil.fotoCuerpo),
  }

  const outfits: Outfit[] = manifiesto.outfits.map(({ prueba, ...campos }) =>
    prueba ? { ...campos, prueba: sacarBlob(prueba) } : campos,
  )

  return {
    prendas,
    outfits,
    perfil,
    modeloGemini: manifiesto.ajustes.modeloGemini,
    tablasTallas: manifiesto.tablasTallas ?? [],
  }
}
