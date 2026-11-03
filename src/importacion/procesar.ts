import type { CambiosCola, ElementoCola } from '../datos/cola.ts'
import type { NuevaPrenda } from '../datos/modelo.ts'
import {
  ErrorIA,
  MAX_PRENDAS_POR_PETICION,
  type ProveedorIA,
  type TipoErrorIA,
} from '../ia/index.ts'

/** Separación mínima entre peticiones: el nivel gratis de Gemini da unas 10 por minuto (D16). */
export const INTERVALO_PETICIONES_MS = 7000

export interface DependenciasProceso {
  listar: () => Promise<ElementoCola[]>
  actualizar: (id: string, cambios: CambiosCola) => Promise<void>
  quitar: (ids: readonly string[]) => Promise<void>
  guardar: (prenda: NuevaPrenda) => Promise<unknown>
  normalizar: (foto: Blob) => Promise<Blob>
  recortar: (foto: Blob) => Promise<Blob>
  obtenerProveedor: () => Promise<ProveedorIA | null>
  esperar: (ms: number, signal: AbortSignal) => Promise<void>
  ahora: () => number
}

export type FaseProceso = 'preparando' | 'etiquetando' | 'esperando'

export interface ProgresoProceso {
  fase: FaseProceso
  añadidas: number
}

/** Por qué se paró: todo hecho, el usuario lo paró, o la IA no puede seguir ahora. */
export type FinProceso =
  | { motivo: 'terminado'; añadidas: number }
  | { motivo: 'parado'; añadidas: number }
  | { motivo: 'sin-ia'; tipo: TipoErrorIA; aviso: string; añadidas: number }

const ERROR_FOTO = 'No se pudo abrir la foto.'
const ERROR_IA = 'Gemini no supo qué prenda era. Reinténtalo o descártala.'
const AVISO_SIN_CLAVE =
  'Sin clave de Gemini las fotos se quedan recortadas en la cola. Ponla en Ajustes y sigue.'

/**
 * Procesa la cola de 5 en 5: normaliza y recorta cada foto, etiqueta el lote en una sola petición y
 * guarda cada prenda que la IA reconoce. Lo hecho se guarda en la cola, así que se puede parar y seguir.
 */
export async function procesarCola(
  deps: DependenciasProceso,
  { signal, alCambiar }: { signal: AbortSignal; alCambiar?: (progreso: ProgresoProceso) => void },
): Promise<FinProceso> {
  let añadidas = 0
  // Función y no `signal.aborted` a pelo: TypeScript cree que no cambia entre esperas.
  const cancelado = () => signal.aborted
  let ultimaPeticion = Number.NEGATIVE_INFINITY
  const avisar = (fase: FaseProceso) => alCambiar?.({ fase, añadidas })

  const preparar = async (elemento: ElementoCola): Promise<ElementoCola> => {
    let normalizada: Blob
    try {
      normalizada = await deps.normalizar(elemento.original)
    } catch {
      const cambios = { estado: 'error', error: ERROR_FOTO } as const
      await deps.actualizar(elemento.id, cambios)
      return { ...elemento, ...cambios }
    }
    // Si el recorte falla, la prenda se guarda con la foto normalizada, como en la alta de una en una.
    const recortada = await deps.recortar(normalizada).catch(() => null)
    const cambios = { normalizada, recortada, estado: 'lista', error: null } as const
    await deps.actualizar(elemento.id, cambios)
    return { ...elemento, ...cambios }
  }

  while (!cancelado()) {
    const pendientes = (await deps.listar()).filter((e) => e.estado !== 'error')
    if (pendientes.length === 0) return { motivo: 'terminado', añadidas }

    avisar('preparando')
    const lote: ElementoCola[] = []
    for (const elemento of pendientes.slice(0, MAX_PRENDAS_POR_PETICION)) {
      if (cancelado()) return { motivo: 'parado', añadidas }
      lote.push(elemento.estado === 'nueva' ? await preparar(elemento) : elemento)
    }
    const listos = lote.flatMap((e) =>
      e.estado === 'lista' && e.normalizada ? [{ ...e, normalizada: e.normalizada }] : [],
    )
    if (listos.length === 0) continue

    const proveedor = await deps.obtenerProveedor()
    if (!proveedor) {
      // Sin IA se adelanta el recorte de todo lo demás: es lo lento y no gasta cupo.
      for (const elemento of pendientes.slice(MAX_PRENDAS_POR_PETICION)) {
        if (cancelado()) return { motivo: 'parado', añadidas }
        if (elemento.estado === 'nueva') await preparar(elemento)
        avisar('preparando')
      }
      return { motivo: 'sin-ia', tipo: 'sin-clave', aviso: AVISO_SIN_CLAVE, añadidas }
    }

    const espera = ultimaPeticion + INTERVALO_PETICIONES_MS - deps.ahora()
    if (espera > 0) {
      avisar('esperando')
      try {
        await deps.esperar(espera, signal)
      } catch {
        return { motivo: 'parado', añadidas }
      }
    }
    if (cancelado()) return { motivo: 'parado', añadidas }

    avisar('etiquetando')
    ultimaPeticion = deps.ahora()
    let resultados: Awaited<ReturnType<ProveedorIA['etiquetarPrendas']>>
    try {
      resultados = await proveedor.etiquetarPrendas(
        listos.map((e) => ({ fotos: [e.recortada ?? e.normalizada] })),
        { signal },
      )
    } catch (error) {
      if (cancelado()) return { motivo: 'parado', añadidas }
      if (!(error instanceof ErrorIA)) throw error
      if (error.tipo === 'respuesta') {
        for (const elemento of listos) {
          await deps.actualizar(elemento.id, { estado: 'error', error: ERROR_IA })
        }
        continue
      }
      return { motivo: 'sin-ia', tipo: error.tipo, aviso: error.message, añadidas }
    }

    const guardadas: string[] = []
    for (const [i, elemento] of listos.entries()) {
      const etiquetas = resultados[i]
      if (!etiquetas) {
        await deps.actualizar(elemento.id, { estado: 'error', error: ERROR_IA })
        continue
      }
      await deps.guardar({
        ...etiquetas,
        fotos: [{ original: elemento.normalizada, recortada: elemento.recortada }],
        etiquetadaPor: 'ia',
      })
      guardadas.push(elemento.id)
      añadidas++
    }
    await deps.quitar(guardadas)
    avisar('etiquetando')
  }
  return { motivo: 'parado', añadidas }
}

/** Espera `ms` o hasta que se cancele (entonces rechaza). */
export function esperarCancelable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const cancelacion = () => new DOMException('Cancelado', 'AbortError')
    if (signal.aborted) {
      rechazar(cancelacion())
      return
    }
    const temporizador = setTimeout(() => {
      signal.removeEventListener('abort', alCancelar)
      resolver()
    }, ms)
    const alCancelar = () => {
      clearTimeout(temporizador)
      rechazar(cancelacion())
    }
    signal.addEventListener('abort', alCancelar, { once: true })
  })
}
