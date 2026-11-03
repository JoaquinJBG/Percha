import { useEffect, useRef, useState } from 'react'
import { etiquetarUna, type ObtenerProveedor, type ResultadoIA } from './etiquetado.ts'

/**
 * Una petición a la IA cada vez. `cancelar()` (o desmontar) la aborta y hace que su `etiquetar`
 * devuelva `null`, aunque el proveedor no haga caso de la señal.
 */
export function useEtiquetadoIA(obtener: ObtenerProveedor) {
  const [etiquetando, setEtiquetando] = useState(false)
  const actual = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      actual.current?.abort()
    },
    [],
  )

  async function etiquetar(fotos: Blob[]): Promise<ResultadoIA | null> {
    actual.current?.abort()
    const control = new AbortController()
    actual.current = control
    setEtiquetando(true)
    const resultado = await etiquetarUna(obtener, fotos, control.signal)
    if (actual.current !== control || control.signal.aborted) return null
    actual.current = null
    setEtiquetando(false)
    return resultado
  }

  function cancelar() {
    actual.current?.abort()
    actual.current = null
    setEtiquetando(false)
  }

  return { etiquetando, etiquetar, cancelar }
}
