import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorCopia, importarCopia } from '../datos/copia.ts'
import { CopiaArmario } from './CopiaArmario.tsx'

vi.mock('../datos/copia.ts', async (original) => ({
  ...(await original<typeof import('../datos/copia.ts')>()),
  exportarCopia: vi.fn(),
  importarCopia: vi.fn(),
}))

const fichero = new File(['zip'], 'percha-copia-2026-11-03.zip', { type: 'application/zip' })

async function elegirFichero() {
  const usuario = userEvent.setup()
  render(<CopiaArmario />)
  await usuario.upload(screen.getByLabelText('Fichero de copia'), fichero)
  return usuario
}

beforeEach(() => {
  vi.mocked(importarCopia).mockReset()
})

describe('copia del armario', () => {
  it('muestra solo los dos botones al entrar', () => {
    render(<CopiaArmario />)

    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Exportar copia',
      'Importar copia',
    ])
  })

  it.each([
    ['Fusionar con lo que tengo', 'fusionar'],
    ['Reemplazar todo', 'reemplazar'],
  ])('al importar con «%s» usa el modo %s', async (boton, modo) => {
    vi.mocked(importarCopia).mockResolvedValue({ prendas: 1, outfits: 0 })
    const usuario = await elegirFichero()

    await usuario.click(screen.getByRole('button', { name: boton }))

    expect(importarCopia).toHaveBeenCalledWith(fichero, modo)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Copia importada: 1 prenda y 0 outfits.',
    )
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('cancelar no importa nada', async () => {
    const usuario = await elegirFichero()

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(importarCopia).not.toHaveBeenCalled()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('enseña el error de una copia que no vale', async () => {
    vi.mocked(importarCopia).mockRejectedValue(new ErrorCopia('Esta copia es de otra versión.'))
    const usuario = await elegirFichero()

    await usuario.click(screen.getByRole('button', { name: 'Reemplazar todo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta copia es de otra versión.')
  })
})
