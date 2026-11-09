import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CambiosPrenda, NuevaPrenda, Prenda } from '../../datos/modelo.ts'
import { nuevaPrenda } from '../../datos/pruebas.ts'
import type { FiltrosPrendas } from '../../datos/repositorio.ts'
import {
  crearProveedorFalso,
  ErrorIA,
  ETIQUETAS_DE_PRUEBA,
  type ProveedorIA,
} from '../../ia/index.ts'
import { Armario } from './Armario.tsx'
import { simularUrlsDeBlob } from './urlsDePrueba.ts'

// Con la suite entera en paralelo, el formulario completo pasa de los 5 s por defecto.
vi.setConfig({ testTimeout: 15_000 })

function prenda(cambios: Partial<NuevaPrenda> = {}): Prenda {
  return { ...nuevaPrenda(cambios), id: 'p1', creadaEn: 1 }
}

const chino = () =>
  prenda({
    categoria: 'inferior',
    subcategoria: 'chino',
    colores: ['beige'],
    estilos: ['smart casual'],
    notas: 'Me queda largo',
    etiquetadaPor: 'manual',
  })

function montar(inicial: Prenda, proveedor: ProveedorIA | null = crearProveedorFalso()) {
  let guardada = inicial
  const listar = vi.fn((filtros: FiltrosPrendas = {}) =>
    Promise.resolve(
      [guardada].filter((p) => !filtros.categoria || p.categoria === filtros.categoria),
    ),
  )
  const borrar = vi.fn(() => Promise.resolve())
  const actualizar = vi.fn((id: string, cambios: CambiosPrenda) => {
    guardada = { ...guardada, ...cambios, id }
    return Promise.resolve(guardada)
  })
  const obtenerProveedor = vi.fn(() => Promise.resolve(proveedor))
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Armario
            listar={listar}
            borrar={borrar}
            actualizar={actualizar}
            obtenerProveedor={obtenerProveedor}
          />
        ),
      },
      { path: '/ajustes', element: <h1>Ajustes</h1> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return { usuario: userEvent.setup(), router, actualizar }
}

async function abrirEdicion(usuario: ReturnType<typeof userEvent.setup>, nombre: string) {
  await usuario.click(await screen.findByRole('button', { name: nombre }))
  await usuario.click(screen.getByRole('button', { name: 'Editar' }))
  return screen.getByRole('dialog', { name: `Editar ${nombre.toLocaleLowerCase('es')}` })
}

const categoria = (dentro: HTMLElement, nombre: string) =>
  within(within(dentro).getByRole('group', { name: 'Categoría' })).getByRole('radio', {
    name: nombre,
  })

let urls: ReturnType<typeof simularUrlsDeBlob>
beforeEach(() => {
  urls = simularUrlsDeBlob()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  urls.quitar()
  vi.restoreAllMocks()
})

describe('editar una prenda', () => {
  it('abre el formulario con sus etiquetas, guarda los cambios y vuelve al detalle', async () => {
    const { usuario, router, actualizar } = montar(chino())

    const edicion = await abrirEdicion(usuario, 'Chino')

    expect(router.state.location.search).toBe('?prenda=p1&editar=1')
    expect(within(edicion).getByRole('heading', { name: 'Editar chino' })).toHaveFocus()
    expect(categoria(edicion, 'Parte de abajo')).toBeChecked()
    expect(within(edicion).getByLabelText('Tipo de prenda')).toHaveValue('chino')
    expect(within(edicion).getByLabelText('Notas')).toHaveValue('Me queda largo')

    await usuario.click(within(edicion).getByRole('checkbox', { name: 'negro' }))
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))

    expect(actualizar).toHaveBeenCalledWith('p1', {
      categoria: 'inferior',
      subcategoria: 'chino',
      colores: ['beige', 'negro'],
      estampado: 'liso',
      estilos: ['smart casual'],
      abrigo: 1,
      formalidad: 2,
      ocasiones: ['diario'],
      temporadas: ['verano'],
      notas: 'Me queda largo',
      etiquetadaPor: 'manual',
    })
    const detalle = await screen.findByRole('dialog', { name: 'Chino' })
    expect(router.state.location.search).toBe('?prenda=p1')
    expect(within(detalle).getByText('Beige, negro')).toBeInTheDocument()
  })

  it.each(['Cancelar', 'Volver sin guardar'])(
    '«%s» vuelve al detalle sin guardar',
    async (boton) => {
      const { usuario, router, actualizar } = montar(chino())
      const edicion = await abrirEdicion(usuario, 'Chino')
      await usuario.click(within(edicion).getByRole('checkbox', { name: 'negro' }))

      await usuario.click(within(edicion).getByRole('button', { name: boton }))

      expect(await screen.findByRole('dialog', { name: 'Chino' })).toBeInTheDocument()
      expect(router.state.location.search).toBe('?prenda=p1')
      expect(actualizar).not.toHaveBeenCalled()
    },
  )

  it('«atrás» del móvil cierra la edición y deja el detalle', async () => {
    const { usuario, router } = montar(chino())
    await abrirEdicion(usuario, 'Chino')

    await router.navigate(-1)

    expect(await screen.findByRole('dialog', { name: 'Chino' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Editar chino' })).not.toBeInTheDocument()
  })

  it('«atrás» mientras guarda no retrocede otra vez al terminar', async () => {
    const { usuario, router, actualizar } = montar(chino())
    let terminar: () => void = () => undefined
    actualizar.mockImplementationOnce(
      (id: string, cambios: CambiosPrenda) =>
        new Promise<Prenda>((resolver) => {
          terminar = () => {
            resolver({ ...chino(), ...cambios, id })
          }
        }),
    )
    const edicion = await abrirEdicion(usuario, 'Chino')
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))

    await act(() => router.navigate(-1))
    await act(async () => {
      terminar()
      await Promise.resolve()
    })

    expect(router.state.location.search).toBe('?prenda=p1')
    expect(screen.getByRole('dialog', { name: 'Chino' })).toBeInTheDocument()
  })

  it('con un filtro puesto, la prenda que deja de cumplirlo sale de la lista', async () => {
    const { usuario } = montar(chino())
    await usuario.click(await screen.findByRole('button', { name: /Parte de abajo/ }))
    const edicion = await abrirEdicion(usuario, 'Chino')

    await usuario.click(categoria(edicion, 'Parte de arriba'))
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))
    const detalle = await screen.findByRole('dialog', { name: 'Chino' })
    await usuario.click(within(detalle).getByRole('button', { name: 'Armario' }))

    expect(await screen.findByText('Ninguna prenda cumple estos filtros.')).toBeInTheDocument()
  })

  it('una prenda de la IA que cambia de categoría pasa a etiquetada a mano', async () => {
    const { usuario, actualizar } = montar(prenda({ etiquetadaPor: 'ia' }))
    const edicion = await abrirEdicion(usuario, 'Camiseta')

    await usuario.click(categoria(edicion, 'Abrigo o chaqueta'))
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))

    expect(actualizar).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ categoria: 'abrigo', etiquetadaPor: 'manual' }),
    )
  })

  it('si no se puede guardar, lo dice y deja reintentarlo', async () => {
    const { usuario, actualizar } = montar(chino())
    actualizar.mockRejectedValueOnce(new Error('disco lleno'))
    const edicion = await abrirEdicion(usuario, 'Chino')

    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(edicion).findByRole('alert')).toHaveTextContent(
      'No se pudieron guardar los cambios.',
    )
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('dialog', { name: 'Chino' })).toBeInTheDocument()
    expect(actualizar).toHaveBeenCalledTimes(2)
  })
})

describe('datos de la etiqueta al editar', () => {
  it('volver a etiquetar con IA no borra marca, referencia, talla, composición ni enlace', async () => {
    const conEtiqueta = prenda({
      marca: 'Zara',
      referencia: '4085/021',
      talla: 'M',
      composicion: [{ material: 'algodón', porcentaje: 100 }],
      enlace: 'https://www.zara.com/es/es/x.html',
    })
    const { usuario, actualizar } = montar(conEtiqueta)
    const edicion = await abrirEdicion(usuario, 'Camiseta')

    await usuario.click(within(edicion).getByRole('button', { name: 'Volver a etiquetar con IA' }))
    await within(edicion).findByText(/Etiquetas nuevas de la IA/)
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))

    expect(actualizar).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        marca: 'Zara',
        referencia: '4085/021',
        talla: 'M',
        composicion: [{ material: 'algodón', porcentaje: 100 }],
        enlace: 'https://www.zara.com/es/es/x.html',
      }),
    )
  })

  it('volver a etiquetar con IA conserva el corte que la IA no dice y usa el que sí dice', async () => {
    const proveedor = crearProveedorFalso({
      etiquetas: () => ({ ...ETIQUETAS_DE_PRUEBA, corte: undefined, manga: 'corta' }),
    })
    const { usuario, actualizar } = montar(
      prenda({ subcategoria: 'camiseta', corte: 'oversize', manga: 'larga' }),
      proveedor,
    )
    const edicion = await abrirEdicion(usuario, 'Camiseta')

    await usuario.click(within(edicion).getByRole('button', { name: 'Volver a etiquetar con IA' }))
    await within(edicion).findByText(/Etiquetas nuevas de la IA/)
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))

    expect(actualizar).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ corte: 'oversize', manga: 'corta' }),
    )
  })

  it('lo escrito en la etiqueta sin guardar sobrevive a volver a etiquetar con IA', async () => {
    const { usuario, actualizar } = montar(prenda())
    const edicion = await abrirEdicion(usuario, 'Camiseta')
    await usuario.type(within(edicion).getByLabelText('Marca'), 'Mango')
    await usuario.type(within(edicion).getByLabelText('Talla'), 'XL')

    await usuario.click(within(edicion).getByRole('button', { name: 'Volver a etiquetar con IA' }))
    await within(edicion).findByText(/Etiquetas nuevas de la IA/)

    expect(within(edicion).getByLabelText('Marca')).toHaveValue('Mango')
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))
    expect(actualizar).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ marca: 'Mango', talla: 'XL' }),
    )
  })

  it('borrar la marca la quita de la prenda', async () => {
    const { usuario, actualizar } = montar(prenda({ marca: 'Zara', talla: 'M' }))
    const edicion = await abrirEdicion(usuario, 'Camiseta')

    await usuario.clear(within(edicion).getByLabelText('Marca'))
    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))

    const cambios = actualizar.mock.calls[0]?.[1]
    expect(cambios).toHaveProperty('marca', undefined)
    expect(cambios?.talla).toBe('M')
  })

  it('la foto de la etiqueta rellena los campos con el proveedor de la pantalla', async () => {
    const proveedor = crearProveedorFalso()
    const { usuario } = montar(prenda(), proveedor)
    const edicion = await abrirEdicion(usuario, 'Camiseta')

    await usuario.upload(
      within(edicion).getByLabelText('Foto de la etiqueta'),
      new File(['x'], 'etiqueta.jpg', { type: 'image/jpeg' }),
    )

    expect(await within(edicion).findByText(/Leído de la etiqueta/)).toBeInTheDocument()
    expect(within(edicion).getByLabelText('Referencia')).toHaveValue('4085/021')
    expect(proveedor.etiquetasLeidas).toHaveLength(1)
  })
})

describe('volver a etiquetar con IA', () => {
  it('pide a la IA la foto recortada, rellena el formulario y guarda como de la IA', async () => {
    const proveedor = crearProveedorFalso({
      etiquetas: () => ({ ...ETIQUETAS_DE_PRUEBA, notas: '' }),
    })
    const original = chino()
    const { usuario, actualizar } = montar(original, proveedor)
    const edicion = await abrirEdicion(usuario, 'Chino')

    await usuario.click(within(edicion).getByRole('button', { name: 'Volver a etiquetar con IA' }))

    expect(await within(edicion).findByText(/Etiquetas nuevas de la IA/)).toBeInTheDocument()
    expect(proveedor.lotes[0]?.[0]?.fotos).toEqual([original.fotos[0]?.recortada])
    expect(categoria(edicion, 'Parte de arriba')).toBeChecked()
    expect(within(edicion).getByLabelText('Tipo de prenda')).toHaveValue('camiseta')
    // La IA no dijo nada en las notas: se quedan las del usuario.
    expect(within(edicion).getByLabelText('Notas')).toHaveValue('Me queda largo')

    await usuario.click(within(edicion).getByRole('button', { name: 'Guardar cambios' }))

    expect(actualizar).toHaveBeenCalledWith('p1', {
      ...ETIQUETAS_DE_PRUEBA,
      notas: 'Me queda largo',
      etiquetadaPor: 'ia',
    })
  })

  it('sin clave, lo avisa con el enlace a Ajustes y el formulario sigue como estaba', async () => {
    const { usuario, router } = montar(chino(), null)
    const edicion = await abrirEdicion(usuario, 'Chino')

    await usuario.click(within(edicion).getByRole('button', { name: 'Volver a etiquetar con IA' }))

    const aviso = await within(edicion).findByRole('alert')
    expect(aviso).toHaveTextContent('Falta la clave de Gemini')
    expect(within(edicion).getByLabelText('Tipo de prenda')).toHaveValue('chino')
    await usuario.click(within(aviso).getByRole('link', { name: 'Ir a Ajustes' }))
    expect(router.state.location.pathname).toBe('/ajustes')
  })

  it('si la IA falla, lo dice, deja probar otra vez y no toca el formulario', async () => {
    const { usuario } = montar(chino(), crearProveedorFalso({ error: new ErrorIA('sin-red') }))
    const edicion = await abrirEdicion(usuario, 'Chino')
    await usuario.type(within(edicion).getByLabelText('Tipo de prenda'), ' largo')

    await usuario.click(within(edicion).getByRole('button', { name: 'Volver a etiquetar con IA' }))

    const aviso = await within(edicion).findByRole('alert')
    expect(aviso).toHaveTextContent('No hay conexión.')
    expect(within(aviso).getByRole('button', { name: 'Probar otra vez' })).toBeInTheDocument()
    expect(within(edicion).getByLabelText('Tipo de prenda')).toHaveValue('chino largo')
  })

  it('mientras etiqueta no deja guardar, y «Dejarlo» lo cancela sin cambiar nada', async () => {
    let señal: AbortSignal | undefined
    const proveedor: ProveedorIA = {
      etiquetarPrendas: (_prendas, opciones) => {
        señal = opciones?.signal
        return new Promise(() => undefined)
      },
      comprobarClave: () => Promise.resolve(),
      elegirOutfits: () => Promise.resolve([]),
      leerEtiqueta: () => Promise.resolve({}),
    }
    const { usuario } = montar(chino(), proveedor)
    const edicion = await abrirEdicion(usuario, 'Chino')

    await usuario.click(within(edicion).getByRole('button', { name: 'Volver a etiquetar con IA' }))

    expect(await within(edicion).findByText('Gemini está mirando la prenda…')).toBeInTheDocument()
    expect(within(edicion).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await usuario.click(within(edicion).getByRole('button', { name: 'Dejarlo' }))

    expect(señal?.aborted).toBe(true)
    expect(within(edicion).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    expect(within(edicion).getByLabelText('Tipo de prenda')).toHaveValue('chino')
  })
})
