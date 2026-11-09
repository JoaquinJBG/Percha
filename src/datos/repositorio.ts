import { db, FILA_UNICA } from './db.ts'
import {
  AJUSTES_POR_DEFECTO,
  ajustesSchema,
  normalizarColor,
  outfitSchema,
  PERFIL_VACIO,
  perfilSchema,
  prendaSchema,
  type Ajustes,
  type CambiosPrenda,
  type Categoria,
  type Estilo,
  type NuevaPrenda,
  type NuevoOutfit,
  type Outfit,
  type Perfil,
  type Prenda,
} from './modelo.ts'

export interface FiltrosPrendas {
  categoria?: Categoria
  estilo?: Estilo
  color?: string
}

/** UUID v4 con `getRandomValues`: `crypto.randomUUID` no existe fuera de un contexto seguro. */
export function nuevoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function crearPrenda(datos: NuevaPrenda): Promise<Prenda> {
  const prenda = prendaSchema.parse({ ...datos, id: nuevoId(), creadaEn: Date.now() })
  await db.prendas.add(prenda)
  return prenda
}

export function leerPrenda(id: string): Promise<Prenda | undefined> {
  return db.prendas.get(id)
}

/** De la más nueva a la más antigua. Los filtros se combinan (todos tienen que cumplirse). */
export function listarPrendas(filtros: FiltrosPrendas = {}): Promise<Prenda[]> {
  const { categoria, estilo } = filtros
  const color = filtros.color === undefined ? '' : normalizarColor(filtros.color)
  return db.prendas
    .orderBy('creadaEn')
    .reverse()
    .filter(
      (prenda) =>
        (categoria === undefined || prenda.categoria === categoria) &&
        (estilo === undefined || prenda.estilos.includes(estilo)) &&
        (color === '' || prenda.colores.includes(color)),
    )
    .toArray()
}

export function actualizarPrenda(id: string, cambios: CambiosPrenda): Promise<Prenda> {
  return db.transaction('rw', db.prendas, async () => {
    const actual = await db.prendas.get(id)
    if (!actual) throw new Error(`No existe la prenda ${id}`)
    const prenda = prendaSchema.parse({ ...actual, ...cambios, id, creadaEn: actual.creadaEn })
    await db.prendas.put(prenda)
    return prenda
  })
}

/** Los outfits que la usaban conservan su `id`: quien los pinte tiene que tolerar prendas que faltan. */
export function borrarPrenda(id: string): Promise<void> {
  return db.prendas.delete(id)
}

export async function guardarOutfit(datos: NuevoOutfit): Promise<Outfit> {
  const outfit = outfitSchema.parse({ ...datos, id: nuevoId(), creadoEn: Date.now() })
  await db.outfits.add(outfit)
  return outfit
}

export function listarOutfits(): Promise<Outfit[]> {
  return db.outfits.orderBy('creadoEn').reverse().toArray()
}

export async function marcarFavorito(id: string, favorito: boolean): Promise<void> {
  const cambiados = await db.outfits.update(id, { favorito })
  if (cambiados === 0) throw new Error(`No existe el outfit ${id}`)
}

/** Guarda con el outfit la foto del probador del PC; si ya tenía una, la cambia. */
export async function guardarPrueba(id: string, prueba: Blob): Promise<void> {
  const cambiados = await db.outfits.update(id, { prueba })
  if (cambiados === 0) throw new Error(`No existe el outfit ${id}`)
}

export function borrarOutfit(id: string): Promise<void> {
  return db.outfits.delete(id)
}

export async function leerPerfil(): Promise<Perfil> {
  return (await db.perfil.get(FILA_UNICA)) ?? PERFIL_VACIO
}

/** Guarda solo los campos que se pasan; el resto se queda como estaba. */
export function guardarPerfil(cambios: Partial<Perfil>): Promise<Perfil> {
  return db.transaction('rw', db.perfil, async () => {
    const perfil = perfilSchema.parse({ ...(await leerPerfil()), ...cambios })
    await db.perfil.put(perfil, FILA_UNICA)
    return perfil
  })
}

export async function leerAjustes(): Promise<Ajustes> {
  // Los ajustes guardados antes de T7.1 no tienen los campos del probador.
  return { ...AJUSTES_POR_DEFECTO, ...(await db.ajustes.get(FILA_UNICA)) }
}

/** Guarda solo los campos que se pasan; una clave vacía se guarda como `null`. */
export function guardarAjustes(cambios: Partial<Ajustes>): Promise<Ajustes> {
  return db.transaction('rw', db.ajustes, async () => {
    const ajustes = ajustesSchema.parse({ ...(await leerAjustes()), ...cambios })
    await db.ajustes.put(ajustes, FILA_UNICA)
    return ajustes
  })
}
