import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { ElementoCola } from '../../datos/cola.ts'
import type { NuevaPrenda } from '../../datos/modelo.ts'
import {
  ETIQUETAS_DE_PRUEBA,
  ErrorIA,
  crearProveedorFalso,
  type ProveedorIA,
} from '../../ia/index.ts'
import type { DependenciasProceso } from '../../importacion/procesar.ts'
import { AltaMasiva } from './AltaMasiva.tsx'

/** Cola en memoria y todo lo demás falso, sin esperas reales. */
function montar(proveedor: ProveedorIA | null = crearProveedorFalso()) {
  let cola: ElementoCola[] = []
  let orden = 0
  const guardadas: NuevaPrenda[] = []
  const dependencias: DependenciasProceso = {
    listar: () => Promise.resolve(cola.map((e) => ({ ...e }))),
    actualizar: (id, cambios) => {
      cola = cola.map((e) => (e.id === id ? { ...e, ...cambios } : e))
      return Promise.resolve()
    },
    quitar: (ids) => {
      cola = cola.filter((e) => !ids.includes(e.id))
      return Promise.resolve()
    },
    guardar: (prenda) => {
      guardadas.push(prenda)
      return Promise.resolve()
    },
    normalizar: (blob) => Promise.resolve(blob),
    recortar: (blob) => Promise.resolve(blob),
    obtenerProveedor: () => Promise.resolve(proveedor),
    esperar: () => Promise.resolve(),
    ahora: () => 0,
  }
  const encolar = (fotos: readonly File[]) => {
    for (const foto of fotos) {
      orden++
      cola.push({
        id: `e${String(orden)}`,
        nombre: foto.name,
        orden,
        original: foto,
        normalizada: null,
        recortada: null,
        estado: 'nueva',
        error: null,
      })
    }
    return Promise.resolve(fotos.length)
  }
  const router = createMemoryRouter(
    [
      {
        path: '/prendas/varias',
        element: <AltaMasiva dependencias={dependencias} encolar={encolar} />,
      },
      { path: '/ajustes', element: <p>Pantalla de ajustes</p> },
      { path: '/', element: <p>Pantalla del armario</p> },
    ],
    { initialEntries: ['/prendas/varias'] },
  )
  render(<RouterProvider router={router} />)
  return { usuario: userEvent.setup(), guardadas }
}

const fotos = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => new File([`f${String(i)}`], `foto${String(i)}.jpg`, { type: 'image/jpeg' }),
  )

describe('Añadir muchas', () => {
  it('etiqueta todas las fotos elegidas y lleva al armario', async () => {
    const { usuario, guardadas } = montar()

    await usuario.upload(screen.getByLabelText('Elegir fotos'), fotos(7))

    expect(await screen.findByRole('link', { name: 'Ver el armario' })).toBeInTheDocument()
    expect(guardadas).toHaveLength(7)
    expect(screen.getByRole('progressbar', { name: 'Prendas añadidas' })).toHaveAttribute(
      'aria-valuenow',
      '7',
    )
    expect(screen.getByRole('heading', { name: 'Listo' })).toBeInTheDocument()
  })

  it('sin clave avisa, deja las fotos en cola y lleva a Ajustes', async () => {
    const { usuario, guardadas } = montar(null)

    await usuario.upload(screen.getByLabelText('Elegir fotos'), fotos(3))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin clave de Gemini')
    expect(guardadas).toEqual([])
    expect(screen.getByText(/en cola/)).toHaveTextContent('0 añadidas · 3 en cola')
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('link', { name: 'Ir a Ajustes' }))
    expect(screen.getByText('Pantalla de ajustes')).toBeInTheDocument()
  })

  it('con el cupo agotado muestra el aviso de Gemini', async () => {
    const { usuario } = montar(crearProveedorFalso({ error: new ErrorIA('sin-cupo') }))

    await usuario.upload(screen.getByLabelText('Elegir fotos'), fotos(2))

    expect(await screen.findByRole('alert')).toHaveTextContent(new ErrorIA('sin-cupo').message)
  })

  it('lo que la IA no reconoce sale con error y se puede descartar', async () => {
    let n = 0
    const proveedor = crearProveedorFalso({
      etiquetas: () => (n++ === 0 ? null : ETIQUETAS_DE_PRUEBA),
    })
    const { usuario, guardadas } = montar(proveedor)

    await usuario.upload(screen.getByLabelText('Elegir fotos'), fotos(2))

    expect(await screen.findByRole('heading', { name: 'Con error' })).toBeInTheDocument()
    expect(guardadas).toHaveLength(1)
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.queryByRole('heading', { name: 'Con error' })).not.toBeInTheDocument()
  })
})
