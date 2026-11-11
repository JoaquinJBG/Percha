import type { Prenda } from '../../datos/modelo.ts'
import { MODELO_BUSQUEDA, type ResultadoFicha, type TipoErrorIA } from '../../ia/index.ts'

/** Como mucho 10 prendas por prueba: con el nivel gratis, cada una es una petición con búsqueda. */
export const MAX_PRENDAS_LABORATORIO = 10

export type Veredicto = 'acierto' | 'a-medias' | 'fallo'

export const VEREDICTOS: { valor: Veredicto; texto: string }[] = [
  { valor: 'acierto', texto: 'Acierto' },
  { valor: 'a-medias', texto: 'A medias' },
  { valor: 'fallo', texto: 'Fallo' },
]

export type EstadoBusqueda =
  | { fase: 'pendiente' }
  | { fase: 'buscando' }
  | { fase: 'hecha'; resultado: ResultadoFicha }
  | { fase: 'error'; tipo: TipoErrorIA; mensaje: string }

/** Lo que se guarda en el móvil para no perder una prueba si se sale de la pantalla. */
export interface Prueba {
  elegidas: string[]
  estados: Record<string, EstadoBusqueda>
  veredictos: Record<string, Veredicto>
}

export const PRUEBA_VACIA: Prueba = { elegidas: [], estados: {}, veredictos: {} }

const CLAVE_PRUEBA = 'percha:laboratorio-prueba'

export function leerPrueba(): Prueba {
  try {
    const guardada = localStorage.getItem(CLAVE_PRUEBA)
    if (!guardada) return PRUEBA_VACIA
    const prueba = JSON.parse(guardada) as Prueba
    // Una búsqueda que se quedó a medias al salir vuelve a estar pendiente.
    const estados = Object.fromEntries(
      Object.entries(prueba.estados).map(([id, estado]) => [
        id,
        estado.fase === 'buscando' ? { fase: 'pendiente' as const } : estado,
      ]),
    )
    return { ...prueba, estados }
  } catch {
    return PRUEBA_VACIA
  }
}

export function guardarPrueba(prueba: Prueba): void {
  try {
    localStorage.setItem(CLAVE_PRUEBA, JSON.stringify(prueba))
  } catch {
    // Sin almacenamiento, la prueba vive solo en la pantalla.
  }
}

/** Estos errores valen para todas las prendas que faltan: se para la prueba. */
export const PARAN_LA_PRUEBA: TipoErrorIA[] = [
  'sin-clave',
  'clave-mala',
  'sin-cupo',
  'de-pago',
  'sin-red',
  'modelo',
]

export function resumen(prueba: Prueba) {
  const veredictos = prueba.elegidas.map((id) => prueba.veredictos[id])
  const tiempos = prueba.elegidas.flatMap((id) => {
    const estado = prueba.estados[id]
    return estado?.fase === 'hecha' ? [estado.resultado] : []
  })
  return {
    prendas: prueba.elegidas.length,
    aciertos: veredictos.filter((v) => v === 'acierto').length,
    aMedias: veredictos.filter((v) => v === 'a-medias').length,
    fallos: veredictos.filter((v) => v === 'fallo').length,
    sinMarcar: veredictos.filter((v) => v === undefined).length,
    errores: prueba.elegidas.filter((id) => prueba.estados[id]?.fase === 'error').length,
    msMedio:
      tiempos.length === 0
        ? null
        : Math.round(tiempos.reduce((suma, r) => suma + r.ms, 0) / tiempos.length),
    tokensTotales: tiempos.reduce((suma, r) => suma + (r.tokens.total ?? 0), 0),
  }
}

/** El JSON de la prueba: la prenda sin fotos, lo encontrado y el veredicto. Nunca lleva la clave. */
export function exportarPrueba(prueba: Prueba, prendas: Prenda[], fecha = new Date()): string {
  const porId = new Map(prendas.map((p) => [p.id, p]))
  return JSON.stringify(
    {
      prueba: 'S9 grounding',
      fecha: fecha.toISOString(),
      modelo: MODELO_BUSQUEDA,
      resumen: resumen(prueba),
      prendas: prueba.elegidas.map((id) => {
        const prenda = porId.get(id)
        const estado = prueba.estados[id] ?? { fase: 'pendiente' }
        return {
          id,
          categoria: prenda?.categoria ?? null,
          subcategoria: prenda?.subcategoria ?? null,
          colores: prenda?.colores ?? [],
          marca: prenda?.marca ?? null,
          referencia: prenda?.referencia ?? null,
          corte: prenda?.corte ?? null,
          veredicto: prueba.veredictos[id] ?? null,
          ...(estado.fase === 'hecha'
            ? estado.resultado
            : { estado: estado.fase, error: estado.fase === 'error' ? estado.tipo : null }),
        }
      }),
    },
    null,
    2,
  )
}
