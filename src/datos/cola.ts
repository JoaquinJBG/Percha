import { db } from './db.ts'
import { nuevoId } from './repositorio.ts'

/**
 * Una foto de la alta masiva que todavía no es prenda.
 * - `nueva`: tal cual llegó.
 * - `lista`: normalizada (y recortada si se pudo), esperando a la IA.
 * - `error`: no se pudo abrir o la IA no supo qué era; `error` dice por qué.
 */
export interface ElementoCola {
  id: string
  nombre: string
  orden: number
  original: Blob
  normalizada: Blob | null
  recortada: Blob | null
  estado: 'nueva' | 'lista' | 'error'
  error: string | null
}

export type CambiosCola = Partial<Omit<ElementoCola, 'id' | 'orden'>>

/** Añade las fotos al final de la cola, en el orden recibido. */
export async function encolarFotos(fotos: readonly File[]): Promise<number> {
  const ultimo = await db.cola.orderBy('orden').last()
  let orden = (ultimo?.orden ?? 0) + 1
  const elementos: ElementoCola[] = fotos
    .filter((foto) => foto.type.startsWith('image/'))
    .map((foto) => ({
      id: nuevoId(),
      nombre: foto.name,
      orden: orden++,
      original: foto,
      normalizada: null,
      recortada: null,
      estado: 'nueva',
      error: null,
    }))
  await db.cola.bulkAdd(elementos)
  return elementos.length
}

/** En el orden en que se añadieron. */
export function listarCola(): Promise<ElementoCola[]> {
  return db.cola.orderBy('orden').toArray()
}

export async function actualizarElementoCola(id: string, cambios: CambiosCola): Promise<void> {
  await db.cola.update(id, cambios)
}

export async function quitarDeCola(ids: readonly string[]): Promise<void> {
  await db.cola.bulkDelete([...ids])
}

export async function vaciarCola(): Promise<void> {
  await db.cola.clear()
}
