import { describe, expect, it, vi } from 'vitest'
import { crearProveedorFalso, ErrorIA, ETIQUETAS_DE_PRUEBA } from '../../ia/index.ts'
import { avisoDeError, BASE_VACIA, etiquetadaPor, etiquetarUna } from './etiquetado.ts'

const foto = new Blob(['foto'], { type: 'image/png' })

describe('etiquetadaPor', () => {
  const deIA = { etiquetas: ETIQUETAS_DE_PRUEBA, por: 'ia' as const }

  it('sin la IA de base, es manual', () => {
    expect(etiquetadaPor(BASE_VACIA, ETIQUETAS_DE_PRUEBA)).toBe('manual')
  })

  it('sigue siendo de la IA si solo se afinan los detalles', () => {
    const afinada = { ...ETIQUETAS_DE_PRUEBA, colores: ['negro'], notas: 'algodón', abrigo: 4 }
    expect(etiquetadaPor(deIA, afinada)).toBe('ia')
    expect(etiquetadaPor(deIA, { ...ETIQUETAS_DE_PRUEBA, subcategoria: ' Camiseta ' })).toBe('ia')
  })

  it('pasa a manual si cambia la categoría o el tipo', () => {
    expect(etiquetadaPor(deIA, { ...ETIQUETAS_DE_PRUEBA, categoria: 'abrigo' })).toBe('manual')
    expect(etiquetadaPor(deIA, { ...ETIQUETAS_DE_PRUEBA, subcategoria: 'polo' })).toBe('manual')
  })
})

describe('avisoDeError', () => {
  it('manda a Ajustes lo que se arregla allí y deja reintentar lo pasajero', () => {
    expect(avisoDeError(new ErrorIA('clave-mala'))).toMatchObject({
      ajustes: true,
      reintentar: false,
    })
    expect(avisoDeError(new ErrorIA('sin-cupo'))).toMatchObject({
      ajustes: false,
      reintentar: true,
    })
  })

  it('un error que no es de la IA no enseña su texto', () => {
    expect(avisoDeError(new Error('token secreto'))).toMatchObject({
      texto: 'No se ha podido hablar con Gemini.',
    })
  })
})

describe('etiquetarUna', () => {
  it('manda una prenda con sus fotos y devuelve sus etiquetas', async () => {
    const proveedor = crearProveedorFalso()
    const resultado = await etiquetarUna(
      () => Promise.resolve(proveedor),
      [foto],
      new AbortController().signal,
    )
    expect(resultado).toEqual({ etiquetas: ETIQUETAS_DE_PRUEBA })
    expect(proveedor.lotes).toEqual([[{ fotos: [foto] }]])
  })

  it('si leer los ajustes falla, lo trata como un error más', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const resultado = await etiquetarUna(
      () => Promise.reject(new Error('IndexedDB')),
      [foto],
      new AbortController().signal,
    )
    expect(resultado).toMatchObject({ aviso: { reintentar: true } })
    vi.restoreAllMocks()
  })

  it('una cancelación no es un error: devuelve null', async () => {
    const control = new AbortController()
    const resultado = etiquetarUna(
      () =>
        Promise.resolve({
          etiquetarPrendas: () => Promise.reject(new DOMException('cancelada', 'AbortError')),
          comprobarClave: () => Promise.resolve(),
          elegirOutfits: () => Promise.resolve([]),
          leerEtiqueta: () => Promise.resolve({}),
          buscarFicha: () => Promise.reject(new Error('no se usa')),
          leerTablaTallas: () => Promise.reject(new Error('no se usa')),
        }),
      [foto],
      control.signal,
    )
    control.abort()
    expect(await resultado).toBeNull()
  })
})
