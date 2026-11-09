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

  it('dice qué papeles puede hacer; si es de antes, los de por defecto', () => {
    const americana = { ...prenda, categoria: 'abrigo' as const, subcategoria: 'americana' }
    const { rerender } = render(
      <DetallePrenda
        prenda={{ ...americana, capas: ['exterior'] }}
        onVolver={vi.fn()}
        onBorrar={vi.fn()}
      />,
    )
    expect(screen.getByText('Puede ir como').nextElementSibling).toHaveTextContent('Exterior')

    rerender(<DetallePrenda prenda={americana} onVolver={vi.fn()} onBorrar={vi.fn()} />)
    expect(screen.getByText('Puede ir como').nextElementSibling).toHaveTextContent(
      'Media, exterior',
    )
  })

  it('lo que no es de arriba no tiene la línea de capas', () => {
    render(
      <DetallePrenda
        prenda={{ ...prenda, categoria: 'calzado', subcategoria: 'mocasín' }}
        onVolver={vi.fn()}
        onBorrar={vi.fn()}
      />,
    )

    expect(screen.queryByText('Puede ir como')).not.toBeInTheDocument()
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

  it('enseña los datos de la etiqueta y los enlaces para buscarla', () => {
    const conEtiqueta = {
      ...prenda,
      marca: 'H&M',
      referencia: '0970819001',
      talla: 'S',
      composicion: [{ material: 'lino', porcentaje: 100 }],
      enlace: 'https://www2.hm.com/es_es/productpage.0970819001.html',
    }
    render(<DetallePrenda prenda={conEtiqueta} onVolver={vi.fn()} onBorrar={vi.fn()} />)

    expect(screen.getByText('H&M')).toBeInTheDocument()
    expect(screen.getByText('0970819001')).toBeInTheDocument()
    expect(screen.getByText('100 % lino')).toBeInTheDocument()
    const enlaces = screen.getByRole('list', { name: 'Buscar la prenda' })
    expect(enlaces).toHaveTextContent('Abrir la ficha')
    expect(enlaces).toHaveTextContent('Buscar en Google')
    expect(screen.getByRole('link', { name: /En la tienda de H&M/ })).toHaveAttribute(
      'href',
      'https://www2.hm.com/es_es/productpage.0970819001.html',
    )
  })

  it('sin datos de etiqueta no enseña filas vacías ni enlaces', () => {
    render(<DetallePrenda prenda={prenda} onVolver={vi.fn()} onBorrar={vi.fn()} />)

    expect(screen.queryByText('Marca')).not.toBeInTheDocument()
    expect(screen.queryByText('Composición')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Buscar la prenda' })).not.toBeInTheDocument()
  })
})
