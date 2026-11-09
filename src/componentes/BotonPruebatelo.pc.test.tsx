import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Categoria } from '../datos/modelo.ts'
import { nuevaPrenda } from '../datos/pruebas.ts'
import { simularUrlsDeBlob } from '../pantallas/armario/urlsDePrueba.ts'
import { crearClienteProbador } from '../probador/index.ts'
import { CLAVE_FALSA, servidorFalso, URL_FALSA } from '../probador/servidorFalso.ts'
import type { TryOn } from '../tryon/index.ts'
import { BotonPruebatelo, type CompartidorTryOn } from './BotonPruebatelo.tsx'

const INSTRUCCION = 'En Gemini, toca la sugerencia del teclado para pegar el texto y envía.'
const foto = new Blob(['cuerpo'], { type: 'image/jpeg' })
const tryon: TryOn = {
  fichero: new File(['jpeg'], 'percha-pruebatelo.jpg', { type: 'image/jpeg' }),
  texto: 'Te paso una imagen…',
}
const sinEsperas = () => Promise.resolve()

function ropa(categoria: Categoria, abrigo = 2, subcategoria: string = categoria) {
  return { ...nuevaPrenda({ categoria, abrigo, subcategoria }), id: subcategoria, creadaEn: 0 }
}

interface Opciones {
  servidor?: Parameters<typeof servidorFalso>[0]
  clave?: string
  prendas?: ReturnType<typeof ropa>[]
  fotoCuerpo?: Blob | null
  leerFotoCuerpo?: () => Promise<Blob | null>
  fotoInterior?: Blob | null
  esperar?: (ms: number, signal?: AbortSignal) => Promise<void>
  compartidor?: CompartidorTryOn
}

function montar({
  servidor: opciones = {},
  clave = CLAVE_FALSA,
  prendas = [ropa('superior', 1, 'camiseta'), ropa('inferior', 2, 'vaquero')],
  fotoCuerpo = foto,
  leerFotoCuerpo = () => Promise.resolve(fotoCuerpo),
  fotoInterior = null,
  esperar = sinEsperas,
  compartidor = { share: vi.fn(() => Promise.resolve()), canShare: () => true },
}: Opciones = {}) {
  const servidor = servidorFalso(opciones)
  const alGuardarPrueba = vi.fn(() => Promise.resolve(true))
  const preparar = vi.fn(() => Promise.resolve(tryon))
  const router = createMemoryRouter(
    [
      {
        path: '/outfits',
        element: (
          <BotonPruebatelo
            prendas={prendas}
            numero={2}
            alGuardarPrueba={alGuardarPrueba}
            leerFotoCuerpo={leerFotoCuerpo}
            leerFotoInterior={() => Promise.resolve(fotoInterior)}
            leerProbador={() => Promise.resolve({ url: URL_FALSA, clave })}
            crearCliente={(config) => crearClienteProbador(config, { fetch: servidor.fetch })}
            esperar={esperar}
            preparar={preparar}
            copiar={() => Promise.resolve(true)}
            compartidor={compartidor}
            privacidad={{ visto: () => true, marcar: () => undefined }}
          />
        ),
      },
      { path: '/ajustes', element: <h1>Ajustes</h1> },
    ],
    { initialEntries: ['/outfits'] },
  )
  const vista = render(<RouterProvider router={router} />)
  return { usuario: userEvent.setup(), servidor, alGuardarPrueba, preparar, router, vista }
}

/**
 * Un `esperar` que no sigue hasta que el test lo dice, para ver cada paso del progreso. Como el de
 * verdad, se corta al cancelar.
 */
function esperaManual() {
  const pasos: { seguir: () => void; signal: AbortSignal | undefined }[] = []
  const esperar = (_ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolver, rechazar) => {
      pasos.push({ seguir: resolver, signal })
      signal?.addEventListener('abort', () => {
        rechazar(signal.reason as Error)
      })
    })
  return { esperar, pasos }
}

const boton = () => screen.getByRole('button', { name: 'Pruébatelo: outfit 2' })
const rutas = (servidor: ReturnType<typeof servidorFalso>) =>
  servidor.peticiones.map((p) => `${p.metodo} ${p.ruta}`)

let urls: ReturnType<typeof simularUrlsDeBlob>

beforeEach(() => {
  urls = simularUrlsDeBlob()
})

afterEach(() => {
  urls.quitar()
})

describe('BotonPruebatelo con el probador del PC', () => {
  it('se viste en el PC y deja guardar y compartir la imagen', async () => {
    const share = vi.fn(() => Promise.resolve())
    const { usuario, servidor, alGuardarPrueba, preparar } = montar({
      compartidor: { share, canShare: () => true },
    })

    await usuario.click(boton())

    const imagen = await screen.findByRole('img', { name: /vestido en tu PC/ })
    expect(urls.blobs.get(imagen.getAttribute('src') ?? '')?.type).toBe('image/jpeg')
    expect(preparar).not.toHaveBeenCalled()
    expect(rutas(servidor)).toEqual([
      'GET /salud',
      'POST /pruebas',
      'GET /pruebas/prueba-1',
      'GET /pruebas/prueba-1',
      'GET /pruebas/prueba-1/imagen',
    ])
    // Primero lo de abajo y luego lo de arriba, como dice el contrato; cada prenda con su zona.
    expect(servidor.peticiones[1]?.datos?.getAll('zona')).toEqual(['abajo', 'arriba'])
    expect([...(servidor.peticiones[1]?.datos?.keys() ?? [])]).toEqual([
      'persona',
      'prenda',
      'zona',
      'prenda',
      'zona',
    ])

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(alGuardarPrueba).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/jpeg' }))
    expect(await screen.findByText('Guardada con el outfit.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardada' })).toBeDisabled()
    // Guardar cambia el estado, pero la imagen sigue en pantalla: su URL no se revoca.
    expect(urls.revocar).not.toHaveBeenCalledWith(imagen.getAttribute('src'))
    expect(screen.getByRole('img', { name: /vestido en tu PC/ })).toHaveAttribute(
      'src',
      imagen.getAttribute('src'),
    )

    await usuario.click(screen.getByRole('button', { name: 'Compartir' }))
    expect(share).toHaveBeenCalledWith({
      files: [expect.objectContaining({ name: 'percha-prueba.jpg' })],
    })
  })

  it('sin Web Share, ofrece descargar la imagen del PC', async () => {
    const { usuario } = montar({ compartidor: {} })

    await usuario.click(boton())

    expect(await screen.findByRole('link', { name: 'Descargar' })).toHaveAttribute(
      'download',
      'percha-prueba.jpg',
    )
  })

  it('enseña el progreso mientras el PC trabaja', async () => {
    const { esperar, pasos } = esperaManual()
    const { usuario } = montar({
      prendas: [ropa('superior'), ropa('inferior'), ropa('calzado')],
      esperar,
    })

    await usuario.click(boton())
    expect(await screen.findByText('Tu PC va a empezar…')).toBeInTheDocument()
    expect(screen.getByText(/0 de 2 hechas\. Quedan unos 3 minutos\./)).toBeInTheDocument()

    pasos[0]?.seguir()
    expect(await screen.findByText('Probándote la prenda 2 de 2…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Prendas probadas' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    expect(screen.getByText(/1 de 2 hechas\. Quedan unos 2 minutos\./)).toBeInTheDocument()
  })

  it('con varias prendas de arriba manda la de fuera y avisa de las capas', async () => {
    const { usuario, servidor } = montar({
      prendas: [ropa('superior', 1, 'camiseta'), ropa('abrigo', 4, 'parka'), ropa('inferior')],
    })

    await usuario.click(boton())

    expect(await screen.findByText(/solo se viste la prenda de fuera/)).toBeInTheDocument()
    expect(servidor.peticiones[1]?.datos?.getAll('prenda')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Probar con Gemini' })).toBeInTheDocument()
  })

  it('si el PC no responde, lo dice y ofrece Gemini avisando de que las fotos van a Google', async () => {
    const share = vi.fn(() => Promise.resolve())
    const { usuario, preparar } = montar({
      servidor: { caido: true },
      compartidor: { share, canShare: () => true },
    })

    await usuario.click(boton())

    expect(await screen.findByText(/Tu PC no responde/)).toBeInTheDocument()
    expect(screen.getByText(/tu foto y las de las prendas van a Google/)).toBeInTheDocument()
    expect(preparar).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: 'Probar con Gemini' }))

    expect(await screen.findByText(INSTRUCCION)).toBeInTheDocument()
    expect(preparar).toHaveBeenCalledWith(foto, expect.any(Array))
    expect(share).toHaveBeenCalledWith({ files: [tryon.fichero] })
  })

  it('con la clave mal (401), lo dice y lleva a Ajustes', async () => {
    const { usuario, router } = montar({ clave: 'otra-clave' })

    await usuario.click(boton())

    expect(await screen.findByText(/no acepta la clave/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('link', { name: 'Ir a Ajustes' }))
    expect(router.state.location.pathname).toBe('/ajustes')
  })

  it('si el PC está ocupado (409), lo dice y deja reintentar', async () => {
    const { usuario, servidor } = montar({ servidor: { ocupado: true } })

    await usuario.click(boton())

    expect(await screen.findByText(/está con otra prueba/)).toBeInTheDocument()
    expect(rutas(servidor)).toEqual(['GET /salud'])
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => {
      expect(rutas(servidor)).toEqual(['GET /salud', 'GET /salud'])
    })
  })

  it('si la prueba falla en el PC, lo dice y ofrece Gemini', async () => {
    const { usuario } = montar({ servidor: { errorPrueba: 'CUDA out of memory' } })

    await usuario.click(boton())

    expect(await screen.findByText(/La prueba ha fallado en tu PC/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Probar con Gemini' })).toBeInTheDocument()
  })

  it('si se corta la red a mitad, deja volver a mirar la misma prueba', async () => {
    const { usuario, servidor } = montar({ servidor: { cortesEstado: [1, 2, 3] } })

    await usuario.click(boton())

    expect(await screen.findByText(/Tu PC no responde/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Volver a mirar' }))

    expect(await screen.findByRole('img', { name: /vestido en tu PC/ })).toBeInTheDocument()
    expect(servidor.peticiones.filter((p) => p.metodo === 'POST')).toHaveLength(1)
  })

  it('«Dejar de esperar» y salir de la pantalla dejan de preguntar al PC', async () => {
    const { esperar, pasos } = esperaManual()
    const { usuario, servidor, vista } = montar({ esperar })

    await usuario.click(boton())
    await screen.findByText('Tu PC va a empezar…')
    await usuario.click(screen.getByRole('button', { name: 'Dejar de esperar' }))
    expect(pasos[0]?.signal?.aborted).toBe(true)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()

    await usuario.click(boton())
    await waitFor(() => {
      expect(pasos).toHaveLength(2)
    })
    vista.unmount()
    expect(pasos[1]?.signal?.aborted).toBe(true)
    pasos[1]?.seguir()
    await Promise.resolve()
    expect(servidor.peticiones.filter((p) => p.ruta === '/pruebas/prueba-1')).toEqual([])
  })

  it('si sales mientras se lee el perfil, no llega a llamar al PC', async () => {
    let darFoto: (foto: Blob) => void = () => undefined
    const { usuario, servidor, vista } = montar({
      leerFotoCuerpo: () =>
        new Promise<Blob>((resolver) => {
          darFoto = resolver
        }),
    })

    await usuario.click(boton())
    vista.unmount()
    darFoto(foto)
    await new Promise((resolver) => setTimeout(resolver, 0))

    expect(servidor.peticiones).toEqual([])
  })

  it('con foto en ropa interior, el PC recibe esa y no la de referencia (D21)', async () => {
    const interior = new Blob(['ropa-interior'], { type: 'image/jpeg' })
    const { usuario, servidor } = montar({ fotoInterior: interior })

    await usuario.click(boton())

    await screen.findByRole('img', { name: /vestido en tu PC/ })
    const persona = servidor.peticiones[1]?.datos?.get('persona') as Blob
    expect(await persona.text()).toBe('ropa-interior')
  })

  it('si el PC falla, Gemini recibe la de referencia y nunca la de ropa interior', async () => {
    const interior = new Blob(['ropa-interior'], { type: 'image/jpeg' })
    const { usuario, preparar } = montar({ servidor: { caido: true }, fotoInterior: interior })

    await usuario.click(boton())
    await usuario.click(await screen.findByRole('button', { name: 'Probar con Gemini' }))

    await screen.findByText(/En Gemini, toca la sugerencia/)
    expect(preparar).toHaveBeenCalledTimes(1)
    expect(preparar).toHaveBeenCalledWith(foto, expect.any(Array))
  })

  it('solo con la foto en ropa interior, el PC la usa', async () => {
    const interior = new Blob(['ropa-interior'], { type: 'image/jpeg' })
    const { usuario, servidor } = montar({ fotoCuerpo: null, fotoInterior: interior })

    await usuario.click(boton())

    await screen.findByRole('img', { name: /vestido en tu PC/ })
    expect(servidor.peticiones.filter((p) => p.metodo === 'POST')).toHaveLength(1)
  })

  it('sin foto de cuerpo no llama al PC', async () => {
    const { usuario, servidor } = montar({ fotoCuerpo: null })

    await usuario.click(boton())

    expect(await screen.findByText(/necesitas una foto tuya de cuerpo entero/)).toBeInTheDocument()
    expect(servidor.peticiones).toEqual([])
  })

  it('un outfit sin ropa que vestir (solo calzado) lo dice y ofrece Gemini', async () => {
    const { usuario, servidor } = montar({ prendas: [ropa('calzado')] })

    await usuario.click(boton())

    expect(await screen.findByText(/no viste calzado ni accesorios/)).toBeInTheDocument()
    expect(servidor.peticiones).toEqual([])
    expect(screen.getByRole('button', { name: 'Probar con Gemini' })).toBeInTheDocument()
  })
})
