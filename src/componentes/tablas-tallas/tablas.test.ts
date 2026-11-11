import { describe, expect, it } from 'vitest'
import { idTablaTallas, type TablaTallas } from '../../datos/modelo.ts'
import { lineaAjusteOutfit, tipoTallaDe } from './tablas.ts'

const pantalon: TablaTallas = {
  id: idTablaTallas('Zara', 'pantalón'),
  marca: 'Zara',
  tipo: 'pantalón',
  medidaDe: 'cuerpo',
  filas: [{ talla: '44', cintura: 86, largoPierna: 84 }],
  actualizadaEn: 1,
}

describe('línea de tallas de un outfit', () => {
  it('una parte por prenda con marca, talla y tabla de su marca y tipo', () => {
    const linea = lineaAjusteOutfit(
      [
        { categoria: 'inferior', subcategoria: 'vaquero', marca: 'ZARA', talla: '44' },
        { categoria: 'superior', subcategoria: 'camiseta', marca: 'Zara', talla: 'M' },
        { categoria: 'calzado', subcategoria: 'zapatillas' },
      ],
      [pantalon],
      { cintura: 88, largoPierna: 80 },
    )

    expect(linea).toBe('Vaquero 44: justa de cintura (−2 cm) y larga de pierna (+4 cm)')
  })

  it('sin tablas, sin talla o sin medidas, null', () => {
    const vaquero = { categoria: 'inferior' as const, subcategoria: 'vaquero', marca: 'Zara' }
    expect(lineaAjusteOutfit([{ ...vaquero, talla: '44' }], [], { cintura: 88 })).toBeNull()
    expect(lineaAjusteOutfit([vaquero], [pantalon], { cintura: 88 })).toBeNull()
    expect(lineaAjusteOutfit([{ ...vaquero, talla: '44' }], [pantalon], undefined)).toBeNull()
  })

  it('qué tabla usa cada prenda', () => {
    expect(tipoTallaDe('vestido')).toBe('parte de arriba')
    expect(tipoTallaDe('accesorio')).toBeNull()
  })
})
