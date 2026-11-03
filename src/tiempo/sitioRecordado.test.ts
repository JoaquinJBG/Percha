import { beforeEach, describe, expect, it } from 'vitest'
import { crearAlmacenSitioLocal } from './sitioRecordado.ts'

describe('crearAlmacenSitioLocal', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('guarda y lee una ciudad o la preferencia de ubicación', () => {
    const almacen = crearAlmacenSitioLocal(window.localStorage)
    const madrid = { nombre: 'Madrid', detalle: 'España', latitud: 40.42, longitud: -3.7 }

    almacen.guardar({ tipo: 'ciudad', sitio: madrid })
    expect(almacen.leer()).toEqual({ tipo: 'ciudad', sitio: madrid })

    almacen.guardar({ tipo: 'ubicacion' })
    expect(almacen.leer()).toEqual({ tipo: 'ubicacion' })
  })

  it.each([
    ['JSON roto', '{no'],
    ['un sitio suelto', JSON.stringify({ nombre: 'Madrid', latitud: 40, longitud: -3 })],
    ['una ciudad sin coordenadas', JSON.stringify({ tipo: 'ciudad', sitio: { nombre: 'X' } })],
  ])('ignora %s', (_caso, texto) => {
    window.localStorage.setItem('percha:sitio', texto)

    expect(crearAlmacenSitioLocal(window.localStorage).leer()).toBeNull()
  })

  it('no falla sin almacén', () => {
    const almacen = crearAlmacenSitioLocal(null)

    almacen.guardar({ tipo: 'ubicacion' })
    expect(almacen.leer()).toBeNull()
  })
})
