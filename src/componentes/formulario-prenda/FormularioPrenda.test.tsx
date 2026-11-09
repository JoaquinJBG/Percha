import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EtiquetasPrenda } from '../../datos/modelo.ts'
import { ETIQUETAS_DE_PRUEBA } from '../../ia/index.ts'
import { FormularioPrenda } from './FormularioPrenda.tsx'

// Estos tests escriben mucho con userEvent: con toda la suite en paralelo pasan de los 5 s por defecto.
vi.setConfig({ testTimeout: 15_000 })

function montar(props: Partial<Parameters<typeof FormularioPrenda>[0]> = {}) {
  const alGuardar = vi.fn<(etiquetas: EtiquetasPrenda) => void>()
  render(<FormularioPrenda alGuardar={alGuardar} {...props} />)
  return { usuario: userEvent.setup(), alGuardar }
}

function grupo(nombre: string) {
  return within(screen.getByRole('group', { name: new RegExp(`^${nombre}`) }))
}

describe('formulario de etiquetas', () => {
  it('vacío, no deja guardar sin categoría', async () => {
    const { usuario, alGuardar } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Elige una categoría.')
    expect(alGuardar).not.toHaveBeenCalled()
    expect(grupo('Categoría').getByRole('radio', { name: 'Parte de arriba' })).toHaveFocus()
  })

  it('vacío, con solo la categoría devuelve el resto por defecto', async () => {
    const { usuario, alGuardar } = montar()

    await usuario.click(screen.getByRole('radio', { name: 'Calzado' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(alGuardar).toHaveBeenCalledWith({
      categoria: 'calzado',
      subcategoria: '',
      colores: [],
      estampado: '',
      estilos: [],
      abrigo: 3,
      formalidad: 3,
      ocasiones: [],
      temporadas: [],
      notas: '',
    })
  })

  it('empieza con lo que propone la IA y devuelve lo editado', async () => {
    const { usuario, alGuardar } = montar({ iniciales: ETIQUETAS_DE_PRUEBA })

    expect(screen.getByRole('radio', { name: 'Parte de arriba' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Tipo de prenda' })).toHaveValue('camiseta')
    expect(grupo('Estilos').getByRole('checkbox', { name: 'minimalista' })).toBeChecked()

    await usuario.click(grupo('Estilos').getByRole('checkbox', { name: 'minimalista' }))
    await usuario.click(grupo('Estilos').getByRole('checkbox', { name: 'streetwear' }))
    await usuario.click(grupo('Colores').getByRole('checkbox', { name: 'azul marino' }))
    await usuario.click(screen.getByRole('radio', { name: '5: Muy abrigado' }))
    await usuario.click(screen.getByRole('radio', { name: '1: Deporte o casa' }))
    await usuario.click(grupo('Temporadas').getByRole('checkbox', { name: 'invierno' }))
    await usuario.click(grupo('Ocasiones').getByRole('checkbox', { name: 'deporte' }))
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Estampado' }), 'rayas')
    await usuario.clear(screen.getByRole('textbox', { name: 'Tipo de prenda' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Tipo de prenda' }), '  sudadera ')
    await usuario.type(screen.getByRole('textbox', { name: 'Notas' }), 'Algodón grueso')
    await usuario.click(grupo('Puede ir como').getByRole('checkbox', { name: 'base' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(alGuardar).toHaveBeenCalledWith({
      capas: ['base', 'media', 'exterior'],
      categoria: 'superior',
      subcategoria: 'sudadera',
      colores: ['blanco', 'azul marino'],
      estampado: 'rayas',
      estilos: ['casual', 'streetwear'],
      abrigo: 5,
      formalidad: 1,
      ocasiones: ['diario', 'deporte'],
      temporadas: ['primavera', 'verano', 'invierno'],
      notas: 'Algodón grueso',
    })
  })

  describe('capas', () => {
    function marcadas() {
      return grupo('Puede ir como')
        .getAllByRole('checkbox')
        .filter((casilla) => (casilla as HTMLInputElement).checked)
        .map((casilla) => casilla.closest('label')?.textContent)
    }

    it('sin tocarlas, siguen a la categoría y al tipo y se guardan', async () => {
      const { usuario, alGuardar } = montar()

      expect(screen.queryByRole('group', { name: /^Puede ir como/ })).not.toBeInTheDocument()
      await usuario.click(screen.getByRole('radio', { name: 'Parte de arriba' }))
      expect(marcadas()).toEqual(['base'])
      await usuario.type(screen.getByRole('textbox', { name: 'Tipo de prenda' }), 'sobrecamisa')
      expect(marcadas()).toEqual(['media', 'exterior'])
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(alGuardar).toHaveBeenCalledWith(
        expect.objectContaining({ capas: ['media', 'exterior'] }),
      )
    })

    it('si corrige qué prenda es sin tocar las capas, las de la IA pasan a las de por defecto', async () => {
      const { usuario, alGuardar } = montar({ iniciales: ETIQUETAS_DE_PRUEBA })

      expect(marcadas()).toEqual(['base'])
      await usuario.click(screen.getByRole('radio', { name: 'Abrigo o chaqueta' }))
      await usuario.clear(screen.getByRole('textbox', { name: 'Tipo de prenda' }))
      await usuario.type(screen.getByRole('textbox', { name: 'Tipo de prenda' }), 'sobrecamisa')
      expect(marcadas()).toEqual(['media', 'exterior'])
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(alGuardar).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: 'abrigo', capas: ['media', 'exterior'] }),
      )
    })

    it('si ya las ha tocado, cambiar el tipo no se las cambia', async () => {
      const { usuario } = montar({ iniciales: ETIQUETAS_DE_PRUEBA })

      await usuario.click(grupo('Puede ir como').getByRole('checkbox', { name: 'media' }))
      await usuario.type(screen.getByRole('textbox', { name: 'Tipo de prenda' }), ' larga')

      expect(marcadas()).toEqual(['base', 'media'])
    })

    it('una prenda de antes, sin capas, enseña las de por defecto', () => {
      montar({
        iniciales: {
          ...ETIQUETAS_DE_PRUEBA,
          capas: undefined,
          categoria: 'abrigo',
          subcategoria: 'americana',
        },
      })

      expect(marcadas()).toEqual(['media', 'exterior'])
    })

    it('no deja guardar una prenda de arriba sin ningún papel', async () => {
      const { usuario, alGuardar } = montar({ iniciales: ETIQUETAS_DE_PRUEBA })

      await usuario.click(grupo('Puede ir como').getByRole('checkbox', { name: 'base' }))
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(grupo('Puede ir como').getByRole('alert')).toHaveTextContent('Elige al menos uno.')
      expect(alGuardar).not.toHaveBeenCalled()
      await usuario.click(grupo('Puede ir como').getByRole('checkbox', { name: 'media' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('si deja de ser de arriba, se guarda sin capas', async () => {
      const { usuario, alGuardar } = montar({ iniciales: ETIQUETAS_DE_PRUEBA })

      await usuario.click(screen.getByRole('radio', { name: 'Parte de abajo' }))
      expect(screen.queryByRole('group', { name: /^Puede ir como/ })).not.toBeInTheDocument()
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(alGuardar.mock.calls[0]?.[0]).toHaveProperty('capas', undefined)
    })
  })

  it('el nivel elegido se lee en el título', async () => {
    const { usuario } = montar()

    await usuario.click(screen.getByRole('radio', { name: '4: Abriga' }))

    expect(screen.getByRole('group', { name: 'Abrigo: 4 · Abriga' })).toBeInTheDocument()
  })

  it('conserva colores y estampados que no están en la lista, y deja quitarlos', async () => {
    const { usuario, alGuardar } = montar({
      iniciales: { ...ETIQUETAS_DE_PRUEBA, colores: ['fucsia', 'negro'], estampado: 'cachemir' },
    })

    expect(grupo('Colores').getByRole('checkbox', { name: 'fucsia' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Estampado' })).toHaveValue('cachemir')
    await usuario.click(grupo('Colores').getByRole('checkbox', { name: 'fucsia' }))
    expect(grupo('Colores').getByRole('checkbox', { name: 'fucsia' })).not.toBeChecked()
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ colores: ['negro'], estampado: 'cachemir' }),
    )
  })

  it('con una prenda entera de valores iniciales devuelve solo las etiquetas', async () => {
    const prenda = {
      ...ETIQUETAS_DE_PRUEBA,
      id: 'p1',
      etiquetadaPor: 'ia' as const,
      creadaEn: 1,
      fotos: [],
    }
    const { usuario, alGuardar } = montar({ iniciales: prenda })

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(alGuardar).toHaveBeenCalledWith(ETIQUETAS_DE_PRUEBA)
  })

  it('un nivel fuera de 1–5 en los valores iniciales empieza en 3', async () => {
    const { usuario, alGuardar } = montar({
      iniciales: { ...ETIQUETAS_DE_PRUEBA, abrigo: 0, formalidad: 2.5 },
    })

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({ abrigo: 3, formalidad: 3 }))
  })

  it('con «ocupado» no deja guardar ni cancelar', () => {
    const alCancelar = vi.fn()
    montar({ ocupado: true, alCancelar, textoGuardar: 'Guardar prenda' })

    expect(screen.getByRole('button', { name: 'Guardar prenda' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })

  it('«Cancelar» solo sale si se pide y avisa sin guardar', async () => {
    const alCancelar = vi.fn()
    const { usuario, alGuardar } = montar({ alCancelar })

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(alCancelar).toHaveBeenCalledOnce()
    expect(alGuardar).not.toHaveBeenCalled()
  })
})
