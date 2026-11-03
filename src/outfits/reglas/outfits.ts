import type { Categoria } from '../../datos/modelo.ts'
import { crearAzar } from './azar.ts'
import { candidatos } from './candidatos.ts'
import { armonia } from './colores.ts'
import { afinidad } from './estilos.ts'
import { nombreFormalidad } from './ocasiones.ts'
import type {
  Candidato,
  Contexto,
  OutfitReglas,
  Peticion,
  PrendaReglas,
  ResultadoOutfits,
} from './tipos.ts'

export const CUANTOS_OUTFITS = 4
/** Cuánto puede mover el azar la nota de una opción: lo bastante para variar, no para elegir algo malo. */
const VARIEDAD = 2.5
const CHOQUE_COLOR = 10
const YA_USADA = 1.5

type NoVacia<T> = [T, ...T[]]

function media(numeros: readonly number[]): number {
  return numeros.reduce((suma, n) => suma + n, 0) / Math.max(numeros.length, 1)
}

function nota<P extends PrendaReglas>(piezas: readonly Candidato<P>[]): number {
  const choque = armonia(piezas.map((c) => c.prenda)).combina ? 0 : CHOQUE_COLOR
  return media(piezas.map((c) => c.puntos)) - choque
}

function motivo(contexto: Contexto, piezas: readonly Candidato[]): string {
  const { temperatura, precipitacion } = contexto
  const partes: string[] = []
  const conAbrigo = piezas.some((c) => c.prenda.categoria === 'abrigo')
  const grados = temperatura === null ? '' : `${String(temperatura)} °C`
  if (conAbrigo) {
    if (temperatura !== null && (!precipitacion || temperatura < 16)) {
      partes.push(`abrigo por ${grados}${precipitacion ? ` y ${precipitacion}` : ''}`)
    } else if (precipitacion) {
      partes.push(`abrigo por la ${precipitacion}`)
    }
  } else if (temperatura !== null) {
    partes.push(temperatura >= 24 ? `ligero por ${grados}` : `para ${grados}`)
  }

  const base = piezas.filter((c) =>
    ['superior', 'inferior', 'vestido'].includes(c.prenda.categoria),
  )
  const formalidad = Math.round(media(base.map((c) => c.prenda.formalidad)))
  partes.push(`${nombreFormalidad(formalidad)} para ${contexto.ocasion}`)

  const principal = base[0]?.prenda
  const estilo = principal ? afinidad(principal.estilos, contexto.estilo) : 'ninguno'
  if (estilo === 'exacto') partes.push(contexto.estilo)
  else if (estilo === 'afin') partes.push(`cercano a ${contexto.estilo}`)

  if (!armonia(piezas.map((c) => c.prenda)).combina) partes.push('colores atrevidos')
  return partes.join(', ')
}

/**
 * Cuatro outfits distintos por reglas, para cuando no hay IA o se queda sin cupo. La misma petición y
 * la misma semilla dan siempre lo mismo; otra semilla, otra tanda.
 */
export function cuatroOutfits<P extends PrendaReglas>(
  peticion: Peticion<P>,
  semilla = 1,
): ResultadoOutfits<P> {
  const { contexto, candidatos: lista, avisos } = candidatos(peticion)
  const azar = crearAzar(semilla)

  const bolsa = (categoria: Categoria, soloPlenas = false): Candidato<P>[] => {
    const deCategoria = lista.filter((c) => c.prenda.categoria === categoria)
    const plenas = deCategoria.filter((c) => c.ajuste === 'pleno')
    return plenas.length > 0 || soloPlenas ? plenas : deCategoria
  }
  const calzados = bolsa('calzado')
  const abrigos = contexto.necesitaAbrigo ? bolsa('abrigo') : []
  const accesorios = bolsa('accesorio', true)

  const bases: { piezas: NoVacia<Candidato<P>>; clave: string; nota: number }[] = []
  const anadirBase = (piezas: NoVacia<Candidato<P>>) => {
    bases.push({
      piezas,
      clave: piezas.map((c) => c.prenda.id).join('+'),
      nota: nota(piezas) + azar() * VARIEDAD,
    })
  }
  for (const superior of bolsa('superior')) {
    for (const inferior of bolsa('inferior')) anadirBase([superior, inferior])
  }
  for (const vestido of bolsa('vestido')) anadirBase([vestido])
  if (bases.length === 0 || calzados.length === 0) return { contexto, outfits: [], avisos }
  bases.sort((a, b) => b.nota - a.nota || (a.clave < b.clave ? -1 : 1))

  // Primero sin repetir ni la de arriba ni la de abajo; luego se deja repetir la de abajo; al final,
  // cualquier combinación nueva.
  const principales = new Set<string>()
  const segundas = new Set<string>()
  const elegidas: typeof bases = []
  const pasadas = [
    (piezas: NoVacia<Candidato<P>>) =>
      !principales.has(piezas[0].prenda.id) && !segundas.has(piezas[1]?.prenda.id ?? ''),
    (piezas: NoVacia<Candidato<P>>) => !principales.has(piezas[0].prenda.id),
    () => true,
  ]
  for (const vale of pasadas) {
    for (const base of bases) {
      if (elegidas.length === CUANTOS_OUTFITS) break
      if (elegidas.includes(base) || !vale(base.piezas)) continue
      elegidas.push(base)
      principales.add(base.piezas[0].prenda.id)
      if (base.piezas[1]) segundas.add(base.piezas[1].prenda.id)
    }
  }

  const usadas = new Set<string>()
  const completar = (
    piezas: Candidato<P>[],
    opciones: readonly Candidato<P>[],
    obligatoria: boolean,
  ) => {
    let mejor: Candidato<P> | null = null
    let mejorNota = -Infinity
    for (const opcion of opciones) {
      const combina = armonia([...piezas, opcion].map((c) => c.prenda)).combina
      if (!obligatoria && !combina) continue
      const valor =
        opcion.puntos -
        (combina ? 0 : CHOQUE_COLOR) -
        (usadas.has(opcion.prenda.id) ? YA_USADA : 0) +
        azar() * VARIEDAD
      if (valor > mejorNota) {
        mejor = opcion
        mejorNota = valor
      }
    }
    if (mejor) {
      piezas.push(mejor)
      usadas.add(mejor.prenda.id)
    }
  }

  const outfits = elegidas.map((base): OutfitReglas<P> => {
    const piezas = [...base.piezas]
    completar(piezas, abrigos, true)
    completar(piezas, calzados, true)
    completar(piezas, accesorios, false)
    return {
      prendas: piezas.map((c) => c.prenda),
      principal: base.piezas[0].prenda,
      puntos: Math.round(nota(piezas) * 10) / 10,
      motivo: motivo(contexto, piezas),
    }
  })

  if (outfits.length < CUANTOS_OUTFITS) {
    avisos.push(
      outfits.length === 1
        ? 'solo sale 1 outfit: añade prendas para tener 4'
        : `solo salen ${String(outfits.length)} outfits distintos: añade prendas para tener 4`,
    )
  }
  return { contexto, outfits, avisos }
}
