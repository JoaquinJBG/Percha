import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { strFromU8, unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportarCopia } from '../datos/copia.ts'
import { vaciarBase } from '../datos/pruebas.ts'
import { guardarAjustes, leerAjustes } from '../datos/repositorio.ts'
import { crearClienteProbador } from '../probador/index.ts'
import { CLAVE_FALSA, servidorFalso, URL_FALSA } from '../probador/servidorFalso.ts'
import { GUIA_PROBADOR, ProbadorPC } from './ProbadorPC.tsx'

function montar(opciones: Parameters<typeof servidorFalso>[0] = {}) {
  const servidor = servidorFalso(opciones)
  const comprobar = vi.fn((config: { url: string; clave: string }) =>
    crearClienteProbador(config, { fetch: servidor.fetch }).salud(),
  )
  render(<ProbadorPC comprobar={comprobar} />)
  return { usuario: userEvent.setup(), comprobar, servidor }
}

async function rellenar(usuario: ReturnType<typeof userEvent.setup>, url: string, clave: string) {
  const enviar = screen.getByRole('button', { name: 'Guardar y comprobar' })
  // Hasta que se leen los ajustes, el botón está desactivado y la URL guardada aún no está.
  await waitFor(() => {
    expect(enviar).toBeEnabled()
  })
  const campoUrl = screen.getByLabelText('Dirección del probador')
  // Pegar y no teclear: así lo hace quien copia la URL y la clave, y el test no se alarga.
  await usuario.clear(campoUrl)
  await usuario.click(campoUrl)
  await usuario.paste(url)
  if (clave) {
    await usuario.click(screen.getByLabelText(/clave/i))
    await usuario.paste(clave)
  }
  await usuario.click(enviar)
}

const consola = {
  log: vi.spyOn(console, 'log'),
  info: vi.spyOn(console, 'info'),
  warn: vi.spyOn(console, 'warn'),
  error: vi.spyOn(console, 'error'),
}

beforeEach(async () => {
  await vaciarBase()
})

afterEach(() => {
  // La clave del probador no puede salir por la consola.
  for (const espia of Object.values(consola)) {
    expect(JSON.stringify(espia.mock.calls)).not.toContain(CLAVE_FALSA)
    espia.mockClear()
  }
})

describe('probador del PC en Ajustes', () => {
  it('guarda la URL y la clave y dice si el PC responde', async () => {
    const { usuario, comprobar } = montar()

    expect(await screen.findByRole('link', { name: 'Cómo se instala' })).toHaveAttribute(
      'href',
      GUIA_PROBADOR,
    )
    expect(screen.getByLabelText('Clave')).toHaveAttribute('type', 'password')
    await rellenar(usuario, `${URL_FALSA}/`, CLAVE_FALSA)

    expect(await screen.findByText(/Guardado\. Tu PC responde y está listo/)).toBeInTheDocument()
    expect(comprobar).toHaveBeenCalledWith({ url: URL_FALSA, clave: CLAVE_FALSA })
    expect(await leerAjustes()).toMatchObject({
      urlProbador: URL_FALSA,
      claveProbador: CLAVE_FALSA,
    })
    expect(screen.getByLabelText(/Cambiar la clave/)).toHaveValue('')
  })

  it('guarda aunque el PC no responda, y lo dice', async () => {
    const { usuario } = montar({ caido: true })

    await rellenar(usuario, URL_FALSA, CLAVE_FALSA)

    expect(await screen.findByRole('alert')).toHaveTextContent(/Guardado\. Tu PC no responde/)
    expect((await leerAjustes()).urlProbador).toBe(URL_FALSA)
  })

  it('con una clave que el PC no acepta, lo dice', async () => {
    const { usuario } = montar()

    await rellenar(usuario, URL_FALSA, 'otra-clave')

    expect(await screen.findByRole('alert')).toHaveTextContent(/no acepta la clave/)
  })

  it('no guarda una dirección http a otra máquina ni sin clave', async () => {
    const { usuario, comprobar } = montar()

    await rellenar(usuario, URL_FALSA, '')
    expect(await screen.findByRole('alert')).toHaveTextContent(/Pega la clave/)

    await rellenar(usuario, 'http://192.168.1.20:7861', CLAVE_FALSA)
    expect(await screen.findByRole('alert')).toHaveTextContent(/https:\/\//)
    expect(comprobar).not.toHaveBeenCalled()
    expect((await leerAjustes()).urlProbador).toBeNull()
  })

  it('con el probador guardado, «Comprobar» dice si está ocupado y «Quitar» lo olvida', async () => {
    await guardarAjustes({ urlProbador: URL_FALSA, claveProbador: CLAVE_FALSA })
    const { usuario } = montar({ ocupado: true })

    await usuario.click(await screen.findByRole('button', { name: 'Comprobar' }))
    expect(await screen.findByText(/está con otra prueba/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(await screen.findByText(/vuelve a usar Gemini/)).toBeInTheDocument()
    expect(await leerAjustes()).toMatchObject({ urlProbador: null, claveProbador: null })
  })

  it('cambia la URL sin volver a pegar la clave', async () => {
    await guardarAjustes({ urlProbador: URL_FALSA, claveProbador: CLAVE_FALSA })
    const { usuario, comprobar } = montar()

    await rellenar(usuario, 'https://otro-pc.tail0000.ts.net', '')

    await screen.findByText(/Guardado\./)
    expect(comprobar).toHaveBeenCalledWith({
      url: 'https://otro-pc.tail0000.ts.net',
      clave: CLAVE_FALSA,
    })
  })

  it('ni la URL ni la clave van en la copia', async () => {
    await guardarAjustes({ urlProbador: URL_FALSA, claveProbador: CLAVE_FALSA })

    const zip = unzipSync(new Uint8Array(await (await exportarCopia()).arrayBuffer()))
    const manifiesto = strFromU8(zip['percha.json'] ?? new Uint8Array())

    expect(manifiesto).not.toContain(CLAVE_FALSA)
    expect(manifiesto).not.toContain(URL_FALSA)
  })
})
