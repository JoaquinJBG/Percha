import { capasDe } from '../../datos/capas.ts'
import type { Capa, Categoria } from '../../datos/modelo.ts'
import { crearAzar } from './azar.ts'
import { candidatos } from './candidatos.ts'
import { LIMITE_EXTERIOR } from './clima.ts'
import { armonia } from './colores.ts'
import { puntuarConjunto } from './cuerpo.ts'
import { afinidad } from './estilos.ts'
import { nombreFormalidad } from './ocasiones.ts'
import {
  abrigaDeVerdad,
  fallaPila,
  recursosDe,
  SIN_RECURSOS,
  type Recursos,
  MAX_ACCESORIOS,
  MAX_PRENDAS_POR_OUTFIT,
  puntuarPila,
  type Pila,
} from './pilas.ts'
import type {
  Candidato,
  Contexto,
  OutfitReglas,
  Peticion,
  PrendaReglas,
  Ranura,
  ResultadoCandidatos,
  ResultadoOutfits,
} from './tipos.ts'

export const CUANTOS_OUTFITS = 4
/** Cuánto puede mover el azar la nota de una opción: lo bastante para variar, no para elegir algo malo. */
const VARIEDAD = 2.5
const CHOQUE_COLOR = 10
const YA_USADA = 1.5
/** Con armarios grandes, solo las mejores de arriba y de abajo entran en las combinaciones. */
const MAX_BASE_POR_CATEGORIA = 40
/** Y solo las mejores medias y exteriores entran en las capas de cada outfit. */
const MAX_CAPA = 12
/** Y además, siempre, los mejores abrigos de verdad. */
const MAX_ABRIGOS = 4

type NoVacia<T> = [T, ...T[]]

function media(numeros: readonly number[]): number {
  return numeros.reduce((suma, n) => suma + n, 0) / Math.max(numeros.length, 1)
}

function nota<P extends PrendaReglas>(piezas: readonly Candidato<P>[]): number {
  const choque = armonia(piezas.map((c) => c.prenda)).combina ? 0 : CHOQUE_COLOR
  return media(piezas.map((c) => c.puntos)) - choque
}

/**
 * Las ranuras de un outfit: las suyas o, si no las trae (outfits de antes de T6.2 o de la IA), deducidas
 * del orden de dentro afuera: la primera de arriba es la base, la última de varias es la exterior si
 * puede serlo, y lo de en medio, media.
 */
export function ranurasDe(outfit: {
  prendas: readonly Pick<PrendaReglas, 'categoria' | 'subcategoria' | 'capas'>[]
  ranuras?: readonly Ranura[] | undefined
}): Ranura[] {
  if (outfit.ranuras?.length === outfit.prendas.length) return [...outfit.ranuras]
  const conVestido = outfit.prendas.some((p) => p.categoria === 'vestido')
  const arriba = outfit.prendas.flatMap((p, i) =>
    p.categoria === 'superior' || p.categoria === 'abrigo' ? [i] : [],
  )
  return outfit.prendas.map((p, i): Ranura => {
    if (p.categoria !== 'superior' && p.categoria !== 'abrigo') return p.categoria
    const posicion = arriba.indexOf(i)
    if (posicion === 0 && !conVestido) return 'base'
    // La última de varias es la exterior si es un abrigo o si puede ir fuera y no de base (sudadera).
    const papeles = capasDe(p)
    const deFuera =
      p.categoria === 'abrigo' || (papeles.includes('exterior') && !papeles.includes('base'))
    if (posicion === arriba.length - 1 && deFuera) return 'exterior'
    return 'media'
  })
}

/** De dentro afuera: base o vestido, medias, exterior, inferior, calzado y accesorios. */
function enOrden<P extends PrendaReglas>(
  pila: Pila<P>,
  inferior: P | null,
  calzado: P | null,
  accesorios: readonly P[],
): { prendas: P[]; ranuras: Ranura[] } {
  const piezas: [P, Ranura][] = [
    [pila.base, pila.base.categoria === 'vestido' ? 'vestido' : 'base'],
  ]
  for (const m of pila.medias) piezas.push([m, 'media'])
  if (pila.exterior) piezas.push([pila.exterior, 'exterior'])
  if (inferior) piezas.push([inferior, 'inferior'])
  if (calzado) piezas.push([calzado, 'calzado'])
  for (const a of accesorios) piezas.push([a, 'accesorio'])
  return { prendas: piezas.map(([p]) => p), ranuras: piezas.map(([, r]) => r) }
}

function motivo(
  contexto: Contexto,
  pila: Pila,
  todas: readonly PrendaReglas[],
  consejo: string | null,
): string {
  const { temperatura, temperaturaVestir: vestir, precipitacion } = contexto
  const partes: string[] = []
  const grados = temperatura === null ? '' : `${String(temperatura)} °C`
  const yPrecipitacion = precipitacion ? ` y ${precipitacion}` : ''
  const encima = pila.exterior ?? pila.medias.at(-1)
  const nombre = (p: PrendaReglas) => p.subcategoria.trim().toLocaleLowerCase('es') || 'otra capa'
  // «abrigo» solo si lo es; si no, su nombre: «sobrecamisa por la lluvia».
  const fuera = pila.exterior && (abrigaDeVerdad(pila.exterior) ? 'abrigo' : nombre(pila.exterior))
  if (fuera && vestir !== null && vestir < LIMITE_EXTERIOR) {
    partes.push(`${fuera} por ${grados}${yPrecipitacion}`)
  } else if (fuera && precipitacion) {
    partes.push(`${fuera} por la ${precipitacion}`)
  } else if (contexto.necesitaAbrigo) {
    const frio = vestir !== null && vestir < LIMITE_EXTERIOR
    partes.push(`sin abrigo para ${frio ? grados : `la ${precipitacion ?? 'lluvia'}`}`)
  } else if (encima) {
    partes.push(
      temperatura === null ? `con ${nombre(encima)}` : `con ${nombre(encima)} para ${grados}`,
    )
  } else if (temperatura !== null) {
    partes.push(
      `${(vestir ?? temperatura) >= 24 ? 'ligero por' : 'para'} ${grados}${yPrecipitacion}`,
    )
  }

  const base = todas.filter((p) => ['superior', 'inferior', 'vestido'].includes(p.categoria))
  const formalidad = Math.round(media(base.map((p) => p.formalidad)))
  partes.push(`${nombreFormalidad(formalidad)} para ${contexto.ocasion}`)

  const estilo = afinidad(pila.base.estilos, contexto.estilo)
  if (estilo === 'exacto') partes.push(contexto.estilo)
  else if (estilo === 'afin') partes.push(`cercano a ${contexto.estilo}`)

  if (!armonia(todas).combina) partes.push('colores atrevidos')
  else if (consejo) partes.push(consejo)
  return partes.join(', ')
}

/** Las de la lista que cumplen `vale`: las plenas si hay alguna; si no, también las parciales. */
function bolsa<P extends PrendaReglas>(
  lista: readonly Candidato<P>[],
  vale: (c: Candidato<P>) => boolean,
  soloPlenas = false,
): Candidato<P>[] {
  const todas = lista.filter(vale)
  const plenas = todas.filter((c) => c.ajuste === 'pleno')
  return plenas.length > 0 || soloPlenas ? plenas : todas
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
  const puede = (capa: Capa) => (c: Candidato<P>) => c.capas.includes(capa)

  const bases = bolsa(lista, (c) => c.prenda.categoria === 'superior' && puede('base')(c))
  const inferiores = bolsa(lista, (c) => c.prenda.categoria === 'inferior')
  const vestidos = bolsa(lista, (c) => c.prenda.categoria === 'vestido')
  const calzados = bolsa(lista, (c) => c.prenda.categoria === 'calzado')
  const medias = bolsa(lista, puede('media')).slice(0, MAX_CAPA)
  const todasExteriores = bolsa(lista, puede('exterior'))
  // Las mejores por puntos y, aunque puntúen menos, los mejores abrigos: con frío son los que valen.
  const exteriores = [
    ...new Set([
      ...todasExteriores.slice(0, MAX_CAPA),
      ...todasExteriores.filter((c) => abrigaDeVerdad(c.prenda)).slice(0, MAX_ABRIGOS),
      ...todasExteriores.filter((c) => c.prenda.categoria === 'abrigo').slice(0, MAX_ABRIGOS),
    ]),
  ]
  const accesorios = bolsa(lista, (c) => c.prenda.categoria === 'accesorio', true)
  const recursos = recursosDe([...medias, ...exteriores])
  const exteriorObligatoria = contexto.necesitaAbrigo && exteriores.length > 0

  const combinaciones: { piezas: NoVacia<Candidato<P>>; clave: string; nota: number }[] = []
  const anadir = (piezas: NoVacia<Candidato<P>>) => {
    combinaciones.push({
      piezas,
      clave: piezas.map((c) => c.prenda.id).join('+'),
      // La silueta (y el cuerpo) ya cuentan al elegir la base y la parte de abajo, no solo las capas.
      nota:
        nota(piezas) +
        puntuarConjunto([piezas[0].prenda], piezas[1]?.prenda ?? null, contexto).puntos +
        azar() * VARIEDAD,
    })
  }
  const abajo = inferiores.slice(0, MAX_BASE_POR_CATEGORIA)
  for (const base of bases.slice(0, MAX_BASE_POR_CATEGORIA)) {
    for (const inferior of abajo) anadir([base, inferior])
  }
  for (const vestido of vestidos) anadir([vestido])
  if (combinaciones.length === 0 || calzados.length === 0) return { contexto, outfits: [], avisos }
  combinaciones.sort((a, b) => b.nota - a.nota || (a.clave < b.clave ? -1 : 1))

  /** Los cuatro outfits con lo que hay; `recursos` dice cuánto se le puede exigir al armario. */
  const componer = (recursos: Recursos): OutfitReglas<P>[] => {
    const usadas = new Map<string, number>()
    const veces = (c: Candidato<P> | null | undefined) => (c ? (usadas.get(c.prenda.id) ?? 0) : 0)
    const usar = (c: Candidato<P>) => usadas.set(c.prenda.id, veces(c) + 1)
    /** La capa de fuera de cada outfit ya hecho, para no repetir la misma en los cuatro. */
    const fueras: string[] = []

    const elegirPila = (base: Candidato<P>, resto: readonly Candidato<P>[]) => {
      const mediasLibres = medias.filter((m) => m !== base)
      const exterioresLibres = exteriores.filter((e) => e !== base)
      const opciones: { medias: Candidato<P>[]; exterior: Candidato<P> | null }[] = []
      if (!exteriorObligatoria) {
        opciones.push({ medias: [], exterior: null })
        for (const m of mediasLibres) opciones.push({ medias: [m], exterior: null })
      }
      for (const e of exterioresLibres) {
        opciones.push({ medias: [], exterior: e })
        for (const m of mediasLibres) if (m !== e) opciones.push({ medias: [m], exterior: e })
        if (contexto.temperaturaVestir !== null && contexto.temperaturaVestir <= 3) {
          for (const [i, m1] of mediasLibres.entries()) {
            for (const m2 of mediasLibres.slice(i + 1)) {
              if (m1 === e || m2 === e) continue
              const [fina, gruesa] = m1.prenda.abrigo <= m2.prenda.abrigo ? [m1, m2] : [m2, m1]
              opciones.push({ medias: [fina, gruesa], exterior: e })
            }
          }
        }
      }

      const valoradas = opciones.flatMap((opcion) => {
        const pila: Pila<P> = {
          base: base.prenda,
          medias: opcion.medias.map((c) => c.prenda),
          exterior: opcion.exterior?.prenda ?? null,
        }
        if (fallaPila(pila, contexto, recursos)) return []
        const capas = [base, ...opcion.medias, ...(opcion.exterior ? [opcion.exterior] : [])]
        const fuera = capas.at(-1) ?? base
        const resultado = puntuarPila(
          pila,
          contexto,
          resto.map((c) => c.prenda),
        )
        // Si la exterior es obligatoria, repetir abrigo no resta: suele haber pocos y es mejor eso que
        // quitarlo. Que no salga el mismo en los cuatro ya lo cuida `repetida`.
        const repetible = (c: Candidato<P>) => exteriorObligatoria && c === opcion.exterior
        const valor =
          nota([...capas, ...resto]) +
          resultado.puntos -
          capas.slice(1).reduce((suma, c) => suma + (repetible(c) ? 0 : veces(c) * YA_USADA), 0) -
          (repetible(fuera) ? 0 : fueras.filter((id) => id === fuera.prenda.id).length * YA_USADA) +
          azar() * VARIEDAD
        return [{ pila, capas, fuera, valor, ...resultado }]
      })
      // Que la misma capa de fuera no salga en los cuatro, si hay otra que valga.
      const [primera] = fueras
      const repetida =
        fueras.length === CUANTOS_OUTFITS - 1 && fueras.every((id) => id === primera)
          ? primera
          : undefined
      const sinRepetir = valoradas.filter((v) => v.fuera.prenda.id !== repetida)
      const posibles = sinRepetir.length > 0 ? sinRepetir : valoradas
      return posibles.reduce<(typeof posibles)[number] | null>(
        (mejor, v) => (!mejor || v.valor > mejor.valor ? v : mejor),
        null,
      )
    }

    const completar = (
      piezas: readonly Candidato<P>[],
      opciones: readonly Candidato<P>[],
      obligatoria: boolean,
    ): Candidato<P> | null => {
      let mejor: Candidato<P> | null = null
      let mejorNota = -Infinity
      for (const opcion of opciones) {
        const combina = armonia([...piezas, opcion].map((c) => c.prenda)).combina
        if (!obligatoria && !combina) continue
        const valor =
          opcion.puntos -
          (combina ? 0 : CHOQUE_COLOR) -
          veces(opcion) * YA_USADA +
          azar() * VARIEDAD
        if (valor > mejorNota) {
          mejor = opcion
          mejorNota = valor
        }
      }
      return mejor
    }

    /** El outfit completo de una base y su parte de abajo, o `null` si ninguna capa encaja con ella. */
    const construir = (piezas: NoVacia<Candidato<P>>): OutfitReglas<P> | null => {
      const [base, inferior] = piezas
      const pila = elegirPila(base, inferior ? [inferior] : [])
      if (!pila) return null
      const { capas } = pila
      for (const c of capas) usar(c)
      if (inferior) usar(inferior)
      const calzado = completar([...capas, ...piezas.slice(1)], calzados, true)
      if (calzado) usar(calzado)
      const sinAccesorio = [...capas, ...piezas.slice(1), ...(calzado ? [calzado] : [])]
      const accesorio = completar(sinAccesorio, accesorios, false)
      if (accesorio) usar(accesorio)
      const todas = [...sinAccesorio, ...(accesorio ? [accesorio] : [])]
      fueras.push((capas.at(-1) ?? base).prenda.id)

      const { prendas, ranuras } = enOrden(
        pila.pila,
        inferior?.prenda ?? null,
        calzado?.prenda ?? null,
        accesorio ? [accesorio.prenda] : [],
      )
      return {
        prendas,
        ranuras,
        principal: base.prenda,
        puntos: Math.round((nota(todas) + pila.puntos) * 10) / 10,
        motivo: motivo(
          contexto,
          pila.pila,
          todas.map((c) => c.prenda),
          pila.consejo,
        ),
      }
    }

    // Primero sin repetir ni la base ni la de abajo; luego se deja repetir la de abajo; al final,
    // cualquier combinación nueva.
    const principales = new Set<string>()
    const segundas = new Set<string>()
    const probadas = new Set<string>()
    // Si ninguna capa encaja con una base, no encaja tampoco con otra parte de abajo.
    const basesSinPila = new Set<string>()
    const outfits: OutfitReglas<P>[] = []
    const pasadas = [
      (piezas: NoVacia<Candidato<P>>) =>
        !principales.has(piezas[0].prenda.id) && !segundas.has(piezas[1]?.prenda.id ?? ''),
      (piezas: NoVacia<Candidato<P>>) => !principales.has(piezas[0].prenda.id),
      () => true,
    ]
    for (const vale of pasadas) {
      for (const { piezas, clave } of combinaciones) {
        if (outfits.length === CUANTOS_OUTFITS) break
        if (probadas.has(clave) || basesSinPila.has(piezas[0].prenda.id) || !vale(piezas)) continue
        probadas.add(clave)
        const outfit = construir(piezas)
        if (!outfit) {
          basesSinPila.add(piezas[0].prenda.id)
          continue
        }
        outfits.push(outfit)
        principales.add(piezas[0].prenda.id)
        if (piezas[1]) segundas.add(piezas[1].prenda.id)
      }
    }
    return outfits
  }

  let outfits = componer(recursos)
  if (outfits.length === 0) {
    // Con lo que hay no se llega a lo que pide el día: mejor algo, y decirlo, que nada.
    outfits = componer(SIN_RECURSOS)
    const { temperatura } = contexto
    if (outfits.length === 0) {
      avisos.push('las capas de arriba que tienes no encajan con el tiempo de hoy')
    } else if (temperatura !== null) {
      avisos.push(`con lo que tienes no vas del todo abrigado para ${String(temperatura)} °C`)
    }
  }

  if (outfits.length > 0 && outfits.length < CUANTOS_OUTFITS) {
    avisos.push(
      outfits.length === 1
        ? 'solo sale 1 outfit: añade prendas para tener 4'
        : `solo salen ${String(outfits.length)} outfits distintos: añade prendas para tener 4`,
    )
  }
  return { contexto, outfits, avisos }
}

/** Los papeles posibles de `n` prendas de arriba, de dentro afuera. */
function patrones(n: number, conVestido: boolean): Capa[][] {
  const encima: Capa[][] = [
    [],
    ['media'],
    ['exterior'],
    ['media', 'exterior'],
    ['media', 'media', 'exterior'],
  ]
  const conBase = encima.map((capas): Capa[] => ['base', ...capas])
  return (conVestido ? encima : conBase).filter((p) => p.length === n)
}

function permutaciones<T>(lista: readonly T[]): T[][] {
  if (lista.length <= 1) return [[...lista]]
  return lista.flatMap((x, i) =>
    permutaciones([...lista.slice(0, i), ...lista.slice(i + 1)]).map((resto) => [x, ...resto]),
  )
}

/**
 * Comprueba un outfit elegido por fuera (la IA) contra los candidatos de hoy y le reparte las capas.
 * Devuelve sus prendas de dentro afuera (la principal, primera), con sus ranuras, o el motivo por el
 * que no vale.
 */
export function comprobarOutfit<P extends PrendaReglas>(
  ids: readonly string[],
  resultado: ResultadoCandidatos<P>,
): { prendas: P[]; ranuras: Ranura[]; principal: P } | { error: string } {
  const porId = new Map(resultado.candidatos.map((c) => [c.prenda.id, c]))
  const elegidas: Candidato<P>[] = []
  for (const id of ids) {
    const candidato = porId.get(id)
    if (!candidato) return { error: `la prenda ${id} no está entre los candidatos` }
    if (elegidas.includes(candidato)) return { error: `repite la prenda ${id}` }
    elegidas.push(candidato)
  }
  if (elegidas.length > MAX_PRENDAS_POR_OUTFIT) {
    return { error: `lleva más de ${String(MAX_PRENDAS_POR_OUTFIT)} prendas` }
  }
  const de = (categoria: Categoria) => elegidas.filter((c) => c.prenda.categoria === categoria)
  const arriba = elegidas.filter((c) => c.capas.length > 0)
  const [vestido, ...otrosVestidos] = de('vestido')
  const inferiores = de('inferior')
  const conVestido = vestido !== undefined && otrosVestidos.length === 0 && inferiores.length === 0
  const conPar = vestido === undefined && inferiores.length === 1 && arriba.length > 0
  if (!conPar && !conVestido) {
    return { error: 'necesita una parte de arriba y otra de abajo, o un vestido' }
  }
  if (de('calzado').length !== 1) return { error: 'necesita un calzado' }
  if (de('accesorio').length > MAX_ACCESORIOS) {
    return { error: `lleva más de ${String(MAX_ACCESORIOS)} accesorios` }
  }

  const { contexto } = resultado
  const hayExterior = resultado.candidatos.some((c) => c.capas.includes('exterior'))
  if (contexto.necesitaAbrigo && hayExterior && !arriba.some((c) => c.capas.includes('exterior'))) {
    return { error: 'hoy necesita abrigo' }
  }
  if (conVestido && arriba.some((c) => c.capas.every((capa) => capa === 'base'))) {
    return { error: 'sobre un vestido no va otra parte de arriba' }
  }
  const recursos = recursosDe(resultado.candidatos)
  const resto = elegidas.filter((c) => c.capas.length === 0 && c !== vestido).map((c) => c.prenda)
  let mejor: { pila: Pila<P>; puntos: number } | null = null
  let primerFallo: string | null = null
  for (const orden of permutaciones(arriba)) {
    for (const patron of patrones(orden.length, conVestido)) {
      if (!orden.every((c, i) => c.capas.includes(patron[i] ?? 'base'))) continue
      const base = conVestido ? vestido : orden[0]
      if (!base) continue
      const pila: Pila<P> = {
        base: base.prenda,
        medias: orden.filter((_, i) => patron[i] === 'media').map((c) => c.prenda),
        exterior: orden.find((_, i) => patron[i] === 'exterior')?.prenda ?? null,
      }
      // Con la exterior obligatoria, una pila sin ella no vale aunque puntúe más.
      const fallo =
        contexto.necesitaAbrigo && hayExterior && !pila.exterior
          ? 'hoy necesita abrigo'
          : fallaPila(pila, contexto, recursos)
      if (fallo) {
        primerFallo ??= fallo
        continue
      }
      const puntos = puntuarPila(pila, contexto, resto).puntos
      if (!mejor || puntos > mejor.puntos) mejor = { pila, puntos }
    }
  }
  if (!mejor) return { error: primerFallo ?? 'las capas de arriba no encajan' }
  if (contexto.necesitaAbrigo && hayExterior && !mejor.pila.exterior) {
    return { error: 'hoy necesita abrigo' }
  }
  const { prendas, ranuras } = enOrden(
    mejor.pila,
    inferiores[0]?.prenda ?? null,
    de('calzado')[0]?.prenda ?? null,
    de('accesorio').map((c) => c.prenda),
  )
  return { prendas, ranuras, principal: mejor.pila.base }
}
