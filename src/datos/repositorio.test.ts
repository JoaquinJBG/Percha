// @vitest-environment node
// jsdom tiene su propio Blob, que fake-indexeddb no sabe clonar: estos tests corren en Node.
import 'fake-indexeddb/auto'
import { ZodError } from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db.ts'
import { imagen, nuevaPrenda, sinBlobs, vaciarBase } from './pruebas.ts'
import {
  actualizarPrenda,
  borrarOutfit,
  borrarPrenda,
  crearPrenda,
  guardarAjustes,
  guardarOutfit,
  guardarPerfil,
  guardarPrueba,
  leerAjustes,
  leerPerfil,
  leerPrenda,
  listarOutfits,
  listarPrendas,
  marcarFavorito,
  nuevoId,
} from './repositorio.ts'

beforeEach(vaciarBase)
afterEach(() => {
  vi.useRealTimers()
})

describe('prendas', () => {
  it('crea una prenda con id y fecha, y la lee con sus fotos intactas', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-02T10:00:00Z'), toFake: ['Date'] })

    const creada = await crearPrenda(nuevaPrenda())
    const leida = await leerPrenda(creada.id)

    expect(creada.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(creada.creadaEn).toBe(Date.parse('2026-11-02T10:00:00Z'))
    expect(await sinBlobs(leida)).toEqual(await sinBlobs(creada))
    expect(await sinBlobs(leida?.fotos[0]?.recortada)).toEqual(
      await sinBlobs(imagen(2, 'image/png')),
    )
  })

  it('guarda los colores en minúsculas, sin espacios ni repetidos', async () => {
    const prenda = await crearPrenda(nuevaPrenda({ colores: [' Azul ', 'azul', 'BLANCO', ' '] }))

    expect(prenda.colores).toEqual(['azul', 'blanco'])
  })

  it.each([
    ['sin fotos', { fotos: [] }],
    [
      'con tres fotos',
      { fotos: Array.from({ length: 3 }, () => ({ original: imagen(1), recortada: null })) },
    ],
    ['abrigo 0', { abrigo: 0 }],
    ['formalidad 6', { formalidad: 6 }],
    ['abrigo con decimales', { abrigo: 2.5 }],
    ['categoría desconocida', { categoria: 'sombrero' }],
    ['estilo fuera de la lista', { estilos: ['hippie'] }],
  ])('rechaza una prenda %s y no guarda nada', async (_, cambios) => {
    await expect(crearPrenda(nuevaPrenda(cambios as never))).rejects.toBeInstanceOf(ZodError)
    expect(await db.prendas.count()).toBe(0)
  })

  it('devuelve undefined si la prenda no existe', async () => {
    expect(await leerPrenda('no-existe')).toBeUndefined()
  })

  it('lista de la más nueva a la más antigua', async () => {
    vi.useFakeTimers({ now: 1_000, toFake: ['Date'] })
    const vieja = await crearPrenda(nuevaPrenda())
    vi.setSystemTime(2_000)
    const nueva = await crearPrenda(nuevaPrenda())

    expect((await listarPrendas()).map((p) => p.id)).toEqual([nueva.id, vieja.id])
  })

  describe('filtros', () => {
    async function sembrar() {
      const camiseta = await crearPrenda(
        nuevaPrenda({ categoria: 'superior', colores: ['blanco'], estilos: ['casual'] }),
      )
      const vaqueros = await crearPrenda(
        nuevaPrenda({
          categoria: 'inferior',
          colores: ['azul'],
          estilos: ['casual', 'vintage / retro'],
        }),
      )
      const camisa = await crearPrenda(
        nuevaPrenda({ categoria: 'superior', colores: ['azul', 'blanco'], estilos: ['formal'] }),
      )
      return { camiseta, vaqueros, camisa }
    }
    const ids = async (...args: Parameters<typeof listarPrendas>) =>
      (await listarPrendas(...args)).map((p) => p.id).sort()

    it('por categoría', async () => {
      const { camiseta, camisa } = await sembrar()
      expect(await ids({ categoria: 'superior' })).toEqual([camiseta.id, camisa.id].sort())
    })

    it('por estilo', async () => {
      const { camiseta, vaqueros } = await sembrar()
      expect(await ids({ estilo: 'casual' })).toEqual([camiseta.id, vaqueros.id].sort())
    })

    it('por color, sin importar mayúsculas ni espacios', async () => {
      const { vaqueros, camisa } = await sembrar()
      expect(await ids({ color: ' AZUL ' })).toEqual([vaqueros.id, camisa.id].sort())
    })

    it('combinados', async () => {
      const { camisa } = await sembrar()
      expect(await ids({ categoria: 'superior', color: 'azul' })).toEqual([camisa.id])
    })

    it('sin coincidencias devuelve una lista vacía', async () => {
      await sembrar()
      expect(await ids({ categoria: 'calzado' })).toEqual([])
    })

    it('un color vacío no filtra', async () => {
      await sembrar()
      expect(await ids({ color: '  ' })).toHaveLength(3)
    })

    it('por corte; las prendas sin corte no salen', async () => {
      await sembrar()
      const balloon = await crearPrenda(
        nuevaPrenda({ categoria: 'inferior', subcategoria: 'vaquero', corte: 'balloon' }),
      )
      expect(await ids({ corte: 'balloon' })).toEqual([balloon.id])
    })
  })

  it('actualiza solo lo que se pasa y conserva id y fecha', async () => {
    const prenda = await crearPrenda(nuevaPrenda())
    const foto = { original: imagen(7), recortada: null }

    const actualizada = await actualizarPrenda(prenda.id, {
      notas: 'de lino',
      etiquetadaPor: 'ia',
      fotos: [foto],
    })

    expect(actualizada).toMatchObject({
      id: prenda.id,
      creadaEn: prenda.creadaEn,
      notas: 'de lino',
    })
    expect(await sinBlobs(await leerPrenda(prenda.id))).toEqual(await sinBlobs(actualizada))
    expect(actualizada.subcategoria).toBe('camiseta')
  })

  it('al actualizar valida y no toca la prenda si los datos son malos', async () => {
    const prenda = await crearPrenda(nuevaPrenda())

    await expect(actualizarPrenda(prenda.id, { abrigo: 9 })).rejects.toBeInstanceOf(ZodError)
    expect((await leerPrenda(prenda.id))?.abrigo).toBe(1)
  })

  it('guarda los datos de la etiqueta y, con undefined, los quita', async () => {
    const prenda = await crearPrenda(
      nuevaPrenda({
        marca: ' Zara ',
        talla: 'M',
        composicion: [{ material: 'Lino', porcentaje: 100 }],
      }),
    )
    expect(prenda).toMatchObject({ marca: 'Zara', composicion: [{ material: 'lino' }] })

    const sinMarca = await actualizarPrenda(prenda.id, { marca: undefined })

    expect(sinMarca.marca).toBeUndefined()
    expect((await leerPrenda(prenda.id))?.marca).toBeUndefined()
    expect(sinMarca.talla).toBe('M')
  })

  it('solo admite enlaces web', async () => {
    const prenda = await crearPrenda(nuevaPrenda())

    await expect(
      actualizarPrenda(prenda.id, { enlace: 'javascript:alert(1)' }),
    ).rejects.toBeInstanceOf(ZodError)
    await expect(crearPrenda(nuevaPrenda({ enlace: 'zara.com/algo' }))).rejects.toBeInstanceOf(
      ZodError,
    )
    expect(
      (
        await actualizarPrenda(prenda.id, {
          enlace: 'https://www2.hm.com/es_es/productpage.0970819001.html',
        })
      ).enlace,
    ).toContain('hm.com')
  })

  it('actualizar una prenda que no existe da error', async () => {
    await expect(actualizarPrenda('no-existe', { notas: 'x' })).rejects.toThrow(/No existe/)
  })

  it('borra una prenda, y borrarla otra vez no falla', async () => {
    const prenda = await crearPrenda(nuevaPrenda())

    await borrarPrenda(prenda.id)
    await borrarPrenda(prenda.id)

    expect(await leerPrenda(prenda.id)).toBeUndefined()
  })
})

describe('outfits', () => {
  it('guarda, lista, marca favorito y borra', async () => {
    const outfit = await guardarOutfit({
      prendas: [nuevoId(), nuevoId()],
      estilo: 'casual',
      ocasion: 'diario',
      tiempo: { temperatura: 18.5, lluvia: false },
      explicacion: 'Fresco y cómodo.',
      favorito: false,
    })

    await marcarFavorito(outfit.id, true)
    expect(await listarOutfits()).toEqual([{ ...outfit, favorito: true }])

    await borrarOutfit(outfit.id)
    expect(await listarOutfits()).toEqual([])
    await expect(marcarFavorito(outfit.id, true)).rejects.toThrow(/No existe/)
  })

  it('guarda con el outfit la foto del probador y la cambia por otra', async () => {
    const outfit = await guardarOutfit({
      prendas: [nuevoId()],
      estilo: 'casual',
      ocasion: 'diario',
      tiempo: null,
      explicacion: '',
      favorito: false,
    })
    expect(outfit.prueba).toBeUndefined()

    await guardarPrueba(outfit.id, imagen(1, 'image/jpeg'))
    await guardarPrueba(outfit.id, imagen(2, 'image/jpeg'))

    const [leido] = await listarOutfits()
    expect(await sinBlobs(leido?.prueba)).toEqual(await sinBlobs(imagen(2, 'image/jpeg')))
    await expect(guardarPrueba(nuevoId(), imagen(3))).rejects.toThrow(/No existe/)
  })
})

describe('perfil', () => {
  it('empieza vacío', async () => {
    expect(await leerPerfil()).toEqual({
      fotoCara: null,
      fotoCuerpo: null,
      ciudad: '',
      estilosFavoritos: [],
    })
  })

  it('guarda solo los campos que se pasan', async () => {
    await guardarPerfil({ ciudad: ' Valencia ' })
    await guardarPerfil({ fotoCara: imagen(3), estilosFavoritos: ['minimalista'] })

    expect(await sinBlobs(await leerPerfil())).toEqual({
      fotoCara: await sinBlobs(imagen(3)),
      fotoCuerpo: null,
      ciudad: 'Valencia',
      estilosFavoritos: ['minimalista'],
    })
  })
})

describe('ajustes', () => {
  it('los guardados antes de T7.1, sin probador, se leen con el probador vacío', async () => {
    await db.ajustes.put({ claveGemini: null, modeloGemini: 'gemini-viejo' } as never, 'unica')

    expect(await leerAjustes()).toEqual({
      claveGemini: null,
      modeloGemini: 'gemini-viejo',
      urlProbador: null,
      claveProbador: null,
    })
  })

  it('guarda la URL y la clave del probador; vacías, las quita', async () => {
    await guardarAjustes({ urlProbador: ' https://pc.tail0000.ts.net ', claveProbador: 'c' })
    expect(await leerAjustes()).toMatchObject({
      urlProbador: 'https://pc.tail0000.ts.net',
      claveProbador: 'c',
    })

    await guardarAjustes({ urlProbador: '', claveProbador: '  ' })
    expect(await leerAjustes()).toMatchObject({ urlProbador: null, claveProbador: null })
  })

  it('sin guardar nada: sin clave y el modelo por defecto', async () => {
    expect(await leerAjustes()).toEqual({
      claveGemini: null,
      modeloGemini: 'gemini-3.5-flash-lite',
      urlProbador: null,
      claveProbador: null,
    })
  })

  it('guarda la clave sin espacios, y una clave vacía la quita', async () => {
    await guardarAjustes({ claveGemini: '  clave-falsa  ' })
    expect((await leerAjustes()).claveGemini).toBe('clave-falsa')

    await guardarAjustes({ claveGemini: '   ' })
    expect(await leerAjustes()).toEqual({
      claveGemini: null,
      modeloGemini: 'gemini-3.5-flash-lite',
      urlProbador: null,
      claveProbador: null,
    })
  })
})
