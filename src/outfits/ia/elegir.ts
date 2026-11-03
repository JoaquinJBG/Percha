import type { Categoria } from '../../datos/modelo.ts'
import { ErrorIA, type TipoErrorIA } from '../../ia/errores.ts'
import type { PrendaParaOutfit, ProveedorIA } from '../../ia/tipos.ts'
import {
  candidatos,
  comprobarOutfit,
  cuatroOutfits,
  CUANTOS_OUTFITS,
  mejoresPorCategoria,
} from '../reglas/index.ts'
import type {
  Candidato,
  OutfitReglas,
  Peticion,
  PrendaReglas,
  ResultadoCandidatos,
  ResultadoOutfits,
} from '../reglas/index.ts'

/** Cuántas candidatas de cada categoría ve la IA: bastan para variar y el texto sigue siendo corto. */
export const MAX_POR_CATEGORIA = 8

export interface OutfitIA<P extends PrendaReglas = PrendaReglas> extends OutfitReglas<P> {
  /** `ia`: lo eligió la IA y `motivo` es su frase; `reglas`: relleno de `cuatroOutfits`. */
  origen: 'ia' | 'reglas'
}

export interface ResultadoOutfitsIA<
  P extends PrendaReglas = PrendaReglas,
> extends ResultadoOutfits<P> {
  outfits: OutfitIA<P>[]
  /** Por qué no se usó la IA (todo salió por reglas); `null` si respondió. */
  errorIA: TipoErrorIA | null
}

export interface OpcionesOutfitsIA {
  /** El proveedor, o cómo conseguirlo (p. ej. `proveedorDesdeAjustes`). */
  proveedor: ProveedorIA | (() => Promise<ProveedorIA>)
  signal?: AbortSignal
}

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Como las reglas: plenas si las hay en la categoría; si no, también las parciales. */
function paraLaIA<P extends PrendaReglas>(lista: readonly Candidato<P>[]): Candidato<P>[] {
  const conPlenas = new Set<Categoria>(
    lista.filter((c) => c.ajuste === 'pleno').map((c) => c.prenda.categoria),
  )
  const utiles = lista.filter((c) => c.ajuste === 'pleno' || !conPlenas.has(c.prenda.categoria))
  return mejoresPorCategoria(utiles, MAX_POR_CATEGORIA)
}

function aTexto({
  id,
  categoria,
  subcategoria,
  colores,
  estampado,
  estilos,
  abrigo,
  formalidad,
  notas,
}: PrendaReglas): PrendaParaOutfit {
  return { id, categoria, subcategoria, colores, estampado, estilos, abrigo, formalidad, notas }
}

function clave(prendas: readonly PrendaReglas[]): string {
  return prendas
    .map((p) => p.id)
    .sort()
    .join('+')
}

function avisoDeCuantos(cuantos: number): string[] {
  if (cuantos === 0 || cuantos >= CUANTOS_OUTFITS) return []
  return [
    cuantos === 1
      ? 'solo sale 1 outfit: añade prendas para tener 4'
      : `solo salen ${String(cuantos)} outfits distintos: añade prendas para tener 4`,
  ]
}

/**
 * Cuatro outfits elegidos por la IA entre los candidatos de las reglas (D8), con la misma entrada y
 * salida que `cuatroOutfits`. Los que la IA proponga mal se cambian por los de las reglas; sin clave,
 * sin red, sin cupo o con cualquier fallo de la IA, sale todo por reglas con un aviso. Solo lanza si se
 * cancela con `signal`.
 */
export async function elegirOutfitsConIA<P extends PrendaReglas>(
  peticion: Peticion<P>,
  semilla = 1,
  { proveedor, signal }: OpcionesOutfitsIA,
): Promise<ResultadoOutfitsIA<P>> {
  const reglas = cuatroOutfits(peticion, semilla)
  const deReglas = reglas.outfits.map((o): OutfitIA<P> => ({ ...o, origen: 'reglas' }))
  // Si las reglas no sacan ninguno, falta base o calzado: la IA tampoco podría y se ahorra cupo.
  if (deReglas.length === 0) return { ...reglas, outfits: deReglas, errorIA: null }

  const resultado = candidatos(peticion)
  const enviadas = paraLaIA(resultado.candidatos)
  const soloEnviadas: ResultadoCandidatos<P> = { ...resultado, candidatos: enviadas }

  let propuestas
  try {
    const ia = typeof proveedor === 'function' ? await proveedor() : proveedor
    propuestas = await ia.elegirOutfits(
      {
        prendas: enviadas.map((c) => aTexto(c.prenda)),
        estilo: peticion.estilo,
        ocasion: peticion.ocasion,
        tiempo: resultado.contexto,
        semilla,
      },
      signal ? { signal } : {},
    )
  } catch (error) {
    if (esCancelacion(error)) throw error
    const errorIA = error instanceof ErrorIA ? error : new ErrorIA('otro')
    return {
      ...reglas,
      outfits: deReglas,
      avisos: [...reglas.avisos, `outfits sin IA: ${errorIA.message}`],
      errorIA: errorIA.tipo,
    }
  }

  const puntosPorId = new Map(enviadas.map((c) => [c.prenda.id, c.puntos]))
  const vistos = new Set<string>()
  const outfits: OutfitIA<P>[] = []
  for (const propuesta of propuestas) {
    if (outfits.length === CUANTOS_OUTFITS) break
    const comprobado = comprobarOutfit(propuesta.prendas, soloEnviadas)
    if ('error' in comprobado) continue
    const { prendas } = comprobado
    const [principal] = prendas
    if (!principal || vistos.has(clave(prendas))) continue
    vistos.add(clave(prendas))
    const puntos = prendas.reduce((suma, p) => suma + (puntosPorId.get(p.id) ?? 0), 0)
    outfits.push({
      prendas,
      principal,
      puntos: Math.round((puntos / prendas.length) * 10) / 10,
      motivo: propuesta.porque,
      origen: 'ia',
    })
  }
  // Para rellenar, primero los de reglas cuya parte de arriba (o vestido) aún no sale.
  const principales = new Set(outfits.map((o) => o.principal.id))
  const relleno = [
    ...deReglas.filter((o) => !principales.has(o.principal.id)),
    ...deReglas.filter((o) => principales.has(o.principal.id)),
  ]
  for (const outfit of relleno) {
    if (outfits.length === CUANTOS_OUTFITS) break
    if (vistos.has(clave(outfit.prendas))) continue
    vistos.add(clave(outfit.prendas))
    outfits.push(outfit)
  }

  return {
    contexto: reglas.contexto,
    outfits,
    avisos: [...resultado.avisos, ...avisoDeCuantos(outfits.length)],
    errorIA: null,
  }
}
