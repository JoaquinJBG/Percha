import { useId } from 'react'
import { CAMPOS_DETALLE, detallesQueAplican, type CampoDetalle } from '../../datos/detalles.ts'
import type { Borrador } from './borrador.ts'

interface Props {
  valores: Borrador
  cambiar: <K extends keyof Borrador>(campo: K, valor: Borrador[K]) => void
}

const campo =
  'min-h-12 w-full min-w-0 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-oliva'

const NOMBRES: Record<CampoDetalle, string> = {
  corte: 'Corte',
  tiro: 'Tiro',
  largo: 'Largo',
  manga: 'Manga',
  cuello: 'Cuello',
}

/** Corte, tiro, largo, manga y cuello (T8.1): solo lo que aplica a la categoría y el tipo. */
export function SeccionCorte({ valores, cambiar }: Props) {
  const id = useId()
  const opciones =
    valores.categoria === null
      ? {}
      : detallesQueAplican({ categoria: valores.categoria, subcategoria: valores.subcategoria })
  const campos = CAMPOS_DETALLE.filter((c) => opciones[c] !== undefined)
  if (campos.length === 0) return null

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-4 rounded-2xl border border-tinta/15 bg-white/60 p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-titulo`} className="font-semibold">
          Corte y detalles
        </h3>
        <p className="text-sm text-suave">Opcional. Solo sale lo que va con el tipo de prenda.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {campos.map((nombre) => {
          const validas: readonly string[] = opciones[nombre] ?? []
          // Un valor que ya no aplica (se cambió el tipo) no se enseña; al guardar se quita.
          const valor = validas.includes(valores[nombre]) ? valores[nombre] : ''
          return (
            <label key={nombre} className="flex min-w-0 flex-col gap-1">
              <span className="font-medium">{NOMBRES[nombre]}</span>
              <select
                className={campo}
                value={valor}
                onChange={(evento) => {
                  cambiar(nombre, evento.target.value)
                }}
              >
                <option value="">Sin indicar</option>
                {validas.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
    </section>
  )
}
