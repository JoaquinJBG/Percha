import { clasificar, resumir } from './resumen.ts'
import { ErrorTiempo, type Sitio, type TiempoHoy } from './tipos.ts'

const URL_GEOCODIFICACION = 'https://geocoding-api.open-meteo.com/v1/search'
const URL_PREVISION = 'https://api.open-meteo.com/v1/forecast'
const MAX_COINCIDENCIAS = 5
const DURACION_CACHE_MS = 60 * 60 * 1000
const TIEMPO_MAXIMO_PETICION_MS = 10_000
const PREFIJO_CACHE = 'percha:tiempo:'

export interface OpcionesServicio {
  fetch?: typeof fetch
  /** `null` desactiva la caché persistente (solo memoria). */
  almacen?: Storage | null
  ahora?: () => number
}

export interface ServicioTiempo {
  buscarCiudades: (texto: string) => Promise<Sitio[]>
  tiempoDeHoy: (sitio: Sitio) => Promise<TiempoHoy>
}

interface EntradaCache {
  guardado: number
  datos: TiempoHoy
}

export function crearServicioTiempo(opciones: OpcionesServicio = {}): ServicioTiempo {
  const pedir = opciones.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const almacen = opciones.almacen === undefined ? almacenLocal() : opciones.almacen
  const ahora = opciones.ahora ?? Date.now
  const memoria = new Map<string, EntradaCache>()

  async function pedirJson(url: string): Promise<unknown> {
    let respuesta: Response
    try {
      respuesta = await pedir(url, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_PETICION_MS) })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ErrorTiempo('tiempo-agotado', 'El servicio del tiempo no responde.', {
          cause: error,
        })
      }
      throw new ErrorTiempo('sin-red', 'Sin conexión: no puedo consultar el tiempo.', {
        cause: error,
      })
    }
    let cuerpo: unknown
    try {
      cuerpo = await respuesta.json()
    } catch (error) {
      throw new ErrorTiempo('servicio', 'El servicio del tiempo ha dado una respuesta rara.', {
        cause: error,
      })
    }
    if (!respuesta.ok) {
      const motivo = esObjeto(cuerpo) && typeof cuerpo.reason === 'string' ? cuerpo.reason : ''
      throw new ErrorTiempo(
        'servicio',
        `El servicio del tiempo ha fallado (${String(respuesta.status)}).`,
        { cause: motivo || undefined },
      )
    }
    return cuerpo
  }

  function leerCache(clave: string): TiempoHoy | null {
    const enMemoria = memoria.get(clave)
    if (enMemoria && sigueVigente(enMemoria, ahora())) return enMemoria.datos
    memoria.delete(clave)

    if (!almacen) return null
    const guardada = leerEntrada(almacen, PREFIJO_CACHE + clave)
    if (!guardada || !sigueVigente(guardada, ahora())) return null
    memoria.set(clave, guardada)
    return guardada.datos
  }

  function guardarCache(clave: string, datos: TiempoHoy) {
    const entrada: EntradaCache = { guardado: ahora(), datos }
    memoria.set(clave, entrada)
    if (!almacen) return
    try {
      limpiarCaducadas(almacen, ahora())
      almacen.setItem(PREFIJO_CACHE + clave, JSON.stringify(entrada))
    } catch {
      // Almacén lleno o bloqueado (modo privado): basta con la caché en memoria.
    }
  }

  return {
    async buscarCiudades(texto) {
      const nombre = texto.trim().replace(/\s+/g, ' ')
      if (nombre.length < 2) return []
      const parametros = new URLSearchParams({
        name: nombre,
        count: String(MAX_COINCIDENCIAS),
        language: 'es',
        format: 'json',
      })
      const cuerpo = await pedirJson(`${URL_GEOCODIFICACION}?${parametros.toString()}`)
      return leerCiudades(cuerpo)
    },

    async tiempoDeHoy(sitio) {
      const clave = claveDeSitio(sitio)
      const enCache = leerCache(clave)
      if (enCache) return { ...enCache, sitio }

      const parametros = new URLSearchParams({
        latitude: sitio.latitud.toFixed(4),
        longitude: sitio.longitud.toFixed(4),
        current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
        daily: [
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
          'apparent_temperature_max',
          'apparent_temperature_min',
          'precipitation_sum',
          'precipitation_probability_max',
          'wind_speed_10m_max',
        ].join(','),
        timezone: 'auto',
        forecast_days: '1',
        temperature_unit: 'celsius',
        wind_speed_unit: 'kmh',
        precipitation_unit: 'mm',
      })
      const cuerpo = await pedirJson(`${URL_PREVISION}?${parametros.toString()}`)
      const datos = leerPrevision(cuerpo, sitio)
      guardarCache(clave, datos)
      return datos
    },
  }
}

/** Con dos decimales (~1 km) la posición del GPS que baila un poco reutiliza la caché. */
export function claveDeSitio(sitio: Sitio): string {
  return `${sitio.latitud.toFixed(2)},${sitio.longitud.toFixed(2)}`
}

/** La caché vale 1 h y solo mientras siga siendo el mismo día en el sitio. */
function sigueVigente(entrada: EntradaCache, ahora: number): boolean {
  const edad = ahora - entrada.guardado
  if (edad < 0 || edad >= DURACION_CACHE_MS) return false
  return fechaEn(entrada.datos.zonaHoraria, ahora) === entrada.datos.fecha
}

function fechaEn(zonaHoraria: string, instante: number): string | null {
  try {
    // en-CA formatea como AAAA-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instante)
  } catch {
    return null
  }
}

function almacenLocal(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function leerEntrada(almacen: Storage, clave: string): EntradaCache | null {
  try {
    const texto = almacen.getItem(clave)
    if (!texto) return null
    const valor: unknown = JSON.parse(texto)
    if (!esObjeto(valor) || typeof valor.guardado !== 'number' || !esObjeto(valor.datos)) {
      return null
    }
    const datos = valor.datos
    if (typeof datos.fecha !== 'string' || typeof datos.zonaHoraria !== 'string') return null
    return valor as unknown as EntradaCache
  } catch {
    return null
  }
}

function limpiarCaducadas(almacen: Storage, ahora: number) {
  const claves: string[] = []
  for (let i = 0; i < almacen.length; i++) {
    const clave = almacen.key(i)
    if (clave?.startsWith(PREFIJO_CACHE)) claves.push(clave)
  }
  for (const clave of claves) {
    const entrada = leerEntrada(almacen, clave)
    if (!entrada || !sigueVigente(entrada, ahora)) almacen.removeItem(clave)
  }
}

function leerCiudades(cuerpo: unknown): Sitio[] {
  if (!esObjeto(cuerpo) || !Array.isArray(cuerpo.results)) return []
  const sitios: Sitio[] = []
  for (const resultado of cuerpo.results as unknown[]) {
    if (!esObjeto(resultado)) continue
    const { name, latitude, longitude, admin1, country } = resultado
    if (typeof name !== 'string' || !esNumero(latitude) || !esNumero(longitude)) continue
    const lugares = [admin1, country].filter(
      (parte): parte is string => typeof parte === 'string' && parte !== '' && parte !== name,
    )
    const sitio: Sitio = { nombre: name, latitud: latitude, longitud: longitude }
    if (lugares.length > 0) sitio.detalle = lugares.join(', ')
    sitios.push(sitio)
  }
  return sitios
}

function leerPrevision(cuerpo: unknown, sitio: Sitio): TiempoHoy {
  const raro = () =>
    new ErrorTiempo('servicio', 'El servicio del tiempo ha dado una respuesta rara.')
  if (!esObjeto(cuerpo) || !esObjeto(cuerpo.current) || !esObjeto(cuerpo.daily)) throw raro()
  const { current, daily } = cuerpo
  const zonaHoraria = cuerpo.timezone
  const hora = current.time
  const fecha = primero(daily.time)
  if (typeof zonaHoraria !== 'string' || typeof hora !== 'string' || typeof fecha !== 'string') {
    throw raro()
  }

  const numero = (valor: unknown) => {
    if (!esNumero(valor)) throw raro()
    return valor
  }
  const opcional = (valor: unknown) => (esNumero(valor) ? valor : null)

  const medidas = {
    temperatura: {
      actual: numero(current.temperature_2m),
      minima: numero(primero(daily.temperature_2m_min)),
      maxima: numero(primero(daily.temperature_2m_max)),
    },
    sensacion: {
      actual: numero(current.apparent_temperature),
      minima: numero(primero(daily.apparent_temperature_min)),
      maxima: numero(primero(daily.apparent_temperature_max)),
    },
    lluvia: {
      probabilidad: opcional(primero(daily.precipitation_probability_max)),
      cantidad: opcional(primero(daily.precipitation_sum)) ?? 0,
    },
    viento: {
      actual: numero(current.wind_speed_10m),
      maximo: opcional(primero(daily.wind_speed_10m_max)) ?? numero(current.wind_speed_10m),
    },
    codigo: opcional(primero(daily.weather_code)) ?? numero(current.weather_code),
  }
  const clima = clasificar(medidas)
  return { sitio, zonaHoraria, fecha, hora, ...medidas, clima, resumen: resumir(clima) }
}

function primero(valor: unknown): unknown {
  return Array.isArray(valor) ? (valor as unknown[])[0] : undefined
}

function esNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}
