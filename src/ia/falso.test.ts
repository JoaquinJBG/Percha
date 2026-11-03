import { describe, expect, it } from 'vitest'
import { ErrorIA } from './errores.ts'
import { crearProveedorFalso, ETIQUETAS_DE_PRUEBA } from './falso.ts'

const prenda = { fotos: [new Blob(['foto'])] }

describe('proveedor falso', () => {
  it('devuelve las etiquetas de prueba y apunta lo que recibe', async () => {
    const proveedor = crearProveedorFalso()

    expect(await proveedor.etiquetarPrendas([prenda, prenda])).toEqual([
      ETIQUETAS_DE_PRUEBA,
      ETIQUETAS_DE_PRUEBA,
    ])
    await proveedor.comprobarClave()
    expect(proveedor.lotes).toEqual([[prenda, prenda]])
    expect(proveedor.comprobaciones).toBe(1)
  })

  it('puede devolver huecos o fallar con el error que se le diga', async () => {
    const conHueco = crearProveedorFalso({
      etiquetas: (_p, i) => (i === 0 ? null : ETIQUETAS_DE_PRUEBA),
    })
    const sinCupo = crearProveedorFalso({ error: new ErrorIA('sin-cupo') })

    expect(await conHueco.etiquetarPrendas([prenda, prenda])).toEqual([null, ETIQUETAS_DE_PRUEBA])
    await expect(sinCupo.etiquetarPrendas([prenda])).rejects.toMatchObject({ tipo: 'sin-cupo' })
    await expect(sinCupo.comprobarClave()).rejects.toMatchObject({ tipo: 'sin-cupo' })
  })
})
