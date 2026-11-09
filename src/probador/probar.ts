import {
  ErrorProbador,
  type ClienteProbador,
  type EstadoPrueba,
  type PrendaEnviada,
} from './cliente.ts'

/** Cada cuánto se pregunta por la prueba (contrato de T7.1). */
export const INTERVALO_MS = 3000
/** Consultas seguidas sin respuesta antes de rendirse: un corte de unos 10 s no tira la prueba. */
export const FALLOS_SEGUIDOS = 3
/** Lo que tarda el PC por prenda, para calcular lo que queda (S4, CatVTON en la 3060). */
export const SEGUNDOS_POR_PRENDA = 80

export interface Progreso extends Pick<EstadoPrueba, 'estado' | 'hechas' | 'total'> {
  id: string
}

export interface OpcionesSeguir {
  alProgreso: (progreso: Progreso) => void
  signal?: AbortSignal
  esperar?: (ms: number, signal?: AbortSignal) => Promise<void>
}

export function esperarMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolver, rechazar) => {
    if (signal?.aborted) {
      rechazar(signal.reason as Error)
      return
    }
    const temporizador = setTimeout(resolver, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(temporizador)
        rechazar(signal.reason as Error)
      },
      { once: true },
    )
  })
}

/** Segundos que faltan, aproximados: lo que tarda cada prenda que queda. */
export function segundosRestantes({ hechas, total }: Pick<Progreso, 'hechas' | 'total'>): number {
  return Math.max(0, total - hechas) * SEGUNDOS_POR_PRENDA
}

/**
 * Pregunta por la prueba cada 3 s hasta que esté lista y devuelve la imagen. Si el PC deja de
 * responder varias veces seguidas, falla con `red`: quien llama puede volver a seguirla con el mismo id.
 */
export async function seguirPrueba(
  cliente: ClienteProbador,
  id: string,
  { alProgreso, signal, esperar = esperarMs }: OpcionesSeguir,
): Promise<Blob> {
  let fallos = 0
  for (;;) {
    await esperar(INTERVALO_MS, signal)
    let estado: EstadoPrueba
    try {
      estado = await cliente.estado(id, signal)
    } catch (fallo) {
      if (fallo instanceof ErrorProbador && fallo.motivo === 'red') {
        fallos += 1
        if (fallos < FALLOS_SEGUIDOS) continue
      }
      throw fallo
    }
    fallos = 0
    alProgreso({ id, estado: estado.estado, hechas: estado.hechas, total: estado.total })
    if (estado.estado === 'lista') return cliente.imagen(id, signal)
    if (estado.estado === 'error') throw new ErrorProbador('prueba', estado.error ?? undefined)
  }
}

/** Manda la persona y las prendas al PC y espera a la imagen. */
export async function probarEnPC(
  cliente: ClienteProbador,
  persona: Blob,
  prendas: readonly PrendaEnviada[],
  opciones: OpcionesSeguir,
): Promise<Blob> {
  const { id, total } = await cliente.crearPrueba(persona, prendas, opciones.signal)
  opciones.alProgreso({ id, estado: 'en-cola', hechas: 0, total })
  return seguirPrueba(cliente, id, opciones)
}
