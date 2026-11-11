import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import {
  idTablaTallas,
  type DatosTablaTallas,
  type TablaTallas,
  type TipoTalla,
} from '../../datos/modelo.ts'
import { crearProveedorFalso, ErrorIA, type ProveedorIA } from '../../ia/index.ts'
import { TablasTallas } from './TablasTallas.tsx'

vi.setConfig({ testTimeout: 15_000 })

const pantalonZara: TablaTallas = {
  id: idTablaTallas('Zara', 'pantalón'),
  marca: 'Zara',
  tipo: 'pantalón',
  medidaDe: 'cuerpo',
  filas: [
    { talla: '40', cintura: 78, cadera: 96 },
    { talla: '42', cintura: 82.5, cadera: 100 },
  ],
  actualizadaEn: 1,
}

function repositorio(iniciales: TablaTallas[] = []) {
  let tablas = [...iniciales]
  const listar = vi.fn(() => Promise.resolve([...tablas]))
  const guardar = vi.fn((datos: DatosTablaTallas, anterior?: string) => {
    const tabla = { ...datos, id: idTablaTallas(datos.marca, datos.tipo), actualizadaEn: 2 }
    tablas = [...tablas.filter((t) => t.id !== tabla.id && t.id !== anterior), tabla]
    return Promise.resolve(tabla)
  })
  const borrar = vi.fn((id: string) => {
    tablas = tablas.filter((t) => t.id !== id)
    return Promise.resolve()
  })
  return { listar, guardar, borrar }
}

function montar(
  repo = repositorio(),
  {
    de,
    proveedor = crearProveedorFalso(),
  }: { de?: { marca: string; tipo: TipoTalla }; proveedor?: ProveedorIA | null } = {},
) {
  render(
    <MemoryRouter>
      <TablasTallas
        {...repo}
        {...(de && { de })}
        obtenerProveedor={() => Promise.resolve(proveedor)}
      />
    </MemoryRouter>,
  )
  return { usuario: userEvent.setup({ delay: null }), repo }
}

async function subirCaptura(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.upload(
    await screen.findByLabelText('Captura de la guía de tallas'),
    new File(['png'], 'guia.png', { type: 'image/png' }),
  )
}

describe('tablas de tallas', () => {
  it('desde una captura: la IA la lee, se revisa y se guarda', async () => {
    const proveedor = crearProveedorFalso()
    const { usuario, repo } = montar(repositorio(), { proveedor })

    expect(await screen.findByText(/Haz una captura de la guía/)).toBeInTheDocument()
    await subirCaptura(usuario)

    expect(await screen.findByRole('textbox', { name: 'Marca' })).toHaveValue('Zara')
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue('pantalón')
    expect(screen.getByRole('textbox', { name: 'Cintura de la talla 40 (cm)' })).toHaveValue('78')
    expect(proveedor.tablasLeidas).toHaveLength(1)
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))

    expect(repo.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ marca: 'Zara', tipo: 'pantalón', medidaDe: 'cuerpo' }),
      undefined,
    )
    expect(await screen.findByText('Zara · pantalón')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Tabla de Zara · pantalón guardada.')
  })

  it('a mano: valida la marca, las tallas y los números, y guarda con coma decimal', async () => {
    const { usuario, repo } = montar()

    await usuario.click(await screen.findByRole('button', { name: 'Escribirla a mano' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe la marca.')

    await usuario.type(screen.getByRole('textbox', { name: 'Marca' }), 'Mango')
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'calzado')
    await usuario.type(screen.getByRole('textbox', { name: 'Talla de la fila 1' }), '42')
    await usuario.type(screen.getByRole('textbox', { name: 'Pie de la talla 42 (cm)' }), 'mucho')
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los números de la talla 42.')

    await usuario.clear(screen.getByRole('textbox', { name: 'Pie de la talla 42 (cm)' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Pie de la talla 42 (cm)' }), '27,5')
    await usuario.click(screen.getByRole('button', { name: 'Añadir talla' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Talla de la fila 2' }), '42')
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pon alguna medida a la talla 42.')

    await usuario.click(
      screen.getAllByRole('button', { name: 'Quitar la talla 42' })[1] ?? document.body,
    )
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))

    expect(repo.guardar).toHaveBeenCalledWith(
      { marca: 'Mango', tipo: 'calzado', medidaDe: 'cuerpo', filas: [{ talla: '42', pie: 27.5 }] },
      undefined,
    )
  })

  it('al cambiar el tipo, solo cuentan sus medidas', async () => {
    const { usuario, repo } = montar()

    await usuario.click(await screen.findByRole('button', { name: 'Escribirla a mano' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Marca' }), 'H&M')
    await usuario.type(screen.getByRole('textbox', { name: 'Talla de la fila 1' }), 'M')
    await usuario.type(screen.getByRole('textbox', { name: 'Pecho de la talla M (cm)' }), '100')
    await usuario.type(screen.getByRole('textbox', { name: 'Cintura de la talla M (cm)' }), '86')
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'pantalón')
    expect(
      screen.queryByRole('textbox', { name: 'Pecho de la talla M (cm)' }),
    ).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))

    expect(repo.guardar.mock.calls[0]?.[0].filas).toEqual([{ talla: 'M', cintura: 86 }])
  })

  it('en el detalle de una prenda sin tabla, la añade con su marca y su tipo', async () => {
    const proveedor = crearProveedorFalso({
      tablaTallas: () => ({
        tipo: 'parte de arriba',
        medidaDe: 'prenda',
        filas: [{ talla: 'L', cintura: 90 }],
      }),
    })
    const { usuario, repo } = montar(repositorio([pantalonZara]), {
      de: { marca: 'Mango', tipo: 'pantalón' },
      proveedor,
    })

    expect(
      await screen.findByText(
        'Tabla de tallas de Mango · pantalón: añádela desde una captura de la guía de la tienda.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Zara/)).not.toBeInTheDocument()
    await subirCaptura(usuario)
    expect(await screen.findByRole('textbox', { name: 'Marca' })).toHaveValue('Mango')
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue('pantalón')
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))

    expect(repo.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ marca: 'Mango', tipo: 'pantalón', medidaDe: 'prenda' }),
      undefined,
    )
    expect(await screen.findByText('Tabla de tallas de Mango · pantalón')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir desde foto' })).not.toBeInTheDocument()
  })

  it('en el detalle de una prenda con tabla: se ve, se edita y se borra', async () => {
    const { usuario, repo } = montar(repositorio([pantalonZara]), {
      de: { marca: 'ZARA', tipo: 'pantalón' },
    })

    await usuario.click(await screen.findByRole('button', { name: 'Ver' }))
    const tabla = screen.getByRole('table')
    expect(within(tabla).getByRole('row', { name: /42/ })).toHaveTextContent('82,5')
    expect(within(tabla).queryByText('Pierna')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Editar' }))
    await usuario.clear(screen.getByRole('textbox', { name: 'Marca' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Marca' }), 'Zara Man')
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))
    expect(repo.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ marca: 'Zara Man' }),
      pantalonZara.id,
    )
  })

  it('antes de sustituir otra tabla de la misma marca y tipo, pregunta', async () => {
    const { usuario, repo } = montar(repositorio([pantalonZara]))

    await usuario.click(await screen.findByRole('button', { name: 'Escribirla a mano' }))
    await usuario.type(screen.getByRole('textbox', { name: 'Marca' }), ' zara ')
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'pantalón')
    await usuario.type(screen.getByRole('textbox', { name: 'Talla de la fila 1' }), '46')
    await usuario.type(screen.getByRole('textbox', { name: 'Cintura de la talla 46 (cm)' }), '90')
    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))

    expect(screen.getByText(/Ya tienes una tabla de zara · pantalón/)).toBeInTheDocument()
    expect(repo.guardar).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'No, volver' }))
    expect(screen.getByRole('textbox', { name: 'Cintura de la talla 46 (cm)' })).toHaveValue('90')

    await usuario.click(screen.getByRole('button', { name: 'Guardar tabla' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, sustituir' }))
    expect(repo.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ marca: 'zara', filas: [{ talla: '46', cintura: 90 }] }),
      undefined,
    )
  })

  it('en el detalle, la marca es la de la prenda aunque la captura diga otra', async () => {
    const proveedor = crearProveedorFalso({
      tablaTallas: () => ({
        marca: 'Zara Man',
        tipo: 'pantalón',
        medidaDe: 'cuerpo',
        filas: [{ talla: '42', cintura: 82 }],
      }),
    })
    const { usuario } = montar(repositorio(), {
      de: { marca: 'Zara', tipo: 'pantalón' },
      proveedor,
    })

    await subirCaptura(usuario)

    expect(await screen.findByRole('textbox', { name: 'Marca' })).toHaveValue('Zara')
  })

  it('borrar pide confirmación', async () => {
    const { usuario, repo } = montar(repositorio([pantalonZara]))

    await usuario.click(await screen.findByRole('button', { name: 'Ver' }))
    await usuario.click(screen.getByRole('button', { name: 'Borrar' }))
    await usuario.click(screen.getByRole('button', { name: 'No' }))
    expect(repo.borrar).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    expect(repo.borrar).toHaveBeenCalledWith(pantalonZara.id)
    expect(await screen.findByText(/Haz una captura de la guía/)).toBeInTheDocument()
  })

  it('sin clave lo avisa con el enlace a Ajustes', async () => {
    const { usuario } = montar(repositorio(), { proveedor: null })

    await subirCaptura(usuario)

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Falta la clave de Gemini')
    expect(within(aviso).getByRole('link', { name: 'Ir a Ajustes' })).toBeInTheDocument()
  })

  it('si la IA no puede leerla, lo dice y no abre el editor', async () => {
    const { usuario } = montar(repositorio(), {
      proveedor: crearProveedorFalso({ error: new ErrorIA('respuesta') }),
    })

    await subirCaptura(usuario)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido leer la tabla')
    expect(screen.queryByRole('button', { name: 'Guardar tabla' })).not.toBeInTheDocument()
  })

  it('si no se pueden leer las tablas, lo dice sin romper', async () => {
    montar({ ...repositorio(), listar: vi.fn(() => Promise.reject(new Error('sin base'))) })

    expect(
      await screen.findByText('No se han podido leer las tablas de tallas.'),
    ).toBeInTheDocument()
  })
})
