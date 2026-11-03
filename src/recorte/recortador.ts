import {
  ErrorRecorte,
  type OpcionesRecorte,
  type PeticionRecorte,
  type ProgresoCarga,
  type Recortar,
  type RespuestaRecorte,
} from './tipos.ts'

/** Lo que se usa de un `Worker`: así los tests pueden pasar uno falso. */
export interface WorkerRecorte {
  postMessage(peticion: PeticionRecorte): void
  onmessage: ((evento: MessageEvent<RespuestaRecorte>) => void) | null
  onerror: ((evento: ErrorEvent) => void) | null
  terminate(): void
}

interface Pendiente {
  resolver: (png: Blob) => void
  rechazar: (error: Error) => void
  alProgresar: ((progreso: ProgresoCarga) => void) | undefined
}

/**
 * El worker se crea con la primera foto y se queda vivo: el modelo se carga una sola vez. Si el worker
 * se cae entero, las fotos pendientes fallan y la siguiente crea uno nuevo.
 */
export function crearRecortador(crearWorker: () => WorkerRecorte): Recortar {
  let worker: WorkerRecorte | null = null
  let siguienteId = 1
  const pendientes = new Map<number, Pendiente>()

  function conectar(): WorkerRecorte {
    if (worker) return worker
    const nuevo = crearWorker()
    nuevo.onmessage = ({ data }) => {
      if (data.tipo === 'progreso') {
        const { cargados, total } = data
        for (const pendiente of pendientes.values()) pendiente.alProgresar?.({ cargados, total })
        return
      }
      const pendiente = pendientes.get(data.id)
      if (!pendiente) return
      pendientes.delete(data.id)
      if (data.tipo === 'hecho') pendiente.resolver(data.png)
      else pendiente.rechazar(new ErrorRecorte(data.mensaje))
    }
    nuevo.onerror = (evento) => {
      evento.preventDefault()
      console.error('El worker de recorte se ha caído', evento.message)
      nuevo.terminate()
      if (worker === nuevo) worker = null
      for (const pendiente of pendientes.values()) {
        pendiente.rechazar(new ErrorRecorte('El recortador se ha detenido.'))
      }
      pendientes.clear()
    }
    worker = nuevo
    return nuevo
  }

  return (foto: Blob, opciones: OpcionesRecorte = {}) =>
    new Promise<Blob>((resolver, rechazar) => {
      const id = siguienteId++
      pendientes.set(id, { resolver, rechazar, alProgresar: opciones.alProgresar })
      try {
        conectar().postMessage({ id, foto })
      } catch (error) {
        pendientes.delete(id)
        rechazar(error instanceof Error ? error : new ErrorRecorte(String(error)))
      }
    })
}

export const recortar: Recortar = crearRecortador(
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'recorte' }),
)
