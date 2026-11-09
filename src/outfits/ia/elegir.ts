import { capasDe } from '../../datos/capas.ts'
import type { Categoria } from '../../datos/modelo.ts'
import { ErrorIA, type TipoErrorIA } from '../../ia/errores.ts'
import type { ExteriorHoy, PrendaParaOutfit, ProveedorIA } from '../../ia/tipos.ts'
import { candidatos, cuatroOutfits, CUANTOS_OUTFITS } from '../reglas/index.ts'
import type {
  Candidato,
  OutfitReglas,
  Peticion,
  PrendaReglas,
  ResultadoOutfits,
} from '../reglas/index.ts'
import { ABRIGO_MAXIMO_OPCIONAL, exteriorDeHoy, soloEncima } from './capas.ts'
import { comprobarConCapas, type PrendaIA } from './composicion.ts'

/** Cuántas candidatas de cada categoría ve la IA: bastan para variar y el texto sigue siendo corto. */
export const MAX_POR_CATEGORIA = 8
/** Arriba hay más donde elegir: las prendas de arriba reparten base, media y exterior. */
export const MAX_POR_CATEGORIA_ARRIBA = 10

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

/**
 * Como las reglas: plenas si las hay en la categoría (si no, también las parciales) y accesorios solo
 * plenos. Abrigos: ninguno si hoy no hacen falta; como tercera pieza, solo los ligeros. Las de arriba
 * van siempre: un punto grueso es justo la capa media de un día fresco.
 */
function paraLaIA<P extends PrendaIA>(
  lista: readonly Candidato<P>[],
  exterior: ExteriorHoy,
): Candidato<P>[] {
  const conPlenas = new Set<Categoria>(
    lista.filter((c) => c.ajuste === 'pleno').map((c) => c.prenda.categoria),
  )
  const utiles = lista.filter(({ prenda, ajuste }) => {
    if (prenda.categoria === 'abrigo' && exterior === 'no') return false
    const pesado = prenda.categoria === 'abrigo' && prenda.abrigo > ABRIGO_MAXIMO_OPCIONAL
    if (exterior === 'opcional' && pesado) return false
    if (prenda.categoria === 'accesorio') return ajuste === 'pleno'
    return ajuste === 'pleno' || !conPlenas.has(prenda.categoria)
  })
  const vistas = new Map<Categoria, number>()
  return utiles.filter(({ prenda: { categoria } }) => {
    const ya = vistas.get(categoria) ?? 0
    vistas.set(categoria, ya + 1)
    const tope =
      categoria === 'superior' || categoria === 'abrigo'
        ? MAX_POR_CATEGORIA_ARRIBA
        : MAX_POR_CATEGORIA
    return ya < tope
  })
}

/** Una tercera pieza ligera: hoy no hace falta, pero puede ir encima y suma. */
function esOpcional(prenda: PrendaIA, exterior: ExteriorHoy): boolean {
  return (
    exterior === 'opcional' &&
    soloEncima(capasDe(prenda)) &&
    prenda.abrigo <= ABRIGO_MAXIMO_OPCIONAL
  )
}

function avisoSinIA(error: ErrorIA): string {
  // El mensaje de `respuesta` habla de etiquetar a mano, que aquí no pinta.
  const mensaje =
    error.tipo === 'respuesta'
      ? 'Gemini ha devuelto algo que no se entiende. Prueba otra vez.'
      : error.message
  return `outfits sin IA: ${mensaje}`
}

function aTexto(prenda: PrendaIA, exterior: ExteriorHoy): PrendaParaOutfit {
  const { id, categoria, subcategoria, colores, estampado, estilos, abrigo, formalidad, notas } =
    prenda
  return {
    id,
    categoria,
    subcategoria,
    colores,
    estampado,
    estilos,
    abrigo,
    formalidad,
    notas,
    ...(prenda.capas && { capas: prenda.capas }),
    ...(prenda.composicion && { composicion: prenda.composicion }),
    ...(esOpcional(prenda, exterior) && { opcional: true }),
  }
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
export async function elegirOutfitsConIA<P extends PrendaIA>(
  peticion: Peticion<P>,
  semilla = 1,
  { proveedor, signal }: OpcionesOutfitsIA,
): Promise<ResultadoOutfitsIA<P>> {
  const reglas = cuatroOutfits(peticion, semilla)
  const deReglas = reglas.outfits.map((o): OutfitIA<P> => ({ ...o, origen: 'reglas' }))
  // Si las reglas no sacan ninguno, falta base o calzado: la IA tampoco podría y se ahorra cupo.
  if (deReglas.length === 0) return { ...reglas, outfits: deReglas, errorIA: null }

  const resultado = candidatos(peticion)
  const { contexto } = resultado
  const exterior = exteriorDeHoy(contexto)
  const enviadas = paraLaIA(resultado.candidatos, exterior)
  const hoy = { exterior, temperatura: contexto.temperatura }

  let propuestas
  try {
    const ia = typeof proveedor === 'function' ? await proveedor() : proveedor
    propuestas = await ia.elegirOutfits(
      {
        prendas: enviadas.map((c) => aTexto(c.prenda, exterior)),
        estilo: peticion.estilo,
        ocasion: peticion.ocasion,
        tiempo: {
          temperatura: contexto.temperatura,
          precipitacion: contexto.precipitacion,
          temporada: contexto.temporada,
          exterior,
        },
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
      avisos: [...reglas.avisos, avisoSinIA(errorIA)],
      errorIA: errorIA.tipo,
    }
  }

  const puntosPorId = new Map(enviadas.map((c) => [c.prenda.id, c.puntos]))
  const vistos = new Set<string>()
  const outfits: OutfitIA<P>[] = []
  for (const propuesta of propuestas) {
    if (outfits.length === CUANTOS_OUTFITS) break
    const comprobado = comprobarConCapas(
      propuesta.prendas,
      enviadas.map((c) => c.prenda),
      hoy,
    )
    if ('error' in comprobado) continue
    const { prendas, principal } = comprobado
    if (vistos.has(clave(prendas))) continue
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
  const ningunoValido = outfits.length === 0
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
    avisos: [
      ...resultado.avisos,
      ...avisoDeCuantos(outfits.length),
      ...(ningunoValido ? [avisoSinIA(new ErrorIA('respuesta'))] : []),
    ],
    errorIA: ningunoValido ? 'respuesta' : null,
  }
}
