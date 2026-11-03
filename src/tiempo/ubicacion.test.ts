import { describe, expect, it, vi } from 'vitest'
import { NOMBRE_MI_UBICACION, obtenerUbicacion } from './ubicacion.ts'

function geolocalizacion(respuesta: { latitud: number; longitud: number } | { codigo: number }) {
  const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((exito, fallo) => {
    if ('codigo' in respuesta) {
      fallo?.({ code: respuesta.codigo, message: '' } as GeolocationPositionError)
    } else {
      exito({
        coords: { latitude: respuesta.latitud, longitude: respuesta.longitud },
      } as GeolocationPosition)
    }
  })
  const geo: Geolocation = { getCurrentPosition, watchPosition: vi.fn(), clearWatch: vi.fn() }
  return { geo, getCurrentPosition }
}

describe('obtenerUbicacion', () => {
  it('devuelve la posición del navegador', async () => {
    const { geo, getCurrentPosition } = geolocalizacion({ latitud: 40.4165, longitud: -3.7026 })

    const sitio = await obtenerUbicacion({ geolocalizacion: geo, contextoSeguro: true })

    expect(sitio).toEqual({ nombre: NOMBRE_MI_UBICACION, latitud: 40.4165, longitud: -3.7026 })
    expect(getCurrentPosition.mock.calls[0]?.[2]).toMatchObject({
      timeout: 15_000,
      enableHighAccuracy: false,
    })
  })

  it.each([
    [1, 'permiso-denegado'],
    [2, 'sin-ubicacion'],
    [3, 'tiempo-agotado'],
  ])('traduce el error %i a «%s»', async (codigo, tipo) => {
    const { geo } = geolocalizacion({ codigo })

    await expect(
      obtenerUbicacion({ geolocalizacion: geo, contextoSeguro: true }),
    ).rejects.toMatchObject({ tipo })
  })

  it('no la pide si el navegador no tiene geolocalización', async () => {
    await expect(
      obtenerUbicacion({ geolocalizacion: undefined, contextoSeguro: true }),
    ).rejects.toMatchObject({ tipo: 'no-disponible' })
  })

  it('no la pide fuera de https, donde el navegador la niega siempre', async () => {
    const { geo, getCurrentPosition } = geolocalizacion({ latitud: 0, longitud: 0 })

    const promesa = obtenerUbicacion({ geolocalizacion: geo, contextoSeguro: false })

    await expect(promesa).rejects.toMatchObject({ tipo: 'no-disponible' })
    await expect(promesa).rejects.toThrow(/https/)
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })
})
