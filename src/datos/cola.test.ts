// @vitest-environment node
// jsdom tiene su propio Blob, que fake-indexeddb no sabe clonar: estos tests corren en Node.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  actualizarElementoCola,
  encolarFotos,
  listarCola,
  quitarDeCola,
  vaciarCola,
} from './cola.ts'
import { exportarCopia } from './copia.ts'
import { vaciarBase } from './pruebas.ts'

const foto = (nombre: string, tipo = 'image/jpeg') => new File([nombre], nombre, { type: tipo })

describe('cola de la alta masiva', () => {
  beforeEach(vaciarBase)

  it('encola solo imágenes, en orden, y sigue el orden al añadir más', async () => {
    expect(
      await encolarFotos([
        foto('a.jpg'),
        foto('notas.txt', 'text/plain'),
        foto('b.png', 'image/png'),
      ]),
    ).toBe(2)
    await encolarFotos([foto('c.jpg')])

    const cola = await listarCola()
    expect(cola.map((e) => e.nombre)).toEqual(['a.jpg', 'b.png', 'c.jpg'])
    expect(cola.every((e) => e.estado === 'nueva' && e.normalizada === null)).toBe(true)
  })

  it('guarda lo hecho y quita lo terminado', async () => {
    await encolarFotos([foto('a.jpg'), foto('b.jpg')])
    const [a, b] = await listarCola()
    if (!a || !b) throw new Error('faltan elementos')

    await actualizarElementoCola(a.id, { estado: 'lista', normalizada: new Blob(['n']) })
    await quitarDeCola([b.id])

    const cola = await listarCola()
    expect(cola).toHaveLength(1)
    expect(cola[0]).toMatchObject({ id: a.id, estado: 'lista' })
    await vaciarCola()
    expect(await listarCola()).toEqual([])
  })

  it('la copia de seguridad no se lleva la cola', async () => {
    await encolarFotos([foto('a.jpg')])
    const zip = await exportarCopia()
    const texto = new TextDecoder('latin1').decode(new Uint8Array(await zip.arrayBuffer()))
    expect(texto).not.toContain('a.jpg')
  })
})
