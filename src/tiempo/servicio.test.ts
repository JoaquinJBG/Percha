import { describe, expect, it, vi } from 'vitest'
import { crearServicioTiempo } from './servicio.ts'
import { ErrorTiempo, type Sitio } from './tipos.ts'

const valencia: Sitio = {
  nombre: 'Valencia',
  detalle: 'Comunidad Valenciana, España',
  latitud: 39.47391,
  longitud: -0.37966,
}

// 2 nov 2026 a las 21:00 en Madrid (UTC+1).
const AHORA = Date.UTC(2026, 10, 2, 20, 0)
const HORA_MS = 60 * 60 * 1000

function prevision(cambios: { current?: object; daily?: object } = {}) {
  return {
    latitude: 39.48,
    longitude: -0.39,
    timezone: 'Europe/Madrid',
    current: {
      time: '2026-11-02T21:00',
      temperature_2m: 16.8,
      apparent_temperature: 17.8,
      weather_code: 3,
      wind_speed_10m: 3.9,
      ...cambios.current,
    },
    daily: {
      time: ['2026-11-02'],
      weather_code: [3],
      temperature_2m_max: [20.7],
      temperature_2m_min: [13.5],
      apparent_temperature_max: [20.4],
      apparent_temperature_min: [12.4],
      precipitation_sum: [0],
      precipitation_probability_max: [0],
      wind_speed_10m_max: [9.4],
      ...cambios.daily,
    },
  }
}

function respuesta(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  })
}

function montar({
  cuerpos = [prevision()] as unknown[],
  almacen = null as Storage | null,
  ahora = () => AHORA,
} = {}) {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const cuerpo of cuerpos) {
    fetch.mockImplementationOnce(() =>
      Promise.resolve(cuerpo instanceof Response ? cuerpo : respuesta(cuerpo)),
    )
  }
  const servicio = crearServicioTiempo({ fetch, almacen, ahora })
  const urls = () => fetch.mock.calls.map(([url]) => new URL(url as string))
  return { servicio, fetch, urls }
}

describe('tiempoDeHoy', () => {
  it('devuelve el tiempo de hoy con la zona horaria del sitio', async () => {
    const { servicio, urls } = montar()

    const tiempo = await servicio.tiempoDeHoy(valencia)

    expect(tiempo).toMatchObject({
      sitio: valencia,
      zonaHoraria: 'Europe/Madrid',
      fecha: '2026-11-02',
      hora: '2026-11-02T21:00',
      temperatura: { actual: 16.8, minima: 13.5, maxima: 20.7 },
      sensacion: { actual: 17.8, minima: 12.4, maxima: 20.4 },
      lluvia: { probabilidad: 0, cantidad: 0 },
      viento: { actual: 3.9, maximo: 9.4 },
      clima: { termico: 'templado', precipitacion: null, viento: false },
      resumen: 'templado',
    })
    const [url] = urls()
    expect(url?.origin).toBe('https://api.open-meteo.com')
    expect(url?.searchParams.get('timezone')).toBe('auto')
    expect(url?.searchParams.get('forecast_days')).toBe('1')
    expect(url?.searchParams.get('latitude')).toBe('39.4739')
  })

  it.each([
    [{ apparent_temperature_min: [2], apparent_temperature_max: [9] }, 'frío'],
    [{ apparent_temperature_min: [22], apparent_temperature_max: [34] }, 'calor'],
    [
      { apparent_temperature_min: [3], apparent_temperature_max: [8], precipitation_sum: [4.2] },
      'frío y lluvia',
    ],
    [
      {
        apparent_temperature_min: [15],
        apparent_temperature_max: [24],
        precipitation_probability_max: [70],
        wind_speed_10m_max: [45],
      },
      'templado, lluvia y viento',
    ],
    [
      { apparent_temperature_min: [-6], apparent_temperature_max: [0], weather_code: [73] },
      'frío y nieve',
    ],
  ])('resume %o como «%s»', async (daily, resumen) => {
    const { servicio } = montar({ cuerpos: [prevision({ daily })] })

    expect((await servicio.tiempoDeHoy(valencia)).resumen).toBe(resumen)
  })

  it('acepta que falten la probabilidad de lluvia y el viento máximo', async () => {
    const { servicio } = montar({
      cuerpos: [
        prevision({
          daily: { precipitation_probability_max: [null], wind_speed_10m_max: [null] },
        }),
      ],
    })

    const tiempo = await servicio.tiempoDeHoy(valencia)

    expect(tiempo.lluvia.probabilidad).toBeNull()
    expect(tiempo.viento.maximo).toBe(3.9)
  })

  it('rechaza una respuesta sin temperaturas', async () => {
    const { servicio } = montar({
      cuerpos: [prevision({ daily: { temperature_2m_max: [null] } })],
    })

    await expect(servicio.tiempoDeHoy(valencia)).rejects.toMatchObject({ tipo: 'servicio' })
  })

  it('da un error de servicio si Open-Meteo responde con error', async () => {
    const { servicio } = montar({
      cuerpos: [respuesta({ error: true, reason: 'Latitude must be in range' }, 400)],
    })

    const error: unknown = await servicio.tiempoDeHoy(valencia).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ErrorTiempo)
    expect(error).toMatchObject({ tipo: 'servicio', cause: 'Latitude must be in range' })
  })

  it('da un error sin red si la petición no sale', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'))
    const servicio = crearServicioTiempo({ fetch, almacen: null })

    await expect(servicio.tiempoDeHoy(valencia)).rejects.toMatchObject({
      tipo: 'sin-red',
      message: 'Sin conexión: no puedo consultar el tiempo.',
    })
  })

  it('da un error de tiempo agotado si Open-Meteo no contesta', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'))
    const servicio = crearServicioTiempo({ fetch, almacen: null })

    await expect(servicio.tiempoDeHoy(valencia)).rejects.toMatchObject({ tipo: 'tiempo-agotado' })
  })
})

describe('caché del tiempo', () => {
  it('no vuelve a pedir el mismo sitio durante una hora', async () => {
    let ahora = AHORA
    const { servicio, fetch } = montar({
      cuerpos: [prevision(), prevision({ current: { temperature_2m: 10 } })],
      ahora: () => ahora,
    })

    await servicio.tiempoDeHoy(valencia)
    ahora += HORA_MS - 1
    const enCache = await servicio.tiempoDeHoy(valencia)
    ahora += 1
    const nuevo = await servicio.tiempoDeHoy(valencia)

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(enCache.temperatura.actual).toBe(16.8)
    expect(nuevo.temperatura.actual).toBe(10)
  })

  it('reutiliza la caché si la posición apenas cambia y devuelve el sitio pedido', async () => {
    const { servicio, fetch } = montar()

    await servicio.tiempoDeHoy(valencia)
    const cerca = { nombre: 'Tu ubicación', latitud: 39.4712, longitud: -0.3801 }
    const tiempo = await servicio.tiempoDeHoy(cerca)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(tiempo.sitio).toEqual(cerca)
  })

  it('pide otra vez otro sitio', async () => {
    const { servicio, fetch } = montar({ cuerpos: [prevision(), prevision()] })

    await servicio.tiempoDeHoy(valencia)
    await servicio.tiempoDeHoy({ nombre: 'Madrid', latitud: 40.4165, longitud: -3.7026 })

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('caduca al cambiar de día en el sitio aunque no haya pasado una hora', async () => {
    // 23:30 en Madrid; 40 min después ya es el día siguiente allí.
    let ahora = Date.UTC(2026, 10, 2, 22, 30)
    const { servicio, fetch } = montar({
      cuerpos: [prevision(), prevision({ daily: { time: ['2026-11-03'] } })],
      ahora: () => ahora,
    })

    await servicio.tiempoDeHoy(valencia)
    ahora += 40 * 60 * 1000
    const tiempo = await servicio.tiempoDeHoy(valencia)

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(tiempo.fecha).toBe('2026-11-03')
  })

  it('sobrevive a recargar la página gracias a localStorage', async () => {
    const almacen = window.localStorage
    almacen.clear()
    const primero = montar({ almacen })
    await primero.servicio.tiempoDeHoy(valencia)

    const segundo = montar({ cuerpos: [], almacen, ahora: () => AHORA + 30 * 60 * 1000 })
    const tiempo = await segundo.servicio.tiempoDeHoy(valencia)

    expect(segundo.fetch).not.toHaveBeenCalled()
    expect(tiempo.temperatura.actual).toBe(16.8)
  })

  it('no mantiene viva en memoria una entrada leída de localStorage más allá de su hora', async () => {
    const almacen = window.localStorage
    almacen.clear()
    await montar({ almacen }).servicio.tiempoDeHoy(valencia)

    let ahora = AHORA + 50 * 60 * 1000
    const { servicio, fetch } = montar({ almacen, ahora: () => ahora })
    await servicio.tiempoDeHoy(valencia)
    ahora = AHORA + HORA_MS
    await servicio.tiempoDeHoy(valencia)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ignora una entrada de localStorage corrupta y borra las caducadas', async () => {
    const almacen = window.localStorage
    almacen.clear()
    almacen.setItem('percha:tiempo:39.47,-0.38', '{no es json')
    almacen.setItem(
      'percha:tiempo:40.42,-3.70',
      JSON.stringify({ guardado: AHORA - 2 * HORA_MS, datos: { fecha: 'x', zonaHoraria: 'UTC' } }),
    )
    almacen.setItem('otra-cosa', 'se queda')
    const { servicio, fetch } = montar({ almacen })

    await servicio.tiempoDeHoy(valencia)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(almacen.getItem('percha:tiempo:40.42,-3.70')).toBeNull()
    expect(almacen.getItem('otra-cosa')).toBe('se queda')
    expect(JSON.parse(almacen.getItem('percha:tiempo:39.47,-0.38') ?? '')).toMatchObject({
      guardado: AHORA,
    })
  })

  it('sigue funcionando si localStorage está lleno', async () => {
    const almacen = window.localStorage
    almacen.clear()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })
    const { servicio, fetch } = montar({ almacen })

    await servicio.tiempoDeHoy(valencia)
    await servicio.tiempoDeHoy(valencia)

    expect(fetch).toHaveBeenCalledTimes(1)
    setItem.mockRestore()
  })
})

describe('buscarCiudades', () => {
  const geocodificacion = {
    results: [
      {
        id: 2509954,
        name: 'Valencia',
        latitude: 39.47391,
        longitude: -0.37966,
        country: 'España',
        admin1: 'Comunidad Valenciana',
        timezone: 'Europe/Madrid',
      },
      {
        id: 3625549,
        name: 'Valencia',
        latitude: 10.16153,
        longitude: -68.00044,
        country: 'Venezuela',
        admin1: 'Estado Carabobo',
      },
      { id: 1, name: 'Sin coordenadas', country: 'España' },
      { id: 2, name: 'Mónaco', latitude: 43.73, longitude: 7.42, country: 'Mónaco' },
    ],
  }

  it('devuelve las coincidencias con región y país para distinguirlas', async () => {
    const { servicio, urls } = montar({ cuerpos: [geocodificacion] })

    const ciudades = await servicio.buscarCiudades('  valencia ')

    expect(ciudades).toEqual([
      valencia,
      {
        nombre: 'Valencia',
        detalle: 'Estado Carabobo, Venezuela',
        latitud: 10.16153,
        longitud: -68.00044,
      },
      { nombre: 'Mónaco', latitud: 43.73, longitud: 7.42 },
    ])
    const [url] = urls()
    expect(url?.origin).toBe('https://geocoding-api.open-meteo.com')
    expect(url?.searchParams.get('name')).toBe('valencia')
    expect(url?.searchParams.get('language')).toBe('es')
    expect(url?.searchParams.get('count')).toBe('5')
  })

  it('devuelve una lista vacía si no hay ninguna ciudad', async () => {
    const { servicio } = montar({ cuerpos: [{ generationtime_ms: 0.06 }] })

    expect(await servicio.buscarCiudades('zzxxqq')).toEqual([])
  })

  it('no llama a la red con un texto vacío o de una letra', async () => {
    const { servicio, fetch } = montar({ cuerpos: [] })

    expect(await servicio.buscarCiudades('   ')).toEqual([])
    expect(await servicio.buscarCiudades('a')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('da un error sin red si la búsqueda no sale', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'))
    const servicio = crearServicioTiempo({ fetch, almacen: null })

    await expect(servicio.buscarCiudades('Madrid')).rejects.toMatchObject({ tipo: 'sin-red' })
  })
})
