import { claridad, tono } from './colores.ts'
import { normalizar } from './texto.ts'
import type { Contexto, PrendaReglas } from './tipos.ts'

// Reglas de silueta (con `corte`, T8.1) y de cuerpo (§6 de docs/investigacion/reglas-outfits.md,
// B1–B11). Todas son blandas: suman o restan. Las de cuerpo solo cuentan si el perfil tiene cuerpo.

const AMPLIO_ARRIBA = new Set<string>(['oversize', 'boxy'])
const AMPLIO_ABAJO = new Set<string>(['baggy', 'wide leg', 'balloon'])
const AJUSTADO_ARRIBA = new Set<string>(['slim', 'regular', 'entallado', 'recto'])
const AJUSTADO_ABAJO = new Set<string>(['skinny', 'slim', 'regular / recto', 'tapered'])
const RECTO_O_RELAJADO = new Set<string>(['regular / recto', 'relaxed', 'tapered', 'bootcut'])
/** Estilos que piden volumen: en ellos, amplio arriba y abajo no resta. */
const CON_VOLUMEN = new Set<string>(['streetwear', 'y2k'])
const ARREGLADOS = new Set<string>([
  'business',
  'formal',
  'elegante',
  'old money / quiet luxury',
  'smart casual',
])

const ESCOTE_ABIERTO = /henley|pico|\bpolo\b/
const CUELLO_ALTO = /cuello alto|cuello vuelto|turtleneck/
const RAYA_HORIZONTAL = /horizontal|breton|marinera?/
const RAYA_VERTICAL = /vertical|diplomatic/
const GRAFICO = /grafico|logo|letras|dibujo/
const CALZADO_CON_PRESENCIA = /derby|mocasin|chukka|chelsea|bota|botin|oxford|blucher|brogue/
const SUELA_FINA = /bailarina|alpargata|slip|plana|lona|chancla|sandalia/
const PUNTO = /jersey|sueter|pullover|punto|merino|cachemir/
const CAPUCHA = /sudadera|hoodie|capucha/
const ESTRUCTURA = /americana|blazer|abrigo|gabardina|trench|chaqueton/
const SASTRE = /pinzas|sastre|traje|chino|vestir|lana/

const tipo = (p: PrendaReglas) => normalizar(p.subcategoria)
const corte = (p: PrendaReglas | null | undefined) => p?.corte ?? ''
const familia = (p: PrendaReglas) => tono(p).split(':')[0] ?? ''

export interface PuntosCuerpo {
  puntos: number
  motivos: string[]
}

/** B1, B6, B7, B8 y B9: lo que una prenda suma o resta sola en un cuerpo grande. */
export function puntosPrendaCuerpo(prenda: PrendaReglas, contexto: Contexto): PuntosCuerpo {
  const nada = { puntos: 0, motivos: [] }
  if (contexto.cuerpo !== 'grande') return nada
  const t = tipo(prenda)
  const estampado = normalizar(prenda.estampado)
  let puntos = 0
  const motivos: string[] = []

  if (prenda.categoria === 'inferior') {
    const c = corte(prenda)
    if (c === 'skinny') {
      puntos -= 3
      motivos.push('el pitillo no favorece')
    } else if (c === 'slim') {
      puntos -= 1
    } else if (RECTO_O_RELAJADO.has(c)) {
      puntos += 1
      motivos.push('corte recto, favorece')
    } else if (AMPLIO_ABAJO.has(c) && !CON_VOLUMEN.has(contexto.estilo)) {
      puntos -= 1
    }
  }

  if (prenda.categoria === 'superior' || prenda.categoria === 'vestido') {
    if (prenda.cuello === 'cubano' || ESCOTE_ABIERTO.test(t)) puntos += 0.5
    if (CUELLO_ALTO.test(t)) puntos -= 0.5
    if (GRAFICO.test(estampado)) puntos -= 1
  }
  if (RAYA_HORIZONTAL.test(estampado)) puntos -= 1
  else if (RAYA_VERTICAL.test(estampado)) puntos += 0.5

  if (prenda.categoria === 'calzado') {
    if (CALZADO_CON_PRESENCIA.test(t)) puntos += 0.5
    else if (SUELA_FINA.test(t)) puntos -= 0.5
  }

  if (prenda.categoria === 'abrigo') {
    const largoArreglado =
      (prenda.largo === 'largo' || prenda.largo === 'medio muslo') &&
      (contexto.ocasion === 'trabajo' || ARREGLADOS.has(contexto.estilo))
    const cadera = prenda.largo === 'cadera' && contexto.ocasion === 'diario'
    if (largoArreglado || cadera) puntos += 0.5
  }
  return { puntos, motivos }
}

export interface NotaConjunto {
  puntos: number
  /** Un consejo de cómo llevarlo para el motivo (B3), o `null`. */
  consejo: string | null
}

/**
 * La silueta (amplio con ajustado, no todo amplio) y B2–B5, B10 y B11 sobre la parte de arriba
 * (`capas`, de dentro afuera) y la de abajo.
 */
export function puntuarConjunto(
  capas: readonly PrendaReglas[],
  inferior: PrendaReglas | null,
  contexto: Contexto,
): NotaConjunto {
  const grande = contexto.cuerpo === 'grande'
  const fuera = capas.at(-1)
  const [base] = capas
  let puntos = 0
  let consejo: string | null = null

  const arribaAmplio = capas.some((c) => AMPLIO_ARRIBA.has(corte(c)))
  const abajoAmplio = AMPLIO_ABAJO.has(corte(inferior))
  // B2 y silueta: una sola pieza amplia; amplio con ajustado suma.
  if (arribaAmplio && abajoAmplio) {
    if (!CON_VOLUMEN.has(contexto.estilo)) puntos -= grande ? 3 : 2
  } else if (abajoAmplio && capas.some((c) => AJUSTADO_ARRIBA.has(corte(c)))) {
    puntos += 1
  } else if (arribaAmplio && AJUSTADO_ABAJO.has(corte(inferior)) && corte(inferior) !== 'skinny') {
    puntos += 1
  }

  if (!grande || !base || !fuera) return { puntos, consejo }

  // B3: una capa abierta encima marca una línea vertical.
  const encimaAbierta =
    capas.length > 1 && !(PUNTO.test(tipo(fuera)) && !/cardigan|rebeca/.test(tipo(fuera)))
  if (encimaAbierta && !CAPUCHA.test(tipo(fuera))) {
    puntos += 1
    consejo = 'lo de fuera abierto, que alarga'
  }
  // B4: columna de color en trabajo y minimalista.
  const columna = inferior && familia(base) !== '' && familia(base) === familia(inferior)
  if (columna && (contexto.ocasion === 'trabajo' || contexto.estilo === 'minimalista')) puntos += 1
  // B5: arriba claro y abajo oscuro resta, más si arriba es amplio.
  if (inferior && claridad(fuera) > claridad(inferior)) puntos -= arribaAmplio ? 1 : 0.5
  // B10: punto fino bajo estructura suma; dos capas gruesas seguidas, no.
  for (let i = 1; i < capas.length; i++) {
    const dentro = capas[i - 1]
    const encima = capas[i]
    if (!dentro || !encima) continue
    if (dentro.abrigo >= 4 && encima.abrigo >= 4) puntos -= 1
    if (PUNTO.test(tipo(dentro)) && dentro.abrigo <= 3 && ESTRUCTURA.test(tipo(encima))) {
      puntos += 0.5
    }
  }
  // B11: la sudadera, con capa encima o pantalón sastre.
  if (CAPUCHA.test(tipo(fuera)) && !(inferior && SASTRE.test(tipo(inferior)))) puntos -= 1
  return { puntos, consejo }
}
