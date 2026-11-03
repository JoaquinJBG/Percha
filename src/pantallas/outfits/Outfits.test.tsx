import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NuevaPrenda, NuevoOutfit, Outfit, Prenda } from '../../datos/modelo.ts'
import { nuevaPrenda } from '../../datos/pruebas.ts'
import { crearContexto, type ResultadoOutfits } from '../../outfits/reglas/index.ts'
import { tiempo as tiempoDePrueba } from '../../outfits/reglas/pruebas.ts'
import type { AlmacenSitio, Sitio } from '../../tiempo/index.ts'
import { simularUrlsDeBlob } from '../armario/urlsDePrueba.ts'
import { ELECCION_POR_DEFECTO, type AlmacenEleccion, type Eleccion } from './eleccion.ts'
import { Outfits } from './Outfits.tsx'
import type { Compartidor } from './Resultado.tsx'
import type { SelectorOutfits } from './selector.ts'

let siguienteId = 0
function prenda(cambios: Partial<NuevaPrenda> = {}): Prenda {
  siguienteId += 1
  return { ...nuevaPrenda(cambios), id: `p${String(siguienteId)}`, creadaEn: siguienteId }
}

const camiseta = () => prenda({ subcategoria: 'camiseta' })
const vaquero = () => prenda({ categoria: 'inferior', subcategoria: 'vaqueros', colores: ['azul'] })
const zapatillas = () => prenda({ categoria: 'calzado', subcategoria: 'zapatillas' })

/** Cuatro outfits fijos, con el contexto que daría la petición. */
function selectorFalso(cuantos = 4) {
  return vi.fn<SelectorOutfits>((peticion) => {
    const outfits = Array.from({ length: cuantos }, (_, i) => {
      const principal = camiseta()
      return {
        prendas: [principal, vaquero(), zapatillas()],
        principal,
        puntos: 10,
        motivo: `motivo ${String(i + 1)}`,
      }
    })
    const resultado: ResultadoOutfits<Prenda> = {
      contexto: crearContexto(peticion),
      outfits,
      avisos: [],
    }
    return Promise.resolve(resultado)
  })
}

function almacenEleccion(inicial: Eleccion = ELECCION_POR_DEFECTO) {
  let guardada = inicial
  return {
    leer: () => guardada,
    guardar: vi.fn((eleccion: Eleccion) => {
      guardada = eleccion
    }),
  } satisfies AlmacenEleccion
}

const madrid: Sitio = { nombre: 'Madrid', latitud: 40.4, longitud: -3.7 }
const sinSitio: AlmacenSitio = { leer: () => null, guardar: () => undefined }

/** En memoria; `fallaEn` hace que falle la llamada n-ésima a `guardar` (empezando en 1). */
function repositorio(fallaEn = 0) {
  const guardados: Outfit[] = []
  let llamadas = 0
  const guardar = vi.fn((datos: NuevoOutfit) => {
    llamadas += 1
    if (llamadas === fallaEn) return Promise.reject(new Error('disco lleno'))
    const outfit = { ...datos, id: `o${String(guardados.length + 1)}`, creadoEn: 1 }
    guardados.push(outfit)
    return Promise.resolve(outfit)
  })
  const marcar = vi.fn<(id: string, favorito: boolean) => Promise<void>>(() => Promise.resolve())
  return { guardados, guardar, marcar }
}

interface Opciones {
  /** `'reglas'`: sin selector, para usar las reglas de verdad. */
  elegir?: SelectorOutfits | 'reglas'
  prendas?: Prenda[]
  eleccion?: ReturnType<typeof almacenEleccion>
  repo?: ReturnType<typeof repositorio>
  compartidor?: Compartidor
  conTiempo?: boolean
}

const collage = new Blob(['jpeg'], { type: 'image/jpeg' })

function montar({
  elegir = selectorFalso(),
  prendas = [camiseta(), vaquero(), zapatillas()],
  eleccion = almacenEleccion(),
  repo = repositorio(),
  compartidor = {},
  conTiempo = false,
}: Opciones = {}) {
  const listar = vi.fn(() => Promise.resolve(prendas))
  const componer = vi.fn(() => Promise.resolve(collage))
  const propsTiempo = conTiempo
    ? {
        consultar: () => Promise.resolve(tiempoDePrueba(8, { precipitacion: 'lluvia' })),
        almacenSitio: {
          leer: () => ({ tipo: 'ciudad' as const, sitio: madrid }),
          guardar: () => undefined,
        },
      }
    : { almacenSitio: sinSitio }
  const router = createMemoryRouter(
    [
      {
        path: '/outfits',
        element: (
          <Outfits
            {...(elegir === 'reglas' ? {} : { elegir })}
            listar={listar}
            almacenEleccion={eleccion}
            propsTiempo={propsTiempo}
            hoy={() => new Date(2026, 10, 3, 0, 30)}
            componer={componer}
            guardar={repo.guardar}
            marcar={repo.marcar}
            compartidor={compartidor}
          />
        ),
      },
      { path: '/prendas/nueva', element: <h1>Nueva prenda</h1> },
    ],
    { initialEntries: ['/outfits'] },
  )
  render(<RouterProvider router={router} />)
  return { usuario: userEvent.setup(), router, listar, componer, repo }
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

async function generar(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: /^Generar/ }))
  return screen.findByRole('img', { name: /Collage/ })
}

describe('Outfits', () => {
  it('genera con el selector inyectado y enseña el collage con los 4 motivos', async () => {
    const elegir = selectorFalso()
    const { usuario, componer } = montar({ elegir })

    await usuario.selectOptions(screen.getByLabelText('Estilo'), 'business')
    await usuario.selectOptions(screen.getByLabelText('Ocasión'), 'trabajo')
    const imagen = await generar(usuario)

    expect(elegir).toHaveBeenCalledTimes(1)
    const [peticion, intento] = elegir.mock.calls[0] ?? []
    expect(peticion).toMatchObject({
      estilo: 'business',
      ocasion: 'trabajo',
      tiempo: null,
      // Fecha local: a las 00:30 del 3 de noviembre sigue siendo día 3.
      fecha: '2026-11-03',
    })
    expect(peticion?.prendas).toHaveLength(3)
    expect(intento).toBe(1)
    expect(componer).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ motivo: 'motivo 1' })]),
    )
    expect(urls.blobs.get(imagen.getAttribute('src') ?? '')).toBe(collage)
    const tusOutfits = screen.getByRole('region', { name: 'Tus outfits' })
    const motivos = within(tusOutfits).getAllByRole('listitem')
    expect(motivos.map((m) => m.textContent)).toEqual([
      expect.stringContaining('Motivo 1'),
      expect.stringContaining('Motivo 2'),
      expect.stringContaining('Motivo 3'),
      expect.stringContaining('Motivo 4'),
    ])

    await usuario.click(screen.getByRole('button', { name: 'Generar otros' }))
    expect(elegir).toHaveBeenLastCalledWith(expect.anything(), 2)
  })

  it('por defecto usa las reglas y pasa el tiempo de hoy', async () => {
    const { usuario, repo } = montar({
      elegir: 'reglas',
      conTiempo: true,
      prendas: armarioConAbrigo(),
    })

    await screen.findByText(/Madrid/)
    await generar(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(repo.guardar).toHaveBeenCalled()
    expect(repo.guardar.mock.calls[0]?.[0].tiempo).toEqual({ temperatura: 8, lluvia: true })
    const tusOutfits = screen.getByRole('region', { name: 'Tus outfits' })
    expect(within(tusOutfits).getAllByRole('listitem')[0]?.textContent).toContain('Abrigo por 8 °C')
  })

  it('recuerda la última elección de estilo y ocasión', async () => {
    const eleccion = almacenEleccion({ estilo: 'boho', ocasion: 'playa / piscina' })
    const { usuario } = montar({ eleccion })

    expect(screen.getByLabelText('Estilo')).toHaveValue('boho')
    expect(screen.getByLabelText('Ocasión')).toHaveValue('playa / piscina')

    await usuario.selectOptions(screen.getByLabelText('Ocasión'), 'cena')
    expect(eleccion.guardar).toHaveBeenLastCalledWith({ estilo: 'boho', ocasion: 'cena' })
  })

  it('con el armario incompleto explica qué falta y enlaza al alta', async () => {
    const { usuario, router, componer } = montar({
      elegir: 'reglas',
      prendas: [camiseta(), vaquero()],
    })

    await usuario.click(screen.getByRole('button', { name: 'Generar' }))

    expect(await screen.findByText(/Te falta calzado/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(componer).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('link', { name: 'Añadir prenda' }))
    expect(router.state.location.pathname).toBe('/prendas/nueva')
  })

  it('con el armario vacío lo dice', async () => {
    const { usuario } = montar({ elegir: 'reglas', prendas: [] })

    await usuario.click(screen.getByRole('button', { name: 'Generar' }))

    expect(await screen.findByText(/Tu armario está vacío/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Añadir prenda' })).toBeInTheDocument()
  })

  it('con menos de 4 outfits enseña los que hay y el aviso', async () => {
    const elegir = vi.fn<SelectorOutfits>(async (peticion, intento) => {
      const resultado = await selectorFalso(2)(peticion, intento)
      return {
        ...resultado,
        avisos: ['solo salen 2 outfits distintos: añade prendas para tener 4'],
      }
    })
    const { usuario } = montar({ elegir })

    await generar(usuario)

    expect(screen.getByText(/Solo salen 2 outfits/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Favorito/ })).toHaveLength(2)
  })

  it('avisa si falla el selector', async () => {
    const { usuario } = montar({ elegir: () => Promise.reject(new Error('sin cupo')) })

    await usuario.click(screen.getByRole('button', { name: 'Generar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se han podido generar')
  })

  it('guarda los 4 outfits una sola vez', async () => {
    const repo = repositorio()
    const { usuario } = montar({ repo })
    await generar(usuario)

    const guardar = screen.getByRole('button', { name: 'Guardar' })
    await usuario.dblClick(guardar)

    expect(await screen.findByText('Outfits guardados.')).toBeInTheDocument()
    expect(repo.guardar).toHaveBeenCalledTimes(4)
    expect(repo.guardar.mock.calls[0]?.[0]).toEqual({
      prendas: expect.any(Array) as string[],
      estilo: 'casual',
      ocasion: 'diario',
      tiempo: null,
      explicacion: 'motivo 1',
      favorito: false,
    })
    expect(screen.getByRole('button', { name: 'Guardados' })).toBeDisabled()
  })

  it('si falla a medias, reintentar no duplica los ya guardados', async () => {
    const repo = repositorio(2)
    const { usuario } = montar({ repo })
    await generar(usuario)

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/No se han podido guardar/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Outfits guardados.')).toBeInTheDocument()
    expect(repo.guardados.map((o) => o.explicacion)).toEqual([
      'motivo 1',
      'motivo 2',
      'motivo 3',
      'motivo 4',
    ])
  })

  it('el favorito guarda el outfit si no lo estaba y luego lo cambia', async () => {
    const repo = repositorio()
    const { usuario } = montar({ repo })
    await generar(usuario)
    const estrella = screen.getByRole('button', { name: 'Favorito: outfit 2' })

    await usuario.click(estrella)
    expect(repo.guardar).toHaveBeenCalledTimes(1)
    expect(repo.guardar.mock.calls[0]?.[0]).toMatchObject({
      explicacion: 'motivo 2',
      favorito: true,
    })
    expect(estrella).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(estrella)
    expect(repo.marcar).toHaveBeenLastCalledWith('o1', false)
    expect(estrella).toHaveAttribute('aria-pressed', 'false')

    // «Guardar» ya no vuelve a guardar el 2.
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(repo.guardar).toHaveBeenCalledTimes(4)
    await usuario.click(screen.getByRole('button', { name: 'Favorito: outfit 1' }))
    expect(repo.marcar).toHaveBeenLastCalledWith('o2', true)
  })

  it('no deja generar otra tanda mientras se guarda', async () => {
    const repo = repositorio()
    let terminar: () => void = () => undefined
    repo.guardar.mockImplementationOnce(
      (datos) =>
        new Promise((resolver) => {
          terminar = () => {
            resolver({ ...datos, id: 'lento', creadoEn: 1 })
          }
        }),
    )
    const { usuario } = montar({ repo })
    await generar(usuario)

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('button', { name: 'Generar otros' })).toBeDisabled()
    terminar()

    expect(await screen.findByText('Outfits guardados.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar otros' })).toBeEnabled()
  })

  it('descarga el collage con un nombre con la fecha', async () => {
    const { usuario } = montar()
    const imagen = await generar(usuario)

    const enlace = screen.getByRole('link', { name: 'Descargar' })
    expect(enlace).toHaveAttribute('download', 'percha-outfits-2026-11-03.jpg')
    expect(enlace).toHaveAttribute('href', imagen.getAttribute('src'))
  })

  it('comparte la imagen como fichero cuando se puede', async () => {
    const share = vi.fn<Navigator['share']>(() => Promise.resolve())
    const canShare = vi.fn<Navigator['canShare']>(() => true)
    const { usuario } = montar({ compartidor: { share, canShare } })
    await generar(usuario)

    await usuario.click(screen.getByRole('button', { name: 'Compartir' }))

    const datos = share.mock.calls[0]?.[0]
    const [fichero] = datos?.files ?? []
    expect(fichero?.name).toBe('percha-outfits-2026-11-03.jpg')
    expect(fichero?.type).toBe('image/jpeg')
    expect(canShare).toHaveBeenCalledWith({ files: [fichero] })
  })

  it('no dice nada si el usuario cancela el compartir, y avisa si falla', async () => {
    const share = vi
      .fn<Navigator['share']>()
      .mockRejectedValueOnce(new DOMException('cancelado', 'AbortError'))
      .mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
    const { usuario } = montar({ compartidor: { share, canShare: () => true } })
    await generar(usuario)

    await usuario.click(screen.getByRole('button', { name: 'Compartir' }))
    expect(screen.queryByText(/No se ha podido compartir/)).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Compartir' }))
    expect(await screen.findByText(/No se ha podido compartir/)).toBeInTheDocument()
  })

  it('ignora un segundo toque en Compartir con la hoja aún abierta', async () => {
    let cerrar: () => void = () => undefined
    const share = vi.fn<Navigator['share']>(
      () =>
        new Promise((resolver) => {
          cerrar = resolver
        }),
    )
    const { usuario } = montar({ compartidor: { share, canShare: () => true } })
    await generar(usuario)

    const boton = screen.getByRole('button', { name: 'Compartir' })
    await usuario.click(boton)
    await usuario.click(boton)
    cerrar()

    expect(share).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/No se ha podido compartir/)).not.toBeInTheDocument()
  })

  it('sin Web Share con ficheros no ofrece Compartir', async () => {
    const { usuario } = montar({ compartidor: { share: vi.fn(), canShare: () => false } })
    await generar(usuario)

    expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Descargar' })).toBeInTheDocument()
  })

  it('libera la URL del collage al generar otro', async () => {
    const { usuario } = montar()
    const primera = (await generar(usuario)).getAttribute('src')

    await usuario.click(screen.getByRole('button', { name: 'Generar otros' }))
    await screen.findByRole('img', { name: /Collage/ })

    expect(urls.revocar).toHaveBeenCalledWith(primera)
  })
})

function armarioConAbrigo(): Prenda[] {
  const deInvierno = { abrigo: 3, temporadas: [], ocasiones: [] } satisfies Partial<NuevaPrenda>
  return [
    prenda({ ...deInvierno, subcategoria: 'jersey' }),
    prenda({ ...deInvierno, categoria: 'inferior', subcategoria: 'vaqueros', colores: ['azul'] }),
    prenda({ ...deInvierno, categoria: 'calzado', subcategoria: 'botas', colores: ['negro'] }),
    prenda({
      ...deInvierno,
      categoria: 'abrigo',
      subcategoria: 'chaquetón',
      abrigo: 5,
      colores: ['negro'],
    }),
  ]
}
