import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nuevaPrenda } from '../datos/pruebas.ts'
import { simularUrlsDeBlob } from '../pantallas/armario/urlsDePrueba.ts'
import type { TryOn } from '../tryon/index.ts'
import { BotonPruebatelo, type AvisoPrivacidad, type CompartidorTryOn } from './BotonPruebatelo.tsx'

const INSTRUCCION = 'En Gemini, toca la sugerencia del teclado para pegar el texto y envía.'
const PRIVACIDAD = /Tu foto solo sale del móvil cuando eliges a dónde compartirla/

const foto = new Blob(['cuerpo'], { type: 'image/jpeg' })
const tryon: TryOn = {
  fichero: new File(['jpeg'], 'percha-pruebatelo.jpg', { type: 'image/jpeg' }),
  texto: 'Te paso una imagen…',
}

function privacidadEnMemoria(visto = false): AvisoPrivacidad {
  return {
    visto: () => visto,
    marcar: () => {
      visto = true
    },
  }
}

interface Opciones {
  fotoCuerpo?: Blob | null
  compartidor?: CompartidorTryOn
  copiado?: boolean
  preparar?: () => Promise<TryOn>
  privacidad?: AvisoPrivacidad
}

function montar({
  fotoCuerpo = foto,
  compartidor = { share: vi.fn(() => Promise.resolve()), canShare: () => true },
  copiado = true,
  preparar = vi.fn(() => Promise.resolve(tryon)),
  privacidad = privacidadEnMemoria(),
}: Opciones = {}) {
  const copiar = vi.fn(() => Promise.resolve(copiado))
  const leerFotoCuerpo = vi.fn(() => Promise.resolve(fotoCuerpo))
  // Hay foto en ropa interior en el móvil: con Gemini nunca se usa (D21).
  const leerFotoInterior = vi.fn(() => Promise.resolve(new Blob(['ropa-interior'])))
  const prendas = [nuevaPrenda({ subcategoria: 'camiseta' })].map((p, i) => ({
    ...p,
    id: String(i),
    creadaEn: 0,
  }))
  const router = createMemoryRouter(
    [
      {
        path: '/outfits',
        element: (
          <BotonPruebatelo
            prendas={prendas}
            numero={2}
            leerFotoCuerpo={leerFotoCuerpo}
            leerFotoInterior={leerFotoInterior}
            leerProbador={sinProbador}
            preparar={preparar}
            copiar={copiar}
            compartidor={compartidor}
            privacidad={privacidad}
          />
        ),
      },
      { path: '/perfil', element: <h1>Perfil</h1> },
    ],
    { initialEntries: ['/outfits'] },
  )
  render(<RouterProvider router={router} />)
  return {
    usuario: userEvent.setup(),
    router,
    copiar,
    preparar,
    leerFotoCuerpo,
    leerFotoInterior,
    prendas,
  }
}

const sinProbador = () => Promise.resolve(null)

const boton = () => screen.getByRole('button', { name: 'Pruébatelo: outfit 2' })

let urls: ReturnType<typeof simularUrlsDeBlob>

beforeEach(() => {
  urls = simularUrlsDeBlob()
})

afterEach(() => {
  urls.quitar()
})

describe('BotonPruebatelo', () => {
  it('copia el texto, abre la hoja de compartir con la imagen y explica cómo pegarlo', async () => {
    const pasos: string[] = []
    const share = vi.fn(() => {
      pasos.push('share')
      return Promise.resolve()
    })
    const canShare = vi.fn(() => true)
    const { usuario, copiar, preparar, prendas } = montar({ compartidor: { share, canShare } })
    copiar.mockImplementation(() => {
      pasos.push('copiar')
      return Promise.resolve(true)
    })

    await usuario.click(boton())

    expect(await screen.findByText(INSTRUCCION)).toBeInTheDocument()
    expect(preparar).toHaveBeenCalledWith(foto, prendas)
    expect(copiar).toHaveBeenCalledWith(tryon.texto)
    expect(canShare).toHaveBeenCalledWith({ files: [tryon.fichero] })
    expect(share).toHaveBeenCalledWith({ files: [tryon.fichero] })
    // El texto no va en share(): Gemini no lo recibe (D13). Y se copia antes de abrir la hoja.
    expect(pasos).toEqual(['copiar', 'share'])
  })

  it('con Gemini usa siempre la foto de referencia, nunca la de ropa interior (D21)', async () => {
    const { usuario, preparar, leerFotoInterior } = montar()

    await usuario.click(boton())

    expect(await screen.findByText(INSTRUCCION)).toBeInTheDocument()
    expect(preparar).toHaveBeenCalledWith(foto, expect.any(Array))
    expect(leerFotoInterior).not.toHaveBeenCalled()
  })

  it('con solo la foto en ropa interior, Gemini no la usa y pide la de referencia', async () => {
    const { usuario, preparar } = montar({ fotoCuerpo: null })

    await usuario.click(boton())

    expect(await screen.findByText(/necesitas una foto tuya de cuerpo entero/)).toBeInTheDocument()
    expect(preparar).not.toHaveBeenCalled()
  })

  it('avisa de la privacidad solo la primera vez', async () => {
    const privacidad = privacidadEnMemoria()
    const { usuario, preparar } = montar({ privacidad })

    await usuario.click(boton())
    expect(await screen.findByText(PRIVACIDAD)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    await usuario.click(boton())

    expect(await screen.findByText(INSTRUCCION)).toBeInTheDocument()
    expect(screen.queryByText(PRIVACIDAD)).not.toBeInTheDocument()
    // La imagen ya preparada se reutiliza.
    expect(preparar).toHaveBeenCalledTimes(1)
  })

  it('sin foto de cuerpo entero, no comparte y lleva a Perfil', async () => {
    const share = vi.fn(() => Promise.resolve())
    const { usuario, preparar, copiar, router } = montar({
      fotoCuerpo: null,
      compartidor: { share, canShare: () => true },
    })

    await usuario.click(boton())

    expect(await screen.findByText(/necesitas una foto tuya de cuerpo entero/)).toBeInTheDocument()
    expect(preparar).not.toHaveBeenCalled()
    expect(copiar).not.toHaveBeenCalled()
    expect(share).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('link', { name: 'Ir a Perfil' }))
    expect(router.state.location.pathname).toBe('/perfil')
  })

  it('sin Web Share con ficheros, ofrece descargar la imagen y copiar el texto', async () => {
    const { usuario, copiar } = montar({ compartidor: { canShare: () => false } })

    await usuario.click(boton())

    const enlace = await screen.findByRole('link', { name: 'Descargar imagen' })
    expect(enlace).toHaveAttribute('download', 'percha-pruebatelo.jpg')
    expect(urls.blobs.get(enlace.getAttribute('href') ?? '')).toBe(tryon.fichero)
    expect(screen.getByText(/que ya está copiado/)).toBeInTheDocument()
    expect(screen.getByText(PRIVACIDAD)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Copiar texto' }))
    expect(copiar).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Texto copiado.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(urls.revocar).toHaveBeenCalledWith(enlace.getAttribute('href'))
  })

  it('sin navigator.share también ofrece la descarga', async () => {
    const { usuario } = montar({ compartidor: {} })

    await usuario.click(boton())

    expect(await screen.findByRole('link', { name: 'Descargar imagen' })).toBeInTheDocument()
  })

  it('si no se puede copiar el texto, lo dice y deja volver a copiarlo', async () => {
    const { usuario, copiar } = montar({ copiado: false })

    await usuario.click(boton())

    expect(await screen.findByText(/No se ha podido copiar el texto/)).toBeInTheDocument()
    copiar.mockResolvedValue(true)
    await usuario.click(screen.getByRole('button', { name: 'Copiar texto' }))
    expect(await screen.findByText('Texto copiado.')).toBeInTheDocument()
    expect(screen.queryByText(/No se ha podido copiar el texto/)).not.toBeInTheDocument()
  })

  it('si el usuario cierra la hoja de compartir, no queda ningún aviso', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('cancelado', 'AbortError')))
    const { usuario } = montar({ compartidor: { share, canShare: () => true } })

    await usuario.click(boton())

    await waitFor(() => {
      expect(screen.queryByText(INSTRUCCION)).not.toBeInTheDocument()
    })
    expect(share).toHaveBeenCalledTimes(1)
  })

  it('si el navegador ya no cuenta el toque como gesto, pide otro toque para compartir', async () => {
    const share = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new DOMException('sin gesto', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined)
    const { usuario } = montar({ compartidor: { share, canShare: () => true } })

    await usuario.click(boton())
    await usuario.click(await screen.findByRole('button', { name: 'Compartir' }))

    expect(share).toHaveBeenCalledTimes(2)
    expect(await screen.findByText(INSTRUCCION)).toBeInTheDocument()
  })

  it('al abrir el panel de otro outfit, se cierra el que había', async () => {
    const usuario = userEvent.setup()
    const copiar = () => Promise.resolve(true)
    const comun = {
      leerProbador: sinProbador,
      prendas: [{ ...nuevaPrenda(), id: '1', creadaEn: 0 }],
      leerFotoCuerpo: () => Promise.resolve(null),
      copiar,
      privacidad: privacidadEnMemoria(),
    }
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <>
            <BotonPruebatelo {...comun} numero={1} />
            <BotonPruebatelo {...comun} numero={2} />
          </>
        ),
      },
    ])
    render(<RouterProvider router={router} />)

    await usuario.click(screen.getByRole('button', { name: 'Pruébatelo: outfit 1' }))
    expect(await screen.findAllByRole('group')).toHaveLength(1)
    await usuario.click(screen.getByRole('button', { name: 'Pruébatelo: outfit 2' }))

    await waitFor(() => {
      expect(screen.getAllByRole('group')).toHaveLength(1)
    })
    expect(screen.getByRole('group')).toHaveAccessibleName('Pruébatelo: outfit 2')
  })

  it('si no se puede preparar la imagen, lo dice', async () => {
    const preparar = vi.fn(() => Promise.reject(new Error('canvas')))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { usuario } = montar({ preparar })

    await usuario.click(boton())

    expect(await screen.findByText(/No se ha podido preparar la imagen/)).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
