// @vitest-environment node
import 'fake-indexeddb/auto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportarCopia, importarCopia } from './copia.ts'
import { datosTablaTallasSchema, idTablaTallas, type DatosTablaTallas } from './modelo.ts'
import { vaciarBase } from './pruebas.ts'
import {
  borrarTablaTallas,
  guardarTablaTallas,
  leerTablaTallas,
  listarTablasTallas,
} from './repositorio.ts'

const zara: DatosTablaTallas = {
  marca: 'Zara',
  tipo: 'pantalón',
  medidaDe: 'cuerpo',
  filas: [
    { talla: '40', cintura: 78, cadera: 96 },
    { talla: '42', cintura: 82, cadera: 100 },
  ],
}

beforeEach(async () => {
  await vaciarBase()
})

describe('esquema de la tabla de tallas', () => {
  it('redondea a un decimal y rechaza medidas imposibles o filas sin talla', () => {
    expect(
      datosTablaTallasSchema.parse({ ...zara, filas: [{ talla: ' M ', pecho: 96.24 }] }).filas,
    ).toEqual([{ talla: 'M', pecho: 96.2 }])
    for (const fila of [{ talla: 'M', pecho: 0 }, { talla: 'M', pecho: 400 }, { talla: '' }]) {
      expect(datosTablaTallasSchema.safeParse({ ...zara, filas: [fila] }).success).toBe(false)
    }
    expect(datosTablaTallasSchema.safeParse({ ...zara, filas: [] }).success).toBe(false)
  })

  it('una medida que redondeada queda en 0 no vale (la copia con ella no se podría importar)', () => {
    expect(
      datosTablaTallasSchema.safeParse({ ...zara, filas: [{ talla: 'M', pecho: 0.04 }] }).success,
    ).toBe(false)
  })

  it('no admite tallas repetidas, sin mirar mayúsculas', () => {
    const filas = [
      { talla: 'M', pecho: 100 },
      { talla: 'm', pecho: 101 },
    ]
    expect(datosTablaTallasSchema.safeParse({ ...zara, filas }).success).toBe(false)
  })
})

describe('tablas de tallas en la base', () => {
  it('una por marca (sin mayúsculas) y tipo: guardar otra la sustituye', async () => {
    await guardarTablaTallas(zara)
    await guardarTablaTallas({ ...zara, marca: ' ZARA ', filas: [{ talla: '44', cintura: 86 }] })
    await guardarTablaTallas({
      ...zara,
      tipo: 'parte de arriba',
      filas: [{ talla: 'M', pecho: 100 }],
    })

    const tablas = await listarTablasTallas()
    expect(tablas.map((t) => [t.marca, t.tipo])).toEqual([
      ['ZARA', 'pantalón'],
      ['Zara', 'parte de arriba'],
    ])
    expect((await leerTablaTallas('zara', 'pantalón'))?.filas).toEqual([
      { talla: '44', cintura: 86 },
    ])
  })

  it('al cambiar la marca o el tipo, quita la de antes', async () => {
    const antes = await guardarTablaTallas(zara)

    await guardarTablaTallas({ ...zara, marca: 'Mango' }, antes.id)

    expect((await listarTablasTallas()).map((t) => t.id)).toEqual([
      idTablaTallas('Mango', 'pantalón'),
    ])
  })

  it('se borra', async () => {
    const tabla = await guardarTablaTallas(zara)

    await borrarTablaTallas(tabla.id)

    expect(await listarTablasTallas()).toEqual([])
  })
})

describe('tablas de tallas en la copia', () => {
  it('van y vuelven; al reemplazar, las que no están en la copia se borran', async () => {
    const tabla = await guardarTablaTallas(zara)
    const copia = await exportarCopia()
    await guardarTablaTallas({ ...zara, marca: 'Mango' })

    await importarCopia(copia, 'reemplazar')

    expect(await listarTablasTallas()).toEqual([tabla])
  })

  it('al fusionar se suman a las del móvil', async () => {
    await guardarTablaTallas(zara)
    const copia = await exportarCopia()
    await vaciarBase()
    await guardarTablaTallas({ ...zara, marca: 'Mango' })

    await importarCopia(copia, 'fusionar')

    expect((await listarTablasTallas()).map((t) => t.marca)).toEqual(['Mango', 'Zara'])
  })

  it('al importar, el id sale de la marca y el tipo aunque la copia diga otro', async () => {
    await guardarTablaTallas(zara)
    const copia = await exportarCopia()
    const zip = unzipSync(new Uint8Array(await copia.arrayBuffer()))
    const json = JSON.parse(strFromU8(zip['percha.json'] ?? strToU8('{}'))) as {
      tablasTallas: { id: string }[]
    }
    const [tabla] = json.tablasTallas
    if (tabla) tabla.id = 'otro-id'
    zip['percha.json'] = strToU8(JSON.stringify(json))

    await importarCopia(new Blob([zipSync(zip)]), 'fusionar')

    expect((await listarTablasTallas()).map((t) => t.id)).toEqual([
      idTablaTallas('Zara', 'pantalón'),
    ])
  })

  it('una copia de antes de T10.1, sin tablas, se importa igual', async () => {
    const copia = await exportarCopia()
    const zip = unzipSync(new Uint8Array(await copia.arrayBuffer()))
    const json = JSON.parse(strFromU8(zip['percha.json'] ?? strToU8('{}'))) as Record<
      string,
      unknown
    >
    delete json.tablasTallas
    zip['percha.json'] = strToU8(JSON.stringify(json))

    await importarCopia(new Blob([zipSync(zip)]), 'reemplazar')

    expect(await listarTablasTallas()).toEqual([])
  })
})
