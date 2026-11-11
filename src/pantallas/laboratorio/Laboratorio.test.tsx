import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccesoLaboratorio } from '../../componentes/AccesoLaboratorio.tsx'
import type { Prenda } from '../../datos/modelo.ts'
import { nuevaPrenda } from '../../datos/pruebas.ts'
import { crearProveedorFalso, ErrorIA, type ProveedorIA } from '../../ia/index.ts'
import { simularUrlsDeBlob } from '../armario/urlsDePrueba.ts'
import { Laboratorio } from './Laboratorio.tsx'
import { exportarPrueba, MAX_PRENDAS_LABORATORIO } from './resultados.ts'

vi.setConfig({ testTimeout: 15_000 })

function prenda(n: number, cambios: Partial<Prenda> = {}): Prenda {
  return {
    ...nuevaPrenda({ subcategoria: `camiseta ${String(n)}`, marca: 'Zara', ...cambios }),
    id: `p${String(n)}`,
    creadaEn: n,
  }
}

function montar(prendas: Prenda[], proveedor: ProveedorIA | null = crearProveedorFalso()) {
  const descargar = vi.fn<(texto: string, nombre: string) => void>()
  render(
    <MemoryRouter>
      <Laboratorio
        listar={() => Promise.resolve(prendas)}
        obtenerProveedor={() => Promise.resolve(proveedor)}
        esperaEntrePeticiones={0}
        descargar={descargar}
      />
    </MemoryRouter>,
  )
  return { usuario: userEvent.setup(), descargar }
}

let urls: ReturnType<typeof simularUrlsDeBlob>

beforeEach(() => {
  localStorage.clear()
  urls = simularUrlsDeBlob()
})

afterEach(() => {
  urls.quitar()
})

describe('laboratorio de grounding', () => {
  it('deja elegir hasta 10 prendas', async () => {
    const { usuario } = montar(Array.from({ length: 11 }, (_, i) => prenda(i + 1)))

    for (let i = 1; i <= MAX_PRENDAS_LABORATORIO; i++) {
      await usuario.click(
        await screen.findByRole('button', { name: `Añadir Camiseta ${String(i)}` }),
      )
    }

    expect(screen.getByRole('heading', { name: 'Elegidas (10 de 10)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir Camiseta 11' })).toBeDisabled()
    await usuario.click(screen.getByRole('button', { name: 'Quitar Camiseta 1' }))
    expect(screen.getByRole('button', { name: 'Añadir Camiseta 11' })).toBeEnabled()
  })

  it('busca, enseña las candidatas con su enlace y su foto, y se marca el veredicto', async () => {
    const proveedor = crearProveedorFalso()
    const { usuario } = montar([prenda(1, { referencia: '4085/021' }), prenda(2)], proveedor)

    await usuario.click(await screen.findByRole('button', { name: 'Añadir Camiseta 1' }))
    await usuario.click(screen.getByRole('button', { name: 'Añadir Camiseta 2' }))
    await usuario.click(screen.getByRole('button', { name: 'Buscar las fichas' }))

    const primera = await screen.findByRole('listitem', { name: 'Camiseta 1' })
    const enlaces = await within(primera).findAllByRole('link', { name: 'Abrir la ficha' })
    expect(enlaces[0]).toHaveAttribute('href', 'https://example.com/ficha-1')
    expect(enlaces[0]).toHaveAttribute('rel', 'noreferrer')
    expect(within(primera).getByRole('img', { name: 'Foto de catálogo 1' })).toHaveAttribute(
      'referrerpolicy',
      'no-referrer',
    )
    expect(proveedor.fichasBuscadas.map((p) => p.subcategoria)).toEqual([
      'camiseta 1',
      'camiseta 2',
    ])
    expect(await screen.findByRole('button', { name: 'Todas buscadas' })).toBeDisabled()

    await usuario.click(within(primera).getByRole('radio', { name: 'Acierto' }))
    await usuario.click(
      within(screen.getByRole('listitem', { name: 'Camiseta 2' })).getByRole('radio', {
        name: 'Fallo',
      }),
    )
    expect(
      screen.getByText(/Aciertos 1 · A medias 0 · Fallos 1 · Sin marcar 0/),
    ).toBeInTheDocument()
  })

  it('exporta un JSON con lo encontrado y el veredicto, sin fotos ni clave', async () => {
    const { usuario, descargar } = montar([prenda(1, { referencia: '4085/021' })])

    await usuario.click(await screen.findByRole('button', { name: 'Añadir Camiseta 1' }))
    await usuario.click(screen.getByRole('button', { name: 'Buscar las fichas' }))
    await usuario.click(await screen.findByRole('radio', { name: 'A medias' }))
    await usuario.click(screen.getByRole('button', { name: 'Exportar resultados' }))

    const [texto, nombre] = descargar.mock.calls[0] ?? []
    expect(nombre).toMatch(/^percha-s9-grounding-\d{4}-\d{2}-\d{2}\.json$/)
    const json = JSON.parse(texto ?? '{}') as {
      resumen: { aMedias: number }
      prendas: Record<string, unknown>[]
    }
    expect(json.resumen.aMedias).toBe(1)
    expect(json.prendas[0]).toMatchObject({
      referencia: '4085/021',
      veredicto: 'a-medias',
      candidatas: expect.any(Array) as unknown,
      tokens: { total: 1350 },
    })
    expect(texto).not.toMatch(/fotos|clave|blob:/i)
  })

  it('sin cupo para y deja lo que falta pendiente', async () => {
    const { usuario } = montar(
      [prenda(1), prenda(2)],
      crearProveedorFalso({ error: new ErrorIA('sin-cupo') }),
    )

    await usuario.click(await screen.findByRole('button', { name: 'Añadir Camiseta 1' }))
    await usuario.click(screen.getByRole('button', { name: 'Añadir Camiseta 2' }))
    await usuario.click(screen.getByRole('button', { name: 'Buscar las fichas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Se ha acabado el cupo')
    expect(screen.queryByRole('link', { name: 'Ir a Ajustes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar las fichas' })).toBeEnabled()
  })

  it('si la búsqueda es de pago para tu clave, lo dice', async () => {
    const { usuario } = montar([prenda(1)], crearProveedorFalso({ error: new ErrorIA('de-pago') }))

    await usuario.click(await screen.findByRole('button', { name: 'Añadir Camiseta 1' }))
    await usuario.click(screen.getByRole('button', { name: 'Buscar las fichas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('facturación')
  })

  it('una respuesta que no se entiende queda en esa prenda y sigue con las demás', async () => {
    const proveedor = crearProveedorFalso()
    const buscar = vi
      .spyOn(proveedor, 'buscarFicha')
      .mockRejectedValueOnce(new ErrorIA('respuesta'))
    const { usuario } = montar([prenda(1), prenda(2)], proveedor)

    await usuario.click(await screen.findByRole('button', { name: 'Añadir Camiseta 1' }))
    await usuario.click(screen.getByRole('button', { name: 'Añadir Camiseta 2' }))
    await usuario.click(screen.getByRole('button', { name: 'Buscar las fichas' }))

    const segunda = screen.getByRole('listitem', { name: 'Camiseta 2' })
    expect(await within(segunda).findAllByRole('link', { name: 'Abrir la ficha' })).toHaveLength(2)
    expect(
      within(screen.getByRole('listitem', { name: 'Camiseta 1' })).getByText(
        /algo que no se entiende/,
      ),
    ).toBeInTheDocument()
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it('sin clave avisa con el enlace a Ajustes', async () => {
    const { usuario } = montar([prenda(1)], null)

    await usuario.click(await screen.findByRole('button', { name: 'Añadir Camiseta 1' }))
    await usuario.click(screen.getByRole('button', { name: 'Buscar las fichas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falta la clave')
    expect(screen.getByRole('link', { name: 'Ir a Ajustes' })).toHaveAttribute('href', '/ajustes')
  })

  it('lo buscado se guarda en el móvil y sigue ahí al volver', async () => {
    const prendas = [prenda(1)]
    const { usuario } = montar(prendas)
    await usuario.click(await screen.findByRole('button', { name: 'Añadir Camiseta 1' }))
    await usuario.click(screen.getByRole('button', { name: 'Buscar las fichas' }))
    await screen.findByRole('button', { name: 'Todas buscadas' })

    document.body.innerHTML = ''
    montar(prendas)

    expect(await screen.findAllByRole('link', { name: 'Abrir la ficha' })).toHaveLength(2)
  })
})

describe('exportar la prueba', () => {
  it('una prenda pendiente o con error dice su estado', () => {
    const texto = exportarPrueba(
      {
        elegidas: ['p1', 'p2'],
        estados: { p2: { fase: 'error', tipo: 'respuesta', mensaje: 'x' } },
        veredictos: {},
      },
      [prenda(1), prenda(2)],
      new Date('2026-11-11T10:00:00Z'),
    )

    const json = JSON.parse(texto) as { fecha: string; prendas: unknown[] }
    expect(json.fecha).toBe('2026-11-11T10:00:00.000Z')
    expect(json.prendas).toEqual([
      expect.objectContaining({ id: 'p1', estado: 'pendiente', error: null }),
      expect.objectContaining({ id: 'p2', estado: 'error', error: 'respuesta' }),
    ])
  })
})

describe('acceso al laboratorio desde Ajustes', () => {
  it('sale tras 5 toques seguidos en «Percha» y se puede ocultar', async () => {
    const usuario = userEvent.setup()
    render(
      <MemoryRouter>
        <AccesoLaboratorio />
      </MemoryRouter>,
    )
    const pie = screen.getByText(/Percha · tus datos/)

    for (let i = 0; i < 4; i++) await usuario.click(pie)
    expect(screen.queryByRole('link', { name: 'Laboratorio' })).not.toBeInTheDocument()
    await usuario.click(pie)
    expect(screen.getByRole('link', { name: 'Laboratorio' })).toHaveAttribute(
      'href',
      '/laboratorio',
    )
    expect(localStorage.getItem('percha:laboratorio')).toBe('1')

    await usuario.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(screen.queryByRole('link', { name: 'Laboratorio' })).not.toBeInTheDocument()
  })
})
