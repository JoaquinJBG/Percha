import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import { proveedorConClave } from '../../componentes/etiquetado-ia/index.ts'
import {
  actualizarElementoCola,
  encolarFotos,
  listarCola,
  quitarDeCola,
  type ElementoCola,
} from '../../datos/cola.ts'
import { crearPrenda } from '../../datos/repositorio.ts'
import {
  esperarCancelable,
  procesarCola,
  type DependenciasProceso,
  type FinProceso,
  type ProgresoProceso,
} from '../../importacion/procesar.ts'
import { normalizarFoto, recortar } from '../../recorte/index.ts'

const dependenciasReales: DependenciasProceso = {
  listar: listarCola,
  actualizar: actualizarElementoCola,
  quitar: quitarDeCola,
  guardar: crearPrenda,
  normalizar: normalizarFoto,
  recortar: (foto) => recortar(foto),
  obtenerProveedor: proveedorConClave,
  esperar: esperarCancelable,
  ahora: () => Date.now(),
}

interface Props {
  dependencias?: DependenciasProceso
  encolar?: (fotos: readonly File[]) => Promise<number>
}

const TEXTO_FASE: Record<ProgresoProceso['fase'], string> = {
  preparando: 'Recortando fotos…',
  etiquetando: 'Gemini está etiquetando…',
  esperando: 'Esperando un momento para no pasar el límite gratis…',
}

const boton =
  'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonPrincipal = `${boton} bg-oliva text-papel`
const botonSecundario = `${boton} border border-tinta/20 bg-white`

// Chrome de Android no deja elegir carpetas: allí se eligen muchas fotos de la galería.
const permiteCarpeta =
  typeof navigator !== 'undefined' && !/Android|iPhone|iPad/i.test(navigator.userAgent)

export function AltaMasiva({ dependencias = dependenciasReales, encolar = encolarFotos }: Props) {
  const [cola, setCola] = useState<ElementoCola[]>([])
  const [progreso, setProgreso] = useState<ProgresoProceso | null>(null)
  const [añadidas, setAñadidas] = useState(0)
  const [fin, setFin] = useState<FinProceso | null>(null)
  const control = useRef<AbortController | null>(null)
  const montada = useRef(true)

  const recargar = useCallback(async () => {
    const actual = await dependencias.listar()
    if (montada.current) setCola(actual)
    return actual
  }, [dependencias])

  const parar = useCallback(() => {
    control.current?.abort()
    control.current = null
  }, [])

  const procesar = useCallback(async () => {
    if (control.current) return
    const actual = new AbortController()
    control.current = actual
    setFin(null)
    const bloqueo = await pedirPantallaEncendida()
    let base = 0
    setAñadidas((n) => (base = n))
    try {
      const resultado = await procesarCola(dependencias, {
        signal: actual.signal,
        alCambiar: (p) => {
          if (!montada.current) return
          setProgreso(p)
          setAñadidas(base + p.añadidas)
          void recargar()
        },
      })
      if (montada.current) {
        setAñadidas(base + resultado.añadidas)
        setFin(resultado)
      }
    } finally {
      void bloqueo?.release().catch(() => undefined)
      if (control.current === actual) control.current = null
      if (montada.current) {
        setProgreso(null)
        void recargar()
      }
    }
  }, [dependencias, recargar])

  useEffect(() => {
    montada.current = true
    // Si quedó trabajo de otra vez, sigue solo al volver a la pantalla.
    void recargar().then((actual) => {
      if (actual.some((e) => e.estado !== 'error')) void procesar()
    })
    return () => {
      montada.current = false
      parar()
    }
  }, [recargar, procesar, parar])

  const alElegir = async (evento: ChangeEvent<HTMLInputElement>) => {
    const fotos = [...(evento.target.files ?? [])]
    evento.target.value = ''
    if (fotos.length === 0) return
    await encolar(fotos)
    await recargar()
    void procesar()
  }

  const conError = cola.filter((e) => e.estado === 'error')
  const pendientes = cola.length - conError.length
  const total = añadidas + pendientes
  const trabajando = progreso !== null

  return (
    <Pantalla titulo="Añadir muchas">
      <p className="text-suave">
        Elige todas las fotos de tus prendas,{' '}
        <strong className="text-tinta">una prenda por foto</strong>. Percha las recorta y Gemini las
        etiqueta de 5 en 5. Puedes salir y volver: sigue por donde iba.
      </p>

      <div className="grid gap-2">
        <label className={`${botonPrincipal} cursor-pointer has-focus-visible:outline-2`}>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => void alElegir(e)}
          />
          Elegir fotos
        </label>
        {permiteCarpeta && (
          <label className={`${botonSecundario} cursor-pointer has-focus-visible:outline-2`}>
            <input
              type="file"
              multiple
              className="sr-only"
              // `webkitdirectory` no está en los tipos de React.
              {...{ webkitdirectory: '' }}
              onChange={(e) => void alElegir(e)}
            />
            Elegir una carpeta
          </label>
        )}
      </div>

      {(total > 0 || conError.length > 0) && (
        <section
          aria-labelledby="titulo-progreso"
          className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-tarjeta"
        >
          <h2 id="titulo-progreso" className="font-titulo text-xl font-semibold">
            {pendientes === 0 && !trabajando ? 'Listo' : 'Añadiendo prendas'}
          </h2>
          <div
            role="progressbar"
            aria-label="Prendas añadidas"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={añadidas}
            className="h-2 overflow-hidden rounded-full bg-oliva-claro"
          >
            <div
              className="h-full rounded-full bg-oliva transition-[width]"
              style={{ width: `${String(total ? (añadidas / total) * 100 : 0)}%` }}
            />
          </div>
          <p>
            <strong>{añadidas}</strong> añadidas · <strong>{pendientes}</strong> en cola
            {conError.length > 0 && (
              <>
                {' '}
                · <strong>{conError.length}</strong> con error
              </>
            )}
          </p>
          {progreso && (
            <p className="text-sm text-suave" aria-live="polite">
              {TEXTO_FASE[progreso.fase]}
            </p>
          )}
          {trabajando && (
            <p className="text-sm text-suave">Deja la pantalla abierta mientras trabaja.</p>
          )}

          {fin?.motivo === 'sin-ia' && (
            <div role="alert" className="flex flex-col gap-2 rounded-xl bg-arena p-3 text-sm">
              <p>{fin.aviso}</p>
              {(fin.tipo === 'sin-clave' || fin.tipo === 'clave-mala') && (
                <Link to="/ajustes" className="font-medium text-oliva-oscuro underline">
                  Ir a Ajustes
                </Link>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {trabajando ? (
              <button type="button" className={`${botonSecundario} flex-1`} onClick={parar}>
                Pausar
              </button>
            ) : (
              pendientes > 0 && (
                <button
                  type="button"
                  className={`${botonPrincipal} flex-1`}
                  onClick={() => void procesar()}
                >
                  Seguir
                </button>
              )
            )}
            {pendientes === 0 && !trabajando && añadidas > 0 && (
              <Link to="/" className={`${botonPrincipal} flex-1`}>
                Ver el armario
              </Link>
            )}
          </div>
        </section>
      )}

      {conError.length > 0 && !trabajando && (
        <section aria-labelledby="titulo-errores" className="flex flex-col gap-2">
          <h2 id="titulo-errores" className="font-titulo text-xl font-semibold">
            Con error
          </h2>
          <ul className="flex flex-col gap-2">
            {conError.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-tarjeta"
              >
                <p className="truncate font-medium">{e.nombre}</p>
                <p className="text-sm text-suave">{e.error}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`${botonSecundario} flex-1`}
                    onClick={() =>
                      void dependencias
                        .actualizar(e.id, {
                          estado: e.normalizada ? 'lista' : 'nueva',
                          error: null,
                        })
                        .then(() => procesar())
                    }
                  >
                    Reintentar
                  </button>
                  <button
                    type="button"
                    className={`${botonSecundario} flex-1`}
                    onClick={() => void dependencias.quitar([e.id]).then(recargar)}
                  >
                    Descartar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Pantalla>
  )
}

/** Que el móvil no apague la pantalla mientras recorta y etiqueta (si el navegador lo permite). */
async function pedirPantallaEncendida(): Promise<WakeLockSentinel | null> {
  if (!('wakeLock' in navigator)) return null
  try {
    return await navigator.wakeLock.request('screen')
  } catch {
    return null
  }
}
