export type TipoErrorIA =
  | 'sin-clave'
  | 'clave-mala'
  | 'sin-cupo'
  | 'sin-red'
  | 'modelo'
  | 'no-disponible'
  | 'respuesta'
  | 'otro'

const MENSAJES: Record<Exclude<TipoErrorIA, 'modelo'>, string> = {
  'sin-clave': 'Falta la clave de Gemini. Ponla en Ajustes.',
  'clave-mala': 'Google no acepta esta clave. Cópiala otra vez de AI Studio.',
  'sin-cupo':
    'Se ha acabado el cupo gratis de Gemini. Prueba dentro de un rato: el del día se renueva hacia las 9:00.',
  'sin-red': 'No hay conexión. Prueba cuando tengas red.',
  'no-disponible': 'Gemini no responde ahora mismo. Prueba en un rato.',
  respuesta: 'Gemini ha devuelto algo que no se entiende. Prueba otra vez o etiqueta a mano.',
  otro: 'No se ha podido hablar con Gemini.',
}

/**
 * Error con un mensaje listo para el usuario. Nunca guarda el error original: el texto de Google
 * no debe acabar en pantalla ni en un log.
 */
export class ErrorIA extends Error {
  readonly tipo: TipoErrorIA
  readonly estado: number | null

  constructor(tipo: TipoErrorIA, opciones: { modelo?: string; estado?: number } = {}) {
    super(
      tipo === 'modelo'
        ? `El modelo «${opciones.modelo ?? '?'}» no está disponible para tu clave.`
        : MENSAJES[tipo],
    )
    this.name = 'ErrorIA'
    this.tipo = tipo
    this.estado = opciones.estado ?? null
  }
}

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Convierte lo que lanza el SDK (o `fetch`) en un `ErrorIA`. Las cancelaciones pasan tal cual. */
export function traducirError(error: unknown, modelo: string): unknown {
  if (error instanceof ErrorIA || esCancelacion(error)) return error
  const estado = (error as { status?: unknown } | null)?.status
  if (typeof estado === 'number') {
    const texto = error instanceof Error ? error.message : ''
    if (estado === 401 || estado === 403) return new ErrorIA('clave-mala', { estado })
    if (estado === 400 && /API_KEY_INVALID|API key not valid/i.test(texto)) {
      return new ErrorIA('clave-mala', { estado })
    }
    if (estado === 404) return new ErrorIA('modelo', { modelo, estado })
    if (estado === 429) return new ErrorIA('sin-cupo', { estado })
    if (estado >= 500) return new ErrorIA('no-disponible', { estado })
    return new ErrorIA('otro', { estado })
  }
  // `fetch` lanza TypeError cuando no llega a haber respuesta (sin red, DNS, CORS).
  if (error instanceof TypeError) return new ErrorIA('sin-red')
  return new ErrorIA('otro')
}
