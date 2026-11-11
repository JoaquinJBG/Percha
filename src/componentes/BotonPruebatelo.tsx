import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Prenda } from '../datos/modelo.ts'
import {
  leerFotoInterior as leerFotoInteriorGuardada,
  leerPerfil,
  listarTablasTallas,
} from '../datos/repositorio.ts'
import { lineaAjusteOutfit } from './tablas-tallas/index.ts'
import { fotoDe } from '../outfits/collage/index.ts'
import {
  crearClienteProbador,
  ErrorProbador,
  esperarMs,
  leerConfigProbador,
  prendasParaProbador,
  probarEnPC,
  segundosRestantes,
  seguirPrueba,
  type ClienteProbador,
  type ConfigProbador,
  type OpcionesSeguir,
  type PrendaEnviada,
  type Progreso,
} from '../probador/index.ts'
import { mensajeProbador } from '../probador/mensajes.ts'
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

/** Lo que hace falta de cada prenda: lo de Gemini y su nivel de abrigo, para elegir la capa de fuera. */
export type PrendaPruebatelo = PrendaTryOn &
  Pick<Prenda, 'abrigo'> &
  Partial<Pick<Prenda, 'marca' | 'talla' | 'corte' | 'largo'>>

interface Props {
  prendas: readonly PrendaPruebatelo[]
  /** El número del outfit en la lista, para el nombre accesible del botón. */
  numero: number
  /** Guarda con el outfit la foto del probador del PC; `false` si no se pudo. Sin ella, no hay «Guardar». */
  alGuardarPrueba?: (prueba: Blob) => Promise<boolean>
  /** La foto de referencia del perfil: la única que va a Gemini. */
  leerFotoCuerpo?: () => Promise<Blob | null>
  /** La foto en ropa interior (D21): solo para el probador del PC, nunca para Gemini. */
  leerFotoInterior?: () => Promise<Blob | null>
  /** El probador del PC de Ajustes, o `null` si no hay: entonces se usa Gemini (D19). */
  leerProbador?: () => Promise<ConfigProbador | null>
  crearCliente?: (config: ConfigProbador) => ClienteProbador
  esperar?: (ms: number, signal?: AbortSignal) => Promise<void>
  preparar?: (fotoCuerpo: Blob, prendas: readonly PrendaTryOn[]) => Promise<TryOn>
  copiar?: (texto: string) => Promise<boolean>
  compartidor?: CompartidorTryOn
  privacidad?: AvisoPrivacidad
  /** La línea de tallas bajo la prueba del PC (T10.2); por defecto, con las tablas y tu perfil. */
  leerAjuste?: (prendas: readonly PrendaPruebatelo[]) => Promise<string | null>
}

type Guardado = 'no' | 'guardando' | 'si' | 'error'

type Estado =
  | { fase: 'quieto' }
  | { fase: 'preparando' }
  | { fase: 'sin-foto' }
  | { fase: 'compartiendo'; copiado: boolean; privacidad: boolean }
  | { fase: 'reintentar'; copiado: boolean }
  | { fase: 'descargar'; url: string; nombre: string; copiado: boolean; privacidad: boolean }
  | { fase: 'error'; mensaje: string }
  | { fase: 'pc-comprobando' }
  /** `progreso` es `null` mientras se suben las fotos. */
  | { fase: 'pc-probando'; progreso: Progreso | null }
  | { fase: 'pc-lista'; blob: Blob; url: string; guardado: Guardado; aviso: string | null }
  /** `seguir`: el id de una prueba que sigue en el PC y se puede volver a mirar. */
  | {
      fase: 'pc-fallo'
      mensaje: string
      seguir: string | null
      reintentar: boolean
      ajustes: boolean
    }

const CLAVE_PRIVACIDAD = 'percha:tryon:privacidad-vista'
/** Al abrir el panel de un outfit se cierra el de otro: si no, quedarían uno encima del otro. */
const EVENTO_ABIERTO = 'percha:pruebatelo-abierto'
const NOMBRE_PRUEBA = 'percha-prueba.jpg'

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

function clienteConRed(config: ConfigProbador): ClienteProbador {
  return crearClienteProbador(config)
}

const compartidorPorDefecto: CompartidorTryOn = typeof navigator === 'undefined' ? {} : navigator

const PRIVACIDAD =
  'Tu foto solo sale del móvil cuando eliges a dónde compartirla: Percha no la sube a ningún sitio.'
const INSTRUCCION = 'En Gemini, toca la sugerencia del teclado para pegar el texto y envía.'
/** Las medidas no salen del móvil: la línea se calcula aquí con las tablas guardadas (D23). */
async function ajusteConTablas(prendas: readonly PrendaPruebatelo[]): Promise<string | null> {
  const [tablas, perfil] = await Promise.all([listarTablasTallas(), leerPerfil()])
  return lineaAjusteOutfit(prendas, tablas, perfil.cuerpo)
}

const AVISO_GOOGLE = 'Con Gemini, tu foto y las de las prendas van a Google.'
const AVISO_CAPAS =
  'En tu PC solo se viste la prenda de fuera; para ver todas las capas, prueba con Gemini.'
const AVISO_VESTIDO =
  'En tu PC solo se viste el vestido; para verlo con el resto, prueba con Gemini.'

const botonPanel =
  'min-h-11 rounded-xl px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papel disabled:opacity-60'
const botonClaro = `${botonPanel} grid place-items-center bg-papel text-tinta`
const botonBorde = `${botonPanel} border border-papel/40`

/** Una función y no `signal.aborted` a secas: TypeScript no sabe que cambia durante un `await`. */
function cortada(signal: AbortSignal): boolean {
  return signal.aborted
}

function esCancelacion(fallo: unknown): boolean {
  return fallo instanceof DOMException && fallo.name === 'AbortError'
}

function mensajeDeFallo(fallo: unknown): string {
  if (fallo instanceof ErrorTryOn && fallo.motivo === 'foto-persona') {
    return 'No se ha podido leer tu foto de cuerpo entero. Cámbiala en Perfil y prueba otra vez.'
  }
  if (fallo instanceof ErrorTryOn) {
    return 'No se han podido leer las fotos de estas prendas.'
  }
  return 'No se ha podido preparar la imagen. Prueba otra vez.'
}

function textoRestante(progreso: Progreso): string {
  const minutos = Math.ceil(segundosRestantes(progreso) / 60)
  if (minutos === 0) return 'Ya casi está.'
  return minutos === 1 ? 'Queda un minuto, más o menos.' : `Quedan unos ${String(minutos)} minutos.`
}

/**
 * «Pruébatelo». Con el probador del PC en Ajustes (D19), le manda tu foto y las prendas, enseña el
 * progreso y luego la imagen para guardarla o compartirla; si el PC falla, ofrece Gemini. Sin probador,
 * compone tu foto con las prendas, copia el prompt y abre la hoja de compartir para Gemini (D13). Sin
 * foto de cuerpo, manda a Perfil.
 */
export function BotonPruebatelo({
  prendas,
  numero,
  alGuardarPrueba,
  leerFotoCuerpo = leerFotoCuerpoDelPerfil,
  leerFotoInterior = leerFotoInteriorGuardada,
  leerProbador = leerConfigProbador,
  crearCliente = clienteConRed,
  esperar = esperarMs,
  preparar = prepararTryOn,
  copiar = copiarTexto,
  compartidor = compartidorPorDefecto,
  privacidad = privacidadLocal,
  leerAjuste = ajusteConTablas,
}: Props) {
  const [lineaAjuste, setLineaAjuste] = useState<string | null>(null)
  useEffect(() => {
    let vigente = true
    leerAjuste(prendas).then(
      (linea) => {
        if (vigente) setLineaAjuste(linea)
      },
      () => {
        // Sin tablas o sin perfil no hay línea de tallas: la prueba se enseña igual.
      },
    )
    return () => {
      vigente = false
    }
  }, [leerAjuste, prendas])
  const [estado, setEstado] = useState<Estado>({ fase: 'quieto' })
  const [copiadoAMano, setCopiadoAMano] = useState<boolean | null>(null)
  // El estado tarda un render en verse: esto evita dos `share()` o dos pruebas seguidas.
  const enCurso = useRef(false)
  // El perfil solo cambia en otra pantalla, que desmonta esta: la imagen preparada sigue valiendo.
  const preparado = useRef<TryOn | null>(null)
  // La prueba del PC en marcha: se cancela al cerrar, al abrir otro outfit y al salir de la pantalla.
  const control = useRef<AbortController | null>(null)
  const cliente = useRef<ClienteProbador | null>(null)
  const id = useId()
  const seleccion = useMemo(() => prendasParaProbador(prendas), [prendas])
  const avisoCapas =
    seleccion.fuera.length === 0
      ? null
      : seleccion.envio[0]?.zona === 'entero'
        ? AVISO_VESTIDO
        : AVISO_CAPAS

  function dejarDeEsperar() {
    control.current?.abort(new DOMException('Cancelada', 'AbortError'))
    control.current = null
  }

  useEffect(() => {
    const cancelar = () => {
      control.current?.abort(new DOMException('Cancelada', 'AbortError'))
    }
    function alAbrirOtro(evento: Event) {
      if (evento instanceof CustomEvent && evento.detail !== id) {
        cancelar()
        setEstado({ fase: 'quieto' })
        setCopiadoAMano(null)
      }
    }
    window.addEventListener(EVENTO_ABIERTO, alAbrirOtro)
    return () => {
      window.removeEventListener(EVENTO_ABIERTO, alAbrirOtro)
      // Al salir de la pantalla se deja de preguntar al PC.
      cancelar()
    }
  }, [id])

  // Se depende de la URL y no del estado: guardar o avisar crean otro estado con la misma imagen.
  const urlImagen = estado.fase === 'descargar' || estado.fase === 'pc-lista' ? estado.url : null
  useEffect(() => {
    if (!urlImagen) return
    return () => {
      URL.revokeObjectURL(urlImagen)
    }
  }, [urlImagen])

  /**
   * Una tarea a la vez por outfit; al empezar, cierra el panel de los demás. Su señal se corta al
   * cerrar, al abrir otro outfit o al salir de la pantalla: tras cada espera, si está cortada, no sigue.
   */
  async function conGuarda(tarea: (signal: AbortSignal) => Promise<void>) {
    if (enCurso.current) return
    enCurso.current = true
    const propio = new AbortController()
    control.current = propio
    setCopiadoAMano(null)
    window.dispatchEvent(new CustomEvent(EVENTO_ABIERTO, { detail: id }))
    try {
      await tarea(propio.signal)
    } catch (fallo) {
      if (propio.signal.aborted || esCancelacion(fallo)) return
      console.error(fallo)
      setEstado({ fase: 'error', mensaje: mensajeDeFallo(fallo) })
    } finally {
      enCurso.current = false
      if (control.current === propio) control.current = null
    }
  }

  async function compartirConGemini(tryon: TryOn, copiado: boolean) {
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
      if (esCancelacion(fallo)) {
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

  async function gemini(signal: AbortSignal, foto?: Blob) {
    let tryon = preparado.current
    if (!tryon) {
      setEstado({ fase: 'preparando' })
      const cuerpo = foto ?? (await leerFotoCuerpo())
      if (cortada(signal)) return
      if (!cuerpo) {
        setEstado({ fase: 'sin-foto' })
        return
      }
      tryon = await preparar(cuerpo, prendas)
      preparado.current = tryon
    }
    const copiado = await copiar(tryon.texto)
    if (cortada(signal)) return
    await compartirConGemini(tryon, copiado)
  }

  function falloPC(fallo: unknown, seguir: string | null) {
    const motivo = fallo instanceof ErrorProbador ? fallo.motivo : null
    if (!(fallo instanceof ErrorProbador)) console.error(fallo)
    setEstado({
      fase: 'pc-fallo',
      mensaje: mensajeProbador(fallo),
      seguir: motivo === 'red' ? seguir : null,
      reintentar: motivo === 'red' || motivo === 'ocupado' || motivo === 'no-existe',
      ajustes: motivo === 'clave' || motivo === 'servidor',
    })
  }

  /** Espera a la prueba (nueva o ya en marcha) y enseña la imagen; los fallos van al panel. */
  async function esperarPrueba(
    signal: AbortSignal,
    tarea: (opciones: OpcionesSeguir) => Promise<Blob>,
  ) {
    let enMarcha: string | null = null
    try {
      const blob = await tarea({
        signal,
        esperar,
        alProgreso: (progreso) => {
          enMarcha = progreso.id
          if (!cortada(signal)) setEstado({ fase: 'pc-probando', progreso })
        },
      })
      if (cortada(signal)) return
      setEstado({
        fase: 'pc-lista',
        blob,
        url: URL.createObjectURL(blob),
        guardado: 'no',
        aviso: null,
      })
    } catch (fallo) {
      if (cortada(signal)) return
      falloPC(fallo, enMarcha)
    }
  }

  async function probarEnTuPC(signal: AbortSignal, config: ConfigProbador, foto: Blob) {
    const enviadas: PrendaEnviada[] = seleccion.envio.flatMap(({ prenda, zona }) => {
      const blob = fotoDe(prenda)
      return blob ? [{ foto: blob, zona }] : []
    })
    if (enviadas.length === 0) {
      setEstado({
        fase: 'pc-fallo',
        mensaje: 'Tu PC no viste calzado ni accesorios, y este outfit no lleva más ropa.',
        seguir: null,
        reintentar: false,
        ajustes: false,
      })
      return
    }
    const nuevo = crearCliente(config)
    cliente.current = nuevo
    setEstado({ fase: 'pc-comprobando' })
    await esperarPrueba(signal, async (opciones) => {
      const salud = await nuevo.salud(signal)
      if (salud.ocupado) throw new ErrorProbador('ocupado')
      if (!cortada(signal)) setEstado({ fase: 'pc-probando', progreso: null })
      return probarEnPC(nuevo, foto, enviadas, opciones)
    })
  }

  function pulsar() {
    return conGuarda(async (signal) => {
      setEstado({ fase: 'preparando' })
      const config = await leerProbador().catch((fallo: unknown) => {
        console.error(fallo)
        return null
      })
      // Al PC, la de ropa interior si la hay (D21); a Gemini, siempre la de referencia.
      const interior = config
        ? await leerFotoInterior().catch((fallo: unknown) => {
            console.error(fallo)
            return null
          })
        : null
      const referencia = await leerFotoCuerpo()
      if (cortada(signal)) return
      const foto = interior ?? referencia
      if (!foto) {
        setEstado({ fase: 'sin-foto' })
        return
      }
      if (config) await probarEnTuPC(signal, config, foto)
      else if (referencia) await gemini(signal, referencia)
    })
  }

  function volverAMirar(idPrueba: string) {
    const actual = cliente.current
    if (!actual) return Promise.resolve()
    return conGuarda(async (signal) => {
      setEstado({ fase: 'pc-probando', progreso: null })
      await esperarPrueba(signal, (opciones) => seguirPrueba(actual, idPrueba, opciones))
    })
  }

  async function guardarPrueba(blob: Blob) {
    if (!alGuardarPrueba) return
    const cambiar = (guardado: Guardado) => {
      setEstado((antes) => (antes.fase === 'pc-lista' ? { ...antes, guardado } : antes))
    }
    cambiar('guardando')
    cambiar((await alGuardarPrueba(blob).catch(() => false)) ? 'si' : 'error')
  }

  async function compartirPrueba(blob: Blob) {
    const fichero = new File([blob], NOMBRE_PRUEBA, { type: blob.type || 'image/jpeg' })
    const avisar = (aviso: string | null) => {
      setEstado((antes) => (antes.fase === 'pc-lista' ? { ...antes, aviso } : antes))
    }
    avisar(null)
    try {
      await compartidor.share?.({ files: [fichero] })
    } catch (fallo) {
      if (esCancelacion(fallo)) return
      console.error(fallo)
      avisar('No se ha podido compartir. Descarga la imagen y compártela desde la galería.')
    }
  }

  async function copiarOtraVez() {
    const tryon = preparado.current
    if (tryon) setCopiadoAMano(await copiar(tryon.texto))
  }

  function cerrar() {
    dejarDeEsperar()
    setEstado({ fase: 'quieto' })
    setCopiadoAMano(null)
  }

  const copiado = 'copiado' in estado ? (copiadoAMano ?? estado.copiado) : (copiadoAMano ?? false)
  const botonCopiar = (
    <button type="button" onClick={() => void copiarOtraVez()} className={botonBorde}>
      Copiar texto
    </button>
  )
  const lineaCopiado = copiado ? null : (
    <p>No se ha podido copiar el texto: pulsa «Copiar texto» antes de abrir Gemini.</p>
  )
  const conGemini = (
    <div className="flex flex-col gap-2 border-t border-papel/25 pt-2">
      <p>{AVISO_GOOGLE}</p>
      <button
        type="button"
        onClick={() => void conGuarda((signal) => gemini(signal))}
        className={botonBorde}
      >
        Probar con Gemini
      </button>
    </div>
  )

  let panel: ReactNode = null
  switch (estado.fase) {
    case 'sin-foto':
      panel = (
        <>
          <p>
            Para probártelo necesitas una foto tuya de cuerpo entero. Ponla en Perfil y vuelve a
            pulsar «Pruébatelo».
          </p>
          <Link to="/perfil" className={botonClaro}>
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
            onClick={() => void conGuarda((signal) => gemini(signal))}
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
            <a href={estado.url} download={estado.nombre} className={botonClaro}>
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
    case 'pc-comprobando':
      panel = <p>Buscando tu PC…</p>
      break
    case 'pc-probando': {
      const { progreso } = estado
      panel = (
        <>
          <p className="font-medium">
            {!progreso
              ? 'Enviando tus fotos a tu PC…'
              : progreso.estado === 'en-cola'
                ? 'Tu PC va a empezar…'
                : `Probándote la prenda ${String(Math.min(progreso.hechas + 1, progreso.total))} de ${String(progreso.total)}…`}
          </p>
          {progreso && (
            <>
              <div
                role="progressbar"
                aria-label="Prendas probadas"
                aria-valuemin={0}
                aria-valuemax={progreso.total}
                aria-valuenow={progreso.hechas}
                className="h-2 w-full overflow-hidden rounded-full bg-papel/25"
              >
                <div
                  className="h-full rounded-full bg-papel transition-[width]"
                  style={{ width: `${String((progreso.hechas / progreso.total) * 100)}%` }}
                />
              </div>
              <p>
                {String(progreso.hechas)} de {String(progreso.total)} hechas.{' '}
                {textoRestante(progreso)}
              </p>
            </>
          )}
          {avisoCapas && <p>{avisoCapas}</p>}
          <p className="text-papel/80">
            No salgas de esta pantalla mientras tanto. Si cierras, tu PC acaba la prueba igualmente.
          </p>
        </>
      )
      break
    }
    case 'pc-lista':
      panel = (
        <>
          <img
            src={estado.url}
            alt={`Tú con el outfit ${String(numero)}, vestido en tu PC`}
            className="mx-auto max-h-[45dvh] w-auto rounded-xl bg-white object-contain"
          />
          {lineaAjuste && <p>Tallas · {lineaAjuste}</p>}
          {avisoCapas && <p>{avisoCapas}</p>}
          <div className="grid grid-cols-2 gap-2">
            {alGuardarPrueba && (
              <button
                type="button"
                onClick={() => void guardarPrueba(estado.blob)}
                disabled={estado.guardado === 'guardando' || estado.guardado === 'si'}
                className={botonClaro}
              >
                {estado.guardado === 'si' ? 'Guardada' : 'Guardar'}
              </button>
            )}
            {typeof compartidor.share === 'function' ? (
              <button
                type="button"
                onClick={() => void compartirPrueba(estado.blob)}
                className={`${botonBorde} ${alGuardarPrueba ? '' : 'col-span-2'}`}
              >
                Compartir
              </button>
            ) : (
              <a
                href={estado.url}
                download={NOMBRE_PRUEBA}
                className={`${botonBorde} grid place-items-center ${alGuardarPrueba ? '' : 'col-span-2'}`}
              >
                Descargar
              </a>
            )}
          </div>
          {estado.guardado === 'si' && <p>Guardada con el outfit.</p>}
          {estado.guardado === 'error' && <p>No se ha podido guardar. Prueba otra vez.</p>}
          {estado.aviso && <p>{estado.aviso}</p>}
          {avisoCapas && conGemini}
        </>
      )
      break
    case 'pc-fallo': {
      const { seguir } = estado
      panel = (
        <>
          <p className="font-medium">{estado.mensaje}</p>
          {seguir ? (
            <button type="button" onClick={() => void volverAMirar(seguir)} className={botonClaro}>
              Volver a mirar
            </button>
          ) : (
            estado.reintentar && (
              <button type="button" onClick={() => void pulsar()} className={botonClaro}>
                Reintentar
              </button>
            )
          )}
          {estado.ajustes && (
            <Link to="/ajustes" className={botonClaro}>
              Ir a Ajustes
            </Link>
          )}
          {conGemini}
        </>
      )
      break
    }
  }

  const ocupado =
    estado.fase === 'preparando' ||
    estado.fase === 'pc-comprobando' ||
    estado.fase === 'pc-probando'

  return (
    <>
      <button
        type="button"
        onClick={() => void pulsar()}
        aria-label={`Pruébatelo: outfit ${String(numero)}`}
        aria-busy={ocupado}
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
            aria-label={`Pruébatelo: outfit ${String(numero)}`}
            className="flex max-h-[calc(100dvh-6rem)] flex-col gap-2 overflow-y-auto rounded-2xl bg-oliva p-4 text-sm text-papel shadow-lg"
          >
            {panel}
            {copiadoAMano && <p>Texto copiado.</p>}
            <button
              type="button"
              onClick={cerrar}
              className={`${botonPanel} self-end text-papel underline`}
            >
              {estado.fase === 'pc-probando' || estado.fase === 'pc-comprobando'
                ? 'Dejar de esperar'
                : 'Cerrar'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
