import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FotoBlob } from '../armario/FotoBlob.tsx'

interface Props {
  id: string
  titulo: string
  foto: Blob | null
  /** Cámara que abre el botón «Cámara»: la frontal para la cara, la trasera para el cuerpo. */
  camara: 'user' | 'environment'
  ocupada: boolean
  onElegir: (fichero: File) => void
  onBorrar: () => void
}

const boton =
  'min-h-11 rounded-xl px-3 text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta'
const botonSecundario = `${boton} border border-tinta/25 text-tinta`
const botonPeligro = `${boton} bg-red-800 text-white`
const botonFichero = `${botonSecundario} flex cursor-pointer items-center justify-center has-[:disabled]:cursor-default has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tinta`

export function FotoPerfil({ id, titulo, foto, camara, ocupada, onElegir, onBorrar }: Props) {
  // Se guarda qué foto se iba a borrar: si cambia o se borra, la confirmación desaparece sola.
  const [aBorrar, setABorrar] = useState<Blob | null>(null)
  const confirmando = aBorrar !== null && aBorrar === foto
  const cancelar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmando) cancelar.current?.focus()
  }, [confirmando])

  function elegir(evento: ChangeEvent<HTMLInputElement>) {
    const fichero = evento.target.files?.[0]
    // Para poder volver a elegir la misma foto después de borrarla.
    evento.target.value = ''
    if (fichero) onElegir(fichero)
  }

  return (
    <li aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="font-medium">
        {titulo}
      </h3>
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-tinta/15 bg-white/60">
        {foto ? (
          <FotoBlob
            blob={foto}
            alt={`Tu foto: ${titulo.toLocaleLowerCase('es')}`}
            className={`h-full w-full object-contain ${ocupada ? 'opacity-60' : ''}`}
          />
        ) : (
          <p className="p-3 text-center text-sm text-suave">{ocupada ? '' : 'Sin foto'}</p>
        )}
        {ocupada && (
          <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-papel/80">
            <div className="h-full w-1/3 animate-pulse bg-tinta" />
          </div>
        )}
      </div>

      {confirmando ? (
        <div
          role="group"
          aria-label={`¿Borrar la foto: ${titulo.toLocaleLowerCase('es')}?`}
          className="flex flex-col gap-2"
        >
          <p className="text-sm font-medium">¿Borrar esta foto?</p>
          <button
            ref={cancelar}
            type="button"
            className={botonSecundario}
            onClick={() => {
              setABorrar(null)
            }}
          >
            Cancelar
          </button>
          <button type="button" className={botonPeligro} disabled={ocupada} onClick={onBorrar}>
            Sí, borrar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className={botonFichero}>
              <input
                type="file"
                accept="image/*"
                capture={camara}
                className="sr-only"
                disabled={ocupada}
                onChange={elegir}
              />
              Cámara
            </label>
            <label className={botonFichero}>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={ocupada}
                onChange={elegir}
              />
              Galería
            </label>
          </div>
          {foto && (
            <button
              type="button"
              className={`${boton} text-suave underline`}
              disabled={ocupada}
              onClick={() => {
                setABorrar(foto)
              }}
            >
              Borrar
            </button>
          )}
        </div>
      )}
    </li>
  )
}
