import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ErrorTiempo,
  type AlmacenSitio,
  type Sitio,
  type SitioRecordado,
  type TiempoHoy as Datos,
} from '../tiempo/index.ts'
import { TiempoHoy } from './TiempoHoy.tsx'

const valenciaES: Sitio = {
  nombre: 'Valencia',
  detalle: 'Comunidad Valenciana, España',
  latitud: 39.47,
  longitud: -0.38,
}
const valenciaVE: Sitio = {
  nombre: 'Valencia',
  detalle: 'Estado Carabobo, Venezuela',
  latitud: 10.16,
  longitud: -68,
}

function datos(sitio: Sitio): Datos {
  return {
    sitio,
    zonaHoraria: 'Europe/Madrid',
    fecha: '2026-11-02',
    hora: '2026-11-02T21:00',
    temperatura: { actual: -0.3, minima: -2, maxima: 8 },
    sensacion: { actual: -3, minima: -5, maxima: 6 },
    lluvia: { probabilidad: 80, cantidad: 3.25 },
    viento: { actual: 12, maximo: 20 },
    codigo: 61,
    clima: { termico: 'frio', precipitacion: 'lluvia', viento: false },
    resumen: 'frío y lluvia',
  }
}

function almacen(
  inicial: SitioRecordado | null = null,
): AlmacenSitio & { guardado: SitioRecordado | null } {
  return {
    guardado: inicial,
    leer() {
      return this.guardado
    },
    guardar(recordado) {
      this.guardado = recordado
    },
  }
}

const miUbicacion: Sitio = { nombre: 'Tu ubicación', latitud: 40.42, longitud: -3.7 }

describe('TiempoHoy', () => {
  it('deja elegir entre varias ciudades con el mismo nombre y recuerda la elegida', async () => {
    const usuario = userEvent.setup()
    const buscar = vi.fn(() => Promise.resolve([valenciaES, valenciaVE]))
    const consultar = vi.fn((sitio: Sitio) => Promise.resolve(datos(sitio)))
    const recordado = almacen()
    render(<TiempoHoy buscar={buscar} consultar={consultar} almacenSitio={recordado} />)

    await usuario.type(screen.getByLabelText('O escribe tu ciudad'), 'Valencia{Enter}')
    await usuario.click(await screen.findByRole('button', { name: /Venezuela/ }))

    expect(buscar).toHaveBeenCalledWith('Valencia')
    expect(consultar).toHaveBeenCalledWith(valenciaVE)
    expect(await screen.findByText('frío y lluvia')).toBeInTheDocument()
    expect(screen.getByText('0 °C (sensación -3 °C)')).toBeInTheDocument()
    expect(screen.getByText('80 % · 3,3 mm')).toBeInTheDocument()
    expect(recordado.guardado).toEqual({ tipo: 'ciudad', sitio: valenciaVE })
  })

  it('avisa si la ciudad no existe', async () => {
    const usuario = userEvent.setup()
    render(
      <TiempoHoy buscar={() => Promise.resolve([])} consultar={vi.fn()} almacenSitio={almacen()} />,
    )

    await usuario.type(screen.getByLabelText('O escribe tu ciudad'), 'zzxxqq{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No encuentro «zzxxqq». Prueba con otro nombre.',
    )
  })

  it('explica que escriba la ciudad si se deniega la ubicación', async () => {
    const usuario = userEvent.setup()
    const ubicar = () =>
      Promise.reject(new ErrorTiempo('permiso-denegado', 'No tengo permiso para ver tu ubicación.'))
    render(<TiempoHoy ubicar={ubicar} consultar={vi.fn()} almacenSitio={almacen()} />)

    await usuario.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tengo permiso para ver tu ubicación.',
    )
    expect(screen.getByLabelText('O escribe tu ciudad')).toBeInTheDocument()
  })

  it('carga sola el último sitio elegido', async () => {
    const consultar = vi.fn((sitio: Sitio) => Promise.resolve(datos(sitio)))
    render(
      <TiempoHoy
        consultar={consultar}
        almacenSitio={almacen({ tipo: 'ciudad', sitio: valenciaES })}
      />,
    )

    expect(await screen.findByText('frío y lluvia')).toBeInTheDocument()
    expect(consultar).toHaveBeenCalledWith(valenciaES)
    expect(screen.queryByLabelText('O escribe tu ciudad')).not.toBeInTheDocument()
  })

  it('vuelve a pedir el sitio si falla la red al cargar el último', async () => {
    const consultar = () => Promise.reject(new ErrorTiempo('sin-red', 'Sin conexión.'))
    render(
      <TiempoHoy
        consultar={consultar}
        almacenSitio={almacen({ tipo: 'ciudad', sitio: valenciaES })}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión.')
    expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeInTheDocument()
  })

  it('de la ubicación recuerda que se usa, no las coordenadas, y la vuelve a pedir', async () => {
    const usuario = userEvent.setup()
    const ubicar = vi.fn(() => Promise.resolve(miUbicacion))
    const consultar = vi.fn((sitio: Sitio) => Promise.resolve(datos(sitio)))
    const recordado = almacen()
    render(<TiempoHoy ubicar={ubicar} consultar={consultar} almacenSitio={recordado} />)

    await usuario.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

    expect(await screen.findByText('frío y lluvia')).toBeInTheDocument()
    expect(recordado.guardado).toEqual({ tipo: 'ubicacion' })
  })

  it('al abrir con la ubicación recordada pide la posición de nuevo', async () => {
    const ubicar = vi.fn(() => Promise.resolve(miUbicacion))
    const consultar = vi.fn((sitio: Sitio) => Promise.resolve(datos(sitio)))
    render(
      <TiempoHoy
        ubicar={ubicar}
        consultar={consultar}
        almacenSitio={almacen({ tipo: 'ubicacion' })}
      />,
    )

    expect(await screen.findByText('frío y lluvia')).toBeInTheDocument()
    expect(ubicar).toHaveBeenCalled()
    expect(consultar).toHaveBeenCalledWith(miUbicacion)
  })

  it('«Volver a» descarta la búsqueda en curso', async () => {
    const usuario = userEvent.setup()
    let responder: (sitios: Sitio[]) => void = () => undefined
    const buscar = () =>
      new Promise<Sitio[]>((resolver) => {
        responder = resolver
      })
    const consultar = vi.fn((sitio: Sitio) => Promise.resolve(datos(sitio)))
    render(
      <TiempoHoy
        buscar={buscar}
        consultar={consultar}
        almacenSitio={almacen({ tipo: 'ciudad', sitio: valenciaES })}
      />,
    )
    await usuario.click(await screen.findByRole('button', { name: 'Cambiar sitio' }))

    await usuario.type(screen.getByLabelText('O escribe tu ciudad'), 'Caracas{Enter}')
    await usuario.click(screen.getByRole('button', { name: 'Volver a Valencia' }))
    responder([valenciaVE])
    await new Promise((resolver) => setTimeout(resolver, 0))

    expect(consultar).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Comunidad Valenciana/)).toBeInTheDocument()
    expect(screen.queryByText(/Venezuela/)).not.toBeInTheDocument()
  })
})
