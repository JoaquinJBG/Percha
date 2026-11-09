import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import type { CambiosPrenda, Prenda } from '../../datos/modelo.ts'
import { actualizarPrenda, listarPrendas } from '../../datos/repositorio.ts'
import { estadoDesdeTienda, leerCompartido } from '../../etiqueta/compartido.ts'
import { datosDeEnlace } from '../../etiqueta/enlaces.ts'
import { nombrePrenda } from '../armario/ayudas.ts'
import { RejillaPrendas } from '../armario/RejillaPrendas.tsx'

/** `listar` y `actualizar` son para los tests; si se pasan, que no cambien en cada render. */
interface Props {
  listar?: () => Promise<Prenda[]>
  actualizar?: (id: string, cambios: CambiosPrenda) => Promise<Prenda>
}

const boton =
  'flex min-h-12 items-center justify-center rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonPrincipal = `${boton} bg-oliva text-papel`
const botonSecundario = `${boton} border border-tinta/25 text-tinta`

/**
 * Llega desde «Compartir» de Android (share_target por GET, T5.1): guarda el enlace de la ficha en una
 * prenda o empieza una nueva con él. Percha no abre ni descarga el enlace (D17).
 */
export function Compartido({ listar = listarPrendas, actualizar = actualizarPrenda }: Props) {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const { enlace, titulo } = leerCompartido(parametros)
  const { marca } = enlace ? datosDeEnlace(enlace) : {}
  const [prendas, setPrendas] = useState<Prenda[] | null>(null)
  const [elegida, setElegida] = useState<Prenda | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!enlace) return
    let vigente = true
    listar().then(
      (todas) => {
        if (vigente) setPrendas(todas)
      },
      (fallo: unknown) => {
        console.error(fallo)
        if (vigente) setError('No se pudo leer el armario.')
      },
    )
    return () => {
      vigente = false
    }
  }, [listar, enlace])

  // El foco lleva la confirmación a la vista: la prenda elegida puede estar muy abajo en la rejilla.
  useEffect(() => {
    if (elegida) cancelar.current?.focus()
  }, [elegida])

  async function guardarEn(prenda: Prenda) {
    if (!enlace) return
    setGuardando(true)
    setError(null)
    try {
      await actualizar(prenda.id, { enlace })
      void navegar(`/?prenda=${encodeURIComponent(prenda.id)}`, { replace: true })
    } catch (fallo) {
      console.error(fallo)
      setError('No se pudo guardar el enlace. Inténtalo otra vez.')
      setGuardando(false)
    }
  }

  if (!enlace) {
    return (
      <Pantalla titulo="Desde la tienda">
        <p>
          No ha llegado ningún enlace. Abre la ficha de la prenda en la web o la app de la tienda y
          pulsa «Compartir» › Percha.
        </p>
        <Link to="/" className={`${botonSecundario} self-start`}>
          Ir al armario
        </Link>
      </Pantalla>
    )
  }

  return (
    <Pantalla titulo="Desde la tienda">
      <div className="flex flex-col gap-1 rounded-2xl border border-tinta/15 bg-white/60 p-4">
        {titulo && <p className="font-medium">{titulo}</p>}
        <p className="text-sm break-all text-suave">{enlace}</p>
        {marca && <p className="text-sm">Tienda: {marca}</p>}
      </div>

      <button
        type="button"
        className={botonPrincipal}
        disabled={guardando}
        onClick={() => void navegar('/prendas/nueva', { state: estadoDesdeTienda(enlace) })}
      >
        Nueva prenda con este enlace
      </button>
      <p className="text-sm text-suave">
        Para la foto, usa una captura de la ficha o la foto que hayas guardado de ella.
      </p>

      <section aria-labelledby="titulo-guardar-en" className="flex flex-col gap-3">
        <h2 id="titulo-guardar-en" className="text-lg font-semibold">
          O guárdalo en una prenda que ya tienes
        </h2>

        {elegida && (
          <div
            role="group"
            aria-labelledby="titulo-confirmar"
            className="flex flex-col gap-3 rounded-2xl border border-oliva/40 bg-oliva-claro p-4"
          >
            <p id="titulo-confirmar" className="font-medium">
              ¿Guardar el enlace en «{nombrePrenda(elegida)}»?
            </p>
            {elegida.enlace && elegida.enlace !== enlace && (
              <p className="text-sm">Ya tenía otro enlace: se cambiará por este.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                ref={cancelar}
                type="button"
                className={botonSecundario}
                disabled={guardando}
                onClick={() => {
                  setElegida(null)
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={botonPrincipal}
                disabled={guardando}
                onClick={() => void guardarEn(elegida)}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        )}

        {prendas?.length === 0 && <p className="text-suave">Aún no tienes prendas.</p>}
        {prendas && prendas.length > 0 && (
          <div inert={guardando} className="contents">
            <RejillaPrendas prendas={prendas} onAbrir={setElegida} />
          </div>
        )}
      </section>
    </Pantalla>
  )
}
