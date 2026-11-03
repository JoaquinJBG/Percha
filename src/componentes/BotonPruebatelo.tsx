import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { leerPerfil } from '../datos/repositorio.ts'
import {
  copiarTexto,
  ErrorTryOn,
  prepararTryOn,
  type PrendaTryOn,
  type TryOn,
} from '../tryon/index.ts'

export type CompartidorTryOn = Partial<Pick<Navigator, 'share' | 'canShare'>>

/** Si ya se ha dicho que la foto solo sale del móvil al compartirla. */
export interface AvisoPrivacidad {
  visto: () => boolean
  marcar: () => void
}

interface Props {
  prendas: readonly PrendaTryOn[]
  /** El número del outfit en la lista, para el nombre accesible del botón. */
  numero: number
  leerFotoCuerpo?: () => Promise<Blob | null>
  preparar?: (fotoCuerpo: Blob, prendas: readonly PrendaTryOn[]) => Promise<TryOn>
  copiar?: (texto: string) => Promise<boolean>
  compartidor?: CompartidorTryOn
  privacidad?: AvisoPrivacidad
}

type Estado =
  | { fase: 'quieto' }
  | { fase: 'preparando' }
  | { fase: 'sin-foto' }
  | { fase: 'compartiendo'; copiado: boolean; privacidad: boolean }
  | { fase: 'reintentar'; copiado: boolean }
  | { fase: 'descargar'; url: string; nombre: string; copiado: boolean; privacidad: boolean }
  | { fase: 'error'; mensaje: string }

const CLAVE_PRIVACIDAD = 'percha:tryon:privacidad-vista'
/** Al abrir el panel de un outfit se cierra el de otro: si no, quedarían uno encima del otro. */
const EVENTO_ABIERTO = 'percha:pruebatelo-abierto'

const privacidadLocal: AvisoPrivacidad = {
  visto() {
    try {
      return localStorage.getItem(CLAVE_PRIVACIDAD) === '1'
    } catch {
      return false
    }
  },
  marcar() {
    try {
      localStorage.setItem(CLAVE_PRIVACIDAD, '1')
    } catch {
      // Sin almacenamiento, el aviso sale cada vez: mejor de más que de menos.
    }
  },
}

async function leerFotoCuerpoDelPerfil(): Promise<Blob | null> {
  return (await leerPerfil()).fotoCuerpo
}

const compartidorPorDefecto: CompartidorTryOn = typeof navigator === 'undefined' ? {} : navigator

const PRIVACIDAD =
  'Tu foto solo sale del móvil cuando eliges a dónde compartirla: Percha no la sube a ningún sitio.'
const INSTRUCCION = 'En Gemini, toca la sugerencia del teclado para pegar el texto y envía.'

const botonPanel =
  'min-h-11 rounded-xl px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papel'

function mensajeDeFallo(fallo: unknown): string {
  if (fallo instanceof ErrorTryOn && fallo.motivo === 'foto-persona') {
    return 'No se ha podido leer tu foto de cuerpo entero. Cámbiala en Perfil y prueba otra vez.'
  }
  if (fallo instanceof ErrorTryOn) {
    return 'No se han podido leer las fotos de estas prendas.'
  }
  return 'No se ha podido preparar la imagen. Prueba otra vez.'
}

/**
 * «Pruébatelo»: compone tu foto de cuerpo entero con las prendas del outfit, copia el prompt al
 * portapapeles y abre la hoja de compartir para mandarlo a Gemini (D13). Sin foto, manda a Perfil; sin
 * Web Share con ficheros, ofrece descargar la imagen.
 */
export function BotonPruebatelo({
  prendas,
  numero,
  leerFotoCuerpo = leerFotoCuerpoDelPerfil,
  preparar = prepararTryOn,
  copiar = copiarTexto,
  compartidor = compartidorPorDefecto,
  privacidad = privacidadLocal,
}: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: 'quieto' })
  const [copiadoAMano, setCopiadoAMano] = useState<boolean | null>(null)
  // El estado tarda un render en verse: esto evita dos `share()` seguidos, que fallan.
  const enCurso = useRef(false)
  // El perfil solo cambia en otra pantalla, que desmonta esta: la imagen preparada sigue valiendo.
  const preparado = useRef<TryOn | null>(null)
  const id = useId()

  useEffect(() => {
    function alAbrirOtro(evento: Event) {
      if (evento instanceof CustomEvent && evento.detail !== id) {
        setEstado({ fase: 'quieto' })
        setCopiadoAMano(null)
      }
    }
    window.addEventListener(EVENTO_ABIERTO, alAbrirOtro)
    return () => {
      window.removeEventListener(EVENTO_ABIERTO, alAbrirOtro)
    }
  }, [id])

  useEffect(() => {
    if (estado.fase !== 'descargar') return
    const { url } = estado
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [estado])

  async function compartir(tryon: TryOn, copiado: boolean) {
    const datos = { files: [tryon.fichero] }
    const primeraVez = !privacidad.visto()
    if (typeof compartidor.share !== 'function' || !(compartidor.canShare?.(datos) ?? false)) {
      setEstado({
        fase: 'descargar',
        url: URL.createObjectURL(tryon.fichero),
        nombre: tryon.fichero.name,
        copiado,
        privacidad: primeraVez,
      })
      privacidad.marcar()
      return
    }
    // El aviso se pinta antes de abrir la hoja: así se lee al volver de Gemini.
    setEstado({ fase: 'compartiendo', copiado, privacidad: primeraVez })
    privacidad.marcar()
    try {
      await compartidor.share(datos)
    } catch (fallo) {
      if (fallo instanceof DOMException && fallo.name === 'AbortError') {
        setEstado({ fase: 'quieto' })
      } else if (fallo instanceof DOMException && fallo.name === 'NotAllowedError') {
        // Preparar la imagen tardó y el navegador ya no cuenta el toque como gesto del usuario.
        setEstado({ fase: 'reintentar', copiado })
      } else {
        console.error(fallo)
        setEstado({ fase: 'error', mensaje: 'No se ha podido abrir la hoja de compartir.' })
      }
    }
  }

  async function pulsar() {
    if (enCurso.current) return
    enCurso.current = true
    setCopiadoAMano(null)
    window.dispatchEvent(new CustomEvent(EVENTO_ABIERTO, { detail: id }))
    try {
      let tryon = preparado.current
      if (!tryon) {
        setEstado({ fase: 'preparando' })
        const foto = await leerFotoCuerpo()
        if (!foto) {
          setEstado({ fase: 'sin-foto' })
          return
        }
        tryon = await preparar(foto, prendas)
        preparado.current = tryon
      }
      await compartir(tryon, await copiar(tryon.texto))
    } catch (fallo) {
      console.error(fallo)
      setEstado({ fase: 'error', mensaje: mensajeDeFallo(fallo) })
    } finally {
      enCurso.current = false
    }
  }

  async function copiarOtraVez() {
    const tryon = preparado.current
    if (tryon) setCopiadoAMano(await copiar(tryon.texto))
  }

  function cerrar() {
    setEstado({ fase: 'quieto' })
    setCopiadoAMano(null)
  }

  const copiado = 'copiado' in estado ? (copiadoAMano ?? estado.copiado) : (copiadoAMano ?? false)
  const botonCopiar = (
    <button
      type="button"
      onClick={() => void copiarOtraVez()}
      className={`${botonPanel} border border-papel/40`}
    >
      Copiar texto
    </button>
  )
  const lineaCopiado = copiado ? null : (
    <p>No se ha podido copiar el texto: pulsa «Copiar texto» antes de abrir Gemini.</p>
  )

  let panel: ReactNode = null
  switch (estado.fase) {
    case 'sin-foto':
      panel = (
        <>
          <p>
            Para probártelo, Gemini necesita una foto tuya de cuerpo entero. Ponla en Perfil y
            vuelve a pulsar «Pruébatelo».
          </p>
          <Link
            to="/perfil"
            className={`${botonPanel} grid place-items-center bg-papel text-tinta`}
          >
            Ir a Perfil
          </Link>
        </>
      )
      break
    case 'compartiendo':
      panel = (
        <>
          {estado.privacidad && <p>{PRIVACIDAD}</p>}
          <p className="font-medium">{INSTRUCCION}</p>
          {lineaCopiado}
          {!copiado && botonCopiar}
        </>
      )
      break
    case 'reintentar':
      panel = (
        <>
          <p>La imagen ya está lista. Pulsa «Compartir» y elige Gemini.</p>
          <button
            type="button"
            onClick={() => void pulsar()}
            className={`${botonPanel} bg-papel text-tinta`}
          >
            Compartir
          </button>
        </>
      )
      break
    case 'descargar':
      panel = (
        <>
          {estado.privacidad && <p>{PRIVACIDAD}</p>}
          <p>
            Este navegador no deja compartir la imagen. Descárgala, adjúntala en Gemini y pega el
            texto{copiado ? ', que ya está copiado' : ''}.
          </p>
          {lineaCopiado}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={estado.url}
              download={estado.nombre}
              className={`${botonPanel} grid place-items-center bg-papel text-tinta`}
            >
              Descargar imagen
            </a>
            {botonCopiar}
          </div>
        </>
      )
      break
    case 'error':
      panel = <p>{estado.mensaje}</p>
      break
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void pulsar()}
        aria-label={`Pruébatelo en Gemini: outfit ${String(numero)}`}
        aria-busy={estado.fase === 'preparando'}
        className="min-h-11 shrink-0 rounded-full border border-tinta/25 px-3 text-sm leading-tight font-medium aria-busy:opacity-60"
      >
        Pruébatelo
      </button>
      <div
        aria-live="polite"
        className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-lg px-4 empty:hidden"
      >
        {panel && (
          <div
            role="group"
            aria-label={`Pruébatelo en Gemini: outfit ${String(numero)}`}
            className="flex flex-col gap-2 rounded-2xl bg-oliva p-4 text-sm text-papel shadow-lg"
          >
            {panel}
            {copiadoAMano && <p>Texto copiado.</p>}
            <button
              type="button"
              onClick={cerrar}
              className={`${botonPanel} self-end text-papel underline`}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </>
  )
}
