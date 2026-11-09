import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatosEtiqueta, EtiquetasPrenda } from '../../datos/modelo.ts'
import {
  crearProveedorFalso,
  ErrorIA,
  ETIQUETAS_DE_PRUEBA,
  type ProveedorIA,
} from '../../ia/index.ts'
import { FormularioPrenda } from './FormularioPrenda.tsx'

// Estos tests escriben mucho con userEvent: con toda la suite en paralelo pasan de los 5 s por defecto.
vi.setConfig({ testTimeout: 15_000 })

const fotoEtiqueta = new File(['etiqueta'], 'etiqueta.jpg', { type: 'image/jpeg' })

function montar({
  proveedor,
  iniciales = ETIQUETAS_DE_PRUEBA,
}: { proveedor?: ProveedorIA | null; iniciales?: Partial<EtiquetasPrenda> } = {}) {
  const alGuardar = vi.fn<(etiquetas: EtiquetasPrenda) => void>()
  const obtenerProveedor =
    proveedor === undefined ? undefined : vi.fn(() => Promise.resolve(proveedor))
  render(
    <MemoryRouter>
      <FormularioPrenda
        iniciales={iniciales}
        alGuardar={alGuardar}
        {...(obtenerProveedor && { obtenerProveedor })}
      />
    </MemoryRouter>,
  )
  return { usuario: userEvent.setup(), alGuardar }
}

const seccion = () => within(screen.getByRole('region', { name: 'Etiqueta y tienda' }))
const guardar = () => screen.getByRole('button', { name: 'Guardar' })

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('datos de la etiqueta a mano', () => {
  it('sin nada escrito, la prenda se guarda sin ellos', async () => {
    const { usuario, alGuardar } = montar()

    await usuario.click(guardar())

    const etiquetas = alGuardar.mock.calls[0]?.[0]
    expect(etiquetas).toMatchObject(ETIQUETAS_DE_PRUEBA)
    expect(etiquetas?.marca).toBeUndefined()
    expect(etiquetas?.composicion).toBeUndefined()
    expect(etiquetas?.enlace).toBeUndefined()
    // Las claves van aunque estén vacías, para que al editar se puedan quitar.
    expect(Object.keys(etiquetas ?? {})).toEqual(expect.arrayContaining(['marca', 'enlace']))
  })

  it('guarda marca, referencia, talla, composición y enlace limpios', async () => {
    const { usuario, alGuardar } = montar()

    await usuario.type(seccion().getByLabelText('Marca'), '  Zara ')
    await usuario.type(seccion().getByLabelText('Referencia'), '4085/021')
    await usuario.type(seccion().getByLabelText('Talla'), 'M')
    await usuario.click(seccion().getByRole('button', { name: 'Añadir material' }))
    await usuario.type(seccion().getByLabelText('Material 1'), 'Algodón')
    await usuario.type(seccion().getByLabelText('Porcentaje del material 1'), '95,5')
    await usuario.click(seccion().getByRole('button', { name: 'Añadir material' }))
    await usuario.type(seccion().getByLabelText('Material 2'), 'forro')
    // Una fila vacía no cuenta.
    await usuario.click(seccion().getByRole('button', { name: 'Añadir material' }))
    await usuario.type(
      seccion().getByLabelText('Enlace a la ficha de la tienda'),
      'https://www.zara.com/es/es/x-p04085021.html',
    )
    await usuario.click(guardar())

    expect(alGuardar.mock.calls[0]?.[0]).toMatchObject({
      marca: 'Zara',
      referencia: '4085/021',
      talla: 'M',
      composicion: [{ material: 'algodón', porcentaje: 95.5 }, { material: 'forro' }],
      enlace: 'https://www.zara.com/es/es/x-p04085021.html',
    })
  })

  it('no guarda con un porcentaje imposible, un porcentaje sin material o un enlace que no es web', async () => {
    const { usuario, alGuardar } = montar()
    await usuario.click(seccion().getByRole('button', { name: 'Añadir material' }))
    await usuario.type(seccion().getByLabelText('Material 1'), 'lana')
    await usuario.type(seccion().getByLabelText('Porcentaje del material 1'), '120')
    await usuario.type(seccion().getByLabelText('Enlace a la ficha de la tienda'), 'zara.com/x')

    await usuario.click(guardar())

    expect(alGuardar).not.toHaveBeenCalled()
    expect(
      seccion().getByText('Pon un porcentaje entre 1 y 100, o déjalo vacío.'),
    ).toBeInTheDocument()
    expect(seccion().getByText(/empezando por https/)).toBeInTheDocument()

    await usuario.clear(seccion().getByLabelText('Material 1'))
    await usuario.clear(seccion().getByLabelText('Porcentaje del material 1'))
    await usuario.type(seccion().getByLabelText('Porcentaje del material 1'), '50')
    await usuario.click(guardar())
    expect(seccion().getByText('Falta el material de algún porcentaje.')).toBeInTheDocument()

    await usuario.click(seccion().getByRole('button', { name: 'Quitar el material 1' }))
    await usuario.clear(seccion().getByLabelText('Enlace a la ficha de la tienda'))
    await usuario.click(guardar())
    expect(alGuardar).toHaveBeenCalledOnce()
  })

  it('un 0 % no vale: la IA lo usa para «no lo pone»', async () => {
    const { usuario, alGuardar } = montar()
    await usuario.click(seccion().getByRole('button', { name: 'Añadir material' }))
    await usuario.type(seccion().getByLabelText('Material 1'), 'lana')
    await usuario.type(seccion().getByLabelText('Porcentaje del material 1'), '0')

    await usuario.click(guardar())

    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('una prenda con un texto más largo de lo que cabe lo dice junto al campo', async () => {
    const { usuario, alGuardar } = montar({
      iniciales: { ...ETIQUETAS_DE_PRUEBA, marca: 'M'.repeat(70) },
    })

    await usuario.click(guardar())

    expect(alGuardar).not.toHaveBeenCalled()
    expect(seccion().getByLabelText('Marca')).toHaveAccessibleDescription(
      'Como mucho 60 caracteres.',
    )
    expect(seccion().getByLabelText('Referencia')).toHaveAttribute('maxLength', '40')
  })

  it('enseña los decimales con coma', () => {
    montar({
      iniciales: {
        ...ETIQUETAS_DE_PRUEBA,
        composicion: [{ material: 'elastano', porcentaje: 2.5 }],
      },
    })
    expect(seccion().getByLabelText('Porcentaje del material 1')).toHaveValue('2,5')
  })

  it('con marca y referencia salen los enlaces de búsqueda, que abren otra pestaña', async () => {
    const { usuario } = montar({
      iniciales: { ...ETIQUETAS_DE_PRUEBA, enlace: 'https://www.zara.com/es/es/x.html' },
    })
    expect(seccion().getByRole('link', { name: /Abrir la ficha/ })).toHaveAttribute(
      'href',
      'https://www.zara.com/es/es/x.html',
    )
    expect(seccion().queryByRole('link', { name: /Buscar en Google/ })).not.toBeInTheDocument()

    await usuario.type(seccion().getByLabelText('Marca'), 'Zara')
    await usuario.type(seccion().getByLabelText('Referencia'), '4085/021')

    const google = seccion().getByRole('link', { name: /Buscar en Google/ })
    expect(google).toHaveAttribute('target', '_blank')
    expect(google).toHaveAttribute('rel', 'noopener noreferrer')
    expect(new URL(google.getAttribute('href') ?? '').searchParams.get('q')).toBe(
      '"p04085021" site:zara.com',
    )
    expect(seccion().getByRole('link', { name: /Google Imágenes/ })).toBeInTheDocument()
    expect(seccion().getByRole('link', { name: /En la tienda de Zara/ })).toBeInTheDocument()
  })
})

describe('foto de la etiqueta', () => {
  it('sin proveedor no aparece el botón', () => {
    montar()
    expect(seccion().queryByLabelText('Foto de la etiqueta')).not.toBeInTheDocument()
  })

  it('la IA rellena los campos de la etiqueta sin tocar el resto de lo cambiado', async () => {
    const proveedor = crearProveedorFalso()
    const { usuario, alGuardar } = montar({ proveedor })
    await usuario.type(screen.getByLabelText('Notas'), 'me encanta')
    await usuario.type(seccion().getByLabelText('Talla'), 'L')

    await usuario.upload(seccion().getByLabelText('Foto de la etiqueta'), fotoEtiqueta)

    expect(
      await seccion().findByText(
        'Leído de la etiqueta: marca, referencia, talla y composición. Revísalo antes de guardar.',
      ),
    ).toBeInTheDocument()
    expect(proveedor.etiquetasLeidas).toEqual([fotoEtiqueta])
    expect(seccion().getByLabelText('Marca')).toHaveValue('Zara')
    expect(seccion().getByLabelText('Talla')).toHaveValue('M')
    expect(seccion().getByLabelText('Material 2')).toHaveValue('elastano')
    expect(screen.getByLabelText('Notas')).toHaveValue('me encanta')

    await usuario.click(guardar())
    expect(alGuardar.mock.calls[0]?.[0]).toMatchObject({
      notas: 'me encanta',
      marca: 'Zara',
      composicion: [
        { material: 'algodón', porcentaje: 95 },
        { material: 'elastano', porcentaje: 5 },
      ],
    })
  })

  it('lo que la etiqueta no dice no borra lo escrito', async () => {
    const proveedor = crearProveedorFalso({ etiqueta: (): DatosEtiqueta => ({ talla: '42' }) })
    const { usuario } = montar({ proveedor })
    await usuario.type(seccion().getByLabelText('Marca'), 'Mango')

    await usuario.upload(seccion().getByLabelText('Foto de la etiqueta'), fotoEtiqueta)

    expect(await seccion().findByText(/Leído de la etiqueta: talla\./)).toBeInTheDocument()
    expect(seccion().getByLabelText('Marca')).toHaveValue('Mango')
    expect(seccion().getByLabelText('Talla')).toHaveValue('42')
  })

  it('si no se lee nada, lo dice', async () => {
    const { usuario } = montar({ proveedor: crearProveedorFalso({ etiqueta: () => ({}) }) })

    await usuario.upload(seccion().getByLabelText('Foto de la etiqueta'), fotoEtiqueta)

    expect(await seccion().findByText(/No se ha leído nada en la etiqueta/)).toBeInTheDocument()
  })

  it('sin clave, avisa con el enlace a Ajustes', async () => {
    const { usuario } = montar({ proveedor: null })

    await usuario.upload(seccion().getByLabelText('Foto de la etiqueta'), fotoEtiqueta)

    const aviso = await seccion().findByRole('alert')
    expect(aviso).toHaveTextContent('Para que la IA lea la etiqueta, ponla en Ajustes.')
    expect(within(aviso).getByRole('link', { name: 'Ir a Ajustes' })).toBeInTheDocument()
  })

  it('si la IA falla, lo dice y deja probar otra vez con la misma foto', async () => {
    const leerEtiqueta = vi
      .fn<ProveedorIA['leerEtiqueta']>()
      .mockRejectedValueOnce(new ErrorIA('sin-cupo'))
      .mockResolvedValueOnce({ marca: 'Nike' })
    const { usuario } = montar({ proveedor: { ...crearProveedorFalso(), leerEtiqueta } })

    await usuario.upload(seccion().getByLabelText('Foto de la etiqueta'), fotoEtiqueta)

    const aviso = await seccion().findByRole('alert')
    expect(aviso).toHaveTextContent('No se ha podido leer la etiqueta')
    expect(aviso).toHaveTextContent('Se ha acabado el cupo gratis de Gemini.')
    await usuario.click(within(aviso).getByRole('button', { name: 'Probar otra vez' }))

    expect(await seccion().findByText(/Leído de la etiqueta: marca\./)).toBeInTheDocument()
    expect(leerEtiqueta).toHaveBeenLastCalledWith(fotoEtiqueta, expect.anything())
    expect(seccion().getByLabelText('Marca')).toHaveValue('Nike')
  })

  it('mientras lee no deja guardar, para no guardar sin lo que está leyendo', async () => {
    const proveedor: ProveedorIA = {
      ...crearProveedorFalso(),
      leerEtiqueta: () => new Promise(() => undefined),
    }
    const { usuario } = montar({ proveedor })

    await usuario.upload(seccion().getByLabelText('Foto de la etiqueta'), fotoEtiqueta)

    expect(await seccion().findByText('Leyendo la etiqueta…')).toBeInTheDocument()
    expect(guardar()).toBeDisabled()
    await usuario.click(seccion().getByRole('button', { name: 'Dejarlo' }))
    expect(guardar()).toBeEnabled()
  })

  it('«Dejarlo» cancela la lectura y lo que llegue tarde no cambia nada', async () => {
    let señal: AbortSignal | undefined
    let responder: (datos: DatosEtiqueta) => void = () => undefined
    const proveedor: ProveedorIA = {
      ...crearProveedorFalso(),
      leerEtiqueta: (_foto, opciones) => {
        señal = opciones?.signal
        return new Promise((resolver) => {
          responder = resolver
        })
      },
    }
    const { usuario } = montar({ proveedor })

    await usuario.upload(seccion().getByLabelText('Foto de la etiqueta'), fotoEtiqueta)
    expect(await seccion().findByText('Leyendo la etiqueta…')).toBeInTheDocument()
    await usuario.click(seccion().getByRole('button', { name: 'Dejarlo' }))

    expect(señal?.aborted).toBe(true)
    responder({ marca: 'Tarde' })
    await new Promise((listo) => setTimeout(listo, 0))
    expect(seccion().getByLabelText('Marca')).toHaveValue('')
    expect(seccion().getByLabelText('Foto de la etiqueta')).toBeInTheDocument()
  })
})
