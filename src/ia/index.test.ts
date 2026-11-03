// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { vaciarBase } from '../datos/pruebas.ts'
import { proveedorDesdeAjustes } from './index.ts'

beforeEach(async () => {
  await vaciarBase()
})

describe('proveedor desde Ajustes', () => {
  it('sin clave guardada, avisa de que falta sin llamar a nadie', async () => {
    const proveedor = await proveedorDesdeAjustes()

    await expect(proveedor.comprobarClave()).rejects.toMatchObject({ tipo: 'sin-clave' })
    await expect(
      proveedor.etiquetarPrendas([{ fotos: [new Blob(['foto'])] }]),
    ).rejects.toMatchObject({ tipo: 'sin-clave' })
  })
})
