import type { Categoria } from '../../datos/modelo.ts'
import {
  LIMITE_ABRIGO,
  abrigoObjetivo,
  temperaturaDe,
  temporadaDe,
  temporadaOpuesta,
} from './clima.ts'
import { afinidad, estilosAfines } from './estilos.ts'
import { FORMALIDAD_POR_OCASION, distanciaFormalidad } from './ocasiones.ts'
import { algunaPalabra, palabras } from './texto.ts'
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
const PARA_LLUVIA = ['agua', 'impermeable', 'chubasquero', 'goretex', 'paraguas'] as const

export function crearContexto(peticion: Peticion): Contexto {
  const { tiempo, estilo, ocasion } = peticion
  const temperatura = temperaturaDe(tiempo)
  const precipitacion = tiempo?.clima.precipitacion ?? null
  return {
    temperatura,
    precipitacion,
    necesitaAbrigo: (temperatura !== null && temperatura < LIMITE_ABRIGO) || precipitacion !== null,
    temporada: tiempo
      ? temporadaDe(tiempo.fecha, tiempo.sitio.latitud)
      : temporadaDe(peticion.fecha),
    formalidad: FORMALIDAD_POR_OCASION[ocasion],
    estilo,
    ocasion,
    estilosAfines: estilosAfines(estilo),
  }
}

/** Nivel de abrigo que se espera de cada categoría; con abrigo encima, la base puede ir más ligera. */
function objetivoDe(categoria: Categoria, temperatura: number): number {
  const objetivo = abrigoObjetivo(temperatura)
  const conAbrigo = temperatura < LIMITE_ABRIGO
  switch (categoria) {
    case 'superior':
    case 'vestido':
      return conAbrigo ? Math.max(1, objetivo - 1) : objetivo
    case 'inferior':
      return Math.min(objetivo, 4)
    case 'calzado':
      return Math.min(Math.max(objetivo, 2), 4)
    case 'abrigo':
      return Math.max(objetivo, 2)
    case 'accesorio':
      return objetivo
  }
}

type Evaluacion = { descarte: string } | { puntos: number; parcial: boolean; motivos: string[] }

function evaluar(prenda: PrendaReglas, contexto: Contexto): Evaluacion {
  const { temperatura, precipitacion, temporada, ocasion, estilo } = contexto
  const motivos: string[] = []
  let puntos = 0
  let parcial = false

  if (precipitacion) {
    const texto = palabras(prenda.subcategoria, prenda.notas)
    if (prenda.categoria === 'calzado' && algunaPalabra(texto, CALZADO_ABIERTO)) {
      return { descarte: `con ${precipitacion} no va calzado abierto` }
    }
    if (algunaPalabra(texto, MATERIAL_DELICADO)) {
      return { descarte: `con ${precipitacion} no va el ante ni el terciopelo` }
    }
    if (algunaPalabra(texto, PARA_LLUVIA)) {
      puntos += 2
      motivos.push(`para la ${precipitacion}`)
    }
  }

  if (temperatura !== null) {
    if (
      prenda.categoria === 'abrigo' &&
      temperatura >= 24 &&
      !(precipitacion && prenda.abrigo <= 2)
    ) {
      return { descarte: `hace calor para abrigo (${String(temperatura)} °C)` }
    }
    const diferencia = prenda.abrigo - objetivoDe(prenda.categoria, temperatura)
    if (diferencia >= 3) {
      return { descarte: `demasiado abrigo para ${String(temperatura)} °C` }
    }
    if (diferencia <= -3 && prenda.categoria !== 'accesorio') {
      return { descarte: `poco abrigo para ${String(temperatura)} °C` }
    }
    if (Math.abs(diferencia) === 2) {
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

  const distancia = distanciaFormalidad(prenda.formalidad, ocasion)
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
      parcial = true
      puntos -= 2
      motivos.push('de otro estilo')
  }

  return { puntos, parcial, motivos }
}

function motivoMasRepetido(descartadas: readonly Descartada[]): string | null {
  const veces = new Map<string, number>()
  for (const { motivo } of descartadas) veces.set(motivo, (veces.get(motivo) ?? 0) + 1)
  let mejor: string | null = null
  for (const [motivo, n] of veces) if (mejor === null || n > (veces.get(mejor) ?? 0)) mejor = motivo
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
  const hay = (categoria: Categoria, soloPlenas = false) =>
    lista.some((c) => c.prenda.categoria === categoria && (!soloPlenas || c.ajuste === 'pleno'))
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
      contexto.temperatura !== null && contexto.temperatura < LIMITE_ABRIGO
        ? `${String(contexto.temperatura)} °C`
        : `la ${contexto.precipitacion ?? 'lluvia'}`
    avisos.push(falta(`te falta un abrigo para ${para}: salen sin él`, ['abrigo'], descartadas))
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
      })
    }
  }
  lista.sort(porPuntos)
  return {
    contexto,
    candidatos: lista,
    descartadas,
    avisos: avisosDe(peticion, contexto, lista, descartadas),
  }
}
