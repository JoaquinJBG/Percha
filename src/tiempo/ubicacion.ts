import { ErrorTiempo, type Sitio } from './tipos.ts'

export const NOMBRE_MI_UBICACION = 'Tu ubicación'

export interface OpcionesUbicacion {
  geolocalizacion?: Geolocation | undefined
  /** `false` en http fuera de localhost: el navegador niega la ubicación. */
  contextoSeguro?: boolean
  tiempoMaximoMs?: number
}

const TIEMPO_MAXIMO_MS = 15_000
// Una posición de hace 10 min vale de sobra para el tiempo y ahorra batería.
const EDAD_MAXIMA_MS = 10 * 60 * 1000

/** Pide la posición al navegador. Open-Meteo no tiene geocodificación inversa: el nombre es genérico. */
export function obtenerUbicacion(opciones: OpcionesUbicacion = {}): Promise<Sitio> {
  const geolocalizacion =
    'geolocalizacion' in opciones ? opciones.geolocalizacion : globalThis.navigator.geolocation
  const contextoSeguro = opciones.contextoSeguro ?? globalThis.isSecureContext

  if (!contextoSeguro) {
    return Promise.reject(
      new ErrorTiempo('no-disponible', 'La ubicación solo funciona con https. Escribe tu ciudad.'),
    )
  }
  if (!geolocalizacion) {
    return Promise.reject(
      new ErrorTiempo('no-disponible', 'Este navegador no da la ubicación. Escribe tu ciudad.'),
    )
  }

  return new Promise((resolver, rechazar) => {
    geolocalizacion.getCurrentPosition(
      (posicion) => {
        resolver({
          nombre: NOMBRE_MI_UBICACION,
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
        })
      },
      (error) => {
        rechazar(errorDeGeolocalizacion(error))
      },
      {
        enableHighAccuracy: false,
        maximumAge: EDAD_MAXIMA_MS,
        timeout: opciones.tiempoMaximoMs ?? TIEMPO_MAXIMO_MS,
      },
    )
  })
}

function errorDeGeolocalizacion(error: GeolocationPositionError): ErrorTiempo {
  // Constantes numéricas de la especificación: no todos los entornos exponen GeolocationPositionError.
  switch (error.code) {
    case 1:
      return new ErrorTiempo(
        'permiso-denegado',
        'No tengo permiso para ver tu ubicación. Escribe tu ciudad o actívalo en el navegador.',
        { cause: error },
      )
    case 3:
      return new ErrorTiempo(
        'tiempo-agotado',
        'La ubicación tarda demasiado. Inténtalo otra vez o escribe tu ciudad.',
        { cause: error },
      )
    default:
      return new ErrorTiempo('sin-ubicacion', 'No consigo saber dónde estás. Escribe tu ciudad.', {
        cause: error,
      })
  }
}
