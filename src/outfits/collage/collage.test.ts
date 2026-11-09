import { describe, expect, it, vi } from 'vitest'
import type { Categoria } from '../../datos/modelo.ts'
import { imagen, nuevaPrenda } from '../../datos/pruebas.ts'
import { crearCollage } from './crear.ts'
import { dibujarCollage, partirTexto, type ImagenPrenda, type RecuadroCollage } from './dibujar.ts'
import { ALTO_COLLAGE, ANCHO_COLLAGE, disponer, encajar, recuadros } from './disposicion.ts'
import { pincelFalso } from './pincelFalso.ts'

const caja = { x: 0, y: 0, ancho: 500, alto: 500 }

function imagenPrenda(categoria: Categoria, ancho = 100, alto = 100): ImagenPrenda {
  return {
    categoria,
    imagen: { categoria } as unknown as ImageBitmap,
    ancho,
    alto,
    nombre: categoria,
  }
}

function outfit(motivo: string, ...categorias: Categoria[]): RecuadroCollage {
  return { motivo, prendas: categorias.map((c) => imagenPrenda(c)) }
}

describe('disponer', () => {
  it('pone arriba la parte de arriba, debajo la de abajo y al final el calzado', () => {
    const [superior, inferior, calzado] = disponer(['superior', 'inferior', 'calzado'], caja)

    expect(superior?.y).toBe(0)
    expect(inferior?.y).toBeGreaterThan(superior?.y ?? Infinity)
    expect(calzado?.y).toBeGreaterThan(inferior?.y ?? Infinity)
    expect(calzado && calzado.y + calzado.alto).toBeCloseTo(500)
    // Sin abrigo ni accesorios, el centro ocupa todo el ancho.
    expect(superior?.ancho).toBe(500)
  })

  it('manda el abrigo y los accesorios a una columna a la derecha', () => {
    const [superior, inferior, abrigo, calzado, accesorio] = disponer(
      ['superior', 'inferior', 'abrigo', 'calzado', 'accesorio'],
      caja,
    )

    expect(abrigo?.x).toBeGreaterThan(superior?.x ?? Infinity)
    expect(accesorio?.x).toBe(abrigo?.x)
    expect(accesorio?.y).toBeGreaterThan(abrigo?.y ?? Infinity)
    expect(inferior?.x).toBe(0)
    expect(calzado?.ancho).toBeLessThan(500)
  })

  it('da al vestido el sitio de arriba y abajo', () => {
    const [vestido, calzado] = disponer(['vestido', 'calzado'], caja)

    expect(vestido?.y).toBe(0)
    expect(vestido?.alto).toBeGreaterThan((calzado?.alto ?? 0) * 3)
  })

  it('ordena por categoría aunque lleguen desordenadas', () => {
    const [calzado, superior] = disponer(['calzado', 'superior'], caja)

    expect(superior?.y).toBe(0)
    expect(calzado?.y).toBeGreaterThan(0)
  })
})

describe('disponer con capas', () => {
  const dentro = (r: { x: number; y: number; ancho: number; alto: number } | undefined) =>
    r !== undefined &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.x + r.ancho <= 500 + 1e-9 &&
    r.y + r.alto <= 500 + 1e-9
  const solapan = (
    a: { x: number; y: number; ancho: number; alto: number },
    b: { x: number; y: number; ancho: number; alto: number },
  ) =>
    a.x < b.x + b.ancho - 1e-9 &&
    b.x < a.x + a.ancho - 1e-9 &&
    a.y < b.y + b.alto - 1e-9 &&
    b.y < a.y + a.alto - 1e-9

  it('caben 8 prendas sin salirse ni pisarse, de fuera adentro', () => {
    const rects = disponer(
      ['base', 'media', 'media', 'exterior', 'inferior', 'calzado', 'accesorio', 'accesorio'],
      caja,
    )
    expect(rects).toHaveLength(8)
    for (const r of rects) expect(dentro(r)).toBe(true)
    rects.forEach((a, i) => {
      rects.slice(i + 1).forEach((b) => {
        expect(solapan(a, b)).toBe(false)
      })
    })
    const [base, mediaDentro, mediaFuera, exterior, inferior, calzado, accesorio] = rects
    // A la derecha, de arriba abajo: exterior, la media de fuera, la de dentro y los accesorios.
    expect(exterior?.y).toBe(0)
    expect(mediaFuera?.y).toBeGreaterThan(exterior?.y ?? Infinity)
    expect(mediaDentro?.y).toBeGreaterThan(mediaFuera?.y ?? Infinity)
    expect(accesorio?.y).toBeGreaterThan(mediaDentro?.y ?? Infinity)
    // En el centro: base, inferior y calzado.
    expect(base?.x).toBe(0)
    expect(inferior?.y).toBeGreaterThan(base?.y ?? Infinity)
    expect(calzado?.y).toBeGreaterThan(inferior?.y ?? Infinity)
    // Con la columna llena, el centro cede algo de ancho.
    expect(base?.ancho).toBeCloseTo(500 * 0.55)
  })

  it('con 2 o 3 prendas sigue ocupando todo el ancho', () => {
    expect(disponer(['vestido', 'calzado'], caja).every((r) => r.ancho === 500)).toBe(true)
    expect(disponer(['base', 'inferior', 'calzado'], caja).every((r) => r.ancho === 500)).toBe(true)
  })

  it('una media sola va a la derecha, como la exterior', () => {
    const [base, media] = disponer(['base', 'media', 'inferior', 'calzado'], caja)
    expect(media?.x).toBeCloseTo(500 * 0.62)
    expect(base?.ancho).toBeCloseTo(500 * 0.62)
  })
})

describe('encajar', () => {
  it('cabe entera, centrada y sin deformarse', () => {
    expect(encajar(200, 100, caja)).toEqual({ x: 0, y: 125, ancho: 500, alto: 250 })
    expect(encajar(0, 100, caja).ancho).toBe(0)
  })
})

describe('partirTexto', () => {
  const { pincel } = pincelFalso()

  it('parte en líneas que caben', () => {
    expect(partirTexto(pincel, 'abrigo por 8 °C', 100, 2)).toEqual(['abrigo por', '8 °C'])
  })

  it('corta con «…» una palabra que no cabe sola', () => {
    expect(partirTexto(pincel, 'cortavientos impermeable', 80, 1)).toEqual(['cortavi…'])
  })

  it('acaba en «…» si no cabe en las líneas que hay', () => {
    const lineas = partirTexto(pincel, 'uno dos tres cuatro cinco seis', 80, 2)

    expect(lineas).toHaveLength(2)
    expect(lineas[1]?.endsWith('…')).toBe(true)
    expect((lineas[1]?.length ?? 0) * 10).toBeLessThanOrEqual(80)
  })
})

describe('dibujarCollage', () => {
  it('dibuja 4 recuadros con sus prendas, su número y su motivo', () => {
    const { pincel, de } = pincelFalso()
    const outfits = [
      outfit('casual para diario', 'superior', 'inferior', 'calzado'),
      outfit('abrigo por 8 °C', 'superior', 'inferior', 'abrigo', 'calzado'),
      outfit('elegante para cena', 'vestido', 'calzado', 'accesorio'),
      outfit('formal para trabajo', 'superior', 'inferior', 'calzado'),
    ]

    dibujarCollage(pincel, outfits)

    expect(de('fillRect')[0]?.argumentos).toEqual([0, 0, ANCHO_COLLAGE, ALTO_COLLAGE])
    const celdas = recuadros().map((r) => [r.x, r.y, r.ancho, r.alto, 24])
    expect(de('roundRect').map((t) => t.argumentos)).toEqual(celdas)
    expect(de('drawImage')).toHaveLength(13)
    const textos = de('fillText').map((t) => t.argumentos[0])
    expect(textos).toEqual(expect.arrayContaining(['1', '2', '3', '4']))
    expect(de('arc')).toHaveLength(4)
    de('fillText').forEach((trazo) => {
      const [texto, x] = trazo.argumentos as [string, number]
      const celda = recuadros().find((r) => x >= r.x && x <= r.x + r.ancho)
      // Ningún texto se sale de su recuadro (el falso mide 10 px por carácter).
      if (trazo.argumentos.length === 3 && celda && texto.length > 1) {
        expect(x + texto.length * 10).toBeLessThanOrEqual(celda.x + celda.ancho)
      }
    })
    expect(textos).toEqual(
      expect.arrayContaining([
        'Casual para diario',
        'Abrigo por 8 °C',
        'Elegante para cena',
        'Formal para trabajo',
      ]),
    )
  })

  it('cada prenda cae dentro de su recuadro', () => {
    const { pincel, de } = pincelFalso()
    const outfits = [1, 2, 3, 4].map((n) =>
      outfit(`o${String(n)}`, 'superior', 'inferior', 'calzado'),
    )

    dibujarCollage(pincel, outfits)

    const celdas = recuadros()
    de('drawImage').forEach((trazo, i) => {
      const celda = celdas[Math.floor(i / 3)]
      const [, x, y, ancho, alto] = trazo.argumentos as number[]
      expect(celda).toBeDefined()
      if (!celda || x === undefined || y === undefined || !ancho || !alto) return
      expect(x).toBeGreaterThanOrEqual(celda.x)
      expect(y).toBeGreaterThanOrEqual(celda.y)
      expect(x + ancho).toBeLessThanOrEqual(celda.x + celda.ancho)
      expect(y + alto).toBeLessThanOrEqual(celda.y + celda.alto)
    })
  })

  it('con menos de 4 outfits deja vacíos los recuadros que sobran', () => {
    const { pincel, de } = pincelFalso()

    dibujarCollage(pincel, [outfit('uno', 'vestido', 'calzado')])

    expect(de('roundRect')).toHaveLength(4)
    expect(de('drawImage')).toHaveLength(2)
    expect(de('fillText').map((t) => t.argumentos[0])).toEqual(['1', 'Uno'])
  })

  it('sin imagen pinta un hueco con el nombre de la prenda', () => {
    const { pincel, de } = pincelFalso()
    const sinFoto: ImagenPrenda = { ...imagenPrenda('calzado'), imagen: null, nombre: 'botas' }

    dibujarCollage(pincel, [{ motivo: 'm', prendas: [imagenPrenda('vestido'), sinFoto] }])

    expect(de('drawImage')).toHaveLength(1)
    expect(de('fillText').map((t) => t.argumentos[0])).toContain('botas')
  })
})

describe('crearCollage', () => {
  function lienzoFalso() {
    const falso = pincelFalso()
    const blob = new Blob(['collage'], { type: 'image/jpeg' })
    const crearLienzo = vi.fn(() => ({ pincel: falso.pincel, aBlob: () => Promise.resolve(blob) }))
    return { ...falso, blob, crearLienzo }
  }

  it('usa la foto recortada o, si no la hay, la original, y libera las imágenes', async () => {
    const recortada = imagen(2, 'image/png')
    const original = imagen(3, 'image/jpeg')
    const cerrar = vi.fn()
    const cargar = vi.fn((foto: Blob) =>
      Promise.resolve({ imagen: { foto } as unknown as ImageBitmap, ancho: 10, alto: 20, cerrar }),
    )
    const { blob, crearLienzo, de } = lienzoFalso()

    const resultado = await crearCollage(
      [
        {
          motivo: 'casual',
          prendas: [
            nuevaPrenda({ fotos: [{ original: imagen(1), recortada }] }),
            nuevaPrenda({ categoria: 'calzado', fotos: [{ original, recortada: null }] }),
          ],
        },
      ],
      { cargar, crearLienzo },
    )

    expect(resultado).toBe(blob)
    expect(crearLienzo).toHaveBeenCalledWith(ANCHO_COLLAGE, ALTO_COLLAGE)
    expect(cargar.mock.calls.map(([foto]) => foto)).toEqual([recortada, original])
    expect(de('drawImage')).toHaveLength(2)
    expect(cerrar).toHaveBeenCalledTimes(2)
  })

  it('lee una sola vez la foto de una prenda que sale en varios outfits', async () => {
    const zapatillas = nuevaPrenda({ categoria: 'calzado' })
    const cargar = vi.fn(() =>
      Promise.resolve({ imagen: {} as unknown as ImageBitmap, ancho: 10, alto: 10 }),
    )
    const { crearLienzo, de } = lienzoFalso()

    await crearCollage(
      [
        { motivo: 'a', prendas: [nuevaPrenda(), zapatillas] },
        { motivo: 'b', prendas: [nuevaPrenda(), zapatillas] },
      ],
      { cargar, crearLienzo },
    )

    expect(cargar).toHaveBeenCalledTimes(3)
    expect(de('drawImage')).toHaveLength(4)
  })

  it('si una foto no se puede leer, sigue con un hueco', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cargar = vi.fn(() => Promise.reject(new Error('imagen rota')))
    const { blob, crearLienzo, de } = lienzoFalso()

    const resultado = await crearCollage(
      [{ motivo: 'm', prendas: [nuevaPrenda({ subcategoria: 'camisa' })] }],
      { cargar, crearLienzo },
    )

    expect(resultado).toBe(blob)
    expect(de('drawImage')).toHaveLength(0)
    expect(de('fillText').map((t) => t.argumentos[0])).toContain('camisa')
  })
})

describe('crearCollage con capas', () => {
  it('coloca cada prenda por su ranura', async () => {
    const { pincel, de } = pincelFalso()
    const camiseta = nuevaPrenda({ subcategoria: 'camiseta' })
    // Una sobrecamisa de `superior` haciendo de exterior: sin ranuras iría al centro como base.
    const sobrecamisa = nuevaPrenda({ categoria: 'superior', subcategoria: 'sobrecamisa' })
    const vaqueros = nuevaPrenda({ categoria: 'inferior' })
    const zapatillas = nuevaPrenda({ categoria: 'calzado' })
    await crearCollage(
      [
        {
          prendas: [camiseta, sobrecamisa, vaqueros, zapatillas],
          ranuras: ['base', 'exterior', 'inferior', 'calzado'],
          motivo: 'con sobrecamisa para 18 °C',
        },
      ],
      {
        cargar: () => Promise.resolve({ imagen: {} as ImageBitmap, ancho: 100, alto: 100 }),
        crearLienzo: () => ({ pincel, aBlob: () => Promise.resolve(new Blob()) }),
      },
    )
    const [base, exterior] = de('drawImage').map((t) => t.argumentos as number[])
    expect(de('drawImage')).toHaveLength(4)
    expect(exterior?.[1]).toBeGreaterThan(base?.[1] ?? Infinity)
  })
})
