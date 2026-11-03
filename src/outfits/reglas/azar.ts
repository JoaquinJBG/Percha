/** Generador mulberry32: la misma semilla da siempre la misma serie en [0, 1). */
export function crearAzar(semilla: number): () => number {
  let estado = Math.trunc(Number.isFinite(semilla) ? semilla : 0) >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
