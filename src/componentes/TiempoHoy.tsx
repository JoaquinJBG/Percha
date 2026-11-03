import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import {
  buscarCiudades,
  crearAlmacenSitioLocal,
  ErrorTiempo,
  obtenerUbicacion,
  tiempoDeHoy,
  type AlmacenSitio,
  type Sitio,
  type SitioRecordado,
  type TiempoHoy as DatosTiempo,
} from '../tiempo/index.ts'

interface Props {
  buscar?: (texto: string) => Promise<Sitio[]>
  consultar?: (sitio: Sitio) => Promise<DatosTiempo>
  ubicar?: () => Promise<Sitio>
  almacenSitio?: AlmacenSitio
  /**
   * Avisa cada vez que cambia el tiempo que se muestra (`null` mientras se elige sitio); tiene que ser
   * estable entre renders.
   */
  alCambiar?: (tiempo: DatosTiempo | null) => void
}

const almacenPorDefecto = crearAlmacenSitioLocal()
const grados = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
  // Sin «-0» cuando hace -0,3 °C.
  signDisplay: 'negative',
})
const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

function mensajeDeError(error: unknown): string {
  return error instanceof ErrorTiempo ? error.message : 'Algo ha fallado al consultar el tiempo.'
}

export function TiempoHoy({
  buscar = buscarCiudades,
  consultar = tiempoDeHoy,
  ubicar = obtenerUbicacion,
  almacenSitio = almacenPorDefecto,
  alCambiar,
}: Props) {
  const [recordadoInicial] = useState(() => almacenSitio.leer())
  const [tiempo, setTiempo] = useState<DatosTiempo | null>(null)
  const [cargando, setCargando] = useState(recordadoInicial !== null)
  const [error, setError] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [coincidencias, setCoincidencias] = useState<Sitio[] | null>(null)
  const [eligiendo, setEligiendo] = useState(recordadoInicial === null)
  // Solo cuenta la última petición: si el usuario cambia de idea, la anterior se descarta.
  const ultimaPeticion = useRef(0)

  // Mientras se elige otro sitio no hay tiempo válido: el de antes ya no es el que se ve.
  useEffect(() => {
    alCambiar?.(eligiendo ? null : tiempo)
  }, [tiempo, eligiendo, alCambiar])

  async function ejecutar<T>(tarea: () => Promise<T>): Promise<T | undefined> {
    const peticion = ++ultimaPeticion.current
    setCargando(true)
    setError(null)
    try {
      const resultado = await tarea()
      return peticion === ultimaPeticion.current ? resultado : undefined
    } catch (fallo) {
      if (peticion === ultimaPeticion.current) setError(mensajeDeError(fallo))
      return undefined
    } finally {
      if (peticion === ultimaPeticion.current) setCargando(false)
    }
  }

  async function mostrar(sitio: Sitio, recordado: SitioRecordado) {
    const datos = await ejecutar(() => consultar(sitio))
    if (!datos) return
    almacenSitio.guardar(recordado)
    setTiempo(datos)
    setCoincidencias(null)
    setEligiendo(false)
  }

  useEffect(() => {
    if (!recordadoInicial) return
    const peticion = ++ultimaPeticion.current
    const cargar = async () =>
      consultar(recordadoInicial.tipo === 'ciudad' ? recordadoInicial.sitio : await ubicar())
    cargar().then(
      (datos) => {
        if (peticion !== ultimaPeticion.current) return
        setTiempo(datos)
        setCargando(false)
      },
      (fallo: unknown) => {
        if (peticion !== ultimaPeticion.current) return
        setError(mensajeDeError(fallo))
        setEligiendo(true)
        setCargando(false)
      },
    )
  }, [recordadoInicial, consultar, ubicar])

  async function usarUbicacion() {
    setCoincidencias(null)
    const sitio = await ejecutar(ubicar)
    if (sitio) await mostrar(sitio, { tipo: 'ubicacion' })
  }

  function elegirCiudad(sitio: Sitio) {
    return mostrar(sitio, { tipo: 'ciudad', sitio })
  }

  async function buscarCiudad(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    const nombre = texto.trim()
    if (nombre.length < 2) {
      setError('Escribe al menos dos letras.')
      return
    }
    const encontradas = await ejecutar(() => buscar(nombre))
    if (!encontradas) return
    if (encontradas.length === 0) {
      setCoincidencias(null)
      setError(`No encuentro «${nombre}». Prueba con otro nombre.`)
    } else if (encontradas.length === 1 && encontradas[0]) {
      await elegirCiudad(encontradas[0])
    } else {
      setCoincidencias(encontradas)
    }
  }

  return (
    <section
      aria-labelledby="tiempo-hoy"
      className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/60 p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="tiempo-hoy" className="text-lg font-semibold">
          Tiempo hoy
        </h2>
        {tiempo && !eligiendo && (
          <button
            type="button"
            onClick={() => {
              setEligiendo(true)
            }}
            className="text-sm font-medium text-suave underline underline-offset-2"
          >
            Cambiar sitio
          </button>
        )}
      </div>

      {tiempo && !eligiendo && <Tarjeta tiempo={tiempo} />}

      {eligiendo && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void usarUbicacion()}
            disabled={cargando}
            className="min-h-11 rounded-xl bg-tinta px-4 font-medium text-papel disabled:opacity-60"
          >
            Usar mi ubicación
          </button>
          <form onSubmit={(e) => void buscarCiudad(e)} className="flex flex-col gap-1">
            <label htmlFor="tiempo-ciudad" className="text-sm text-suave">
              O escribe tu ciudad
            </label>
            <div className="flex gap-2">
              <input
                id="tiempo-ciudad"
                type="search"
                enterKeyHint="search"
                autoComplete="address-level2"
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value)
                }}
                placeholder="Madrid, Sevilla…"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3"
              />
              <button
                type="submit"
                disabled={cargando}
                className="min-h-11 rounded-xl border border-tinta px-4 font-medium disabled:opacity-60"
              >
                Buscar
              </button>
            </div>
          </form>
          {tiempo && (
            <button
              type="button"
              onClick={() => {
                // Descarta la búsqueda en curso para que no cambie el sitio por detrás.
                ultimaPeticion.current++
                setCargando(false)
                setEligiendo(false)
                setCoincidencias(null)
                setError(null)
              }}
              className="self-start text-sm text-suave underline underline-offset-2"
            >
              Volver a {tiempo.sitio.nombre}
            </button>
          )}
        </div>
      )}

      {coincidencias && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-suave">¿Cuál de estas?</p>
          <ul className="flex flex-col gap-1">
            {coincidencias.map((sitio) => (
              <li key={`${String(sitio.latitud)},${String(sitio.longitud)}`}>
                <button
                  type="button"
                  onClick={() => void elegirCiudad(sitio)}
                  disabled={cargando}
                  className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-left disabled:opacity-60"
                >
                  <span className="font-medium">{sitio.nombre}</span>
                  {sitio.detalle && (
                    <span className="block text-sm text-suave">{sitio.detalle}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div aria-live="polite" className="text-sm">
        {cargando && <p className="text-suave">Consultando el tiempo…</p>}
        {error && !cargando && <p role="alert">{error}</p>}
      </div>
    </section>
  )
}

function Tarjeta({ tiempo }: { tiempo: DatosTiempo }) {
  const { sitio, temperatura, sensacion, lluvia, viento } = tiempo
  const probabilidad =
    lluvia.probabilidad === null ? '' : `${grados.format(lluvia.probabilidad)} % · `
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium">
          {sitio.nombre}
          {sitio.detalle && <span className="font-normal text-suave"> · {sitio.detalle}</span>}
        </p>
        <p className="text-2xl font-semibold first-letter:uppercase">{tiempo.resumen}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Dato
          titulo="Ahora"
          valor={`${grados.format(temperatura.actual)} °C (sensación ${grados.format(sensacion.actual)} °C)`}
        />
        <Dato
          titulo="Mín / máx"
          valor={`${grados.format(temperatura.minima)} / ${grados.format(temperatura.maxima)} °C`}
        />
        <Dato titulo="Lluvia" valor={`${probabilidad}${decimal.format(lluvia.cantidad)} mm`} />
        <Dato
          titulo="Viento"
          valor={`${grados.format(viento.actual)} km/h (máx. ${grados.format(viento.maximo)})`}
        />
      </dl>
    </div>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-suave">{titulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  )
}
