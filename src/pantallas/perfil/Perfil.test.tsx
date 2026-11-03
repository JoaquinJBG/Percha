// La ruta real lee la base al montarse; aquí basta con una vacía.
import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rutas } from '../../app/rutas.tsx'
import { PERFIL_VACIO, type Perfil as DatosPerfil } from '../../datos/modelo.ts'
import { ErrorFoto } from '../../recorte/index.ts'
import { Perfil } from './Perfil.tsx'

const normalizada = (nombre: string) => new Blob([`normalizada ${nombre}`], { type: 'image/jpeg' })
const ficheroFoto = (nombre = 'foto.jpg') => new File(['bytes'], nombre, { type: 'image/jpeg' })

/** Un perfil en memoria que se comporta como `guardarPerfil`: mezcla los campos y limpia la ciudad. */
function montar(inicial: Partial<DatosPerfil> = {}) {
  let guardado: DatosPerfil = { ...PERFIL_VACIO, ...inicial }
  const leer = vi.fn(() => Promise.resolve(guardado))
  const guardar = vi.fn((cambios: Partial<DatosPerfil>) => {
    guardado = { ...guardado, ...cambios }
    guardado.ciudad = guardado.ciudad.trim()
    return Promise.resolve(guardado)
  })
  const normalizar = vi.fn((foto: Blob) =>
    Promise.resolve(normalizada(foto instanceof File ? foto.name : 'blob')),
  )
  render(<Perfil leer={leer} guardar={guardar} normalizar={normalizar} />)
  return { usuario: userEvent.setup(), leer, guardar, normalizar, guardado: () => guardado }
}

const tarjeta = (nombre: 'Cuerpo entero' | 'Cara') => screen.getByRole('listitem', { name: nombre })

beforeEach(() => {
  let creadas = 0
  URL.createObjectURL = vi.fn(() => `blob:prueba-${String(++creadas)}`)
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Perfil', () => {
  it('tiene su ruta en la app', async () => {
    const router = createMemoryRouter(rutas, { initialEntries: ['/perfil'] })
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(await screen.findByRole('listitem', { name: 'Cuerpo entero' })).toBeInTheDocument()
  })

  it('avisa de la privacidad y da consejos para el probador', async () => {
    montar()

    expect(await screen.findByText('Tus fotos no salen del móvil')).toBeInTheDocument()
    expect(screen.getByText(/Solo salen cuando tú las compartes con Gemini/)).toBeInTheDocument()
    expect(screen.getByText('Fondo liso, sin gente ni muebles detrás.')).toBeInTheDocument()
  })

  it('enseña lo que ya está guardado', async () => {
    montar({
      fotoCara: normalizada('cara'),
      ciudad: 'Valencia',
      estilosFavoritos: ['boho'],
    })

    expect(
      within(await screen.findByRole('listitem', { name: 'Cara' })).getByRole('img'),
    ).toBeInTheDocument()
    expect(within(tarjeta('Cuerpo entero')).getByText('Sin foto')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tu ciudad' })).toHaveValue('Valencia')
    expect(screen.getByRole('button', { name: 'boho' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'casual' })).toHaveAttribute('aria-pressed', 'false')
  })

  describe('fotos', () => {
    it('guarda la foto de cuerpo normalizada', async () => {
      const { usuario, normalizar, guardar } = montar()
      const fichero = ficheroFoto('cuerpo.jpg')

      await usuario.upload(
        within(await screen.findByRole('listitem', { name: 'Cuerpo entero' })).getByLabelText(
          'Galería',
        ),
        fichero,
      )

      expect(await screen.findByText('Foto de cuerpo entero guardada.')).toBeInTheDocument()
      expect(normalizar).toHaveBeenCalledWith(fichero)
      expect(guardar).toHaveBeenCalledWith({ fotoCuerpo: normalizada('cuerpo.jpg') })
      expect(within(tarjeta('Cuerpo entero')).getByRole('img')).toBeInTheDocument()
      expect(within(tarjeta('Cara')).getByText('Sin foto')).toBeInTheDocument()
    })

    it('la cámara abre la frontal para la cara y la trasera para el cuerpo', async () => {
      montar()

      const cara = within(await screen.findByRole('listitem', { name: 'Cara' }))
      expect(cara.getByLabelText('Cámara')).toHaveAttribute('capture', 'user')
      expect(within(tarjeta('Cuerpo entero')).getByLabelText('Cámara')).toHaveAttribute(
        'capture',
        'environment',
      )
    })

    it('cambia una foto que ya había', async () => {
      const { usuario, guardar, guardado } = montar({ fotoCara: normalizada('vieja') })

      await usuario.upload(
        within(await screen.findByRole('listitem', { name: 'Cara' })).getByLabelText('Cámara'),
        ficheroFoto('nueva.jpg'),
      )

      expect(await screen.findByText('Foto de cara guardada.')).toBeInTheDocument()
      expect(guardar).toHaveBeenCalledWith({ fotoCara: normalizada('nueva.jpg') })
      expect(guardado().fotoCara).toEqual(normalizada('nueva.jpg'))
    })

    it('si la foto no se puede abrir, lo dice y no guarda nada', async () => {
      const { usuario, normalizar, guardar } = montar()
      normalizar.mockRejectedValueOnce(new ErrorFoto('No se pudo abrir la foto. Prueba con otra.'))

      await usuario.upload(
        within(await screen.findByRole('listitem', { name: 'Cara' })).getByLabelText('Galería'),
        ficheroFoto(),
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se pudo abrir la foto. Prueba con otra.',
      )
      expect(guardar).not.toHaveBeenCalled()
      expect(within(tarjeta('Cara')).getByText('Sin foto')).toBeInTheDocument()
    })

    it('si no se puede guardar, lo dice y deja la que había', async () => {
      const { usuario, guardar } = montar({ fotoCara: normalizada('vieja') })
      guardar.mockRejectedValueOnce(new Error('cuota llena'))

      await usuario.upload(
        within(await screen.findByRole('listitem', { name: 'Cara' })).getByLabelText('Galería'),
        ficheroFoto(),
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se ha podido guardar la foto de cara.',
      )
      expect(within(tarjeta('Cara')).getByRole('img')).toBeInTheDocument()
    })

    it('borra una foto tras confirmarlo, y cancelar no borra', async () => {
      const { usuario, guardar, guardado } = montar({
        fotoCara: normalizada('cara'),
        fotoCuerpo: normalizada('cuerpo'),
      })
      const cara = within(await screen.findByRole('listitem', { name: 'Cara' }))

      await usuario.click(cara.getByRole('button', { name: 'Borrar' }))
      expect(cara.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
      await usuario.click(cara.getByRole('button', { name: 'Cancelar' }))
      expect(guardar).not.toHaveBeenCalled()

      await usuario.click(cara.getByRole('button', { name: 'Borrar' }))
      await usuario.click(cara.getByRole('button', { name: 'Sí, borrar' }))

      expect(await screen.findByText('Foto de cara borrada.')).toBeInTheDocument()
      expect(guardar).toHaveBeenCalledWith({ fotoCara: null })
      expect(guardado()).toMatchObject({ fotoCara: null, fotoCuerpo: normalizada('cuerpo') })
      expect(cara.getByText('Sin foto')).toBeInTheDocument()
      expect(cara.queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
      expect(within(tarjeta('Cuerpo entero')).getByRole('img')).toBeInTheDocument()
    })
  })

  describe('ciudad', () => {
    it('guarda la ciudad sin espacios sobrantes', async () => {
      const { usuario, guardar } = montar()
      const campo = await screen.findByRole('textbox', { name: 'Tu ciudad' })
      const boton = screen.getByRole('button', { name: 'Guardar ciudad' })
      expect(boton).toBeDisabled()

      await usuario.type(campo, '  Bilbao ')
      await usuario.click(boton)

      expect(await screen.findByText('Ciudad guardada.')).toBeInTheDocument()
      expect(guardar).toHaveBeenCalledWith({ ciudad: '  Bilbao ' })
      expect(campo).toHaveValue('Bilbao')
      expect(boton).toBeDisabled()
    })

    it('deja quitarla', async () => {
      const { usuario, guardado } = montar({ ciudad: 'Valencia' })

      await usuario.clear(await screen.findByRole('textbox', { name: 'Tu ciudad' }))
      await usuario.click(screen.getByRole('button', { name: 'Guardar ciudad' }))

      expect(await screen.findByText('Ciudad quitada.')).toBeInTheDocument()
      expect(guardado().ciudad).toBe('')
    })
  })

  describe('estilos favoritos', () => {
    it('marca y desmarca estilos, en el orden de la lista', async () => {
      const { usuario, guardar, guardado } = montar({ estilosFavoritos: ['boho'] })

      await usuario.click(await screen.findByRole('button', { name: 'casual' }))
      expect(screen.getByRole('button', { name: 'casual' })).toHaveAttribute('aria-pressed', 'true')
      expect(guardar).toHaveBeenLastCalledWith({ estilosFavoritos: ['casual', 'boho'] })

      await usuario.click(screen.getByRole('button', { name: 'boho' }))
      expect(screen.getByRole('button', { name: 'boho' })).toHaveAttribute('aria-pressed', 'false')
      expect(guardar).toHaveBeenLastCalledWith({ estilosFavoritos: ['casual'] })
      expect(guardado().estilosFavoritos).toEqual(['casual'])
    })

    it('si no se pueden guardar, lo dice y vuelve a lo guardado', async () => {
      const { usuario, guardar } = montar()
      guardar.mockRejectedValueOnce(new Error('sin espacio'))

      await usuario.click(await screen.findByRole('button', { name: 'casual' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se han podido guardar los estilos.',
      )
      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: 'casual' })).toHaveAttribute(
          'aria-pressed',
          'false',
        )
      })
    })
  })

  it('si no se puede leer el perfil, lo dice', async () => {
    render(<Perfil leer={() => Promise.reject(new Error('rota'))} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido leer tu perfil.')
  })
})
