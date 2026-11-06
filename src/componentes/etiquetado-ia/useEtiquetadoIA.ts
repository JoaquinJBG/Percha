import { useEffect, useRef, useState } from 'react'
import {
  etiquetarUna,
  leerEtiquetaUna,
  type ObtenerProveedor,
  type ResultadoIA,
  type ResultadoLectura,
} from './etiquetado.ts'

/**
 * Una petición a la IA cada vez. `cancelar()` (o desmontar) la aborta y hace que `pedir` devuelva
 * `null`, aunque el proveedor no haga caso de la señal.
 */
function usePeticionIA() {
  const [ocupado, setOcupado] = useState(false)
  const actual = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      actual.current?.abort()
    },
    [],
  )

  async function pedir<T>(tarea: (signal: AbortSignal) => Promise<T | null>): Promise<T | null> {
    actual.current?.abort()
    const control = new AbortController()
    actual.current = control
    setOcupado(true)
    const resultado = await tarea(control.signal)
    if (actual.current !== control || control.signal.aborted) return null
    actual.current = null
    setOcupado(false)
    return resultado
  }

  function cancelar() {
    actual.current?.abort()
    actual.current = null
    setOcupado(false)
  }

  return { ocupado, pedir, cancelar }
}

export function useEtiquetadoIA(obtener: ObtenerProveedor) {
  const { ocupado, pedir, cancelar } = usePeticionIA()
  return {
    etiquetando: ocupado,
    etiquetar: (fotos: Blob[]): Promise<ResultadoIA | null> =>
      pedir((signal) => etiquetarUna(obtener, fotos, signal)),
    cancelar,
  }
}

/** Lo mismo para leer la foto de la etiqueta cosida (T5.1). */
export function useLecturaEtiqueta(obtener: ObtenerProveedor) {
  const { ocupado, pedir, cancelar } = usePeticionIA()
  return {
    leyendo: ocupado,
    leer: (foto: Blob): Promise<ResultadoLectura | null> =>
      pedir((signal) => leerEtiquetaUna(obtener, foto, signal)),
    cancelar,
  }
}
