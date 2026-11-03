import 'fake-indexeddb/auto'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rutas } from '../../app/rutas.tsx'
import type { NuevaPrenda as DatosPrenda, EtiquetasPrenda } from '../../datos/modelo.ts'
import {
  crearProveedorFalso,
  ErrorIA,
  ETIQUETAS_DE_PRUEBA,
  type OpcionesPeticion,
  type PrendaAEtiquetar,
  type ProveedorIA,
} from '../../ia/index.ts'
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

/** Proveedor cuyas respuestas decide el test, una a una. */
function proveedorControlado() {
  const peticiones: {
    prendas: PrendaAEtiquetar[]
    opciones: OpcionesPeticion | undefined
    resolver: (etiquetas: (EtiquetasPrenda | null)[]) => void
    rechazar: (error: unknown) => void
  }[] = []
  const proveedor: ProveedorIA = {
    etiquetarPrendas: (prendas, opciones) =>
      new Promise((resolver, rechazar) => {
        peticiones.push({ prendas, opciones, resolver, rechazar })
      }),
    comprobarClave: () => Promise.resolve(),
  }
  return { proveedor, peticiones }
}

const normalizada = (nombre: string) => new Blob([`normalizada ${nombre}`], { type: 'image/jpeg' })
const png = new Blob(['png'], { type: 'image/png' })
const ficheroFoto = (nombre = 'foto.jpg') => new File(['bytes'], nombre, { type: 'image/jpeg' })

/** Sin `proveedor`, como si no hubiera clave. */
function montar({ proveedor = null }: { proveedor?: ProveedorIA | null } = {}) {
  const { recortar, llamadas } = recortadorControlado()
  const normalizar = vi.fn((foto: Blob) =>
    Promise.resolve(normalizada(foto instanceof File ? foto.name : 'blob')),
  )
  const guardar = vi.fn<(prenda: DatosPrenda) => Promise<void>>(() => Promise.resolve())
  const obtenerProveedor = vi.fn(() => Promise.resolve(proveedor))
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Armario</h1> },
      { path: '/ajustes', element: <h1>Ajustes</h1> },
      {
        path: '/prendas/nueva',
        element: (
          <NuevaPrenda
            recortar={recortar}
            normalizar={normalizar}
            guardar={guardar}
            obtenerProveedor={obtenerProveedor}
          />
        ),
      },
    ],
    { initialEntries: ['/prendas/nueva'] },
  )
  render(<RouterProvider router={router} />)
  return {
    usuario: userEvent.setup(),
    recortar,
    llamadas,
    normalizar,
    guardar,
    obtenerProveedor,
    router,
  }
}

function llamada(llamadas: Llamada[], indice: number): Llamada {
  const encontrada = llamadas[indice]
  if (!encontrada) throw new Error(`No hay llamada ${String(indice)} al recortador`)
  return encontrada
}

const botonSiguiente = () => screen.getByRole('button', { name: 'Siguiente' })
const botonGuardar = () => screen.getByRole('button', { name: 'Guardar' })
const categoria = (nombre: string) =>
  within(screen.getByRole('group', { name: 'Categoría' })).getByRole('radio', { name: nombre })

/** Sube una foto, deja que se recorte y pasa a las etiquetas. */
async function fotoRecortadaYSiguiente(
  usuario: ReturnType<typeof userEvent.setup>,
  llamadas: Llamada[],
) {
  await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
  await screen.findByText('Quitando el fondo…')
  llamada(llamadas, 0).resolver(png)
  await screen.findByText('Fondo quitado')
  await usuario.click(botonSiguiente())
}

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

describe('Nueva prenda: fotos y recorte', () => {
  it('tiene su ruta en la app', () => {
    const router = createMemoryRouter(rutas, { initialEntries: ['/prendas/nueva'] })
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Nueva prenda' })).toBeInTheDocument()
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
    expect(botonSiguiente()).toBeEnabled()

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(recortar).toHaveBeenCalledTimes(2)
    expect(botonSiguiente()).toBeDisabled()
    llamada(llamadas, 1).rechazar(new ErrorRecorte('otra vez'))
    await screen.findByText('No se pudo quitar el fondo. Se guardará sin recortar.')

    await usuario.click(botonSiguiente())
    await usuario.click(categoria('Parte de arriba'))
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
    await usuario.click(botonSiguiente())
    await usuario.click(categoria('Parte de abajo'))
    await usuario.click(botonGuardar())

    await screen.findByText('Prenda guardada en el armario.')
    expect(guardar.mock.calls[0]?.[0].fotos[0]?.recortada).toBeNull()
  })

  it('con el recorte en marcha no deja seguir, salvo marcando «Usar la original»', async () => {
    const { usuario, llamadas, guardar } = montar()
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto())
    await screen.findByText('Quitando el fondo…')

    expect(botonSiguiente()).toBeDisabled()
    expect(
      screen.getByText('Espera a que termine el recorte o marca «Usar la original».'),
    ).toBeInTheDocument()

    await usuario.click(screen.getByRole('checkbox', { name: 'Usar la original' }))
    expect(screen.getByText('Se guardará sin recortar')).toBeInTheDocument()
    expect(botonSiguiente()).toBeEnabled()

    // Aunque el recorte llegue después, se guarda la original.
    llamada(llamadas, 0).resolver(png)
    await screen.findByRole('img', { name: 'Foto 1' })
    await usuario.click(botonSiguiente())
    await usuario.click(categoria('Accesorio'))
    await usuario.click(botonGuardar())
    await screen.findByText('Prenda guardada en el armario.')
    expect(guardar.mock.calls[0]?.[0].fotos[0]?.recortada).toBeNull()
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
    await screen.findAllByText('Fondo quitado')
    await usuario.click(botonSiguiente())
    await usuario.click(categoria('Vestido o mono'))
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

    expect(
      await screen.findByText('No se pudo abrir la foto. Prueba con otra.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(recortar).not.toHaveBeenCalled()
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

describe('Nueva prenda: etiquetas', () => {
  it('con clave, etiqueta con la IA la foto recortada y guarda lo revisado como de la IA', async () => {
    const proveedor = crearProveedorFalso()
    const { usuario, llamadas, guardar } = montar({ proveedor })
    expect(screen.queryByText('Sin clave de Gemini')).not.toBeInTheDocument()

    await fotoRecortadaYSiguiente(usuario, llamadas)

    expect(await screen.findByRole('heading', { name: 'Revisa las etiquetas' })).toBeInTheDocument()
    expect(proveedor.lotes).toHaveLength(1)
    expect(proveedor.lotes[0]?.[0]?.fotos).toEqual([png])
    expect(categoria('Parte de arriba')).toBeChecked()
    expect(screen.getByLabelText('Tipo de prenda')).toHaveValue('camiseta')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Afinar los colores no le quita la etiqueta de la IA.
    await usuario.click(screen.getByRole('checkbox', { name: 'negro' }))
    await usuario.click(botonGuardar())

    await screen.findByText('Prenda guardada en el armario.')
    const prenda = guardar.mock.calls[0]?.[0]
    expect(prenda).toMatchObject({
      ...ETIQUETAS_DE_PRUEBA,
      colores: ['blanco', 'negro'],
      etiquetadaPor: 'ia',
    })
    expect(prenda?.fotos[0]?.recortada).toBe(png)
  })

  it('si se cambia qué prenda es (categoría o tipo), se guarda como etiquetada a mano', async () => {
    const { usuario, llamadas, guardar } = montar({ proveedor: crearProveedorFalso() })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByRole('heading', { name: 'Revisa las etiquetas' })

    await usuario.clear(screen.getByLabelText('Tipo de prenda'))
    await usuario.type(screen.getByLabelText('Tipo de prenda'), 'polo')
    await usuario.click(botonGuardar())

    await screen.findByText('Prenda guardada en el armario.')
    expect(guardar.mock.calls[0]?.[0]).toMatchObject({
      subcategoria: 'polo',
      etiquetadaPor: 'manual',
    })
  })

  it('sin clave lo avisa desde el principio y abre el formulario vacío con el enlace a Ajustes', async () => {
    const { usuario, llamadas, guardar, router } = montar()

    expect(await screen.findByText('Sin clave de Gemini')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Ajustes' })).toBeInTheDocument()

    await fotoRecortadaYSiguiente(usuario, llamadas)

    expect(await screen.findByRole('heading', { name: 'Etiquetas' })).toBeInTheDocument()
    const aviso = screen.getByRole('alert')
    expect(aviso).toHaveTextContent('Falta la clave de Gemini')
    expect(aviso).toHaveTextContent('esta prenda no se guarda')
    expect(within(aviso).queryByRole('button', { name: 'Probar otra vez' })).not.toBeInTheDocument()
    for (const radio of within(screen.getByRole('group', { name: 'Categoría' })).getAllByRole(
      'radio',
    )) {
      expect(radio).not.toBeChecked()
    }

    await usuario.click(categoria('Calzado'))
    await usuario.click(botonGuardar())
    await screen.findByText('Prenda guardada en el armario.')
    expect(guardar.mock.calls[0]?.[0]).toMatchObject({
      categoria: 'calzado',
      subcategoria: '',
      colores: [],
      estilos: [],
      abrigo: 3,
      formalidad: 3,
      etiquetadaPor: 'manual',
    })

    await usuario.click(screen.getByRole('button', { name: 'Añadir otra' }))
    await usuario.click(screen.getByRole('link', { name: 'Ir a Ajustes' }))
    expect(router.state.location.pathname).toBe('/ajustes')
  })

  it('si la IA falla, abre el formulario vacío con el motivo y deja probar otra vez', async () => {
    const { proveedor, peticiones } = proveedorControlado()
    const { usuario, llamadas, guardar } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)

    expect(await screen.findByText('Gemini está mirando la prenda…')).toBeInTheDocument()
    peticiones[0]?.rechazar(new ErrorIA('sin-cupo'))

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('La IA no ha podido etiquetarla')
    expect(aviso).toHaveTextContent('Se ha acabado el cupo gratis de Gemini.')
    expect(within(aviso).queryByRole('link', { name: 'Ir a Ajustes' })).not.toBeInTheDocument()
    expect(categoria('Parte de arriba')).not.toBeChecked()

    await usuario.click(within(aviso).getByRole('button', { name: 'Probar otra vez' }))
    expect(peticiones).toHaveLength(2)
    peticiones[1]?.resolver([{ ...ETIQUETAS_DE_PRUEBA, categoria: 'abrigo' }])

    expect(await screen.findByRole('heading', { name: 'Revisa las etiquetas' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(categoria('Abrigo o chaqueta')).toBeChecked()
    await usuario.click(botonGuardar())
    await screen.findByText('Prenda guardada en el armario.')
    expect(guardar.mock.calls[0]?.[0].etiquetadaPor).toBe('ia')
  })

  it('tras un fallo, volver a las fotos y seguir vuelve a probar con la IA', async () => {
    const { proveedor, peticiones } = proveedorControlado()
    const { usuario, llamadas } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByText('Gemini está mirando la prenda…')
    peticiones[0]?.rechazar(new ErrorIA('sin-red'))
    await screen.findByRole('alert')

    await usuario.click(screen.getByRole('button', { name: 'Cambiar fotos' }))
    await usuario.click(botonSiguiente())

    expect(peticiones).toHaveLength(2)
  })

  it('«Cambiar fotos» mientras etiqueta cancela la petición y vuelve a las fotos', async () => {
    const { proveedor, peticiones } = proveedorControlado()
    const { usuario, llamadas } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByText('Gemini está mirando la prenda…')

    await usuario.click(screen.getByRole('button', { name: 'Cambiar fotos' }))

    expect(peticiones[0]?.opciones?.signal?.aborted).toBe(true)
    expect(screen.getByRole('heading', { name: 'Fotos' })).toHaveFocus()
    expect(screen.getByRole('img', { name: 'Foto 1, sin fondo' })).toBeInTheDocument()
  })

  it('con una clave que no vale, el aviso lleva a Ajustes', async () => {
    const proveedor = crearProveedorFalso({ error: new ErrorIA('clave-mala') })
    const { usuario, llamadas } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Google no acepta esta clave.')
    expect(within(aviso).getByRole('link', { name: 'Ir a Ajustes' })).toBeInTheDocument()
  })

  it('si la IA no da nada válido para la prenda, lo dice como respuesta mala', async () => {
    const { proveedor, peticiones } = proveedorControlado()
    const { usuario, llamadas } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByText('Gemini está mirando la prenda…')

    peticiones[0]?.resolver([null])

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Gemini ha devuelto algo que no se entiende.',
    )
  })

  it('«Etiquetar a mano» no espera a la IA y lo que llegue tarde no pisa el formulario', async () => {
    const { proveedor, peticiones } = proveedorControlado()
    const { usuario, llamadas } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByText('Gemini está mirando la prenda…')

    await usuario.click(screen.getByRole('button', { name: 'Etiquetar a mano' }))

    expect(screen.getByRole('heading', { name: 'Etiquetas' })).toHaveFocus()
    expect(peticiones[0]?.opciones?.signal?.aborted).toBe(true)
    peticiones[0]?.resolver([ETIQUETAS_DE_PRUEBA])
    await new Promise((listo) => setTimeout(listo, 0))
    expect(screen.getByRole('heading', { name: 'Etiquetas' })).toBeInTheDocument()
    expect(categoria('Parte de arriba')).not.toBeChecked()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('volver a las fotos sin cambiarlas no repite la petición ni pierde lo cambiado', async () => {
    const proveedor = crearProveedorFalso()
    const { usuario, llamadas } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByRole('heading', { name: 'Revisa las etiquetas' })
    await usuario.type(screen.getByLabelText('Notas'), 'algodón')

    await usuario.click(screen.getByRole('button', { name: 'Cambiar fotos' }))
    expect(screen.getByRole('heading', { name: 'Fotos' })).toHaveFocus()
    await usuario.click(botonSiguiente())

    expect(proveedor.lotes).toHaveLength(1)
    expect(screen.getByLabelText('Notas')).toHaveValue('algodón')

    // Con otra foto, sí vuelve a preguntar.
    await usuario.click(screen.getByRole('button', { name: 'Cambiar fotos' }))
    await usuario.upload(screen.getByLabelText('Galería'), ficheroFoto('2.jpg'))
    await screen.findByText('Quitando el fondo…')
    llamada(llamadas, 1).resolver(png)
    await screen.findAllByText('Fondo quitado')
    await usuario.click(botonSiguiente())
    await screen.findByRole('heading', { name: 'Revisa las etiquetas' })
    expect(proveedor.lotes).toHaveLength(2)
    expect(proveedor.lotes[1]?.[0]?.fotos).toHaveLength(2)
  })

  it('salir mientras etiqueta cancela la petición', async () => {
    const { proveedor, peticiones } = proveedorControlado()
    const { usuario, llamadas, router } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByText('Gemini está mirando la prenda…')

    await act(() => router.navigate('/'))

    expect(peticiones[0]?.opciones?.signal?.aborted).toBe(true)
  })

  it('mientras guarda no deja cancelar ni volver a las fotos', async () => {
    const { usuario, llamadas, guardar } = montar({ proveedor: crearProveedorFalso() })
    let terminar: () => void = () => undefined
    guardar.mockReturnValueOnce(
      new Promise<void>((resolver) => {
        terminar = resolver
      }),
    )
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByRole('heading', { name: 'Revisa las etiquetas' })

    await usuario.click(botonGuardar())

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cambiar fotos' })).toBeDisabled()
    terminar()
    expect(await screen.findByText('Prenda guardada en el armario.')).toBeInTheDocument()
  })

  it('cancelar en el formulario vuelve al armario sin guardar', async () => {
    const { usuario, llamadas, guardar, router } = montar({ proveedor: crearProveedorFalso() })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByRole('heading', { name: 'Revisa las etiquetas' })

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(router.state.location.pathname).toBe('/')
    expect(guardar).not.toHaveBeenCalled()
  })

  it('avisa si no se puede guardar y deja reintentarlo', async () => {
    const { usuario, llamadas, guardar } = montar({ proveedor: crearProveedorFalso() })
    guardar.mockRejectedValueOnce(new Error('cuota'))
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByRole('heading', { name: 'Revisa las etiquetas' })

    await usuario.click(botonGuardar())
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la prenda.')

    await usuario.click(botonGuardar())
    expect(await screen.findByText('Prenda guardada en el armario.')).toBeInTheDocument()
    expect(guardar).toHaveBeenCalledTimes(2)
  })

  it('«Añadir otra» deja la pantalla vacía para la siguiente prenda', async () => {
    const proveedor = crearProveedorFalso()
    const { usuario, llamadas } = montar({ proveedor })
    await fotoRecortadaYSiguiente(usuario, llamadas)
    await screen.findByRole('heading', { name: 'Revisa las etiquetas' })
    await usuario.click(botonGuardar())

    await usuario.click(await screen.findByRole('button', { name: 'Añadir otra' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Categoría' })).not.toBeInTheDocument()
    expect(botonSiguiente()).toBeDisabled()
  })
})
