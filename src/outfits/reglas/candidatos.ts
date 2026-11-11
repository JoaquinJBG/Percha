import { capasDe, llevaCapas } from '../../datos/capas.ts'
import type { Capa, Categoria } from '../../datos/modelo.ts'
import {
  LIMITE_EXTERIOR,
  LIMITE_TERCERA_PIEZA,
  abrigoObjetivo,
  temperaturaDe,
  temporadaDe,
  temporadaOpuesta,
} from './clima.ts'
import { afinidad, estilosAfines } from './estilos.ts'
import { puntosPrendaCuerpo } from './cuerpo.ts'
import { FORMALIDAD_POR_OCASION, distanciaFormalidad } from './ocasiones.ts'
import { ajusteTermico, formalidadTrabajo, tipoCuerpo } from './perfil.ts'
import { esChalecoDePunto } from './pilas.ts'
import { algunaPalabra, normalizar, palabras } from './texto.ts'
import type {
  Candidato,
  Contexto,
  Descartada,
  Peticion,
  PrendaReglas,
  ResultadoCandidatos,
} from './tipos.ts'

// Sin campo de material en el modelo, la lluvia se mira en la subcategoría y las notas.
const CALZADO_ABIERTO = [
  'sandalia',
  'sandalias',
  'chancla',
  'chanclas',
  'chancleta',
  'chancletas',
  'alpargata',
  'alpargatas',
  'esparto',
] as const
const MATERIAL_DELICADO = ['ante', 'serraje', 'gamuza', 'terciopelo', 'suede'] as const
// En las notas, «ante» también es preposición: solo cuenta como «de ante» o «en ante».
const MATERIAL_EN_NOTAS = /\b(?:de|en)\s+(?:ante|serraje|gamuza|terciopelo)\b|\bsuede\b/
const PARA_LLUVIA = ['agua', 'impermeable', 'chubasquero', 'goretex'] as const
const CORTO = ['corto', 'cortos', 'short', 'shorts', 'bermuda', 'bermudas'] as const
/** Por debajo de esto no se lleva calzado abierto aunque esté etiquetado como abrigado. */
const LIMITE_CALZADO_ABIERTO = 14
/** Por encima de esto la lluvia se lleva sin abrigo. */
const LIMITE_CALOR = 24
const LIMITE_PANTALON_CORTO = 16
/** Lo más que abriga una media o una exterior que se pone «por estilo», sin hacer falta. */
export const ABRIGO_TERCERA_PIEZA = 3
/** Hasta aquí (°C) un punto grueso de «superior» puede ir de capa media sin que haga falta abrigo. */
export const LIMITE_PUNTO_GRUESO = 17

export function crearContexto(peticion: Peticion): Contexto {
  const { tiempo, estilo, ocasion, perfil } = peticion
  // En casa no cuenta el tiempo de fuera; solo la temporada.
  const fuera = ocasion !== 'casa'
  const temperatura = fuera ? temperaturaDe(tiempo) : null
  const vestir = temperatura === null ? null : temperatura + ajusteTermico(perfil?.sensacionTermica)
  const precipitacion = fuera ? (tiempo?.clima.precipitacion ?? null) : null
  const frio = vestir !== null && vestir < LIMITE_EXTERIOR
  // La lluvia moja igual a un caluroso: esto va con la temperatura de verdad.
  const lluviaSinCalor =
    precipitacion !== null && (temperatura === null || temperatura < LIMITE_CALOR)
  const necesitaAbrigo = frio || lluviaSinCalor
  const fecha = tiempo?.fecha ?? peticion.fecha
  const deOficina = ocasion === 'trabajo' ? formalidadTrabajo(perfil?.oficina, fecha) : null
  return {
    temperatura,
    temperaturaVestir: vestir,
    cuerpo: tipoCuerpo(perfil?.cuerpo),
    precipitacion,
    necesitaAbrigo,
    terceraPieza:
      fuera &&
      !necesitaAbrigo &&
      (vestir === null || (vestir >= LIMITE_EXTERIOR && vestir <= LIMITE_TERCERA_PIEZA)),
    temporada: tiempo
      ? temporadaDe(tiempo.fecha, tiempo.sitio.latitud)
      : temporadaDe(peticion.fecha),
    formalidad: deOficina ?? FORMALIDAD_POR_OCASION[ocasion],
    estilo,
    ocasion,
    estilosAfines: estilosAfines(estilo),
  }
}

/**
 * Nivel de abrigo que se espera de cada categoría. Lo de arriba solo se mira por si abriga de más:
 * si se queda corto se pone otra capa, y eso lo decide la pila entera (`pilas.ts`).
 */
function objetivoDe(categoria: Categoria, temperatura: number): number {
  const objetivo = abrigoObjetivo(temperatura)
  switch (categoria) {
    case 'superior':
      return objetivo
    case 'vestido':
      return temperatura < LIMITE_EXTERIOR ? Math.max(1, objetivo - 1) : objetivo
    case 'inferior':
      return Math.min(objetivo, 4)
    case 'calzado':
      return Math.min(objetivo, 4)
    case 'abrigo':
      return Math.max(objetivo, 2)
    case 'accesorio':
      return objetivo
  }
}

type Evaluacion =
  { descarte: string } | { puntos: number; parcial: boolean; motivos: string[]; capas: Capa[] }

/** Los papeles que puede hacer hoy una prenda de arriba: con calor, solo base; sin frío, encima solo lo ligero. */
function capasDeHoy(prenda: PrendaReglas, contexto: Contexto): Capa[] {
  const { temperaturaVestir: temperatura, necesitaAbrigo, terceraPieza } = contexto
  let capas = capasDe(prenda)
  // En casa, como mucho un punto o una sudadera encima; nada de chaquetas ni abrigos.
  if (contexto.ocasion === 'casa') {
    capas = prenda.categoria === 'abrigo' ? [] : capas.filter((c) => c !== 'exterior')
  } else if (!necesitaAbrigo && !terceraPieza) {
    // Con calor, solo base; si llueve, también un chubasquero fino por encima.
    const fino = contexto.precipitacion !== null && prenda.abrigo <= 2
    capas = capas.filter((c) => c === 'base' || (fino && c === 'exterior'))
  } else if (!necesitaAbrigo && temperatura !== null) {
    // De 14 a 17 °C un punto grueso sí vale de capa media (§1.5: «P1 con punto debajo»); por encima, solo lo ligero.
    const tope =
      prenda.categoria === 'superior' && temperatura <= LIMITE_PUNTO_GRUESO
        ? ABRIGO_TERCERA_PIEZA + 1
        : ABRIGO_TERCERA_PIEZA
    capas = capas.filter((c) => c === 'base' || prenda.abrigo <= tope)
  }
  if (temperatura !== null && temperatura < LIMITE_EXTERIOR && esChalecoDePunto(prenda)) {
    capas = capas.filter((c) => c !== 'exterior')
  }
  return capas
}

function sinCapasHoy(contexto: Contexto): string {
  const { temperatura, ocasion, necesitaAbrigo, terceraPieza } = contexto
  if (ocasion === 'casa') return 'en casa no hace falta abrigo'
  const grados = temperatura === null ? '' : ` a ${String(temperatura)} °C`
  if (!necesitaAbrigo && !terceraPieza) return `hace calor para una capa encima${grados}`
  return `demasiado abrigo para llevarla encima${grados}`
}

function evaluar(prenda: PrendaReglas, contexto: Contexto): Evaluacion {
  const { temperatura, temperaturaVestir, precipitacion, temporada, ocasion, estilo } = contexto
  const motivos: string[] = []
  let puntos = 0
  let parcial = false

  const subcategoria = palabras(prenda.subcategoria)
  const abierto =
    prenda.categoria === 'calzado' &&
    algunaPalabra(palabras(prenda.subcategoria, prenda.notas), CALZADO_ABIERTO)

  if (precipitacion) {
    if (abierto) return { descarte: `con ${precipitacion} no va calzado abierto` }
    const delicada =
      algunaPalabra(subcategoria, MATERIAL_DELICADO) ||
      MATERIAL_EN_NOTAS.test(normalizar(prenda.notas))
    if (delicada) return { descarte: `con ${precipitacion} no va el ante ni el terciopelo` }
    if (algunaPalabra(subcategoria, PARA_LLUVIA)) {
      puntos += 2
      motivos.push(`para la ${precipitacion}`)
    }
  }

  if (temperatura !== null && temperaturaVestir !== null) {
    // Los textos, con la de verdad; las decisiones, con la de vestir (según el perfil).
    const grados = `${String(temperatura)} °C`
    const vestir = temperaturaVestir
    if (abierto && vestir < LIMITE_CALZADO_ABIERTO) {
      return { descarte: `con ${grados} no va calzado abierto` }
    }
    if (
      prenda.categoria === 'inferior' &&
      vestir < LIMITE_PANTALON_CORTO &&
      algunaPalabra(subcategoria, CORTO)
    ) {
      return { descarte: `con ${grados} no van pantalones cortos` }
    }
    if (
      prenda.categoria === 'abrigo' &&
      temperatura >= LIMITE_CALOR &&
      !(precipitacion && prenda.abrigo <= 2)
    ) {
      return { descarte: `hace calor para abrigo a ${grados}` }
    }
    const diferencia = prenda.abrigo - objetivoDe(prenda.categoria, vestir)
    // Lo que va encima (abrigo, gorro, bufanda) se nota más: se tolera un nivel menos de sobra.
    const encima = prenda.categoria === 'abrigo' || prenda.categoria === 'accesorio'
    if (diferencia >= (encima ? 2 : 3)) {
      return { descarte: `demasiado abrigo para ${grados}` }
    }
    const deArriba = llevaCapas(prenda.categoria)
    if (diferencia <= -3 && prenda.categoria !== 'accesorio' && !deArriba) {
      return { descarte: `poco abrigo para ${grados}` }
    }
    if (deArriba && diferencia < 0) {
      // Se compensa con capas: lo puntúa la pila.
    } else if (Math.abs(diferencia) === 2) {
      puntos -= 1
      motivos.push(diferencia > 0 ? 'algo abrigada' : 'algo fresca')
    } else {
      puntos += 2 - Math.abs(diferencia)
    }
  }

  if (temporada && prenda.temporadas.length > 0) {
    const opuesta = temporadaOpuesta(temporada)
    if (prenda.temporadas.includes(temporada)) {
      puntos += 1
    } else if (prenda.temporadas.every((otra) => otra === opuesta)) {
      // Con tiempo manda la temperatura; sin él, la temporada es la única pista.
      if (temperatura === null) return { descarte: `es de ${opuesta} y estamos en ${temporada}` }
      puntos -= 2
      motivos.push(`de ${opuesta}`)
    } else {
      puntos -= 1
    }
  }

  const distancia = distanciaFormalidad(prenda.formalidad, contexto.formalidad)
  const masFormal = prenda.formalidad > contexto.formalidad.maxima
  if (distancia >= 2) {
    return {
      descarte: masFormal ? `demasiado formal para ${ocasion}` : `muy informal para ${ocasion}`,
    }
  }
  if (distancia === 1 && masFormal) {
    // Ir un punto más arreglado se tolera; uno menos, no.
    puntos -= 1
    motivos.push(`algo formal para ${ocasion}`)
  } else if (distancia === 1) {
    parcial = true
    puntos -= 2
    motivos.push(`algo informal para ${ocasion}`)
  } else {
    puntos += 1
  }

  if (prenda.ocasiones.includes(ocasion)) {
    puntos += 2
    motivos.push(`para ${ocasion}`)
  } else if (prenda.ocasiones.length > 0) {
    puntos -= 1
  }

  switch (afinidad(prenda.estilos, estilo)) {
    case 'exacto':
      puntos += 3
      motivos.push(estilo)
      break
    case 'afin':
      puntos += 1.5
      motivos.push(`cercana a ${estilo}`)
      break
    case 'comodin':
      puntos += 1
      break
    case 'ninguno':
      // Si además ya era parcial por formalidad, le fallan las dos cosas: fuera.
      if (parcial) return { descarte: `de otro estilo y algo informal para ${ocasion}` }
      parcial = true
      puntos -= 2
      motivos.push('de otro estilo')
  }

  const cuerpo = puntosPrendaCuerpo(prenda, contexto)
  puntos += cuerpo.puntos
  motivos.push(...cuerpo.motivos)

  const capas = llevaCapas(prenda.categoria) ? capasDeHoy(prenda, contexto) : []
  if (llevaCapas(prenda.categoria) && capas.length === 0) return { descarte: sinCapasHoy(contexto) }
  return { puntos, parcial, motivos, capas }
}

function motivoMasRepetido(descartadas: readonly Descartada[]): string | null {
  const veces = new Map<string, number>()
  for (const { motivo } of descartadas) veces.set(motivo, (veces.get(motivo) ?? 0) + 1)
  let mejor: string | null = null
  for (const [motivo, n] of veces) {
    const actual = mejor === null ? 0 : (veces.get(mejor) ?? 0)
    if (mejor === null || n > actual || (n === actual && motivo < mejor)) mejor = motivo
  }
  return mejor
}

function falta(
  texto: string,
  categorias: readonly Categoria[],
  descartadas: readonly Descartada[],
): string {
  const motivo = motivoMasRepetido(
    descartadas.filter((d) => categorias.includes(d.prenda.categoria)),
  )
  return motivo ? `${texto} (${motivo})` : texto
}

function avisosDe(
  peticion: Peticion,
  contexto: Contexto,
  lista: readonly Candidato[],
  descartadas: readonly Descartada[],
): string[] {
  if (peticion.prendas.length === 0)
    return ['tu armario está vacío: añade prendas para ver outfits']
  // Lo de arriba cuenta como «parte de arriba» si puede ir de base y como «abrigo» si puede ir fuera.
  const hay = (categoria: Categoria, soloPlenas = false) =>
    lista.some(
      (c) =>
        (!soloPlenas || c.ajuste === 'pleno') &&
        (categoria === 'superior'
          ? c.capas.includes('base')
          : categoria === 'abrigo'
            ? c.capas.includes('exterior')
            : c.prenda.categoria === categoria),
    )
  const hayBase = (soloPlenas = false) =>
    hay('vestido', soloPlenas) || (hay('superior', soloPlenas) && hay('inferior', soloPlenas))
  const avisos: string[] = []

  if (!hayBase()) {
    let texto = 'te falta ropa: una parte de arriba y otra de abajo, o un vestido'
    let categorias: Categoria[] = ['superior', 'inferior', 'vestido']
    if (hay('superior')) {
      texto = 'te falta una parte de abajo (o un vestido)'
      categorias = ['inferior', 'vestido']
    } else if (hay('inferior')) {
      texto = 'te falta una parte de arriba (o un vestido)'
      categorias = ['superior', 'vestido']
    }
    avisos.push(falta(texto, categorias, descartadas))
  }
  if (!hay('calzado')) avisos.push(falta('te falta calzado', ['calzado'], descartadas))
  if (contexto.necesitaAbrigo && !hay('abrigo')) {
    const para =
      contexto.temperatura !== null &&
      contexto.temperaturaVestir !== null &&
      contexto.temperaturaVestir < LIMITE_EXTERIOR
        ? `${String(contexto.temperatura)} °C`
        : `la ${contexto.precipitacion ?? 'lluvia'}`
    avisos.push(falta(`te falta un abrigo para ${para}`, ['abrigo'], descartadas))
  }

  const flojas: string[] = []
  if (hayBase() && !hayBase(true)) flojas.push('ropa')
  if (hay('calzado') && !hay('calzado', true)) flojas.push('calzado')
  if (contexto.necesitaAbrigo && hay('abrigo') && !hay('abrigo', true)) flojas.push('abrigo')
  if (flojas.length > 0) {
    avisos.push(
      `no tienes ${flojas.join(' ni ')} que encaje del todo con ${contexto.estilo} ` +
        `para ${contexto.ocasion}: uso lo más parecido`,
    )
  }
  return avisos
}

function porPuntos(a: Candidato, b: Candidato): number {
  return b.puntos - a.puntos || (a.prenda.id < b.prenda.id ? -1 : a.prenda.id > b.prenda.id ? 1 : 0)
}

/** Las prendas que sirven hoy, puntuadas, y las que no, con su motivo. */
export function candidatos<P extends PrendaReglas>(peticion: Peticion<P>): ResultadoCandidatos<P> {
  const contexto = crearContexto(peticion)
  const lista: Candidato<P>[] = []
  const descartadas: Descartada<P>[] = []
  for (const prenda of peticion.prendas) {
    const evaluacion = evaluar(prenda, contexto)
    if ('descarte' in evaluacion) {
      descartadas.push({ prenda, motivo: evaluacion.descarte })
    } else {
      lista.push({
        prenda,
        puntos: evaluacion.puntos,
        ajuste: evaluacion.parcial ? 'parcial' : 'pleno',
        motivos: evaluacion.motivos,
        capas: evaluacion.capas,
        opcional:
          evaluacion.capas.length > 0 &&
          !evaluacion.capas.includes('base') &&
          !contexto.necesitaAbrigo,
      })
    }
  }
  lista.sort(porPuntos)
  descartadas.sort((a, b) => (a.prenda.id < b.prenda.id ? -1 : a.prenda.id > b.prenda.id ? 1 : 0))
  return {
    contexto,
    candidatos: lista,
    descartadas,
    avisos: avisosDe(peticion, contexto, lista, descartadas),
  }
}

/** Las `n` mejores de cada categoría, para no gastar cupo de la IA con armarios grandes. */
export function mejoresPorCategoria<P extends PrendaReglas>(
  lista: readonly Candidato<P>[],
  n: number,
): Candidato<P>[] {
  const vistas = new Map<Categoria, number>()
  return lista.filter((c) => {
    const ya = vistas.get(c.prenda.categoria) ?? 0
    vistas.set(c.prenda.categoria, ya + 1)
    return ya < n
  })
}
