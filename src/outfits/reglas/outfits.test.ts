import { describe, expect, it } from 'vitest'
import { CATEGORIAS, ESTILOS, OCASIONES, TEMPORADAS } from '../../datos/modelo.ts'
import { crearAzar } from './azar.ts'
import { armonia } from './colores.ts'
import { cuatroOutfits } from './outfits.ts'
import { armarioEjemplo, prenda, tiempo } from './pruebas.ts'
import type { OutfitReglas, Peticion, PrendaReglas } from './tipos.ts'

function peticion(prendas: PrendaReglas[], cambios: Partial<Peticion> = {}): Peticion {
  return { prendas, estilo: 'casual', ocasion: 'diario', tiempo: null, ...cambios }
}

function categorias(outfit: OutfitReglas): string[] {
  return outfit.prendas.map((p) => p.categoria)
}

function cuenta(outfit: OutfitReglas, categoria: string): number {
  return categorias(outfit).filter((c) => c === categoria).length
}

function esValido(outfit: OutfitReglas): boolean {
  const conBase =
    (cuenta(outfit, 'superior') === 1 &&
      cuenta(outfit, 'inferior') === 1 &&
      cuenta(outfit, 'vestido') === 0) ||
    (cuenta(outfit, 'vestido') === 1 &&
      cuenta(outfit, 'superior') === 0 &&
      cuenta(outfit, 'inferior') === 0)
  return (
    conBase &&
    cuenta(outfit, 'calzado') === 1 &&
    cuenta(outfit, 'abrigo') <= 1 &&
    cuenta(outfit, 'accesorio') <= 1
  )
}

function huella(outfits: readonly OutfitReglas[]): string[] {
  return outfits.map((o) => o.prendas.map((p) => p.id).join('+'))
}

/** Armario aleatorio pero repetible, con todas las categorías. */
function armarioGrande(cuantas: number, semilla = 42): PrendaReglas[] {
  const azar = crearAzar(semilla)
  const de = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)] as T
  const colores = ['negro', 'blanco', 'gris', 'beige', 'azul marino', 'rojo', 'verde', 'amarillo']
  return Array.from({ length: cuantas }, (_, i) =>
    prenda({
      id: `g${String(i).padStart(3, '0')}`,
      categoria: de(CATEGORIAS),
      colores: [de(colores)],
      estampado: azar() < 0.2 ? 'rayas' : 'liso',
      estilos: [de(ESTILOS), de(ESTILOS)],
      abrigo: 1 + Math.floor(azar() * 5),
      formalidad: 1 + Math.floor(azar() * 5),
      ocasiones: [de(OCASIONES)],
      temporadas: azar() < 0.5 ? [] : [de(TEMPORADAS)],
    }),
  )
}

describe('cuatroOutfits con el armario de ejemplo', () => {
  const armario = armarioEjemplo()

  it('con frío: 4 outfits válidos, todos con abrigo', () => {
    const { outfits, avisos } = cuatroOutfits(
      peticion(armario, { estilo: 'business', ocasion: 'trabajo', tiempo: tiempo(8) }),
    )
    expect(outfits).toHaveLength(4)
    expect(avisos).toEqual([])
    for (const outfit of outfits) {
      expect(esValido(outfit)).toBe(true)
      expect(cuenta(outfit, 'abrigo')).toBe(1)
      expect(outfit.motivo).toMatch(/^abrigo por 8 °C, (formal|arreglado) para trabajo/)
    }
  })

  it('con calor: sin abrigo ni jersey y motivo «ligero»', () => {
    const { outfits } = cuatroOutfits(
      peticion(armario, {
        estilo: 'elegante',
        ocasion: 'cena',
        tiempo: tiempo(30, { fecha: '2026-07-10' }),
      }),
    )
    expect(outfits).toHaveLength(4)
    for (const outfit of outfits) {
      expect(cuenta(outfit, 'abrigo')).toBe(0)
      expect(outfit.prendas.map((p) => p.id)).not.toContain('jersey-gris')
      expect(outfit.motivo).toMatch(/^ligero por 30 °C/)
    }
  })

  it('con lluvia templada: abrigo por la lluvia, sin sandalias ni ante', () => {
    const { outfits } = cuatroOutfits(
      peticion(armario, { tiempo: tiempo(19, { precipitacion: 'lluvia' }) }),
    )
    expect(outfits.length).toBeGreaterThan(0)
    for (const outfit of outfits) {
      const prendas = outfit.prendas.map((p) => p.id)
      expect(prendas).not.toContain('sandalias')
      expect(prendas).not.toContain('chaqueta-ante')
      expect(cuenta(outfit, 'abrigo')).toBe(1)
      expect(outfit.motivo).toMatch(/^abrigo por la lluvia/)
    }
  })

  it('con lluvia prefiere las botas de agua', () => {
    const { outfits } = cuatroOutfits(
      peticion(armario, { tiempo: tiempo(12, { precipitacion: 'lluvia' }) }),
    )
    expect(outfits.filter((o) => o.prendas.some((p) => p.id === 'botas')).length).toBeGreaterThan(1)
  })

  it('sin tiempo: sin abrigo y el motivo no habla de grados', () => {
    const { outfits } = cuatroOutfits(peticion(armario))
    expect(outfits).toHaveLength(4)
    for (const outfit of outfits) {
      expect(cuenta(outfit, 'abrigo')).toBe(0)
      expect(outfit.motivo).not.toMatch(/°C/)
    }
  })

  it('4 outfits distintos y sin repetir la prenda principal', () => {
    const { outfits } = cuatroOutfits(peticion(armario, { tiempo: tiempo(18) }))
    expect(new Set(huella(outfits)).size).toBe(4)
    expect(new Set(outfits.map((o) => o.principal.id)).size).toBe(4)
  })

  it('la principal es la parte de arriba o el vestido, y va primera', () => {
    for (const outfit of cuatroOutfits(peticion(armario)).outfits) {
      expect(['superior', 'vestido']).toContain(outfit.principal.categoria)
      expect(outfit.prendas[0]).toBe(outfit.principal)
    }
  })

  it('devuelve las mismas prendas que recibe', () => {
    const { outfits } = cuatroOutfits(peticion(armario))
    for (const p of outfits.flatMap((o) => o.prendas)) expect(armario).toContain(p)
  })
})

describe('armarios cortos', () => {
  const zapatillas = prenda({ id: 'zapatillas', categoria: 'calzado' })

  it('armario mínimo: 1 outfit y aviso', () => {
    const { outfits, avisos } = cuatroOutfits(
      peticion([
        prenda({ id: 'camiseta' }),
        prenda({ id: 'vaqueros', categoria: 'inferior' }),
        zapatillas,
      ]),
    )
    expect(huella(outfits)).toEqual(['camiseta+vaqueros+zapatillas'])
    expect(avisos).toEqual(['solo sale 1 outfit: añade prendas para tener 4'])
  })

  it('una sola parte de arriba: repite la principal pero no el outfit', () => {
    const inferiores = ['a', 'b', 'c', 'd', 'e'].map((id) => prenda({ id, categoria: 'inferior' }))
    const { outfits } = cuatroOutfits(
      peticion([prenda({ id: 'camiseta' }), ...inferiores, zapatillas]),
    )
    expect(outfits).toHaveLength(4)
    expect(new Set(huella(outfits)).size).toBe(4)
  })

  it('sin calzado: ningún outfit, una razón y ningún error', () => {
    const { outfits, avisos } = cuatroOutfits(
      peticion([prenda(), prenda({ categoria: 'inferior' })]),
    )
    expect(outfits).toEqual([])
    expect(avisos).toEqual(['te falta calzado'])
  })

  it('sin parte de abajo: ningún outfit y lo dice', () => {
    const { outfits, avisos } = cuatroOutfits(peticion([prenda(), zapatillas]))
    expect(outfits).toEqual([])
    expect(avisos).toEqual(['te falta una parte de abajo (o un vestido)'])
  })

  it('con solo un vestido y calzado sale un outfit', () => {
    const vestido = prenda({ id: 'vestido', categoria: 'vestido' })
    expect(huella(cuatroOutfits(peticion([vestido, zapatillas])).outfits)).toEqual([
      'vestido+zapatillas',
    ])
  })

  it('armario vacío', () => {
    expect(cuatroOutfits(peticion([]))).toMatchObject({
      outfits: [],
      avisos: ['tu armario está vacío: añade prendas para ver outfits'],
    })
  })

  it('con frío y sin abrigo salen igual, con aviso', () => {
    const { outfits, avisos } = cuatroOutfits(
      peticion(
        [
          prenda({ abrigo: 4 }),
          prenda({ categoria: 'inferior', abrigo: 3 }),
          prenda({ categoria: 'calzado', abrigo: 3 }),
        ],
        {
          tiempo: tiempo(6),
        },
      ),
    )
    expect(outfits).toHaveLength(1)
    expect(outfits[0]?.motivo).toMatch(/^para 6 °C/)
    expect(avisos).toContain('te falta un abrigo para 6 °C: salen sin él')
  })

  it('ocasión formal con armario informal: ningún outfit y la razón', () => {
    const informal = [
      prenda({ formalidad: 1 }),
      prenda({ categoria: 'inferior', formalidad: 1 }),
      prenda({ categoria: 'calzado', formalidad: 2 }),
    ]
    const { outfits, avisos } = cuatroOutfits(peticion(informal, { ocasion: 'evento formal' }))
    expect(outfits).toEqual([])
    expect(avisos).toContain('te falta calzado (muy informal para evento formal)')
  })

  it('ocasión formal con armario casi formal: outfits con lo más parecido', () => {
    const casi = [
      prenda({ formalidad: 3 }),
      prenda({ categoria: 'inferior', formalidad: 4 }),
      prenda({ categoria: 'calzado', formalidad: 3 }),
    ]
    const { outfits, avisos } = cuatroOutfits(peticion(casi, { ocasion: 'boda', estilo: 'casual' }))
    expect(outfits).toHaveLength(1)
    expect(avisos[0]).toMatch(/^no tienes ropa ni calzado que encaje del todo/)
  })
})

describe('colores', () => {
  it('elige la combinación que no choca si la hay', () => {
    const roja = prenda({ id: 'roja', colores: ['rojo'] })
    const verde = prenda({ id: 'verde', categoria: 'inferior', colores: ['verde'] })
    const negro = prenda({ id: 'negro', categoria: 'inferior', colores: ['negro'] })
    const zapatillas = prenda({ id: 'zapatillas', categoria: 'calzado', colores: ['blanco'] })
    for (let semilla = 1; semilla <= 20; semilla++) {
      const [primero] = cuatroOutfits(peticion([roja, verde, negro, zapatillas]), semilla).outfits
      expect(primero?.prendas.map((p) => p.id)).toEqual(['roja', 'negro', 'zapatillas'])
    }
  })

  it('si no hay más remedio, avisa en el motivo', () => {
    const roja = prenda({ colores: ['rojo'] })
    const verde = prenda({ categoria: 'inferior', colores: ['verde'] })
    const zapatillas = prenda({ categoria: 'calzado' })
    const [outfit] = cuatroOutfits(peticion([roja, verde, zapatillas])).outfits
    expect(outfit?.motivo).toMatch(/colores atrevidos$/)
  })

  it('no añade un accesorio que choca', () => {
    const roja = prenda({ colores: ['rojo'] })
    const vaqueros = prenda({ categoria: 'inferior', subcategoria: 'vaqueros', colores: ['azul'] })
    const zapatillas = prenda({ categoria: 'calzado' })
    const bolsoVerde = prenda({ id: 'bolso', categoria: 'accesorio', colores: ['verde'] })
    const [outfit] = cuatroOutfits(peticion([roja, vaqueros, zapatillas, bolsoVerde])).outfits
    expect(outfit?.prendas.map((p) => p.id)).not.toContain('bolso')
  })

  it('con el armario grande casi todos los outfits combinan', () => {
    const { outfits } = cuatroOutfits(peticion(armarioGrande(200)), 3)
    expect(outfits.every((o) => armonia(o.prendas).combina)).toBe(true)
  })
})

describe('semilla', () => {
  const armario = armarioGrande(120)

  it('la misma semilla da lo mismo', () => {
    const a = cuatroOutfits(peticion(armario, { tiempo: tiempo(14) }), 99)
    const b = cuatroOutfits(peticion([...armario].reverse(), { tiempo: tiempo(14) }), 99)
    expect(huella(b.outfits)).toEqual(huella(a.outfits))
    expect(b.outfits.map((o) => o.motivo)).toEqual(a.outfits.map((o) => o.motivo))
  })

  it('otra semilla da otra tanda', () => {
    const tandas = new Set(
      [1, 2, 3, 4, 5].map((semilla) =>
        huella(cuatroOutfits(peticion(armario), semilla).outfits).join('|'),
      ),
    )
    expect(tandas.size).toBeGreaterThan(1)
  })

  it('una semilla rara no rompe nada', () => {
    expect(cuatroOutfits(peticion(armario), Number.NaN).outfits).toHaveLength(4)
    expect(cuatroOutfits(peticion(armario), -7.5).outfits).toHaveLength(4)
  })
})

describe('volumen', () => {
  it('200 prendas en menos de medio segundo', () => {
    const armario = armarioGrande(200)
    const inicio = performance.now()
    const { outfits } = cuatroOutfits(
      peticion(armario, { estilo: 'smart casual', ocasion: 'trabajo', tiempo: tiempo(12) }),
    )
    expect(performance.now() - inicio).toBeLessThan(500)
    expect(outfits).toHaveLength(4)
    expect(outfits.every(esValido)).toBe(true)
  })
})
