// Armario lee la base al montarse; aquí basta con una vacía.
import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { rutas } from './rutas.tsx'

function montar(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  render(<RouterProvider router={router} />)
  return router
}

function pestañasActivas() {
  return screen.getAllByRole('link').filter((enlace) => enlace.hasAttribute('aria-current'))
}

describe('navegación inferior', () => {
  it('abre en Armario con su pestaña marcada', () => {
    montar('/')

    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Armario' })).toBeInTheDocument()
    expect(pestañasActivas()).toEqual([screen.getByRole('link', { name: 'Armario' })])
  })

  it.each([
    ['Outfits', '/', '/outfits'],
    ['Perfil', '/', '/perfil'],
    ['Ajustes', '/', '/ajustes'],
    ['Armario', '/ajustes', '/'],
  ])('lleva a %s', async (pantalla, desde, hasta) => {
    const usuario = userEvent.setup()
    const router = montar(desde)

    await usuario.click(screen.getByRole('link', { name: pantalla }))

    expect(router.state.location.pathname).toBe(hasta)
    expect(screen.getByRole('heading', { level: 1, name: pantalla })).toBeInTheDocument()
    expect(pestañasActivas()).toEqual([screen.getByRole('link', { name: pantalla })])
  })

  it('manda una ruta desconocida a Armario', () => {
    const router = montar('/no-existe')

    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Armario' })).toBeInTheDocument()
  })
})
