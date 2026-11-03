import { afterEach, describe, expect, it, vi } from 'vitest'
import { imagen, nuevaPrenda } from '../datos/pruebas.ts'
import {
  ALTO_TRYON,
  ANCHO_TRYON,
  copiarTexto,
  describirPrenda,
  ErrorTryOn,
  HUECO_PERSONA,
  huecosPrendas,
  prepararTryOn,
  promptTryOn,
  type ImagenCargada,
  type PincelTryOn,
  type PrendaTryOn,
} from './index.ts'

function prenda(cambios: Partial<PrendaTryOn> = {}): PrendaTryOn {
  return { ...nuevaPrenda(), ...cambios }
}

describe('describirPrenda', () => {
  it('nombra la prenda, sus colores y el estampado', () => {
    expect(
      describirPrenda(
        prenda({ subcategoria: 'camisa', colores: ['azul', 'blanco'], estampado: 'rayas' }),
      ),
    ).toBe('camisa de color azul y blanco, de rayas')
    expect(
      describirPrenda(
        prenda({ subcategoria: 'falda', colores: ['negro'], estampado: 'gráfico / logo' }),
      ),
    ).toBe('falda de color negro, con estampado gráfico o logo')
  })

  it('no dice nada del estampado si es liso u «otro»', () => {
    expect(describirPrenda(prenda({ colores: ['verde'], estampado: 'liso' }))).toBe(
      'camiseta de color verde',
    )
    expect(describirPrenda(prenda({ colores: [], estampado: 'otro' }))).toBe('camiseta')
  })

  it('no repite el color que ya está en el nombre', () => {
    expect(
      describirPrenda(prenda({ subcategoria: 'Pantalón vaquero', colores: ['vaquero', 'azul'] })),
    ).toBe('Pantalón vaquero de color azul')
  })

  it('sin subcategoría, usa la categoría', () => {
    expect(
      describirPrenda(prenda({ categoria: 'calzado', subcategoria: ' ', colores: ['blanco'] })),
    ).toBe('calzado de color blanco')
  })
})

describe('promptTryOn', () => {
  it('cuenta y lista las prendas y pide el try-on sin tocar la cara', () => {
    const texto = promptTryOn([
      prenda({ subcategoria: 'sudadera', colores: ['gris'] }),
      prenda({ categoria: 'inferior', subcategoria: 'vaquero', colores: ['azul'] }),
    ])

    expect(texto).toMatch(
      /^Te paso una imagen: a la izquierda estoy yo y a la derecha, en columna y de arriba abajo, 2 prendas de ropa: sudadera de color gris; vaquero de color azul\.\n/,
    )
    expect(texto).toContain('Crea una imagen fotorrealista de mí llevando puesto este outfit')
    expect(texto).toContain('Mantén mi cara')
  })

  it('con una sola prenda, lo dice en singular', () => {
    expect(promptTryOn([prenda()])).toContain('una prenda de ropa: camiseta')
  })
})

describe('prepararTryOn', () => {
  function cargarFalso() {
    const cerradas: string[] = []
    const cargar = vi.fn((foto: Blob): Promise<ImagenCargada> => {
      const nombre = foto.type
      if (nombre === 'image/rota') return Promise.reject(new Error('foto rota'))
      return Promise.resolve({
        imagen: { nombre } as unknown as ImageBitmap,
        ancho: 100,
        alto: 200,
        cerrar: () => cerradas.push(nombre),
      })
    })
    return { cargar, cerradas }
  }

  function lienzoFalso() {
    const dibujos: { imagen: unknown; x: number; y: number; ancho: number; alto: number }[] = []
    const pincel = {
      fillStyle: '#000',
      fillRect: vi.fn(),
      drawImage: (imagen: unknown, x: number, y: number, ancho: number, alto: number) => {
        dibujos.push({ imagen, x, y, ancho, alto })
      },
    } as unknown as PincelTryOn
    const crearLienzo = vi.fn(() => ({
      pincel,
      aBlob: () => Promise.resolve(new Blob(['jpeg'], { type: 'image/jpeg' })),
    }))
    return { crearLienzo, dibujos, pincel }
  }

  const persona = imagen(9, 'image/persona')
  const camiseta = prenda({
    subcategoria: 'camiseta',
    colores: ['verde'],
    fotos: [{ original: imagen(1, 'image/original'), recortada: imagen(2, 'image/camiseta') }],
  })
  const pantalon = prenda({
    categoria: 'inferior',
    subcategoria: 'pantalón',
    colores: ['azul'],
    fotos: [{ original: imagen(3, 'image/pantalon'), recortada: null }],
  })
  const abrigo = prenda({
    categoria: 'abrigo',
    subcategoria: 'parka',
    colores: ['negro'],
    fotos: [{ original: imagen(4, 'image/original'), recortada: imagen(5, 'image/abrigo') }],
  })

  it('pone a la persona a la izquierda y las prendas de arriba abajo a la derecha', async () => {
    const { cargar, cerradas } = cargarFalso()
    const { crearLienzo, dibujos } = lienzoFalso()

    const tryon = await prepararTryOn(persona, [pantalon, camiseta, abrigo], {
      cargar,
      crearLienzo,
    })

    expect(crearLienzo).toHaveBeenCalledWith(ANCHO_TRYON, ALTO_TRYON)
    expect(dibujos.map((d) => (d.imagen as { nombre: string }).nombre)).toEqual([
      'image/persona',
      'image/abrigo',
      'image/camiseta',
      'image/pantalon',
    ])
    const [enPersona, ...enPrendas] = dibujos
    // Encajada sin deformar (1:2) y centrada en su hueco.
    expect(enPersona?.ancho).toBe(HUECO_PERSONA.ancho)
    expect(enPersona?.alto).toBe(HUECO_PERSONA.ancho * 2)
    expect(enPersona?.y).toBe(HUECO_PERSONA.y + (HUECO_PERSONA.alto - HUECO_PERSONA.ancho * 2) / 2)
    expect(enPersona && enPersona.x + enPersona.ancho).toBeLessThan(huecosPrendas(3)[0]?.x ?? 0)
    const ys = enPrendas.map((d) => d.y)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))

    expect(tryon.fichero.name).toBe('percha-pruebatelo.jpg')
    expect(tryon.fichero.type).toBe('image/jpeg')
    expect(tryon.texto).toContain(
      '3 prendas de ropa: parka de color negro; camiseta de color verde; pantalón de color azul.',
    )
    // Usa la recortada si la hay (la camiseta sale como image/camiseta) y cierra todo lo que abre.
    expect(cargar.mock.calls.some(([foto]) => foto === camiseta.fotos[0]?.original)).toBe(false)
    expect(cerradas).toHaveLength(4)
  })

  it('deja fuera de la imagen y del texto la prenda cuya foto no se lee', async () => {
    const { cargar } = cargarFalso()
    const { crearLienzo, dibujos } = lienzoFalso()
    const rota = prenda({
      subcategoria: 'gorra',
      categoria: 'accesorio',
      fotos: [{ original: imagen(6, 'image/rota'), recortada: null }],
    })

    const tryon = await prepararTryOn(persona, [camiseta, rota], { cargar, crearLienzo })

    expect(dibujos).toHaveLength(2)
    expect(tryon.texto).toContain('una prenda de ropa: camiseta de color verde.')
    expect(tryon.texto).not.toContain('gorra')
  })

  it('falla con su motivo si no se lee la persona o ninguna prenda', async () => {
    const { cargar, cerradas } = cargarFalso()
    const { crearLienzo } = lienzoFalso()
    const rota = prenda({ fotos: [{ original: imagen(6, 'image/rota'), recortada: null }] })

    await expect(
      prepararTryOn(imagen(1, 'image/rota'), [camiseta], { cargar, crearLienzo }),
    ).rejects.toEqual(new ErrorTryOn('foto-persona'))
    await expect(prepararTryOn(persona, [rota], { cargar, crearLienzo })).rejects.toMatchObject({
      motivo: 'sin-prendas',
    })
    expect(cerradas).toEqual(['image/persona'])
    expect(crearLienzo).not.toHaveBeenCalled()
  })
})

describe('copiarTexto', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

  function simularPortapapeles(writeText: (texto: string) => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  }

  function simularExecCommand(resultado: boolean | Error) {
    const execCommand = vi.fn(() => {
      if (resultado instanceof Error) throw resultado
      return resultado
    })
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    return execCommand
  }

  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'clipboard', original)
    else Reflect.deleteProperty(navigator, 'clipboard')
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('copia con el portapapeles', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    simularPortapapeles(writeText)
    const execCommand = simularExecCommand(true)

    await expect(copiarTexto('hola')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hola')
    expect(execCommand).not.toHaveBeenCalled()
  })

  it('si el portapapeles no deja, copia con una selección y no deja rastro', async () => {
    simularPortapapeles(() => Promise.reject(new DOMException('no', 'NotAllowedError')))
    const execCommand = simularExecCommand(true)

    await expect(copiarTexto('hola')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('dice que no si no se puede de ninguna forma', async () => {
    simularPortapapeles(() => Promise.reject(new Error('no')))
    simularExecCommand(new Error('tampoco'))

    await expect(copiarTexto('hola')).resolves.toBe(false)
  })
})
