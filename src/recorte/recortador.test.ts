import { describe, expect, it, vi } from 'vitest'
import { crearRecortador, type WorkerRecorte } from './recortador.ts'
import { ErrorRecorte, type PeticionRecorte, type RespuestaRecorte } from './tipos.ts'

class WorkerFalso implements WorkerRecorte {
  recibidas: PeticionRecorte[] = []
  terminado = false
  onmessage: ((evento: MessageEvent<RespuestaRecorte>) => void) | null = null
  onerror: ((evento: ErrorEvent) => void) | null = null

  postMessage(peticion: PeticionRecorte) {
    this.recibidas.push(peticion)
  }

  terminate() {
    this.terminado = true
  }

  contestar(respuesta: RespuestaRecorte) {
    this.onmessage?.(new MessageEvent('message', { data: respuesta }))
  }

  caerse() {
    this.onerror?.(new ErrorEvent('error', { message: 'se cayó', cancelable: true }))
  }
}

function preparar() {
  const workers: WorkerFalso[] = []
  const recortar = crearRecortador(() => {
    const worker = new WorkerFalso()
    workers.push(worker)
    return worker
  })
  return { recortar, workers }
}

const foto = (n: number) => new Blob([String(n)], { type: 'image/jpeg' })
const png = new Blob(['png'], { type: 'image/png' })

describe('crearRecortador', () => {
  it('no crea el worker hasta la primera foto y luego lo reutiliza', async () => {
    const { recortar, workers } = preparar()
    expect(workers).toHaveLength(0)

    const primera = recortar(foto(1))
    const segunda = recortar(foto(2))
    expect(workers).toHaveLength(1)
    const [worker] = workers
    if (!worker) throw new Error('sin worker')
    const [p1, p2] = worker.recibidas
    if (!p1 || !p2) throw new Error('faltan peticiones')
    expect(p1.id).not.toBe(p2.id)

    // Contesta en otro orden: cada promesa recibe lo suyo.
    const png2 = new Blob(['2'], { type: 'image/png' })
    worker.contestar({ tipo: 'hecho', id: p2.id, png: png2 })
    worker.contestar({ tipo: 'hecho', id: p1.id, png })
    await expect(primera).resolves.toBe(png)
    await expect(segunda).resolves.toBe(png2)
  })

  it('reparte el progreso de la carga a todas las fotos pendientes', async () => {
    const { recortar, workers } = preparar()
    const avisos1 = vi.fn()
    const avisos2 = vi.fn()
    const primera = recortar(foto(1), { alProgresar: avisos1 })
    const segunda = recortar(foto(2), { alProgresar: avisos2 })
    const worker = workers[0]
    if (!worker) throw new Error('sin worker')

    worker.contestar({ tipo: 'progreso', cargados: 10, total: 100 })
    for (const { id } of worker.recibidas) worker.contestar({ tipo: 'hecho', id, png })
    await Promise.all([primera, segunda])

    expect(avisos1).toHaveBeenCalledWith({ cargados: 10, total: 100 })
    expect(avisos2).toHaveBeenCalledWith({ cargados: 10, total: 100 })
  })

  it('rechaza con ErrorRecorte si el worker no puede recortar la foto', async () => {
    const { recortar, workers } = preparar()
    const promesa = recortar(foto(1))
    const worker = workers[0]
    const peticion = worker?.recibidas[0]
    if (!worker || !peticion) throw new Error('sin petición')

    worker.contestar({ tipo: 'error', id: peticion.id, mensaje: 'sin red' })

    await expect(promesa).rejects.toThrow(ErrorRecorte)
    await expect(promesa).rejects.toThrow('sin red')
  })

  it('si el worker se cae, falla lo pendiente y la siguiente foto crea otro', async () => {
    const { recortar, workers } = preparar()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const promesa = recortar(foto(1))
    workers[0]?.caerse()

    await expect(promesa).rejects.toThrow(ErrorRecorte)
    expect(workers[0]?.terminado).toBe(true)

    const otra = recortar(foto(2))
    expect(workers).toHaveLength(2)
    const peticion = workers[1]?.recibidas[0]
    if (!peticion) throw new Error('sin petición')
    workers[1]?.contestar({ tipo: 'hecho', id: peticion.id, png })
    await expect(otra).resolves.toBe(png)
  })
})
