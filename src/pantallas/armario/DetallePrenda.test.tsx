import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nuevaPrenda } from '../../datos/pruebas.ts'
import { DetallePrenda } from './DetallePrenda.tsx'
import { simularUrlsDeBlob } from './urlsDePrueba.ts'

const prenda = { ...nuevaPrenda({ subcategoria: '', etiquetadaPor: 'ia' }), id: 'p1', creadaEn: 0 }
let urls: ReturnType<typeof simularUrlsDeBlob>

beforeEach(() => {
  urls = simularUrlsDeBlob()
})

afterEach(() => {
  urls.quitar()
})

describe('detalle de una prenda', () => {
  it('sin subcategoría se titula con la categoría y dice quién la etiquetó', () => {
    render(<DetallePrenda prenda={prenda} onVolver={vi.fn()} onBorrar={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Parte de arriba' })).toHaveFocus()
    expect(screen.getByText('Por la IA')).toBeInTheDocument()
  })

  it('con `onEditar` enseña el botón «Editar» junto a «Borrar»', async () => {
    const onEditar = vi.fn()
    render(
      <DetallePrenda prenda={prenda} onVolver={vi.fn()} onBorrar={vi.fn()} onEditar={onEditar} />,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: 'Editar' }))

    expect(onEditar).toHaveBeenCalledWith(prenda)
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  })
})
