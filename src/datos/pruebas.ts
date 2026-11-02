import { db } from './db.ts'
import type { NuevaPrenda } from './modelo.ts'

/** Imagen sintética: unos bytes con el tipo que se pida. */
export function imagen(semilla: number, tipo = 'image/webp'): Blob {
  return new Blob([Uint8Array.from({ length: 64 }, (_, i) => (i * semilla) % 256)], { type: tipo })
}

export function nuevaPrenda(cambios: Partial<NuevaPrenda> = {}): NuevaPrenda {
  return {
    fotos: [{ original: imagen(1, 'image/jpeg'), recortada: imagen(2, 'image/png') }],
    categoria: 'superior',
    subcategoria: 'camiseta',
    colores: ['blanco'],
    estampado: 'liso',
    estilos: ['casual'],
    abrigo: 1,
    formalidad: 2,
    ocasiones: ['diario'],
    temporadas: ['verano'],
    notas: '',
    etiquetadaPor: 'manual',
    ...cambios,
  }
}

/** Sustituye cada `Blob` por su tipo y sus bytes para poder comparar con `toEqual`. */
export async function sinBlobs(valor: unknown): Promise<unknown> {
  if (valor instanceof Blob) {
    return { tipo: valor.type, bytes: Array.from(new Uint8Array(await valor.arrayBuffer())) }
  }
  if (Array.isArray(valor)) return Promise.all(valor.map(sinBlobs))
  if (valor && typeof valor === 'object') {
    const entradas = await Promise.all(
      Object.entries(valor).map(async ([clave, dentro]) => [clave, await sinBlobs(dentro)]),
    )
    return Object.fromEntries(entradas)
  }
  return valor
}

export async function vaciarBase(): Promise<void> {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
}
