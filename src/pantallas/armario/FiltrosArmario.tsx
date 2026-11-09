import { useId } from 'react'
import { CATEGORIAS, CORTES, ESTILOS, type Categoria, type Prenda } from '../../datos/modelo.ts'
import { capitalizar, ETIQUETA_CATEGORIA, type Filtros } from './ayudas.ts'

interface Props {
  /** Todo el armario: de aquí salen las opciones, para no ofrecer filtros que no dan nada. */
  prendas: Prenda[]
  filtros: Filtros
  onCambiar: (filtros: Filtros) => void
}

const chip =
  'flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const selector =
  'min-h-12 w-full rounded-xl border border-tinta/15 bg-white px-3 text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'

export function FiltrosArmario({ prendas, filtros, onCambiar }: Props) {
  const idEstilo = useId()
  const idColor = useId()
  const idCorte = useId()
  // La opción elegida se queda aunque ya no quede ninguna prenda con ella (p. ej. tras borrar).
  const categorias = CATEGORIAS.filter(
    (c) => c === filtros.categoria || prendas.some((p) => p.categoria === c),
  )
  const estilos = ESTILOS.filter(
    (e) => e === filtros.estilo || prendas.some((p) => p.estilos.includes(e)),
  )
  const colores = [
    ...new Set([...prendas.flatMap((p) => p.colores), ...(filtros.color ? [filtros.color] : [])]),
  ].sort((a, b) => a.localeCompare(b, 'es'))
  // Solo los cortes que hay en el armario; sin ninguno, el filtro no sale.
  const cortes = CORTES.filter(
    (c) => c === filtros.corte || prendas.some((p) => p.corte === c),
  ).sort((a, b) => a.localeCompare(b, 'es'))

  function botonCategoria(categoria: Categoria | null, etiqueta: string, cuantas: number) {
    const activo = filtros.categoria === categoria
    return (
      <button
        key={categoria ?? 'todas'}
        type="button"
        aria-pressed={activo}
        className={`${chip} ${
          activo ? 'border-oliva bg-oliva text-papel' : 'border-tinta/15 bg-white text-tinta'
        }`}
        onClick={() => {
          onCambiar({ ...filtros, categoria })
        }}
      >
        {etiqueta} <span className={activo ? 'text-papel/75' : 'text-suave'}>{cuantas}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Categoría"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        {botonCategoria(null, 'Todas', prendas.length)}
        {categorias.map((c) =>
          botonCategoria(c, ETIQUETA_CATEGORIA[c], prendas.filter((p) => p.categoria === c).length),
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={idEstilo} className="text-sm font-medium">
            Estilo
          </label>
          <select
            id={idEstilo}
            className={selector}
            value={filtros.estilo ?? ''}
            onChange={(evento) => {
              const valor = evento.target.value
              onCambiar({ ...filtros, estilo: estilos.find((e) => e === valor) ?? null })
            }}
          >
            <option value="">Todos</option>
            {estilos.map((e) => (
              <option key={e} value={e}>
                {capitalizar(e)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idColor} className="text-sm font-medium">
            Color
          </label>
          <select
            id={idColor}
            className={selector}
            value={filtros.color ?? ''}
            onChange={(evento) => {
              onCambiar({
                ...filtros,
                color: evento.target.value === '' ? null : evento.target.value,
              })
            }}
          >
            <option value="">Todos</option>
            {colores.map((c) => (
              <option key={c} value={c}>
                {capitalizar(c)}
              </option>
            ))}
          </select>
        </div>
        {cortes.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={idCorte} className="text-sm font-medium">
              Corte
            </label>
            <select
              id={idCorte}
              className={selector}
              value={filtros.corte ?? ''}
              onChange={(evento) => {
                const valor = evento.target.value
                onCambiar({ ...filtros, corte: cortes.find((c) => c === valor) ?? null })
              }}
            >
              <option value="">Todos</option>
              {cortes.map((c) => (
                <option key={c} value={c}>
                  {capitalizar(c)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
