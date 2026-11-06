import type { DatosEtiqueta } from '../datos/modelo.ts'
import { enlacesDeBusqueda } from './enlaces.ts'

interface Props extends Pick<DatosEtiqueta, 'marca' | 'referencia'> {
  /** El enlace que el usuario ya guardó de la ficha, si lo hay. */
  enlace?: string | undefined
}

const enlaceBoton =
  'inline-flex min-h-11 items-center gap-1 rounded-full border border-tinta/25 bg-white px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'

function Externo() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

/**
 * Enlaces que abre el usuario en otra pestaña. Percha no llama a la tienda (D17): `noreferrer` para que
 * la tienda tampoco sepa de dónde viene.
 */
export function EnlacesBusqueda({ marca, referencia, enlace }: Props) {
  const busquedas = enlacesDeBusqueda({ marca, referencia })
  if (!enlace && busquedas.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Buscar la prenda">
      {enlace && (
        <li>
          <a href={enlace} target="_blank" rel="noopener noreferrer" className={enlaceBoton}>
            Abrir la ficha
            <Externo />
          </a>
        </li>
      )}
      {busquedas.map(({ texto, url }) => (
        <li key={texto}>
          <a href={url} target="_blank" rel="noopener noreferrer" className={enlaceBoton}>
            {texto}
            <Externo />
          </a>
        </li>
      ))}
    </ul>
  )
}
