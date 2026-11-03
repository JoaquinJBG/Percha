import { vi } from 'vitest'

/**
 * jsdom no implementa `URL.createObjectURL` ni `revokeObjectURL`: los pone falsos y apunta qué
 * `Blob` hay detrás de cada URL. `quitar` los deja como estaban.
 */
export function simularUrlsDeBlob() {
  const blobs = new Map<string, Blob>()
  const crear = vi.fn((blob: Blob) => {
    const url = `blob:prueba/${String(blobs.size)}`
    blobs.set(url, blob)
    return url
  })
  const revocar = vi.fn<(url: string) => void>()
  const nombres = ['createObjectURL', 'revokeObjectURL'] as const
  const originales = nombres.map((nombre) => Object.getOwnPropertyDescriptor(URL, nombre))
  Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar })

  function quitar() {
    nombres.forEach((nombre, i) => {
      const original = originales[i]
      if (original) Object.defineProperty(URL, nombre, original)
      else Reflect.deleteProperty(URL, nombre)
    })
  }

  return { blobs, crear, revocar, quitar }
}
