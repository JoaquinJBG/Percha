/** Bytes leídos del modelo de recorte (de la red la primera vez; después, de la caché). */
export interface ProgresoCarga {
  cargados: number
  total: number
}

export interface OpcionesRecorte {
  alProgresar?: (progreso: ProgresoCarga) => void
}

/** Devuelve un PNG con el fondo transparente, del mismo tamaño que la foto. */
export type Recortar = (foto: Blob, opciones?: OpcionesRecorte) => Promise<Blob>

/** Lo que el hilo principal le manda al worker. */
export interface PeticionRecorte {
  id: number
  foto: Blob
}

/** Lo que el worker contesta: el progreso de la carga va a todas las peticiones pendientes. */
export type RespuestaRecorte =
  | ({ tipo: 'progreso' } & ProgresoCarga)
  | { tipo: 'hecho'; id: number; png: Blob }
  | { tipo: 'error'; id: number; mensaje: string }

export class ErrorRecorte extends Error {
  override name = 'ErrorRecorte'
}
