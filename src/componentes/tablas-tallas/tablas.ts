import {
  datosTablaTallasSchema,
  MEDIDAS_POR_TIPO,
  MEDIDAS_TALLA,
  type Categoria,
  type DatosTablaTallas,
  type MedidaTalla,
  type TipoTalla,
} from '../../datos/modelo.ts'

export const NOMBRE_MEDIDA: Record<MedidaTalla, string> = {
  pecho: 'Pecho',
  cintura: 'Cintura',
  cadera: 'Cadera',
  hombros: 'Hombros',
  manga: 'Manga',
  largo: 'Largo',
  largoPierna: 'Pierna',
  pie: 'Pie',
}

/** Qué tabla de tallas usa una prenda; los accesorios no tienen. */
export function tipoTallaDe(categoria: Categoria): TipoTalla | null {
  switch (categoria) {
    case 'inferior':
      return 'pantalón'
    case 'calzado':
      return 'calzado'
    case 'accesorio':
      return null
    default:
      return 'parte de arriba'
  }
}

/** Una fila mientras se escribe: los números son texto hasta validar. */
export type FilaBorrador = { talla: string } & Record<MedidaTalla, string>

export interface BorradorTabla {
  marca: string
  tipo: TipoTalla
  medidaDe: DatosTablaTallas['medidaDe']
  filas: FilaBorrador[]
}

export function filaVacia(): FilaBorrador {
  return {
    talla: '',
    ...(Object.fromEntries(MEDIDAS_TALLA.map((m) => [m, ''])) as Record<MedidaTalla, string>),
  }
}

function aTexto(numero: number | undefined): string {
  return numero === undefined ? '' : String(numero).replace('.', ',')
}

export function borradorDe(inicial: Partial<DatosTablaTallas>): BorradorTabla {
  const filas = (inicial.filas ?? []).map((fila) => ({
    ...filaVacia(),
    talla: fila.talla,
    ...(Object.fromEntries(MEDIDAS_TALLA.map((m) => [m, aTexto(fila[m])])) as Record<
      MedidaTalla,
      string
    >),
  }))
  return {
    marca: inicial.marca ?? '',
    tipo: inicial.tipo ?? 'parte de arriba',
    medidaDe: inicial.medidaDe ?? 'cuerpo',
    filas: filas.length > 0 ? filas : [filaVacia()],
  }
}

/** «82», «82,5» o «82.5» → número; vacío → `undefined`; lo demás → `NaN`. */
function leerNumero(texto: string): number | undefined {
  const limpio = texto.replace(',', '.').trim()
  if (limpio === '') return undefined
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : Number.NaN
}

/**
 * Valida lo escrito. Solo cuentan las medidas del tipo (si se cambió el tipo, las otras se quitan) y las
 * filas del todo vacías se ignoran.
 */
export function validarBorradorTabla(
  borrador: BorradorTabla,
): { valida: true; datos: DatosTablaTallas } | { valida: false; error: string } {
  if (borrador.marca.trim() === '') return { valida: false, error: 'Escribe la marca.' }
  const medidas = MEDIDAS_POR_TIPO[borrador.tipo]
  const filas = []
  for (const fila of borrador.filas) {
    const valores = medidas.map((m) => [m, leerNumero(fila[m])] as const)
    if (fila.talla.trim() === '' && valores.every(([, v]) => v === undefined)) continue
    if (fila.talla.trim() === '') return { valida: false, error: 'Falta la talla de alguna fila.' }
    if (valores.some(([, v]) => v !== undefined && !(v > 0 && v <= 300))) {
      return { valida: false, error: `Revisa los números de la talla ${fila.talla.trim()}.` }
    }
    if (valores.every(([, v]) => v === undefined)) {
      return { valida: false, error: `Pon alguna medida a la talla ${fila.talla.trim()}.` }
    }
    filas.push({
      talla: fila.talla,
      ...Object.fromEntries(valores.filter(([, v]) => v !== undefined)),
    })
  }
  if (filas.length === 0) return { valida: false, error: 'Añade al menos una talla.' }
  const tallas = filas.map((f) => f.talla.trim().toLocaleLowerCase('es'))
  if (new Set(tallas).size !== tallas.length) {
    return { valida: false, error: 'Hay una talla repetida.' }
  }
  const leida = datosTablaTallasSchema.safeParse({ ...borrador, filas })
  return leida.success
    ? { valida: true, datos: leida.data }
    : { valida: false, error: 'Revisa la tabla: algún dato no vale.' }
}
