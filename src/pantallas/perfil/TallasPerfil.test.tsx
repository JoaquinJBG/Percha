import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { tallaMarcaSchema, type TallaMarca } from '../../datos/modelo.ts'
import { TallasPerfil } from './TallasPerfil.tsx'

/** Solo las tallas, con un `guardar` que valida como el perfil y las pone en pantalla al guardarlas. */
function montar(inicial: TallaMarca[] = []) {
  let guardadas = inicial
  const guardar = vi.fn((tallas: TallaMarca[]) => {
    guardadas = z.array(tallaMarcaSchema).parse(tallas)
    return Promise.resolve(guardadas)
  })
  function Arnes() {
    const [tallas, setTallas] = useState(inicial)
    return (
      <TallasPerfil
        tallas={tallas}
        guardar={async (nuevas) => {
          setTallas(await guardar(nuevas))
        }}
      />
    )
  }
  render(<Arnes />)
  return { usuario: userEvent.setup(), guardar, guardadas: () => guardadas }
}

async function añadir(
  usuario: ReturnType<typeof userEvent.setup>,
  marca: string,
  tipo: string,
  talla: string,
) {
  await usuario.clear(screen.getByRole('textbox', { name: 'Marca' }))
  await usuario.click(screen.getByRole('textbox', { name: 'Marca' }))
  await usuario.paste(marca)
  await usuario.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), tipo)
  await usuario.clear(screen.getByRole('textbox', { name: 'Talla' }))
  await usuario.click(screen.getByRole('textbox', { name: 'Talla' }))
  await usuario.paste(talla)
  await usuario.click(screen.getByRole('button', { name: 'Añadir talla' }))
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Tallas por marca', () => {
  it('añade, cambia la de la misma marca y tipo, y quita', async () => {
    const { usuario, guardadas } = montar()

    await añadir(usuario, 'Zara', 'pantalón', '44')
    expect(await screen.findByText('Talla añadida: Zara · pantalón · 44.')).toBeInTheDocument()
    await añadir(usuario, 'Nike', 'calzado', '45')
    await añadir(usuario, 'zara', 'pantalón', '46')
    expect(await screen.findByText('Talla cambiada: zara · pantalón · 46.')).toBeInTheDocument()

    expect(guardadas()).toEqual([
      { marca: 'zara', tipo: 'pantalón', talla: '46' },
      { marca: 'Nike', tipo: 'calzado', talla: '45' },
    ])
    expect(screen.getByRole('textbox', { name: 'Marca' })).toHaveValue('')

    await usuario.click(screen.getByRole('button', { name: 'Quitar Nike · calzado · 45' }))
    expect(await screen.findByText('Talla quitada: Nike · calzado · 45.')).toBeInTheDocument()
    expect(guardadas()).toEqual([{ marca: 'zara', tipo: 'pantalón', talla: '46' }])
    expect(screen.queryByText('Nike · calzado · 45')).not.toBeInTheDocument()
  })

  it('sin tallas lo dice', () => {
    montar()

    expect(screen.getByText('Aún no has puesto ninguna.')).toBeInTheDocument()
  })

  it('pide la marca y la talla', async () => {
    const { usuario, guardar } = montar()

    await añadir(usuario, '   ', 'calzado', '45')

    expect(screen.getByRole('alert')).toHaveTextContent('Escribe la marca y la talla.')
    expect(guardar).not.toHaveBeenCalled()
  })

  it('no pasa del máximo, pero sí deja cambiar una que ya está', async () => {
    const llenas = Array.from({ length: 30 }, (_, i) => ({
      marca: `Marca ${String(i)}`,
      tipo: 'calzado' as const,
      talla: '42',
    }))
    const { usuario, guardar } = montar(llenas)

    await añadir(usuario, 'Otra', 'calzado', '43')
    expect(screen.getByRole('alert')).toHaveTextContent('Como mucho 30 tallas.')
    expect(guardar).not.toHaveBeenCalled()

    await añadir(usuario, 'marca 0', 'calzado', '43')
    expect(await screen.findByText('Talla cambiada: marca 0 · calzado · 43.')).toBeInTheDocument()
  })

  it('si no se puede guardar, lo dice y no borra lo escrito', async () => {
    const { usuario, guardar } = montar()
    guardar.mockRejectedValueOnce(new Error('rota'))

    await añadir(usuario, 'Zara', 'pantalón', '44')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se han podido guardar las tallas.',
    )
    expect(screen.getByRole('textbox', { name: 'Marca' })).toHaveValue('Zara')
    expect(screen.getByText('Aún no has puesto ninguna.')).toBeInTheDocument()
  })
})
