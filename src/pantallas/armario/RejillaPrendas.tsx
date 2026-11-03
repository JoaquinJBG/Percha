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
            className="mb-3 flex items-baseline gap-2 text-xs font-semibold tracking-widest text-suave uppercase"
          >
            {ETIQUETA_CATEGORIA[categoria]}{' '}
            <span className="rounded-full bg-oliva-claro px-2 py-0.5 font-medium tracking-normal text-oliva-oscuro">
              {delGrupo.length}
            </span>
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {delGrupo.map((prenda) => {
              const portada = fotoPortada(prenda)
              return (
                <li key={prenda.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-2 rounded-2xl text-left transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva"
                    onClick={() => {
                      onAbrir(prenda)
                    }}
                  >
                    <span className="block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-white shadow-tarjeta">
                      {portada && (
                        <FotoBlob blob={portada} className="size-full object-contain p-3" />
                      )}
                    </span>
                    <span className="truncate px-1 text-sm font-medium">
                      {nombrePrenda(prenda)}
                    </span>
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
