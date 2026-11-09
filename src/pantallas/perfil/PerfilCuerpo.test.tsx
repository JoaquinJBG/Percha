import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PERFIL_VACIO, perfilSchema, type Perfil as DatosPerfil } from '../../datos/modelo.ts'
import { Perfil } from './Perfil.tsx'

/** Un perfil en memoria que valida como `guardarPerfil`, con el mismo esquema. */
function montar(inicial: Partial<DatosPerfil> = {}) {
  let guardado: DatosPerfil = { ...PERFIL_VACIO, ...inicial }
  const guardar = vi.fn((cambios: Partial<DatosPerfil>) => {
    guardado = perfilSchema.parse({ ...guardado, ...cambios })
    return Promise.resolve(guardado)
  })
  render(
    <Perfil
      leer={() => Promise.resolve(guardado)}
      guardar={guardar}
      normalizar={(foto) => Promise.resolve(foto)}
    />,
  )
  return { usuario: userEvent.setup(), guardar, guardado: () => guardado }
}

/** Pega el texto de una vez: teclearlo letra a letra repinta toda la pantalla en cada una. */
async function escribir(
  usuario: ReturnType<typeof userEvent.setup>,
  campo: HTMLElement,
  texto: string,
) {
  await usuario.click(campo)
  await usuario.paste(texto)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Tu cuerpo', () => {
  it('guarda las medidas, con coma decimal, la complexión y la línea libre', async () => {
    const { usuario, guardar, guardado } = montar()
    await escribir(usuario, await screen.findByRole('textbox', { name: 'Altura' }), '176')
    await escribir(usuario, screen.getByRole('textbox', { name: 'Peso' }), '100')
    await escribir(usuario, screen.getByRole('textbox', { name: 'Cintura' }), ' 98,5 ')
    await usuario.click(screen.getByRole('button', { name: 'grande' }))
    await escribir(
      usuario,
      screen.getByRole('textbox', { name: 'Algo más de tu cuerpo' }),
      'hombros anchos',
    )

    await usuario.click(screen.getByRole('button', { name: 'Guardar medidas' }))

    expect(await screen.findByText('Medidas guardadas.')).toBeInTheDocument()
    expect(guardar).toHaveBeenCalledWith({
      cuerpo: {
        altura: 176,
        peso: 100,
        cintura: 98.5,
        complexion: 'grande',
        notas: 'hombros anchos',
      },
    })
    expect(guardado().cuerpo).toEqual({
      altura: 176,
      peso: 100,
      cintura: 98.5,
      complexion: 'grande',
      notas: 'hombros anchos',
    })
  })

  it('enseña lo guardado y deja quitar una medida', async () => {
    const { usuario, guardar } = montar({
      cuerpo: { altura: 176, cadera: 112.5, complexion: 'atlética' },
    })
    const cadera = await screen.findByRole('textbox', { name: 'Cadera' })
    expect(cadera).toHaveValue('112,5')
    expect(screen.getByRole('button', { name: 'atlética' })).toHaveAttribute('aria-pressed', 'true')

    await usuario.clear(cadera)
    await usuario.click(screen.getByRole('button', { name: 'Guardar medidas' }))

    expect(await screen.findByText('Medidas guardadas.')).toBeInTheDocument()
    expect(guardar).toHaveBeenCalledWith({ cuerpo: { altura: 176, complexion: 'atlética' } })
  })

  it('si se vacía todo, el perfil se queda sin cuerpo', async () => {
    const { usuario, guardar, guardado } = montar({ cuerpo: { altura: 176 } })

    await usuario.clear(await screen.findByRole('textbox', { name: 'Altura' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar medidas' }))

    expect(await screen.findByText('Medidas guardadas.')).toBeInTheDocument()
    expect(guardar).toHaveBeenCalledWith({ cuerpo: undefined })
    expect(guardado().cuerpo).toBeUndefined()
  })

  it('no guarda una medida fuera de rango ni un texto que no es un número', async () => {
    const { usuario, guardar } = montar()
    const altura = await screen.findByRole('textbox', { name: 'Altura' })
    await escribir(usuario, altura, '300')
    await escribir(usuario, screen.getByRole('textbox', { name: 'Pecho' }), 'mucho')

    await usuario.click(screen.getByRole('button', { name: 'Guardar medidas' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Revisa las medidas marcadas.')
    expect(altura).toHaveAttribute('aria-invalid', 'true')
    expect(altura).toHaveAccessibleDescription('Entre 100 y 230 cm.')
    expect(screen.getByRole('textbox', { name: 'Pecho' })).toHaveAccessibleDescription(
      'Escribe solo el número, por ejemplo 84 o 84,5.',
    )
    expect(guardar).not.toHaveBeenCalled()
  })

  it('cada medida explica cómo tomarla', async () => {
    montar()
    const cuerpo = within(await screen.findByRole('region', { name: 'Tu cuerpo' }))

    expect(cuerpo.getAllByText('Cómo medirte')).toHaveLength(6)
    expect(cuerpo.getByText(/de la entrepierna al suelo/)).toBeInTheDocument()
  })

  it('avisa de que se queda en el móvil y no va a Gemini', async () => {
    montar()

    expect(await screen.findByText(/no se manda a Gemini/)).toBeInTheDocument()
  })

  it('si no se puede guardar, lo dice', async () => {
    const { usuario, guardar } = montar()
    guardar.mockRejectedValueOnce(new Error('rota'))

    await escribir(usuario, await screen.findByRole('textbox', { name: 'Altura' }), '176')
    await usuario.click(screen.getByRole('button', { name: 'Guardar medidas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se han podido guardar las medidas.',
    )
  })
})

describe('Trabajo y temperatura', () => {
  it('marca la oficina y el viernes casual, y deja desmarcarla', async () => {
    const { usuario, guardado } = montar()
    const viernes = await screen.findByRole('checkbox', { name: 'Hay viernes casual' })
    expect(viernes).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: 'estándar' }))
    expect(guardado().oficina).toEqual({ tipo: 'estándar', viernesCasual: false })
    await vi.waitFor(() => {
      expect(viernes).toBeEnabled()
    })

    await usuario.click(viernes)
    await vi.waitFor(() => {
      expect(guardado().oficina).toEqual({ tipo: 'estándar', viernesCasual: true })
    })

    await usuario.click(screen.getByRole('button', { name: 'creativa' }))
    await vi.waitFor(() => {
      expect(guardado().oficina).toEqual({ tipo: 'creativa', viernesCasual: true })
    })

    await usuario.click(screen.getByRole('button', { name: 'creativa' }))
    await vi.waitFor(() => {
      expect(guardado().oficina).toBeUndefined()
    })
    expect(viernes).not.toBeChecked()
  })

  it('marca y desmarca la sensación térmica', async () => {
    const { usuario, guardado } = montar()

    await usuario.click(await screen.findByRole('button', { name: 'caluroso' }))
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'caluroso' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
    expect(guardado().sensacionTermica).toBe('caluroso')

    await usuario.click(screen.getByRole('button', { name: 'caluroso' }))
    await vi.waitFor(() => {
      expect(guardado().sensacionTermica).toBeUndefined()
    })
  })

  it('si no se puede guardar, lo dice y no lo marca', async () => {
    const { usuario, guardar } = montar()
    guardar.mockRejectedValueOnce(new Error('rota'))

    await usuario.click(await screen.findByRole('button', { name: 'friolero' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar el cambio.')
    expect(screen.getByRole('button', { name: 'friolero' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
