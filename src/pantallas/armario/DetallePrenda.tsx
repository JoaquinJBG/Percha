import { useEffect, useRef, useState } from 'react'
import type { Prenda } from '../../datos/modelo.ts'
import { capitalizar, ETIQUETA_CATEGORIA, nombrePrenda } from './ayudas.ts'
import { FotoBlob } from './FotoBlob.tsx'

interface Props {
  /** `undefined` si la prenda ya no está (borrada, o un enlace viejo). */
  prenda: Prenda | undefined
  onVolver: () => void
  onBorrar: (id: string) => Promise<void>
  /** Con él aparece el botón «Editar». */
  onEditar?: (prenda: Prenda) => void
}

type Fase = 'libre' | 'confirmando' | 'borrando' | 'error'

const boton =
  'min-h-12 flex-1 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonSecundario = `${boton} border border-tinta/25 text-tinta`
const botonPeligro = `${boton} bg-red-800 text-white`
const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })

function lista(valores: readonly string[]): string {
  return valores.length === 0 ? '—' : capitalizar(valores.join(', '))
}

export function DetallePrenda({ prenda, onVolver, onBorrar, onEditar }: Props) {
  const [fase, setFase] = useState<Fase>('libre')
  const titulo = useRef<HTMLHeadingElement>(null)
  const cancelar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    titulo.current?.focus()
  }, [])

  // El foco lleva la confirmación a la vista: «Borrar» está al final y la confirmación saldría debajo.
  useEffect(() => {
    if (fase === 'confirmando') cancelar.current?.focus()
  }, [fase])

  async function borrar(id: string) {
    setFase('borrando')
    try {
      await onBorrar(id)
    } catch (error) {
      console.error(error)
      setFase('error')
    }
  }

  const etiquetas: [string, string][] = prenda
    ? [
        ['Categoría', ETIQUETA_CATEGORIA[prenda.categoria]],
        ['Tipo', prenda.subcategoria === '' ? '—' : capitalizar(prenda.subcategoria)],
        ['Colores', lista(prenda.colores)],
        ['Estampado', prenda.estampado === '' ? '—' : capitalizar(prenda.estampado)],
        ['Estilos', lista(prenda.estilos)],
        ['Abrigo', `${String(prenda.abrigo)} de 5`],
        ['Formalidad', `${String(prenda.formalidad)} de 5`],
        ['Ocasiones', lista(prenda.ocasiones)],
        ['Temporadas', lista(prenda.temporadas)],
        ...(prenda.notas.trim() === '' ? [] : [['Notas', prenda.notas] as [string, string]]),
        ['Etiquetada', prenda.etiquetadaPor === 'ia' ? 'Por la IA' : 'A mano'],
        ['Añadida', fecha.format(prenda.creadaEn)],
      ]
    : []

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-detalle"
      className="fixed inset-0 z-20 overflow-y-auto overscroll-contain bg-papel"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="-ml-2 flex min-h-12 items-center gap-1 self-start rounded-xl px-2 font-medium focus-visible:outline-2 focus-visible:outline-oliva"
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
          Armario
        </button>

        <h2
          id="titulo-detalle"
          ref={titulo}
          tabIndex={-1}
          className="text-2xl font-semibold outline-none"
        >
          {prenda ? nombrePrenda(prenda) : 'Esta prenda ya no está'}
        </h2>

        {!prenda && <p className="text-suave">Puede que la hayas borrado.</p>}

        {prenda && (
          <>
            <div className={`grid gap-2 ${prenda.fotos.length > 1 ? 'grid-cols-2' : ''}`}>
              {prenda.fotos.map((foto, i) => (
                <FotoBlob
                  key={i}
                  blob={foto.recortada ?? foto.original}
                  alt={`Foto ${String(i + 1)} de ${nombrePrenda(prenda)}`}
                  loading="eager"
                  className="aspect-[3/4] w-full rounded-2xl bg-white shadow-tarjeta object-contain"
                />
              ))}
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-white shadow-tarjeta p-4 text-sm">
              {etiquetas.map(([nombre, valor]) => (
                <div key={nombre} className="contents">
                  <dt className="text-suave">{nombre}</dt>
                  <dd className="break-words">{valor}</dd>
                </div>
              ))}
            </dl>

            {fase === 'libre' || fase === 'error' ? (
              <div className="flex gap-3">
                {onEditar && (
                  <button
                    type="button"
                    className={botonSecundario}
                    onClick={() => {
                      onEditar(prenda)
                    }}
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  className={botonSecundario}
                  onClick={() => {
                    setFase('confirmando')
                  }}
                >
                  Borrar
                </button>
              </div>
            ) : (
              <div
                role="group"
                aria-labelledby="titulo-borrar"
                className="flex flex-col gap-3 rounded-2xl border border-red-800/30 bg-white/60 p-4"
              >
                <p id="titulo-borrar" className="font-medium">
                  ¿Borrar esta prenda? No se puede deshacer.
                </p>
                <div className="flex gap-3">
                  <button
                    ref={cancelar}
                    type="button"
                    className={botonSecundario}
                    disabled={fase === 'borrando'}
                    onClick={() => {
                      setFase('libre')
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={botonPeligro}
                    disabled={fase === 'borrando'}
                    onClick={() => void borrar(prenda.id)}
                  >
                    {fase === 'borrando' ? 'Borrando…' : 'Sí, borrar'}
                  </button>
                </div>
              </div>
            )}

            {fase === 'error' && (
              <p role="alert" className="text-sm font-medium text-red-800">
                No se pudo borrar la prenda.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
