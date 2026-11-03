import { useEffect, useRef, type ImgHTMLAttributes } from 'react'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  blob: Blob
}

/**
 * Imagen de un `Blob` guardado. La URL se crea al montarla y se libera al desmontarla; con
 * `loading="lazy"` el navegador solo decodifica las que están a la vista.
 */
export function FotoBlob({ blob, alt = '', ...resto }: Props) {
  const imagen = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const elemento = imagen.current
    if (!elemento) return
    const url = URL.createObjectURL(blob)
    elemento.src = url
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [blob])

  return <img ref={imagen} alt={alt} loading="lazy" decoding="async" {...resto} />
}
