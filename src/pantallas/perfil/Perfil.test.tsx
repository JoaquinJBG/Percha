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
function montar(inicial: Partial<DatosPerfil> = {}, interiorInicial: Blob | null = null) {
  let guardado: DatosPerfil = { ...PERFIL_VACIO, ...inicial }
  // La foto en ropa interior va aparte del perfil (D21).
  let interior = interiorInicial
  const guardarInterior = vi.fn((foto: Blob | null) => {
    interior = foto
    return Promise.resolve(interior)
  })
  const leer = vi.fn(() => Promise.resolve(guardado))
  const guardar = vi.fn((cambios: Partial<DatosPerfil>) => {
    guardado = { ...guardado, ...cambios }
    guardado.ciudad = guardado.ciudad.trim()
    return Promise.resolve(guardado)
  })
  const normalizar = vi.fn((foto: Blob) =>
    Promise.resolve(normalizada(foto instanceof File ? foto.name : 'blob')),
  )
  render(
    <Perfil
      leer={leer}
      guardar={guardar}
      normalizar={normalizar}
      leerInterior={() => Promise.resolve(interior)}
      guardarInterior={guardarInterior}
    />,
  )
  return {
    usuario: userEvent.setup({ delay: null }),
    leer,
    guardar,
    normalizar,
    guardarInterior,
    guardado: () => guardado,
    interior: () => interior,
  }
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
  })

  it('explica cómo hacer la foto de referencia, con un dibujo de la pose', async () => {
    const { usuario } = montar()

    await usuario.click(await screen.findByText('Cómo hacer la foto de referencia'))

    expect(screen.getByRole('img', { name: /de pie y de frente/i })).toBeInTheDocument()
    expect(
      screen.getByText('Camiseta de tirantes ajustada y leggings o mallas de correr, lisos.'),
    ).toBeVisible()
    expect(screen.getByText('Pies separados al ancho de los hombros.')).toBeVisible()
    expect(screen.getByText('Móvil en vertical, a la altura del pecho.')).toBeVisible()
    expect(screen.getByText(/A unos 3 metros/)).toBeVisible()
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

  describe('foto en ropa interior', () => {
    it('explica que es solo para el PC y que nunca va a Gemini ni en la copia', async () => {
      montar()

      expect(
        await screen.findByText('Opcional y solo para el probador de tu PC'),
      ).toBeInTheDocument()
      expect(screen.getByText(/Nunca se manda a Gemini ni a ninguna nube/)).toBeInTheDocument()
      expect(screen.getByText(/no va en la copia del armario/)).toBeInTheDocument()
    })

    it('se guarda aparte del perfil y se borra con un toque y su confirmación', async () => {
      const { usuario, guardar, guardarInterior, interior } = montar()
      const tarjetaInterior = within(await screen.findByRole('listitem', { name: 'Ropa interior' }))

      await usuario.upload(tarjetaInterior.getByLabelText('Galería'), ficheroFoto('interior.jpg'))

      expect(await screen.findByText('Foto en ropa interior guardada.')).toBeInTheDocument()
      expect(guardarInterior).toHaveBeenCalledWith(normalizada('interior.jpg'))
      expect(guardar).not.toHaveBeenCalled()

      await usuario.click(tarjetaInterior.getByRole('button', { name: 'Borrar' }))
      await usuario.click(tarjetaInterior.getByRole('button', { name: 'Sí, borrar' }))

      expect(await screen.findByText('Foto en ropa interior borrada.')).toBeInTheDocument()
      expect(interior()).toBeNull()
      expect(tarjetaInterior.getByText('Sin foto')).toBeInTheDocument()
      expect(guardar).not.toHaveBeenCalled()
    })

    it('enseña la que ya está guardada', async () => {
      montar({}, normalizada('interior'))

      expect(
        within(await screen.findByRole('listitem', { name: 'Ropa interior' })).getByRole('img'),
      ).toBeInTheDocument()
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

  describe('a la vez y con fallos', () => {
    it('cada foto tiene su aviso: el error de una no lo tapa el «guardada» de la otra', async () => {
      const { usuario, guardar } = montar()
      guardar.mockRejectedValueOnce(new Error('cuota llena'))

      await usuario.upload(
        within(await screen.findByRole('listitem', { name: 'Cuerpo entero' })).getByLabelText(
          'Galería',
        ),
        ficheroFoto('cuerpo.jpg'),
      )
      await usuario.upload(
        within(tarjeta('Cara')).getByLabelText('Galería'),
        ficheroFoto('cara.jpg'),
      )

      expect(await screen.findByText('Foto de cara guardada.')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se ha podido guardar la foto de cuerpo entero.',
      )
      expect(within(tarjeta('Cuerpo entero')).getByText('Sin foto')).toBeInTheDocument()
    })

    it('si falla un error raro al abrir la foto, da un mensaje genérico', async () => {
      const { usuario, normalizar, guardar } = montar()
      normalizar.mockRejectedValueOnce(new TypeError('raro'))

      await usuario.upload(
        within(await screen.findByRole('listitem', { name: 'Cara' })).getByLabelText('Galería'),
        ficheroFoto(),
      )

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo abrir la foto.')
      expect(guardar).not.toHaveBeenCalled()
    })

    it('si no se puede borrar, lo dice y la foto sigue', async () => {
      const { usuario, guardar } = montar({ fotoCara: normalizada('cara') })
      guardar.mockRejectedValueOnce(new Error('rota'))
      const cara = within(await screen.findByRole('listitem', { name: 'Cara' }))

      await usuario.click(cara.getByRole('button', { name: 'Borrar' }))
      await usuario.click(cara.getByRole('button', { name: 'Sí, borrar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se ha podido borrar la foto de cara.',
      )
      expect(cara.getByRole('img')).toBeInTheDocument()
    })

    it('no deja escribir la ciudad mientras se guarda', async () => {
      const { usuario, guardar } = montar()
      let terminar: () => void = () => undefined
      guardar.mockImplementationOnce(
        (cambios) =>
          new Promise((resolver) => {
            terminar = () => {
              resolver({ ...PERFIL_VACIO, ciudad: (cambios.ciudad ?? '').trim() })
            }
          }),
      )
      const campo = await screen.findByRole('textbox', { name: 'Tu ciudad' })

      await usuario.type(campo, 'Valencia')
      await usuario.click(screen.getByRole('button', { name: 'Guardar ciudad' }))

      expect(campo).toBeDisabled()
      terminar()
      expect(await screen.findByText('Ciudad guardada.')).toBeInTheDocument()
      expect(campo).toBeEnabled()
      expect(campo).toHaveValue('Valencia')
    })

    it('si falla un estilo pero ya has tocado otro, no deshace el segundo', async () => {
      const { usuario, guardar, leer } = montar()
      let fallar: () => void = () => undefined
      guardar.mockImplementationOnce(
        () =>
          new Promise((_, rechazar) => {
            fallar = () => {
              rechazar(new Error('lenta y rota'))
            }
          }),
      )

      await usuario.click(await screen.findByRole('button', { name: 'casual' }))
      await usuario.click(screen.getByRole('button', { name: 'boho' }))
      fallar()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se han podido guardar los estilos.',
      )
      expect(leer).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'boho' })).toHaveAttribute('aria-pressed', 'true')
      expect(guardar).toHaveBeenLastCalledWith({ estilosFavoritos: ['casual', 'boho'] })
    })
  })

  it('si no se puede leer el perfil, lo dice', async () => {
    render(<Perfil leer={() => Promise.reject(new Error('rota'))} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido leer tu perfil.')
  })
})
