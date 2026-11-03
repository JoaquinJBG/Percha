import { CATEGORIAS, type Prenda } from '../../datos/modelo.ts'
import { FotoBlob } from './FotoBlob.tsx'
import { ETIQUETA_CATEGORIA, fotoPortada, nombrePrenda } from './ayudas.ts'

interface Props {
  prendas: Prenda[]
  onAbrir: (prenda: Prenda) => void
}

export function RejillaPrendas({ prendas, onAbrir }: Props) {
  const grupos = CATEGORIAS.map(
    (categoria) => [categoria, prendas.filter((p) => p.categoria === categoria)] as const,
  ).filter(([, delGrupo]) => delGrupo.length > 0)

  return (
    <div className="flex flex-col gap-6">
      {grupos.map(([categoria, delGrupo]) => (
        <section key={categoria} aria-labelledby={`grupo-${categoria}`}>
          <h2
            id={`grupo-${categoria}`}
            className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-suave"
          >
            {ETIQUETA_CATEGORIA[categoria]}
            <span className="font-normal">{delGrupo.length}</span>
          </h2>
          <ul className="grid grid-cols-3 gap-2">
            {delGrupo.map((prenda) => {
              const portada = fotoPortada(prenda)
              return (
                <li key={prenda.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
                    onClick={() => {
                      onAbrir(prenda)
                    }}
                  >
                    <span className="block aspect-square w-full overflow-hidden rounded-xl border border-tinta/10 bg-white">
                      {portada && (
                        <FotoBlob blob={portada} className="size-full object-contain p-1" />
                      )}
                    </span>
                    <span className="truncate px-0.5 text-xs">{nombrePrenda(prenda)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
