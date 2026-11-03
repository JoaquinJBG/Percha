// @vitest-environment node
// jsdom tiene su propio Blob, que fake-indexeddb no sabe clonar: estos tests corren en Node.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportarCopia, importarCopia } from '../../datos/copia.ts'
import { imagen, sinBlobs, vaciarBase } from '../../datos/pruebas.ts'
import { guardarPerfil, leerPerfil } from '../../datos/repositorio.ts'

beforeEach(vaciarBase)

describe('fotos del perfil', () => {
  it('guarda la de cuerpo y la de cara', async () => {
    await guardarPerfil({ fotoCuerpo: imagen(1, 'image/jpeg') })
    await guardarPerfil({ fotoCara: imagen(2, 'image/jpeg') })

    expect(await sinBlobs(await leerPerfil())).toMatchObject({
      fotoCuerpo: await sinBlobs(imagen(1, 'image/jpeg')),
      fotoCara: await sinBlobs(imagen(2, 'image/jpeg')),
    })
  })

  it('cambia una sin tocar la otra', async () => {
    await guardarPerfil({ fotoCuerpo: imagen(1, 'image/jpeg'), fotoCara: imagen(2, 'image/jpeg') })

    await guardarPerfil({ fotoCuerpo: imagen(3, 'image/jpeg') })

    expect(await sinBlobs(await leerPerfil())).toMatchObject({
      fotoCuerpo: await sinBlobs(imagen(3, 'image/jpeg')),
      fotoCara: await sinBlobs(imagen(2, 'image/jpeg')),
    })
  })

  it('borra una sin tocar la otra ni el resto del perfil', async () => {
    await guardarPerfil({
      fotoCuerpo: imagen(1, 'image/jpeg'),
      fotoCara: imagen(2, 'image/jpeg'),
      ciudad: 'Valencia',
      estilosFavoritos: ['boho'],
    })

    await guardarPerfil({ fotoCara: null })

    expect(await sinBlobs(await leerPerfil())).toEqual({
      fotoCuerpo: await sinBlobs(imagen(1, 'image/jpeg')),
      fotoCara: null,
      ciudad: 'Valencia',
      estilosFavoritos: ['boho'],
    })
  })
})

describe('ciudad y estilos del perfil', () => {
  it('guarda la ciudad sin espacios sobrantes y deja quitarla', async () => {
    await guardarPerfil({ ciudad: '  Bilbao ' })
    expect((await leerPerfil()).ciudad).toBe('Bilbao')

    await guardarPerfil({ ciudad: '' })
    expect((await leerPerfil()).ciudad).toBe('')
  })

  it('guarda y cambia los estilos favoritos', async () => {
    await guardarPerfil({ estilosFavoritos: ['casual', 'boho'] })
    await guardarPerfil({ estilosFavoritos: ['boho'] })

    expect((await leerPerfil()).estilosFavoritos).toEqual(['boho'])
  })

  it('rechaza un estilo que no está en la lista', async () => {
    await expect(
      guardarPerfil({ estilosFavoritos: ['inventado' as unknown as 'boho'] }),
    ).rejects.toThrow()
    expect((await leerPerfil()).estilosFavoritos).toEqual([])
  })
})

describe('el perfil en la copia', () => {
  it('va entero en la copia y vuelve igual al importarla', async () => {
    await guardarPerfil({
      fotoCuerpo: imagen(1, 'image/jpeg'),
      fotoCara: imagen(2, 'image/jpeg'),
      ciudad: 'Valencia',
      estilosFavoritos: ['minimalista', 'boho'],
    })
    const antes = await sinBlobs(await leerPerfil())
    const copia = await exportarCopia()
    await vaciarBase()

    await importarCopia(copia, 'reemplazar')

    expect(await sinBlobs(await leerPerfil())).toEqual(antes)
  })

  it('una foto borrada sigue borrada tras exportar e importar', async () => {
    await guardarPerfil({ fotoCuerpo: imagen(1, 'image/jpeg'), fotoCara: imagen(2, 'image/jpeg') })
    await guardarPerfil({ fotoCuerpo: null })
    const copia = await exportarCopia()
    await vaciarBase()

    await importarCopia(copia, 'reemplazar')

    expect(await sinBlobs(await leerPerfil())).toMatchObject({
      fotoCuerpo: null,
      fotoCara: await sinBlobs(imagen(2, 'image/jpeg')),
    })
  })
})
