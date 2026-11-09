// @vitest-environment node
// jsdom tiene su propio Blob, que fake-indexeddb no sabe clonar: estos tests corren en Node.
import 'fake-indexeddb/auto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportarCopia, importarCopia } from './copia.ts'
import type { Perfil } from './modelo.ts'
import { imagen, sinBlobs, vaciarBase } from './pruebas.ts'
import { guardarPerfil, leerPerfil } from './repositorio.ts'

beforeEach(vaciarBase)

const CUERPO: NonNullable<Perfil['cuerpo']> = {
  altura: 176,
  peso: 100,
  pecho: 118,
  cintura: 104.5,
  cadera: 112,
  largoPierna: 80,
  complexion: 'grande',
  notas: 'hombros anchos, muslo grande',
}

describe('cuerpo, tallas, oficina y calor en el perfil', () => {
  it('guarda todo sin tocar las fotos ni la ciudad', async () => {
    await guardarPerfil({ fotoCara: imagen(1, 'image/jpeg'), ciudad: 'Valencia' })

    await guardarPerfil({
      cuerpo: CUERPO,
      tallas: [{ marca: ' Zara ', tipo: 'pantalón', talla: ' 44 ' }],
      oficina: { tipo: 'estándar', viernesCasual: true },
      sensacionTermica: 'caluroso',
    })

    expect(await sinBlobs(await leerPerfil())).toEqual({
      fotoCara: await sinBlobs(imagen(1, 'image/jpeg')),
      fotoCuerpo: null,
      ciudad: 'Valencia',
      estilosFavoritos: [],
      cuerpo: CUERPO,
      tallas: [{ marca: 'Zara', tipo: 'pantalón', talla: '44' }],
      oficina: { tipo: 'estándar', viernesCasual: true },
      sensacionTermica: 'caluroso',
    })
  })

  it.each([
    ['una altura imposible', { altura: 20 }],
    ['un peso imposible', { peso: 900 }],
    ['una cintura negativa', { cintura: -5 }],
    ['un número que no lo es', { pecho: Number.NaN }],
    ['infinito', { cadera: Number.POSITIVE_INFINITY }],
    ['una complexión inventada', { complexion: 'enorme' }],
    ['una línea libre larguísima', { notas: 'a'.repeat(121) }],
  ])('rechaza %s y deja el perfil como estaba', async (_, cuerpo) => {
    await guardarPerfil({ cuerpo: { altura: 176 } })

    await expect(guardarPerfil({ cuerpo: cuerpo as Perfil['cuerpo'] })).rejects.toThrow()
    expect((await leerPerfil()).cuerpo).toEqual({ altura: 176 })
  })

  it('rechaza una talla sin marca o con un tipo inventado', async () => {
    await expect(
      guardarPerfil({ tallas: [{ marca: '  ', tipo: 'pantalón', talla: '44' }] }),
    ).rejects.toThrow()
    await expect(
      guardarPerfil({
        tallas: [{ marca: 'Zara', tipo: 'gorro' as 'calzado', talla: 'M' }],
      }),
    ).rejects.toThrow()
  })

  it('un perfil de antes, sin nada de esto, se sigue leyendo', async () => {
    await guardarPerfil({ ciudad: 'Bilbao' })

    const perfil = await leerPerfil()
    expect(perfil.cuerpo).toBeUndefined()
    expect(perfil.tallas).toBeUndefined()
  })
})

describe('el cuerpo en la copia', () => {
  it('va en la copia y vuelve igual al importarla', async () => {
    await guardarPerfil({
      cuerpo: CUERPO,
      tallas: [
        { marca: 'Zara', tipo: 'pantalón', talla: '44' },
        { marca: 'Nike', tipo: 'calzado', talla: '45' },
      ],
      oficina: { tipo: 'conservadora', viernesCasual: false },
      sensacionTermica: 'friolero',
    })
    const antes = await sinBlobs(await leerPerfil())
    const copia = await exportarCopia()
    await vaciarBase()

    await importarCopia(copia, 'reemplazar')

    expect(await sinBlobs(await leerPerfil())).toEqual(antes)
  })

  it('una copia de antes, sin estos campos, se importa', async () => {
    await guardarPerfil({ ciudad: 'Sevilla', estilosFavoritos: ['boho'] })
    const ficheros = unzipSync(new Uint8Array(await (await exportarCopia()).arrayBuffer()))
    const json = JSON.parse(strFromU8(ficheros['percha.json'] ?? new Uint8Array())) as {
      perfil: Record<string, unknown>
    }
    // Así eran las copias antes de T8.2: el perfil solo con fotos, ciudad y estilos.
    expect(Object.keys(json.perfil).sort()).toEqual(
      ['ciudad', 'estilosFavoritos', 'fotoCara', 'fotoCuerpo'].sort(),
    )
    const vieja = new Blob([zipSync({ ...ficheros, 'percha.json': strToU8(JSON.stringify(json)) })])
    await vaciarBase()

    await importarCopia(vieja, 'reemplazar')

    expect(await leerPerfil()).toMatchObject({ ciudad: 'Sevilla', estilosFavoritos: ['boho'] })
  })

  it('al fusionar una copia de antes, se queda todo lo del cuerpo', async () => {
    const copia = await exportarCopia()
    await guardarPerfil({
      cuerpo: { altura: 176 },
      tallas: [{ marca: 'Zara', tipo: 'pantalón', talla: '44' }],
      oficina: { tipo: 'creativa', viernesCasual: false },
    })

    await importarCopia(copia, 'fusionar')

    expect(await leerPerfil()).toMatchObject({
      cuerpo: { altura: 176 },
      tallas: [{ marca: 'Zara', tipo: 'pantalón', talla: '44' }],
      oficina: { tipo: 'creativa', viernesCasual: false },
    })
  })

  it('al fusionar, unas notas vacías en la copia no borran las del móvil', async () => {
    await guardarPerfil({ cuerpo: { altura: 176 } })
    const ficheros = unzipSync(new Uint8Array(await (await exportarCopia()).arrayBuffer()))
    const json = JSON.parse(strFromU8(ficheros['percha.json'] ?? new Uint8Array())) as {
      perfil: { cuerpo: Record<string, unknown> }
    }
    json.perfil.cuerpo.notas = ''
    const retocada = new Blob([
      zipSync({ ...ficheros, 'percha.json': strToU8(JSON.stringify(json)) }),
    ])
    await guardarPerfil({ cuerpo: { notas: 'hombros anchos' } })

    await importarCopia(retocada, 'fusionar')

    expect((await leerPerfil()).cuerpo).toEqual({ altura: 176, notas: 'hombros anchos' })
  })

  it('al fusionar, la copia no borra las medidas que no trae', async () => {
    await guardarPerfil({ cuerpo: { altura: 176, cadera: 112 }, sensacionTermica: 'caluroso' })
    const copia = await exportarCopia()
    await guardarPerfil({
      cuerpo: { altura: 175, peso: 100 },
      tallas: [{ marca: 'Zara', tipo: 'pantalón', talla: '44' }],
      sensacionTermica: 'normal',
    })

    await importarCopia(copia, 'fusionar')

    expect(await leerPerfil()).toMatchObject({
      cuerpo: { altura: 176, peso: 100, cadera: 112 },
      tallas: [{ marca: 'Zara', tipo: 'pantalón', talla: '44' }],
      sensacionTermica: 'caluroso',
    })
  })
})
