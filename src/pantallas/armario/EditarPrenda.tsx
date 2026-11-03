import { useEffect, useRef, useState } from 'react'
import {
  AvisoEtiquetado,
  etiquetadaPor,
  fotosParaIA,
  useEtiquetadoIA,
  type AvisoIA,
  type BaseEtiquetas,
  type ObtenerProveedor,
} from '../../componentes/etiquetado-ia/index.ts'
import { FormularioPrenda } from '../../componentes/formulario-prenda/index.ts'
import type { CambiosPrenda, EtiquetasPrenda, Prenda } from '../../datos/modelo.ts'
import { nombrePrenda } from './ayudas.ts'
import { FotoBlob } from './FotoBlob.tsx'

interface Props {
  prenda: Prenda
  obtenerProveedor: ObtenerProveedor
  onVolver: () => void
  onGuardar: (cambios: CambiosPrenda) => Promise<void>
}

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonSecundario = `${boton} border border-tinta/25 text-tinta`

export function EditarPrenda({ prenda, obtenerProveedor, onVolver, onGuardar }: Props) {
  const [base, setBase] = useState<BaseEtiquetas>({ etiquetas: prenda, por: prenda.etiquetadaPor })
  const [version, setVersion] = useState(0)
  const [avisoIA, setAvisoIA] = useState<AvisoIA | null>(null)
  const [reetiquetada, setReetiquetada] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(false)
  const ia = useEtiquetadoIA(obtenerProveedor)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titulo.current?.focus()
  }, [])

  async function volverAEtiquetar() {
    setAvisoIA(null)
    setReetiquetada(false)
    const resultado = await ia.etiquetar(fotosParaIA(prenda.fotos))
    if (!resultado) return
    if ('aviso' in resultado) {
      setAvisoIA(resultado.aviso)
      return
    }
    // Las notas suelen ser del usuario («con qué combina»): si la IA no dice nada, se quedan.
    const { etiquetas } = resultado
    setBase({
      etiquetas: {
        ...etiquetas,
        notas: etiquetas.notas.trim() === '' ? prenda.notas : etiquetas.notas,
      },
      por: 'ia',
    })
    setVersion((anterior) => anterior + 1)
    setReetiquetada(true)
  }

  async function guardar(etiquetas: EtiquetasPrenda) {
    setGuardando(true)
    setError(false)
    try {
      await onGuardar({ ...etiquetas, etiquetadaPor: etiquetadaPor(base, etiquetas) })
    } catch (fallo) {
      console.error(fallo)
      setError(true)
      setGuardando(false)
    }
  }

  const ocupado = guardando || ia.etiquetando

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-editar"
      className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-papel"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="-ml-2 flex min-h-12 items-center gap-1 self-start rounded-xl px-2 font-medium focus-visible:outline-2 focus-visible:outline-oliva disabled:opacity-50"
          disabled={guardando}
          onClick={onVolver}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 5-7 7 7 7" />
          </svg>
          Volver sin guardar
        </button>

        <h2
          id="titulo-editar"
          ref={titulo}
          tabIndex={-1}
          className="text-2xl font-semibold outline-none"
        >
          Editar {nombrePrenda(prenda).toLocaleLowerCase('es')}
        </h2>

        <div className="flex gap-2">
          {prenda.fotos.map((foto, i) => (
            <FotoBlob
              key={i}
              blob={foto.recortada ?? foto.original}
              alt={`Foto ${String(i + 1)}`}
              loading="eager"
              className="size-24 rounded-xl border border-tinta/15 bg-white object-contain"
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {ia.etiquetando ? (
            <div className="flex flex-col gap-2">
              <p role="status">Gemini está mirando la prenda…</p>
              <button type="button" className={botonSecundario} onClick={ia.cancelar}>
                Dejarlo
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={botonSecundario}
              disabled={guardando}
              onClick={() => void volverAEtiquetar()}
            >
              Volver a etiquetar con IA
            </button>
          )}
          {reetiquetada && (
            <p role="status" className="text-sm text-suave">
              Etiquetas nuevas de la IA. Revísalas y guarda; si cancelas, se queda como estaba.
            </p>
          )}
          {avisoIA && (
            <AvisoEtiquetado
              aviso={avisoIA}
              onReintentar={() => void volverAEtiquetar()}
              nota={
                avisoIA.ajustes
                  ? 'Si vas ahora a Ajustes, se pierden los cambios sin guardar.'
                  : undefined
              }
            />
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
            No se pudieron guardar los cambios. Inténtalo otra vez.
          </p>
        )}

        <FormularioPrenda
          key={version}
          iniciales={base.etiquetas}
          ocupado={ocupado}
          textoGuardar={guardando ? 'Guardando…' : 'Guardar cambios'}
          alGuardar={(etiquetas) => void guardar(etiquetas)}
          alCancelar={onVolver}
        />
      </div>
    </div>
  )
}
