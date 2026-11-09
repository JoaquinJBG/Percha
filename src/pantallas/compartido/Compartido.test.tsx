import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rutas } from '../../app/rutas.tsx'
import type { CambiosPrenda, NuevaPrenda, Prenda } from '../../datos/modelo.ts'
import { nuevaPrenda } from '../../datos/pruebas.ts'
import { datosDesdeTienda } from '../../etiqueta/compartido.ts'
import { simularUrlsDeBlob } from '../armario/urlsDePrueba.ts'
import { Compartido } from './Compartido.tsx'

const FICHA = 'https://www.zara.com/es/es/camiseta-basica-p04085021.html'

function prenda(id: string, cambios: Partial<NuevaPrenda> = {}): Prenda {
  return { ...nuevaPrenda(cambios), id, creadaEn: 1 }
}

function DestinoNueva() {
  const estado: unknown = useLocation().state
  return <p>Nueva prenda con {datosDesdeTienda(estado).referencia ?? 'nada'}</p>
}

function montar(busqueda: string, prendas: Prenda[] = []) {
  const listar = vi.fn(() => Promise.resolve(prendas))
  const actualizar = vi.fn((id: string, cambios: CambiosPrenda) =>
    Promise.resolve({ ...prenda(id), ...cambios }),
  )
  const router = createMemoryRouter(
    [
      { path: '/compartido', element: <Compartido listar={listar} actualizar={actualizar} /> },
      { path: '/prendas/nueva', element: <DestinoNueva /> },
      { path: '/', element: <p>Armario</p> },
    ],
    { initialEntries: [`/compartido${busqueda}`] },
  )
  render(<RouterProvider router={router} />)
  return { usuario: userEvent.setup(), router, listar, actualizar }
}

let urls: ReturnType<typeof simularUrlsDeBlob>
beforeEach(() => {
  urls = simularUrlsDeBlob()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  urls.quitar()
  vi.restoreAllMocks()
})

describe('volver de la tienda con «Compartir»', () => {
  it('tiene su ruta en la app, la del share_target del manifiesto', () => {
    const router = createMemoryRouter(rutas, { initialEntries: ['/compartido'] })
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Desde la tienda' })).toBeInTheDocument()
  })

  it('sin enlace explica cómo compartir y no lee el armario', () => {
    const { listar } = montar('?text=una+camiseta')

    expect(screen.getByText(/No ha llegado ningún enlace/)).toBeInTheDocument()
    expect(listar).not.toHaveBeenCalled()
  })

  it('enseña el enlace y la tienda, y empieza una prenda nueva con él', async () => {
    const { usuario, router } = montar(
      `?title=${encodeURIComponent('CAMISETA BÁSICA')}&text=${encodeURIComponent(`Mira: ${FICHA}`)}`,
    )

    expect(screen.getByText('CAMISETA BÁSICA')).toBeInTheDocument()
    expect(screen.getByText(FICHA)).toBeInTheDocument()
    expect(screen.getByText('Tienda: Zara')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Nueva prenda con este enlace' }))

    expect(router.state.location.pathname).toBe('/prendas/nueva')
    expect(screen.getByText('Nueva prenda con 4085/021')).toBeInTheDocument()
  })

  it('guarda el enlace en una prenda que ya existe, tras confirmarlo, y abre su detalle', async () => {
    const { usuario, router, actualizar } = montar(`?url=${encodeURIComponent(FICHA)}`, [
      prenda('p1', { subcategoria: 'camiseta' }),
      prenda('p2', { subcategoria: 'polo', enlace: 'https://www.zara.com/es/es/otro.html' }),
    ])

    await usuario.click(await screen.findByRole('button', { name: /Polo/ }))
    const confirmacion = screen.getByRole('group', { name: '¿Guardar el enlace en «Polo»?' })
    expect(confirmacion).toHaveTextContent('Ya tenía otro enlace: se cambiará por este.')
    await usuario.click(within(confirmacion).getByRole('button', { name: 'Guardar' }))

    expect(actualizar).toHaveBeenCalledWith('p2', { enlace: FICHA })
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toBe('?prenda=p2')
  })

  it('cancelar la confirmación no guarda nada', async () => {
    const { usuario, actualizar } = montar(`?url=${encodeURIComponent(FICHA)}`, [
      prenda('p1', { subcategoria: 'camiseta' }),
    ])

    await usuario.click(await screen.findByRole('button', { name: /Camiseta/ }))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('group', { name: /Guardar el enlace/ })).not.toBeInTheDocument()
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('si no se puede guardar, lo dice y deja reintentarlo', async () => {
    const { usuario, actualizar, router } = montar(`?url=${encodeURIComponent(FICHA)}`, [
      prenda('p1', { subcategoria: 'camiseta' }),
    ])
    actualizar.mockRejectedValueOnce(new Error('disco lleno'))

    await usuario.click(await screen.findByRole('button', { name: /Camiseta/ }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el enlace.')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(router.state.location.search).toBe('?prenda=p1')
  })

  it('un enlace que no es web no se acepta', () => {
    montar(`?url=${encodeURIComponent('javascript:alert(1)')}`)

    expect(screen.getByText(/No ha llegado ningún enlace/)).toBeInTheDocument()
  })
})
