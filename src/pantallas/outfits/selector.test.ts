import { describe, expect, it, vi } from 'vitest'
import type { NuevaPrenda, Prenda } from '../../datos/modelo.ts'
import { nuevaPrenda } from '../../datos/pruebas.ts'
import { crearProveedorFalso, ErrorIA, type ProveedorIA } from '../../ia/index.ts'
import type { Peticion } from '../../outfits/reglas/index.ts'
import { crearSelectorConIA, outfitsPorReglas } from './selector.ts'

let siguienteId = 0
function prenda(cambios: Partial<NuevaPrenda> = {}): Prenda {
  siguienteId += 1
  return { ...nuevaPrenda(cambios), id: `p${String(siguienteId)}`, creadaEn: siguienteId }
}

function peticion(): Peticion<Prenda> {
  return {
    prendas: [
      prenda({ subcategoria: 'camiseta' }),
      prenda({ subcategoria: 'camisa', colores: ['azul'] }),
      prenda({ subcategoria: 'polo', colores: ['negro'] }),
      prenda({ categoria: 'inferior', subcategoria: 'vaqueros', colores: ['azul'] }),
      prenda({ categoria: 'inferior', subcategoria: 'chinos', colores: ['beige'] }),
      prenda({ categoria: 'calzado', subcategoria: 'zapatillas' }),
    ],
    estilo: 'casual',
    ocasion: 'diario',
    tiempo: null,
    fecha: '2026-11-03',
  }
}

describe('outfitsPorReglas', () => {
  it('marca todos como de las reglas y sin aviso de IA', async () => {
    const resultado = await outfitsPorReglas(peticion(), 1)

    expect(resultado.outfits.length).toBeGreaterThan(0)
    expect(resultado.outfits.every((o) => o.origen === 'reglas')).toBe(true)
    expect(resultado.avisoIA).toBeNull()
  })
})

describe('crearSelectorConIA', () => {
  it('con clave, elige con la IA, pasa el intento como semilla y avisa antes de esperar', async () => {
    const proveedor = crearProveedorFalso()
    const alPreguntarIA = vi.fn()
    const elegir = crearSelectorConIA(() => Promise.resolve(proveedor))

    const resultado = await elegir(peticion(), 3, { alPreguntarIA })

    expect(alPreguntarIA).toHaveBeenCalledOnce()
    expect(proveedor.peticionesOutfits[0]?.semilla).toBe(3)
    expect(resultado.outfits[0]).toMatchObject({ origen: 'ia', motivo: 'Outfit de prueba 1.' })
    expect(resultado.avisoIA).toBeNull()
  })

  it('sin clave, usa las reglas sin preguntar a la IA ni avisar', async () => {
    const alPreguntarIA = vi.fn()
    const elegir = crearSelectorConIA(() => Promise.resolve(null))

    const datos = peticion()
    const resultado = await elegir(datos, 1, { alPreguntarIA })

    expect(alPreguntarIA).not.toHaveBeenCalled()
    expect(resultado).toEqual(await outfitsPorReglas(datos, 1))
  })

  it.each([
    ['sin cupo (429)', new ErrorIA('sin-cupo', { estado: 429 }), /cupo gratis/],
    ['sin red', new ErrorIA('sin-red'), /No hay conexión/],
  ])(
    'si la IA falla (%s), da las reglas y saca el aviso de la lista de avisos',
    async (_, error, texto) => {
      const elegir = crearSelectorConIA(() => Promise.resolve(crearProveedorFalso({ error })))
      const datos = peticion()

      const resultado = await elegir(datos, 1)

      expect(resultado.outfits).toEqual((await outfitsPorReglas(datos, 1)).outfits)
      expect(resultado.avisoIA).toMatch(/^outfits sin IA: /)
      expect(resultado.avisoIA).toMatch(texto)
      expect(resultado.avisos.some((a) => a.includes('sin IA'))).toBe(false)
    },
  )

  it('si las reglas no sacan ninguno (falta calzado), ni mira la clave ni pregunta a la IA', async () => {
    const obtener = vi.fn(() => Promise.resolve(crearProveedorFalso()))
    const alPreguntarIA = vi.fn()
    const datos = {
      ...peticion(),
      prendas: peticion().prendas.filter((p) => p.categoria !== 'calzado'),
    }

    const resultado = await crearSelectorConIA(obtener)(datos, 1, { alPreguntarIA })

    expect(obtener).not.toHaveBeenCalled()
    expect(alPreguntarIA).not.toHaveBeenCalled()
    expect(resultado.outfits).toEqual([])
    expect(resultado.avisos.join(' ')).toMatch(/te falta calzado/)
  })

  it('si se cancela mientras lee la clave, no llega a preguntar a la IA', async () => {
    const proveedor = crearProveedorFalso()
    const controlador = new AbortController()
    const alPreguntarIA = vi.fn()
    const elegir = crearSelectorConIA(() => {
      controlador.abort()
      return Promise.resolve(proveedor)
    })

    await expect(
      elegir(peticion(), 1, { signal: controlador.signal, alPreguntarIA }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(alPreguntarIA).not.toHaveBeenCalled()
    expect(proveedor.peticionesOutfits).toHaveLength(0)
  })

  it('al cancelar, rechaza con AbortError', async () => {
    const proveedor: ProveedorIA = {
      ...crearProveedorFalso(),
      elegirOutfits: (_, opciones) =>
        new Promise((_listo, fallo) => {
          const cancelar = () => {
            fallo(new DOMException('Cancelado', 'AbortError'))
          }
          if (opciones?.signal?.aborted) cancelar()
          opciones?.signal?.addEventListener('abort', cancelar)
        }),
    }
    const controlador = new AbortController()
    const elegir = crearSelectorConIA(() => Promise.resolve(proveedor))

    const promesa = elegir(peticion(), 1, { signal: controlador.signal })
    await Promise.resolve()
    controlador.abort()

    await expect(promesa).rejects.toMatchObject({ name: 'AbortError' })
  })
})
