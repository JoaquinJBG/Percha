import { recortarFoto } from './modelo.ts'
import type { PeticionRecorte, ProgresoCarga, RespuestaRecorte } from './tipos.ts'

function responder(respuesta: RespuestaRecorte) {
  self.postMessage(respuesta)
}

function avisar(progreso: ProgresoCarga) {
  responder({ tipo: 'progreso', ...progreso })
}

// De una en una: dos inferencias a la vez sobre la misma sesión de WebGPU fallan.
let cola: Promise<unknown> = Promise.resolve()

self.addEventListener('message', ({ data }: MessageEvent<PeticionRecorte>) => {
  const { id, foto } = data
  cola = cola.then(async () => {
    try {
      responder({ tipo: 'hecho', id, png: await recortarFoto(foto, avisar) })
    } catch (error) {
      console.error('No se pudo recortar la foto', error)
      responder({
        tipo: 'error',
        id,
        mensaje: error instanceof Error ? error.message : String(error),
      })
    }
  })
})
