import { describe, expect, it, vi } from 'vitest'
import type { ElementoCola } from '../datos/cola.ts'
import type { NuevaPrenda } from '../datos/modelo.ts'
import { ETIQUETAS_DE_PRUEBA, ErrorIA, crearProveedorFalso, type ProveedorIA } from '../ia/index.ts'
import { INTERVALO_PETICIONES_MS, procesarCola, type DependenciasProceso } from './procesar.ts'

const foto = (nombre: string) => new Blob([nombre], { type: 'image/jpeg' })

function elemento(n: number, cambios: Partial<ElementoCola> = {}): ElementoCola {
  return {
    id: `e${String(n)}`,
    nombre: `foto${String(n)}.jpg`,
    orden: n,
    original: foto(`original ${String(n)}`),
    normalizada: null,
    recortada: null,
    estado: 'nueva',
    error: null,
    ...cambios,
  }
}

/** Cola en memoria con las mismas operaciones que la de IndexedDB. */
interface OpcionesMontar {
  proveedor?: ProveedorIA | null
  extra?: Partial<DependenciasProceso>
}

function montar(n: number, { proveedor = crearProveedorFalso(), extra = {} }: OpcionesMontar = {}) {
  let cola = Array.from({ length: n }, (_, i) => elemento(i + 1))
  const guardadas: NuevaPrenda[] = []
  let reloj = 0
  const esperas: number[] = []
  const deps: DependenciasProceso = {
    listar: () => Promise.resolve(cola.map((e) => ({ ...e }))),
    actualizar: (id, cambios) => {
      cola = cola.map((e) => (e.id === id ? { ...e, ...cambios } : e))
      return Promise.resolve()
    },
    quitar: (ids) => {
      cola = cola.filter((e) => !ids.includes(e.id))
      return Promise.resolve()
    },
    guardar: (prenda) => {
      guardadas.push(prenda)
      return Promise.resolve()
    },
    normalizar: (blob) => Promise.resolve(new Blob([blob], { type: 'image/jpeg' })),
    recortar: (blob) => Promise.resolve(new Blob([blob], { type: 'image/png' })),
    obtenerProveedor: () => Promise.resolve(proveedor),
    esperar: (ms) => {
      esperas.push(ms)
      reloj += ms
      return Promise.resolve()
    },
    ahora: () => reloj,
    ...extra,
  }
  return { deps, guardadas, esperas, cola: () => cola }
}

const señal = () => new AbortController().signal

describe('procesarCola', () => {
  it('etiqueta de 5 en 5, guarda cada prenda y vacía la cola', async () => {
    const proveedor = crearProveedorFalso()
    const { deps, guardadas, esperas, cola } = montar(12, { proveedor })

    const fin = await procesarCola(deps, { signal: señal() })

    expect(fin).toEqual({ motivo: 'terminado', añadidas: 12 })
    expect(proveedor.lotes.map((lote) => lote.length)).toEqual([5, 5, 2])
    expect(guardadas).toHaveLength(12)
    expect(guardadas[0]).toMatchObject({ ...ETIQUETAS_DE_PRUEBA, etiquetadaPor: 'ia' })
    expect(guardadas[0]?.fotos[0]?.recortada?.type).toBe('image/png')
    expect(cola()).toEqual([])
    // Entre peticiones se respeta el intervalo del nivel gratis; antes de la primera no se espera.
    expect(esperas).toEqual([INTERVALO_PETICIONES_MS, INTERVALO_PETICIONES_MS])
  })

  it('a la IA le manda la foto recortada; si el recorte falla, la normalizada', async () => {
    const proveedor = crearProveedorFalso()
    let recortes = 0
    const { deps, guardadas } = montar(2, {
      proveedor,
      extra: {
        recortar: (blob) =>
          recortes++ === 0
            ? Promise.reject(new Error('webgpu'))
            : Promise.resolve(new Blob([blob], { type: 'image/png' })),
      },
    })

    await procesarCola(deps, { signal: señal() })

    expect(proveedor.lotes[0]?.map((p) => p.fotos[0]?.type)).toEqual(['image/jpeg', 'image/png'])
    expect(guardadas[0]?.fotos[0]).toMatchObject({ recortada: null })
  })

  it('una foto que no se abre se queda en la cola con su error y no frena a las demás', async () => {
    const rota: { foto: Blob | undefined } = { foto: undefined }
    const { deps, guardadas, cola } = montar(3, {
      extra: {
        normalizar: (blob) =>
          blob === rota.foto
            ? Promise.reject(new Error('heic'))
            : Promise.resolve(new Blob([blob], { type: 'image/jpeg' })),
      },
    })
    rota.foto = cola().find((e) => e.id === 'e2')?.original

    const fin = await procesarCola(deps, { signal: señal() })

    expect(fin).toEqual({ motivo: 'terminado', añadidas: 2 })
    expect(guardadas).toHaveLength(2)
    expect(cola()).toEqual([
      expect.objectContaining({ id: 'e2', estado: 'error', error: 'No se pudo abrir la foto.' }),
    ])
  })

  it('sin clave recorta todo lo que queda y para con el aviso', async () => {
    const recortar = vi.fn((blob: Blob) => Promise.resolve(new Blob([blob], { type: 'image/png' })))
    const { deps, guardadas, cola } = montar(7, { proveedor: null, extra: { recortar } })

    const fin = await procesarCola(deps, { signal: señal() })

    expect(fin).toMatchObject({ motivo: 'sin-ia', tipo: 'sin-clave', añadidas: 0 })
    expect(recortar).toHaveBeenCalledTimes(7)
    expect(guardadas).toEqual([])
    expect(cola().every((e) => e.estado === 'lista')).toBe(true)
  })

  it('con el cupo agotado para y deja lo que falta listo para seguir', async () => {
    const proveedor = crearProveedorFalso({ error: new ErrorIA('sin-cupo') })
    const { deps, cola } = montar(6, { proveedor })

    const fin = await procesarCola(deps, { signal: señal() })

    expect(fin).toMatchObject({ motivo: 'sin-ia', tipo: 'sin-cupo', añadidas: 0 })
    expect(cola()).toHaveLength(6)
    expect(cola().filter((e) => e.estado === 'lista')).toHaveLength(5)
  })

  it('lo que la IA no reconoce queda con error; lo demás se guarda', async () => {
    let n = 0
    const proveedor = crearProveedorFalso({
      etiquetas: () => (n++ === 1 ? null : ETIQUETAS_DE_PRUEBA),
    })
    const { deps, guardadas, cola } = montar(3, { proveedor })

    const fin = await procesarCola(deps, { signal: señal() })

    expect(fin).toEqual({ motivo: 'terminado', añadidas: 2 })
    expect(guardadas).toHaveLength(2)
    expect(cola()).toEqual([expect.objectContaining({ id: 'e2', estado: 'error' })])
  })

  it('al cancelar para enseguida y no pierde lo hecho', async () => {
    const control = new AbortController()
    const { deps, guardadas, cola } = montar(12, {
      extra: {
        guardar: (prenda) => {
          guardadasMias.push(prenda)
          if (guardadasMias.length === 5) control.abort()
          return Promise.resolve()
        },
      },
    })
    const guardadasMias: NuevaPrenda[] = []

    const fin = await procesarCola(deps, { signal: control.signal })

    expect(fin).toEqual({ motivo: 'parado', añadidas: 5 })
    expect(guardadas).toEqual([])
    expect(cola()).toHaveLength(7)
  })

  it('con todo hecho termina sin pedir nada', async () => {
    const proveedor = crearProveedorFalso()
    const { deps } = montar(0, { proveedor })

    expect(await procesarCola(deps, { signal: señal() })).toEqual({
      motivo: 'terminado',
      añadidas: 0,
    })
    expect(proveedor.lotes).toEqual([])
  })
})
