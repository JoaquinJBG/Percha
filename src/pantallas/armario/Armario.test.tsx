import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NuevaPrenda, Prenda } from '../../datos/modelo.ts'
import { imagen, nuevaPrenda } from '../../datos/pruebas.ts'
import type { FiltrosPrendas } from '../../datos/repositorio.ts'
import { Armario } from './Armario.tsx'
import { simularUrlsDeBlob } from './urlsDePrueba.ts'

let siguienteId = 0
function prenda(cambios: Partial<NuevaPrenda> = {}): Prenda {
  siguienteId += 1
  return { ...nuevaPrenda(cambios), id: `p${String(siguienteId)}`, creadaEn: siguienteId }
}

/** Repositorio en memoria con el mismo contrato que `listarPrendas` y `borrarPrenda`. */
function repositorio(iniciales: Prenda[]) {
  let prendas = [...iniciales]
  const listar = vi.fn((filtros: FiltrosPrendas = {}) =>
    Promise.resolve(
      prendas.filter(
        (p) =>
          (filtros.categoria === undefined || p.categoria === filtros.categoria) &&
          (filtros.estilo === undefined || p.estilos.includes(filtros.estilo)) &&
          (filtros.color === undefined || p.colores.includes(filtros.color)),
      ),
    ),
  )
  const borrar = vi.fn((id: string) => {
    prendas = prendas.filter((p) => p.id !== id)
    return Promise.resolve()
  })
  return { listar, borrar }
}

function montar(repo: ReturnType<typeof repositorio>, ruta = '/') {
  // Una pantalla antes en el historial, para ver si «volver» retrocede de más.
  const router = createMemoryRouter(
    [
      { path: '/', element: <Armario listar={repo.listar} borrar={repo.borrar} /> },
      { path: '/antes', element: <p>Pantalla anterior</p> },
    ],
    { initialEntries: ['/antes', ruta], initialIndex: 1 },
  )
  const { unmount } = render(<RouterProvider router={router} />)
  return { usuario: userEvent.setup(), router, unmount }
}

function nombresEnLista() {
  return screen
    .queryAllByRole('listitem')
    .map((elemento) => within(elemento).getByRole('button').textContent)
}

const camiseta = () => prenda({ subcategoria: 'camiseta', colores: ['blanco'] })
const vaquero = () =>
  prenda({
    categoria: 'inferior',
    subcategoria: 'vaquero',
    colores: ['azul'],
    estilos: ['casual', 'streetwear'],
  })
const chino = () =>
  prenda({
    categoria: 'inferior',
    subcategoria: 'chino',
    colores: ['azul', 'beige'],
    estilos: ['smart casual'],
  })
const zapatilla = () =>
  prenda({
    categoria: 'calzado',
    subcategoria: 'zapatillas',
    colores: ['azul'],
    estilos: ['casual'],
  })

let urls: ReturnType<typeof simularUrlsDeBlob>

beforeEach(() => {
  urls = simularUrlsDeBlob()
})

afterEach(() => {
  urls.quitar()
})

describe('lista del armario', () => {
  it('con el armario vacío invita a añadir la primera prenda y no enseña filtros', async () => {
    montar(repositorio([]))

    expect(await screen.findByText('Tu armario está vacío')).toBeInTheDocument()
    expect(screen.getByText(/Añade tu primera prenda/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Categoría' })).not.toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('agrupa por categoría y cuenta las prendas', async () => {
    montar(repositorio([camiseta(), vaquero(), chino()]))

    expect(await screen.findByText('3 prendas')).toBeInTheDocument()
    const arriba = screen.getByRole('region', { name: /Parte de arriba/ })
    const abajo = screen.getByRole('region', { name: /Parte de abajo/ })
    expect(within(arriba).getAllByRole('listitem')).toHaveLength(1)
    expect(within(abajo).getAllByRole('listitem')).toHaveLength(2)
  })

  it('combina los filtros de categoría, estilo y color', async () => {
    const repo = repositorio([camiseta(), vaquero(), chino(), zapatilla()])
    const { usuario } = montar(repo)
    await screen.findByText('4 prendas')

    await usuario.click(screen.getByRole('button', { name: /Parte de abajo/ }))
    expect(await screen.findByText('2 de 4 prendas')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Color'), 'azul')
    await usuario.selectOptions(screen.getByLabelText('Estilo'), 'casual')

    expect(await screen.findByText('1 de 4 prendas')).toBeInTheDocument()
    expect(repo.listar).toHaveBeenLastCalledWith({
      categoria: 'inferior',
      estilo: 'casual',
      color: 'azul',
    })
    expect(nombresEnLista()).toEqual(['Vaquero'])
    expect(screen.getByRole('button', { name: /Parte de abajo/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('sin resultados deja quitar los filtros', async () => {
    const { usuario } = montar(repositorio([camiseta(), chino()]))
    await screen.findByText('2 prendas')

    await usuario.click(screen.getByRole('button', { name: /Parte de arriba/ }))
    await usuario.selectOptions(screen.getByLabelText('Color'), 'beige')

    expect(await screen.findByText('Ninguna prenda cumple estos filtros.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Quitar filtros' }))

    expect(screen.getByText('2 prendas')).toBeInTheDocument()
    expect(nombresEnLista()).toEqual(['Camiseta', 'Chino'])
    expect(screen.getByLabelText('Color')).toHaveValue('')
  })

  it('enseña la foto recortada y, si no la hay, la original', async () => {
    const recortada = imagen(7, 'image/png')
    const original = imagen(8, 'image/jpeg')
    montar(
      repositorio([
        prenda({ subcategoria: 'polo', fotos: [{ original: imagen(9), recortada }] }),
        prenda({ subcategoria: 'jersey', fotos: [{ original, recortada: null }] }),
      ]),
    )
    await screen.findByText('2 prendas')

    expect([...urls.blobs.values()]).toEqual(expect.arrayContaining([recortada, original]))
    expect(urls.blobs.size).toBe(2)
  })

  it('libera las URLs de las fotos que dejan de verse y al salir', async () => {
    const { usuario, unmount } = montar(repositorio([camiseta(), vaquero(), chino()]))
    await screen.findByText('3 prendas')
    const creadas = urls.crear.mock.results.map((r) => r.value as string)
    expect(creadas).toHaveLength(3)

    await usuario.click(screen.getByRole('button', { name: /Parte de arriba/ }))
    await screen.findByText('1 de 3 prendas')
    // Las dos del grupo de abajo ya no se ven: sus URLs se liberan.
    expect(urls.revocar).toHaveBeenCalledTimes(2)

    unmount()

    expect(urls.revocar.mock.calls.map(([url]) => url).sort()).toEqual(creadas.sort())
  })
})

describe('detalle de una prenda', () => {
  it('abre con sus fotos y etiquetas en solo lectura, y vuelve a la lista', async () => {
    const dosFotos = prenda({
      categoria: 'inferior',
      subcategoria: 'vaquero',
      colores: ['azul', 'negro'],
      estilos: ['casual', 'streetwear'],
      fotos: [
        { original: imagen(3), recortada: imagen(4) },
        { original: imagen(5), recortada: null },
      ],
      notas: 'Me queda un poco largo',
    })
    const { usuario, router } = montar(repositorio([camiseta(), dosFotos]))

    await usuario.click(await screen.findByRole('button', { name: 'Vaquero' }))

    const detalle = screen.getByRole('dialog', { name: 'Vaquero' })
    expect(router.state.location.search).toBe(`?prenda=${dosFotos.id}`)
    expect(within(detalle).getAllByRole('img')).toHaveLength(2)
    expect(within(detalle).getByText('Parte de abajo')).toBeInTheDocument()
    expect(within(detalle).getByText('Azul, negro')).toBeInTheDocument()
    expect(within(detalle).getByText('Casual, streetwear')).toBeInTheDocument()
    expect(within(detalle).getByText('Me queda un poco largo')).toBeInTheDocument()
    expect(within(detalle).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(detalle).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()

    await usuario.click(within(detalle).getByRole('button', { name: 'Armario' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('')
    expect(screen.getByText('2 prendas')).toBeInTheDocument()
  })

  it('dos toques seguidos en «volver» solo cierran el detalle', async () => {
    const { usuario, router } = montar(repositorio([camiseta()]))
    await usuario.click(await screen.findByRole('button', { name: 'Camiseta' }))

    await usuario.dblClick(screen.getByRole('button', { name: 'Armario' }))

    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toBe('')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un enlace a una prenda que ya no está lo dice y vuelve al armario', async () => {
    const { usuario, router } = montar(repositorio([camiseta()]), '/?prenda=no-existe')

    const detalle = await screen.findByRole('dialog', { name: 'Esta prenda ya no está' })
    await usuario.click(within(detalle).getByRole('button', { name: 'Armario' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })
})

describe('borrar una prenda', () => {
  it('pide confirmación y, si se cancela, no borra', async () => {
    const repo = repositorio([camiseta()])
    const { usuario } = montar(repo)
    await usuario.click(await screen.findByRole('button', { name: 'Camiseta' }))

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(screen.getByText('¿Borrar esta prenda? No se puede deshacer.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(repo.borrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Camiseta' })).toBeInTheDocument()
  })

  it('borra, cierra el detalle y la quita de la lista y de los filtros', async () => {
    const quitada = vaquero()
    const repo = repositorio([camiseta(), quitada, chino()])
    const { usuario, router } = montar(repo)
    await usuario.click(await screen.findByRole('button', { name: /Parte de abajo/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Vaquero' }))

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    expect(repo.borrar).toHaveBeenCalledWith(quitada.id)
    expect(await screen.findByRole('status')).toHaveTextContent('Prenda borrada.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('')
    expect(nombresEnLista()).toEqual(['Chino'])
    expect(screen.getByText('1 de 2 prendas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Parte de abajo/ })).toHaveTextContent('1')
  })

  it('si se vuelve mientras se borra, no retrocede otra vez al terminar', async () => {
    const repo = repositorio([camiseta(), chino()])
    let terminar: () => void = () => undefined
    repo.borrar.mockImplementationOnce(
      () =>
        new Promise<void>((resolver) => {
          terminar = resolver
        }),
    )
    const { usuario, router } = montar(repo)
    await usuario.click(await screen.findByRole('button', { name: 'Camiseta' }))
    await usuario.click(screen.getByRole('button', { name: 'Borrar' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    await usuario.click(screen.getByRole('button', { name: 'Armario' }))
    terminar()

    expect(await screen.findByRole('status')).toHaveTextContent('Prenda borrada.')
    expect(router.state.location.pathname).toBe('/')
    expect(nombresEnLista()).toEqual(['Chino'])
  })

  it('si no se puede borrar, lo dice y la prenda sigue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const repo = repositorio([camiseta()])
    repo.borrar.mockRejectedValueOnce(new Error('disco lleno'))
    const { usuario } = montar(repo)
    await usuario.click(await screen.findByRole('button', { name: 'Camiseta' }))

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo borrar la prenda.')
    expect(screen.getByRole('dialog', { name: 'Camiseta' })).toBeInTheDocument()
    vi.mocked(console.error).mockRestore()
  })
})
