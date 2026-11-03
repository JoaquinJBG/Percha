import { Dexie, type EntityTable, type Table } from 'dexie'
import type { ElementoCola } from './cola.ts'
import type { Ajustes, Outfit, Perfil, Prenda } from './modelo.ts'

/** Clave de la única fila de `perfil` y de `ajustes`. */
export const FILA_UNICA = 'unica'

export class BaseDatos extends Dexie {
  declare prendas: EntityTable<Prenda, 'id'>
  declare outfits: EntityTable<Outfit, 'id'>
  declare perfil: Table<Perfil, string>
  declare ajustes: Table<Ajustes, string>
  declare cola: EntityTable<ElementoCola, 'id'>

  constructor(nombre = 'percha') {
    super(nombre)
    this.version(1).stores({
      prendas: 'id, categoria, *estilos, *colores, creadaEn',
      outfits: 'id, creadoEn',
      perfil: '',
      ajustes: '',
    })
    // Fotos de la alta masiva que aún no son prendas. No van en la copia.
    this.version(2).stores({ cola: 'id, orden' })
  }
}

export const db = new BaseDatos()

/**
 * Pide a Chrome que no borre los datos si falta espacio. Sin contexto seguro (`pnpm dev --host` por IP)
 * `navigator.storage` no existe.
 */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) return false
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}
