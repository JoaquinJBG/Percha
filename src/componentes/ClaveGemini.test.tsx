import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { strFromU8, unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportarCopia } from '../datos/copia.ts'
import { vaciarBase } from '../datos/pruebas.ts'
import { guardarAjustes, leerAjustes } from '../datos/repositorio.ts'
import { crearProveedorFalso, ErrorIA, type TipoErrorIA } from '../ia/index.ts'
import { ClaveGemini } from './ClaveGemini.tsx'

const CLAVE_FALSA = 'clave-falsa-de-test'

function montar(error?: TipoErrorIA) {
  const proveedor = crearProveedorFalso(error ? { error: new ErrorIA(error) } : {})
  const crearProveedor = vi.fn(() => proveedor)
  render(<ClaveGemini crearProveedor={crearProveedor} />)
  return { usuario: userEvent.setup({ delay: null }), crearProveedor, proveedor }
}

/** El botón está desactivado hasta que se leen los ajustes: con la CPU cargada, eso tarda. */
async function botonGuardar() {
  const boton = screen.getByRole('button', { name: 'Guardar y comprobar' })
  await waitFor(() => {
    expect(boton).toBeEnabled()
  })
  return boton
}

async function pegarYGuardar(usuario: ReturnType<typeof userEvent.setup>, clave = CLAVE_FALSA) {
  await usuario.type(await screen.findByLabelText('Tu clave'), clave)
  await usuario.click(await botonGuardar())
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
  // La clave no puede salir por la consola en ningún caso.
  for (const espia of Object.values(consola)) {
    expect(JSON.stringify(espia.mock.calls)).not.toContain(CLAVE_FALSA)
    espia.mockClear()
  }
})

describe('clave de Gemini en Ajustes', () => {
  it('guarda la clave si Gemini la acepta, sin mostrarla', async () => {
    const { usuario, crearProveedor } = montar()

    const campo = await screen.findByLabelText('Tu clave')
    expect(campo).toHaveAttribute('type', 'password')
    await pegarYGuardar(usuario, `  ${CLAVE_FALSA}  `)

    expect(
      await screen.findByText('Clave guardada. Gemini la acepta.', { exact: false }),
    ).toHaveRole('status')
    expect(crearProveedor).toHaveBeenCalledWith(CLAVE_FALSA, 'gemini-3.5-flash-lite')
    expect((await leerAjustes()).claveGemini).toBe(CLAVE_FALSA)
    expect(screen.getByText('Tienes una clave guardada.')).toBeInTheDocument()
    expect(screen.getByLabelText('Cambiar la clave')).toHaveValue('')
    expect(document.body.textContent).not.toContain(CLAVE_FALSA)
  })

  it('no guarda una clave que Google rechaza', async () => {
    const { usuario } = montar('clave-mala')

    await pegarYGuardar(usuario)

    expect(await screen.findByRole('alert')).toHaveTextContent('Google no acepta esta clave')
    expect((await leerAjustes()).claveGemini).toBeNull()
    expect(screen.queryByText('Tienes una clave guardada.')).not.toBeInTheDocument()
  })

  it.each<[TipoErrorIA, string]>([
    ['sin-red', 'No hay conexión'],
    ['sin-cupo', 'Se ha acabado el cupo'],
    ['no-disponible', 'Gemini no responde'],
  ])('con «%s» la guarda pero avisa de que no se ha comprobado', async (tipo, texto) => {
    const { usuario } = montar(tipo)

    await pegarYGuardar(usuario)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Clave guardada, pero sin comprobar.')
    expect(alerta).toHaveTextContent(texto)
    expect(alerta.textContent).not.toContain(CLAVE_FALSA)
    expect((await leerAjustes()).claveGemini).toBe(CLAVE_FALSA)
  })

  it('pide la clave si el campo está vacío', async () => {
    const { usuario, crearProveedor } = montar()

    await screen.findByLabelText('Tu clave')
    await usuario.click(await botonGuardar())

    expect(await screen.findByRole('alert')).toHaveTextContent('Pega la clave primero.')
    expect(crearProveedor).not.toHaveBeenCalled()
  })

  it('rechaza una clave con espacios o caracteres raros sin llamar a Gemini', async () => {
    const { usuario, crearProveedor } = montar()

    await pegarYGuardar(usuario, 'clave\u200bfalsa')

    expect(await screen.findByRole('alert')).toHaveTextContent('caracteres raros')
    expect(crearProveedor).not.toHaveBeenCalled()
    expect((await leerAjustes()).claveGemini).toBeNull()
  })

  it('comprueba con el modelo que haya guardado en ese momento', async () => {
    await guardarAjustes({ claveGemini: CLAVE_FALSA })
    const { usuario, crearProveedor } = montar()
    await screen.findByRole('button', { name: 'Comprobar' })
    await guardarAjustes({ modeloGemini: 'gemini-importado' })

    await usuario.click(screen.getByRole('button', { name: 'Comprobar' }))

    await screen.findByText('Gemini acepta tu clave.')
    expect(crearProveedor).toHaveBeenCalledWith(CLAVE_FALSA, 'gemini-importado')
  })

  it('comprueba la clave guardada', async () => {
    await guardarAjustes({ claveGemini: CLAVE_FALSA })
    const { usuario, proveedor } = montar()

    await usuario.click(await screen.findByRole('button', { name: 'Comprobar' }))

    expect(await screen.findByText('Gemini acepta tu clave.', { exact: false })).toHaveRole(
      'status',
    )
    expect(proveedor.comprobaciones).toBe(1)
  })

  it('si la clave guardada ya no vale, lo dice', async () => {
    await guardarAjustes({ claveGemini: CLAVE_FALSA })
    const { usuario } = montar('clave-mala')

    await usuario.click(await screen.findByRole('button', { name: 'Comprobar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Google no acepta esta clave')
  })

  it('«Olvidar» borra la clave del móvil', async () => {
    await guardarAjustes({ claveGemini: CLAVE_FALSA })
    const { usuario } = montar()

    await usuario.click(await screen.findByRole('button', { name: 'Olvidar' }))

    expect(await screen.findByText('Clave olvidada', { exact: false })).toHaveRole('status')
    expect((await leerAjustes()).claveGemini).toBeNull()
    expect(screen.queryByRole('button', { name: 'Comprobar' })).not.toBeInTheDocument()
  })

  it('enlaza a AI Studio para conseguirla gratis', async () => {
    montar()

    const enlace = await screen.findByRole('link', { name: 'Google AI Studio' })
    expect(enlace).toHaveAttribute('href', 'https://aistudio.google.com/apikey')
    expect(enlace).toHaveAttribute('rel', 'noreferrer')
    expect(screen.getByText(/No actives la facturación/)).toBeInTheDocument()
  })

  it('la clave guardada aquí no va en la copia exportada', async () => {
    const { usuario } = montar()
    await pegarYGuardar(usuario)
    await screen.findByText('Tienes una clave guardada.')

    const zip = unzipSync(new Uint8Array(await (await exportarCopia()).arrayBuffer()))

    for (const contenido of Object.values(zip)) {
      expect(strFromU8(contenido)).not.toContain(CLAVE_FALSA)
    }
    expect(strFromU8(zip['percha.json'] ?? new Uint8Array())).toContain('modeloGemini')
  })
})
