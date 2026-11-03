import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  blob: Blob
}

/**
 * Imagen de un `Blob` guardado. La URL se crea al montarla y se libera al desmontarla; con
 * `loading="lazy"` el navegador solo decodifica las que están a la vista. Hasta que carga es
 * transparente, para que Chrome no pinte el icono de imagen rota con el `alt` mientras tanto.
 */
export function FotoBlob({ blob, alt = '', className = '', ...resto }: Props) {
  const imagen = useRef<HTMLImageElement>(null)
  const [cargada, setCargada] = useState(false)

  useEffect(() => {
    const elemento = imagen.current
    if (!elemento) return
    const url = URL.createObjectURL(blob)
    elemento.src = url
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [blob])

  function mostrar() {
    setCargada(true)
  }

  return (
    <img
      ref={imagen}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={mostrar}
      onError={mostrar}
      {...resto}
      className={`${className} transition-opacity ${cargada ? '' : 'opacity-0'}`}
    />
  )
}
