import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import { proveedorConClave, type ObtenerProveedor } from '../../componentes/etiquetado-ia/index.ts'
import { resumenCorte } from '../../datos/detalles.ts'
import type { Prenda } from '../../datos/modelo.ts'
import { listarPrendas } from '../../datos/repositorio.ts'
import { ErrorIA, MODELO_BUSQUEDA, type ResultadoFicha, type TipoErrorIA } from '../../ia/index.ts'
import { nombrePrenda } from '../armario/ayudas.ts'
import { FotoBlob } from '../armario/FotoBlob.tsx'
import {
  exportarPrueba,
  guardarPrueba,
  leerPrueba,
  MAX_PRENDAS_LABORATORIO,
  PARAN_LA_PRUEBA,
  PRUEBA_VACIA,
  resumen,
  VEREDICTOS,
  type EstadoBusqueda,
  type Prueba,
} from './resultados.ts'

interface Props {
  listar?: () => Promise<Prenda[]>
  obtenerProveedor?: ObtenerProveedor
  /** Pausa entre peticiones: el nivel gratis de 2.5 Flash da ~10 por minuto. */
  esperaEntrePeticiones?: number
  descargar?: (texto: string, nombre: string) => void
}

const DE_AJUSTES: TipoErrorIA[] = ['sin-clave', 'clave-mala', 'modelo']

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonPrincipal = `${boton} bg-oliva text-papel`
const botonSecundario = `${boton} border border-tinta/25 text-tinta`
const tarjeta = 'flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-tarjeta'
const enlace = 'font-medium text-oliva underline underline-offset-2 break-all'

function descargarFichero(texto: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  // Si se revoca en el acto, Chrome en Android puede cortar la descarga.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}

function sinClave<T>(registro: Record<string, T>, clave: string): Record<string, T> {
  return Object.fromEntries(Object.entries(registro).filter(([k]) => k !== clave))
}

function esperar(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((listo, fallo) => {
    if (ms <= 0) {
      listo()
      return
    }
    const espera = setTimeout(listo, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(espera)
        fallo(new DOMException('Parada', 'AbortError'))
      },
      { once: true },
    )
  })
}

function Candidatas({ resultado }: { resultado: ResultadoFicha }) {
  return (
    <div className="flex flex-col gap-3">
      {resultado.candidatas.length === 0 ? (
        <p className="text-sm text-suave">No ha encontrado ninguna ficha.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {resultado.candidatas.map((candidata, i) => (
            <li key={candidata.enlace} className="flex gap-3">
              {candidata.foto && (
                // La pinta el navegador directamente: Percha no descarga nada de la tienda.
                <img
                  src={candidata.foto}
                  alt={`Foto de catálogo ${String(i + 1)}`}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="h-24 w-20 shrink-0 rounded-lg bg-papel object-contain"
                  onError={(evento) => {
                    evento.currentTarget.hidden = true
                  }}
                />
              )}
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <p className="font-medium break-words">
                  {i + 1}. {candidata.nombre}
                </p>
                {candidata.tienda && <p className="text-suave">{candidata.tienda}</p>}
                <a href={candidata.enlace} target="_blank" rel="noreferrer" className={enlace}>
                  Abrir la ficha
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}
      <details className="text-sm text-suave">
        <summary className="cursor-pointer">
          {resultado.fuentes.length} fuentes de Google · {(resultado.ms / 1000).toFixed(1)} s ·{' '}
          {resultado.tokens.total ?? '?'} tokens
        </summary>
        {resultado.busquedas.length > 0 && (
          <p className="mt-2">Buscó: {resultado.busquedas.join(' · ')}</p>
        )}
        <ul className="mt-2 flex flex-col gap-1">
          {resultado.fuentes.map((fuente) => (
            <li key={fuente.enlace}>
              <a href={fuente.enlace} target="_blank" rel="noreferrer" className={enlace}>
                {fuente.titulo}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

/**
 * Laboratorio de grounding (S9): busca con Gemini y Google la ficha de hasta 10 prendas, el usuario
 * marca si acierta y exporta los resultados. Pantalla oculta: se llega desde Ajustes.
 */
export function Laboratorio({
  listar = listarPrendas,
  obtenerProveedor = proveedorConClave,
  esperaEntrePeticiones = 6000,
  descargar = descargarFichero,
}: Props) {
  const [prendas, setPrendas] = useState<Prenda[] | null>(null)
  const [prueba, setPrueba] = useState<Prueba>(leerPrueba)
  const [corriendo, setCorriendo] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; ajustes: boolean } | null>(null)
  const control = useRef<AbortController | null>(null)
  const actual = useRef(prueba)

  useEffect(() => {
    actual.current = prueba
    guardarPrueba(prueba)
  }, [prueba])

  useEffect(() => {
    let vigente = true
    listar().then(
      (todas) => {
        if (!vigente) return
        setPrendas(todas)
        // Las que ya no están en el armario salen de la prueba.
        setPrueba((anterior) => ({
          ...anterior,
          elegidas: anterior.elegidas.filter((id) => todas.some((p) => p.id === id)),
        }))
      },
      () => {
        if (vigente) setAviso({ texto: 'No se ha podido leer el armario.', ajustes: false })
      },
    )
    return () => {
      vigente = false
      control.current?.abort()
    }
  }, [listar])

  function cambiarEstado(id: string, estado: EstadoBusqueda) {
    setPrueba((anterior) => ({ ...anterior, estados: { ...anterior.estados, [id]: estado } }))
  }

  function elegir(id: string, elegida: boolean) {
    setPrueba((anterior) => {
      if (!elegida) {
        return {
          elegidas: anterior.elegidas.filter((e) => e !== id),
          estados: sinClave(anterior.estados, id),
          veredictos: sinClave(anterior.veredictos, id),
        }
      }
      if (anterior.elegidas.length >= MAX_PRENDAS_LABORATORIO) return anterior
      return { ...anterior, elegidas: [...anterior.elegidas, id] }
    })
  }

  async function buscar() {
    const porId = new Map((prendas ?? []).map((p) => [p.id, p]))
    const nuevo = new AbortController()
    control.current = nuevo
    setCorriendo(true)
    setAviso(null)
    try {
      const proveedor = await obtenerProveedor()
      if (!proveedor) {
        setAviso({ texto: new ErrorIA('sin-clave').message, ajustes: true })
        return
      }
      let primera = true
      for (const id of actual.current.elegidas) {
        const prenda = porId.get(id)
        if (!prenda || actual.current.estados[id]?.fase === 'hecha') continue
        if (!primera) await esperar(esperaEntrePeticiones, nuevo.signal)
        primera = false
        cambiarEstado(id, { fase: 'buscando' })
        try {
          const resultado = await proveedor.buscarFicha(prenda, { signal: nuevo.signal })
          cambiarEstado(id, { fase: 'hecha', resultado })
        } catch (error) {
          if (nuevo.signal.aborted) {
            cambiarEstado(id, { fase: 'pendiente' })
            return
          }
          const fallo = error instanceof ErrorIA ? error : new ErrorIA('otro')
          if (PARAN_LA_PRUEBA.includes(fallo.tipo)) {
            cambiarEstado(id, { fase: 'pendiente' })
            setAviso({ texto: fallo.message, ajustes: DE_AJUSTES.includes(fallo.tipo) })
            return
          }
          cambiarEstado(id, { fase: 'error', tipo: fallo.tipo, mensaje: fallo.message })
        }
      }
    } catch {
      // Parada durante la pausa entre peticiones: lo hecho se queda.
    } finally {
      if (control.current === nuevo) control.current = null
      setCorriendo(false)
    }
  }

  function exportar() {
    const fecha = new Date()
    descargar(
      exportarPrueba(prueba, prendas ?? [], fecha),
      `percha-s9-grounding-${fecha.toISOString().slice(0, 10)}.json`,
    )
  }

  const totales = resumen(prueba)
  const elegidas = prueba.elegidas.flatMap((id) => prendas?.find((p) => p.id === id) ?? [])
  const libres = (prendas ?? []).filter((p) => !prueba.elegidas.includes(p.id))
  const llenas = prueba.elegidas.length >= MAX_PRENDAS_LABORATORIO
  const pendientes = elegidas.some((p) => prueba.estados[p.id]?.fase !== 'hecha')

  return (
    <Pantalla titulo="Laboratorio">
      <p className="text-sm text-suave">
        Prueba S9: ¿encuentra Gemini ({MODELO_BUSQUEDA}, con la búsqueda de Google) la ficha de tus
        prendas en la tienda? Cada prenda es una petición con tu clave. Elige hasta{' '}
        {MAX_PRENDAS_LABORATORIO}, mejor con marca y referencia.
      </p>

      {prendas === null && !aviso && <p role="status">Cargando el armario…</p>}

      {aviso && (
        <div role="alert" className="flex flex-col gap-1 text-sm font-medium text-red-800">
          <p>{aviso.texto}</p>
          {aviso.ajustes && (
            <Link to="/ajustes" className={enlace}>
              Ir a Ajustes
            </Link>
          )}
        </div>
      )}

      {prendas !== null && (
        <>
          <section aria-labelledby="titulo-elegidas" className="flex flex-col gap-3">
            <h2 id="titulo-elegidas" className="text-lg font-semibold">
              Elegidas ({prueba.elegidas.length} de {MAX_PRENDAS_LABORATORIO})
            </h2>
            {elegidas.length === 0 && (
              <p className="text-sm text-suave">Aún no hay ninguna: añádelas abajo.</p>
            )}
            <ul className="flex flex-col gap-3">
              {elegidas.map((prenda) => {
                const estado = prueba.estados[prenda.id] ?? { fase: 'pendiente' }
                const nombre = nombrePrenda(prenda)
                const detalle = [resumenCorte(prenda), prenda.referencia]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li key={prenda.id} className={tarjeta} aria-label={nombre}>
                    <div className="flex items-start gap-3">
                      <FotoBlob
                        blob={prenda.fotos[0]?.recortada ?? prenda.fotos[0]?.original ?? new Blob()}
                        alt=""
                        className="size-16 shrink-0 rounded-lg bg-papel object-contain"
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="font-medium">{nombre}</p>
                        {detalle && <p className="text-sm text-suave break-words">{detalle}</p>}
                      </div>
                      <button
                        type="button"
                        className="min-h-12 px-2 text-sm text-suave underline"
                        disabled={corriendo}
                        aria-label={`Quitar ${nombre}`}
                        onClick={() => {
                          elegir(prenda.id, false)
                        }}
                      >
                        Quitar
                      </button>
                    </div>

                    {estado.fase === 'buscando' && (
                      <p role="status" className="text-sm">
                        Buscando en Google…
                      </p>
                    )}
                    {estado.fase === 'error' && (
                      <p className="text-sm font-medium text-red-800">{estado.mensaje}</p>
                    )}
                    {estado.fase === 'hecha' && (
                      <>
                        <Candidatas resultado={estado.resultado} />
                        <fieldset className="flex flex-col gap-2">
                          <legend className="mb-1 text-sm font-medium">¿Ha acertado?</legend>
                          <div className="grid grid-cols-3 gap-2">
                            {VEREDICTOS.map(({ valor, texto }) => (
                              <label
                                key={valor}
                                className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-tinta/25 text-sm has-checked:border-oliva has-checked:bg-oliva has-checked:text-papel has-focus-visible:outline-2 has-focus-visible:outline-oliva"
                              >
                                <input
                                  type="radio"
                                  className="sr-only"
                                  name={`veredicto-${prenda.id}`}
                                  checked={prueba.veredictos[prenda.id] === valor}
                                  onChange={() => {
                                    setPrueba((anterior) => ({
                                      ...anterior,
                                      veredictos: { ...anterior.veredictos, [prenda.id]: valor },
                                    }))
                                  }}
                                />
                                {texto}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>

            {elegidas.length > 0 && (
              <div className="flex flex-col gap-3">
                {corriendo ? (
                  <button
                    type="button"
                    className={botonSecundario}
                    onClick={() => control.current?.abort()}
                  >
                    Parar
                  </button>
                ) : (
                  <button
                    type="button"
                    className={botonPrincipal}
                    disabled={!pendientes}
                    onClick={() => void buscar()}
                  >
                    {pendientes ? 'Buscar las fichas' : 'Todas buscadas'}
                  </button>
                )}
                <p role="status" className="text-sm">
                  Aciertos {totales.aciertos} · A medias {totales.aMedias} · Fallos {totales.fallos}{' '}
                  · Sin marcar {totales.sinMarcar}
                  {totales.msMedio !== null &&
                    ` · ${(totales.msMedio / 1000).toFixed(1)} s de media · ${String(totales.tokensTotales)} tokens`}
                </p>
                <button
                  type="button"
                  className={botonSecundario}
                  disabled={corriendo}
                  onClick={exportar}
                >
                  Exportar resultados
                </button>
                <button
                  type="button"
                  className="min-h-12 text-sm text-suave underline"
                  disabled={corriendo}
                  onClick={() => {
                    setPrueba(PRUEBA_VACIA)
                  }}
                >
                  Empezar de nuevo
                </button>
              </div>
            )}
          </section>

          <details open={elegidas.length === 0} className="flex flex-col gap-3">
            <summary className="min-h-12 cursor-pointer content-center text-lg font-semibold">
              Añadir prendas
            </summary>
            {llenas && (
              <p className="text-sm text-suave">
                Ya tienes {MAX_PRENDAS_LABORATORIO}: quita alguna para añadir otra.
              </p>
            )}
            {libres.length === 0 && <p className="text-sm text-suave">No quedan más prendas.</p>}
            <ul className="flex flex-col gap-2">
              {libres.map((prenda) => {
                const nombre = nombrePrenda(prenda)
                return (
                  <li key={prenda.id} className="flex items-center gap-3">
                    <FotoBlob
                      blob={prenda.fotos[0]?.recortada ?? prenda.fotos[0]?.original ?? new Blob()}
                      alt=""
                      loading="lazy"
                      className="size-12 shrink-0 rounded-lg bg-white object-contain"
                    />
                    <div className="flex min-w-0 flex-1 flex-col text-sm">
                      <p className="font-medium">{nombre}</p>
                      {prenda.marca && <p className="text-suave">{prenda.marca}</p>}
                    </div>
                    <button
                      type="button"
                      className={botonSecundario}
                      disabled={llenas || corriendo}
                      aria-label={`Añadir ${nombre}`}
                      onClick={() => {
                        elegir(prenda.id, true)
                      }}
                    >
                      Añadir
                    </button>
                  </li>
                )
              })}
            </ul>
          </details>
        </>
      )}
    </Pantalla>
  )
}
