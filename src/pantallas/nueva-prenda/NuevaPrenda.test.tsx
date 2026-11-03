import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rutas } from '../../app/rutas.tsx'
import type { NuevaPrenda as DatosPrenda } from '../../datos/modelo.ts'
import { ErrorFoto, ErrorRecorte, type OpcionesRecorte } from '../../recorte/index.ts'
import { NuevaPrenda } from './NuevaPrenda.tsx'

interface Llamada {
  foto: Blob
  opciones: OpcionesRecorte | undefined
  resolver: (png: Blob) => void
  rechazar: (error: Error) => void
}

function recortadorControlado() {
  const llamadas: Llamada[] = []
  const recortar = vi.fn(
    (foto: Blob, opciones?: OpcionesRecorte) =>
      new Promise<Blob>((resolver, rechazar) => {
        llamadas.push({ foto, opciones, resolver, rechazar })
      }),
  )
  return { recortar, llamadas }
}

const normalizada = (nombre: string) => new Blob([`normalizada ${nombre}`], { type: 'image/jpeg' })
const png = new Blob(['png'], { type: 'image/png' })
const ficheroFoto = (nombre = 'foto.jpg') => new File(['bytes'], nombre, { type: 'image/jpeg' })

function montar() {
  const { recortar, llamadas } = recortadorControlado()
  const normalizar = vi.fn((foto: Blob) =>
    Promise.resolve(normalizada(foto instanceof File ? foto.name : 'blob')),
  )
  const guardar = vi.fn<(prenda: DatosPrenda) => Promise<void>>(() => Promise.resolve())
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Armario</h1> },
      {
        path: '/prendas/nueva',
        element: <NuevaPrenda recortar={recortar} normalizar={normalizar} guardar={guardar} />,
      },
    ],
    { initialEntries: ['/prendas/nueva'] },
  )
  render(<RouterProvider router={router} />)
  return { usuario: userEvent.setup(), recortar, llamadas, normalizar, guardar, router }
}

function llamada(llamadas: Llamada[], indice: number): Llamada {
  const encontrada = llamadas[indice]
  if (!encontrada) throw new Error(`No hay llamada ${String(indice)} al recortador`)
  return encontrada
}

const botonGuardar = () => screen.getByRole('button', { name: 'Guardar' })

let creadas: number
const revocar = vi.fn<(url: string) => void>()
beforeEach(() => {
  creadas = 0
  URL.createObjectURL = vi.fn(() => `blob:prueba-${String(++creadas)}`)
  revocar.mockReset()
  URL.revokeObjectURL = revocar
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Nueva prenda', () => {
  it('tiene su ruta en la app', () => {
    const router = createMemoryRouter(rutas, { initialEntries: ['/prendas/nueva'] })
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Nueva prenda' })).toBeInTheDocument()
  })

  it('recorta la foto, deja elegir la categoría y guarda la prenda a mano', async () => {
    const { usuario, llamadas, normalizar, guardar } = montar()
    expect(botonGuardar()).toBeDisabled()
    expect(screen.getByText('Añade al menos una foto.')).toBeInTheDocument()

    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto('camiseta.jpg'))

    expect(normalizar).toHaveBeenCalledOnce()
    expect(await screen.findByText('Quitando el fondo…')).toBeInTheDocument()
    expect(await llamada(llamadas, 0).foto.text()).toBe('normalizada camiseta.jpg')
    expect(screen.getByRole('img', { name: 'Foto 1' })).toBeInTheDocument()

    llamada(llamadas, 0).resolver(png)
    expect(await screen.findByText('Fondo quitado')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Foto 1, sin fondo' })).toBeInTheDocument()
    expect(botonGuardar()).toBeDisabled()
    expect(screen.getByText('Elige la categoría.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('radio', { name: 'Calzado' }))
    await usuario.click(botonGuardar())

    expect(await screen.findByText('Prenda guardada en el armario.')).toBeInTheDocument()
    expect(guardar).toHaveBeenCalledOnce()
    const prenda = guardar.mock.calls[0]?.[0]
    expect(prenda).toMatchObject({
      categoria: 'calzado',
      etiquetadaPor: 'manual',
      subcategoria: '',
      colores: [],
      estilos: [],
      ocasiones: [],
      temporadas: [],
      notas: '',
    })
    expect(prenda?.fotos).toHaveLength(1)
    expect(await prenda?.fotos[0]?.original.text()).toBe('normalizada camiseta.jpg')
    expect(prenda?.fotos[0]?.recortada).toBe(png)
  })

  it('enseña el progreso de la carga del modelo', async () => {
    const { usuario, llamadas } = montar()
    await usuario.upload(screen.getByLabelText('Cámara'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')

    llamada(llamadas, 0).opciones?.alProgresar?.({ cargados: 10e6, total: 88e6 })

    expect(await screen.findByText('Cargando el recortador: 10 de 88 MB')).toBeInTheDocument()
    expect(screen.getByText('Solo la primera vez. Mejor con wifi.')).toBeInTheDocument()
  })

  it('si el recorte falla, guarda la original y deja reintentarlo', async () => {
    const { usuario, recortar, llamadas, guardar } = montar()
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')

    llamada(llamadas, 0).rechazar(new ErrorRecorte('sin red'))

    expect(
      await screen.findByText('No se pudo quitar el fondo. Se guardará sin recortar.'),
    ).toBeInTheDocument()
    await usuario.click(screen.getByRole('radio', { name: 'Parte de arriba' }))
    expect(botonGuardar()).toBeEnabled()

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(recortar).toHaveBeenCalledTimes(2)
    expect(botonGuardar()).toBeDisabled()
    llamada(llamadas, 1).rechazar(new ErrorRecorte('otra vez'))
    await screen.findByText('No se pudo quitar el fondo. Se guardará sin recortar.')

    await usuario.click(botonGuardar())
    await screen.findByText('Prenda guardada en el armario.')
    const prenda = guardar.mock.calls[0]?.[0]
    expect(prenda?.categoria).toBe('superior')
    expect(prenda?.fotos[0]?.recortada).toBeNull()
  })

  it('«Usar la original» guarda la foto sin recortar aunque el recorte saliera', async () => {
    const { usuario, llamadas, guardar } = montar()
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')
    llamada(llamadas, 0).resolver(png)
    await screen.findByText('Fondo quitado')

    await usuario.click(screen.getByRole('checkbox', { name: 'Usar la original' }))
    expect(screen.getByRole('img', { name: 'Foto 1' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('radio', { name: 'Parte de abajo' }))
    await usuario.click(botonGuardar())

    await screen.findByText('Prenda guardada en el armario.')
    expect(guardar.mock.calls[0]?.[0].fotos[0]?.recortada).toBeNull()
  })

  it('con el recorte en marcha no deja guardar, salvo marcando «Usar la original»', async () => {
    const { usuario, llamadas, guardar } = montar()
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')
    await usuario.click(screen.getByRole('radio', { name: 'Accesorio' }))

    expect(botonGuardar()).toBeDisabled()
    expect(
      screen.getByText('Espera a que termine el recorte o marca «Usar la original».'),
    ).toBeInTheDocument()

    await usuario.click(screen.getByRole('checkbox', { name: 'Usar la original' }))
    expect(screen.getByText('Se guardará sin recortar')).toBeInTheDocument()
    expect(botonGuardar()).toBeEnabled()

    // Aunque el recorte llegue después, se guarda la original.
    llamada(llamadas, 0).resolver(png)
    await screen.findByRole('img', { name: 'Foto 1' })
    await usuario.click(botonGuardar())
    await screen.findByText('Prenda guardada en el armario.')
    expect(guardar.mock.calls[0]?.[0].fotos[0]?.recortada).toBeNull()
  })

  it('mientras guarda no deja cancelar', async () => {
    const { usuario, llamadas, guardar } = montar()
    let terminar: () => void = () => undefined
    guardar.mockReturnValueOnce(
      new Promise<void>((resolver) => {
        terminar = resolver
      }),
    )
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')
    llamada(llamadas, 0).resolver(png)
    await usuario.click(screen.getByRole('radio', { name: 'Calzado' }))

    await usuario.click(botonGuardar())

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Cancelar' })).not.toBeInTheDocument()
    terminar()
    expect(await screen.findByText('Prenda guardada en el armario.')).toBeInTheDocument()
  })

  it('admite dos fotos como mucho', async () => {
    const { usuario, normalizar, llamadas, guardar } = montar()

    await usuario.upload(screen.getByLabelText('Galería'), [
      ficheroFoto('1.jpg'),
      ficheroFoto('2.jpg'),
      ficheroFoto('3.jpg'),
    ])

    expect(normalizar).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('alert')).toHaveTextContent('Como mucho 2 fotos por prenda.')
    expect(screen.queryByLabelText('Galería')).not.toBeInTheDocument()

    await screen.findAllByText('Quitando el fondo…')
    llamada(llamadas, 0).resolver(png)
    llamada(llamadas, 1).resolver(png)
    await usuario.click(screen.getByRole('radio', { name: 'Vestido' }))
    await usuario.click(botonGuardar())
    await screen.findByText('Prenda guardada en el armario.')
    expect(guardar.mock.calls[0]?.[0].fotos).toHaveLength(2)
  })

  it('quitar una foto la saca de la prenda, libera su URL y deja añadir otra', async () => {
    const { usuario, llamadas } = montar()
    await usuario.upload(screen.getByLabelText('Galería'), [
      ficheroFoto('1.jpg'),
      ficheroFoto('2.jpg'),
    ])
    await screen.findAllByText('Quitando el fondo…')

    await usuario.click(screen.getByRole('button', { name: 'Quitar la foto 1' }))

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(revocar).toHaveBeenCalledWith('blob:prueba-1')
    expect(screen.getByText('Otra foto (opcional)')).toBeInTheDocument()

    // El recorte de la foto quitada llega tarde: no crea una URL nueva.
    const antes = creadas
    llamada(llamadas, 0).resolver(png)
    await new Promise((listo) => setTimeout(listo, 0))
    expect(creadas).toBe(antes)
  })

  it('avisa si la foto no se puede abrir', async () => {
    const { usuario, normalizar, recortar } = montar()
    normalizar.mockRejectedValueOnce(new ErrorFoto('No se pudo abrir la foto. Prueba con otra.'))

    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo abrir la foto. Prueba con otra.',
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(recortar).not.toHaveBeenCalled()
  })

  it('avisa si no se puede guardar y deja reintentarlo', async () => {
    const { usuario, llamadas, guardar } = montar()
    guardar.mockRejectedValueOnce(new Error('cuota'))
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')
    llamada(llamadas, 0).resolver(png)
    await usuario.click(screen.getByRole('radio', { name: 'Abrigo' }))

    await usuario.click(botonGuardar())
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la prenda.')

    await usuario.click(botonGuardar())
    expect(await screen.findByText('Prenda guardada en el armario.')).toBeInTheDocument()
    expect(guardar).toHaveBeenCalledTimes(2)
  })

  it('«Añadir otra» deja la pantalla vacía para la siguiente prenda', async () => {
    const { usuario, llamadas } = montar()
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')
    llamada(llamadas, 0).resolver(png)
    await usuario.click(screen.getByRole('radio', { name: 'Calzado' }))
    await usuario.click(botonGuardar())

    await usuario.click(await screen.findByRole('button', { name: 'Añadir otra' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Calzado' })).not.toBeChecked()
    expect(botonGuardar()).toBeDisabled()
  })

  it('cancelar vuelve al armario sin guardar y libera las fotos', async () => {
    const { usuario, llamadas, guardar, router } = montar()
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')

    await usuario.click(screen.getByRole('link', { name: 'Cancelar' }))

    expect(router.state.location.pathname).toBe('/')
    expect(revocar).toHaveBeenCalledWith('blob:prueba-1')
    const antes = creadas
    llamada(llamadas, 0).resolver(png)
    await new Promise((listo) => setTimeout(listo, 0))
    expect(creadas).toBe(antes)
    expect(guardar).not.toHaveBeenCalled()
  })
})
