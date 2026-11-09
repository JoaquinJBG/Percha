import { capasPorDefecto, llevaCapas } from '../../datos/capas.ts'
import {
  esEnlaceWeb,
  etiquetasPrendaSchema,
  MAX_COMPONENTES,
  type Capa,
  type Categoria,
  type Componente,
  type DatosEtiqueta,
  type Estilo,
  type EtiquetasPrenda,
  type Ocasion,
  type Temporada,
} from '../../datos/modelo.ts'

/** Una fila de la composición mientras se escribe: el porcentaje es texto hasta validar. */
export interface FilaComposicion {
  material: string
  porcentaje: string
}

/** Lo que se está editando: como `EtiquetasPrenda`, pero la categoría puede faltar. */
export interface Borrador {
  categoria: Categoria | null
  subcategoria: string
  colores: string[]
  estampado: string
  estilos: Estilo[]
  abrigo: number
  formalidad: number
  ocasiones: Ocasion[]
  temporadas: Temporada[]
  notas: string
  /** `null`: las de por defecto según la categoría y el tipo (`capasPorDefecto`). */
  capas: Capa[] | null
  /**
   * Si el usuario ha tocado «Puede ir como». Mientras no, cambiar la categoría o el tipo devuelve las
   * capas a las de por defecto, aunque vinieran de la IA: si corrige qué prenda es, también cambian.
   */
  capasTocadas: boolean
  marca: string
  referencia: string
  talla: string
  composicion: FilaComposicion[]
  enlace: string
}

/** Lo que se escribe en «Etiqueta y tienda», tal cual. Se puede guardar fuera para volver a montar el formulario. */
export type CamposEtiqueta = Pick<
  Borrador,
  'marca' | 'referencia' | 'talla' | 'composicion' | 'enlace'
>

/** Lo mismo que el modelo de datos: con más, «Guardar» fallaría. */
export const LARGO_MAXIMO = { marca: 60, referencia: 40, talla: 20 } as const

export type ErroresBorrador = Partial<Record<keyof Borrador, string | undefined>>

const NIVEL_POR_DEFECTO = 3

export const DESCRIPCION_ABRIGO = ['Muy fresco', 'Fresco', 'Medio', 'Abriga', 'Muy abrigado']
export const DESCRIPCION_FORMALIDAD = [
  'Deporte o casa',
  'Casual',
  'Smart casual',
  'Arreglado',
  'Etiqueta',
]

function nivel(valor: number | undefined): number {
  return valor !== undefined && Number.isInteger(valor) && valor >= 1 && valor <= 5
    ? valor
    : NIVEL_POR_DEFECTO
}

/** Copia solo los campos de etiquetas: se le puede pasar una prenda entera para editarla. */
export function borradorInicial(
  iniciales: Partial<EtiquetasPrenda> = {},
  etiquetaEnCurso?: CamposEtiqueta,
): Borrador {
  if (etiquetaEnCurso) {
    return { ...borradorInicial(iniciales), ...etiquetaEnCurso }
  }
  return {
    categoria: iniciales.categoria ?? null,
    subcategoria: iniciales.subcategoria ?? '',
    colores: [...(iniciales.colores ?? [])],
    estampado: iniciales.estampado ?? '',
    estilos: [...(iniciales.estilos ?? [])],
    abrigo: nivel(iniciales.abrigo),
    formalidad: nivel(iniciales.formalidad),
    ocasiones: [...(iniciales.ocasiones ?? [])],
    temporadas: [...(iniciales.temporadas ?? [])],
    notas: iniciales.notas ?? '',
    capas: iniciales.capas && iniciales.capas.length > 0 ? [...iniciales.capas] : null,
    capasTocadas: false,
    marca: iniciales.marca ?? '',
    referencia: iniciales.referencia ?? '',
    talla: iniciales.talla ?? '',
    composicion: filasComposicion(iniciales.composicion),
    enlace: iniciales.enlace ?? '',
  }
}

export function filasComposicion(
  composicion: readonly Componente[] | undefined,
): FilaComposicion[] {
  return (composicion ?? []).map(({ material, porcentaje }) => ({
    material,
    porcentaje: porcentaje === undefined ? '' : String(porcentaje).replace('.', ','),
  }))
}

/** Lo leído de una etiqueta pisa solo los campos que trae; el resto se queda como estaba. */
export function conDatosEtiqueta(borrador: Borrador, datos: DatosEtiqueta): Borrador {
  return {
    ...borrador,
    ...(datos.marca && { marca: datos.marca }),
    ...(datos.referencia && { referencia: datos.referencia }),
    ...(datos.talla && { talla: datos.talla }),
    ...(datos.composicion && { composicion: filasComposicion(datos.composicion) }),
  }
}

/** Aplica un cambio de un campo con lo que arrastra a las capas. */
export function conCambio<K extends keyof Borrador>(
  borrador: Borrador,
  campo: K,
  valor: Borrador[K],
): Borrador {
  const siguiente = { ...borrador, [campo]: valor }
  if (campo === 'capas') siguiente.capasTocadas = true
  const cambiaLaPrenda = campo === 'categoria' || campo === 'subcategoria'
  if (cambiaLaPrenda && !borrador.capasTocadas) siguiente.capas = null
  return siguiente
}

/** Las capas que se ven marcadas: las elegidas o, si no se han tocado, las de por defecto. */
export function capasVisibles(borrador: Borrador): Capa[] {
  if (borrador.categoria === null || !llevaCapas(borrador.categoria)) return []
  return (
    borrador.capas ??
    capasPorDefecto({ categoria: borrador.categoria, subcategoria: borrador.subcategoria })
  )
}

function vacioAIndefinido(texto: string): string | undefined {
  const limpio = texto.trim()
  return limpio === '' ? undefined : limpio
}

/** «60», «60 %» o «2,5» → número; vacío → `undefined`; lo demás → `NaN`. */
function leerPorcentaje(texto: string): number | undefined {
  const limpio = texto.replace('%', '').replace(',', '.').trim()
  if (limpio === '') return undefined
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : Number.NaN
}

function leerComposicion(
  filas: FilaComposicion[],
): { valida: true; composicion: Componente[] | undefined } | { valida: false; error: string } {
  const composicion: Componente[] = []
  for (const fila of filas) {
    const material = fila.material.trim().toLowerCase()
    const porcentaje = leerPorcentaje(fila.porcentaje)
    if (material === '' && porcentaje === undefined) continue
    if (material === '') return { valida: false, error: 'Falta el material de algún porcentaje.' }
    // 0 no dice nada: la IA lo usa para «no lo pone».
    if (porcentaje !== undefined && !(porcentaje > 0 && porcentaje <= 100)) {
      return { valida: false, error: 'Pon un porcentaje entre 1 y 100, o déjalo vacío.' }
    }
    composicion.push(porcentaje === undefined ? { material } : { material, porcentaje })
  }
  if (composicion.length > MAX_COMPONENTES) {
    return { valida: false, error: `Como mucho ${String(MAX_COMPONENTES)} materiales.` }
  }
  return { valida: true, composicion: composicion.length > 0 ? composicion : undefined }
}

export function validarBorrador(
  borrador: Borrador,
): { valido: true; etiquetas: EtiquetasPrenda } | { valido: false; errores: ErroresBorrador } {
  if (borrador.categoria === null) {
    return { valido: false, errores: { categoria: 'Elige una categoría.' } }
  }
  const errores: ErroresBorrador = {}
  const composicion = leerComposicion(borrador.composicion)
  if (!composicion.valida) errores.composicion = composicion.error
  for (const campo of ['marca', 'referencia', 'talla'] as const) {
    if (borrador[campo].trim().length > LARGO_MAXIMO[campo]) {
      errores[campo] = `Como mucho ${String(LARGO_MAXIMO[campo])} caracteres.`
    }
  }
  const enlace = vacioAIndefinido(borrador.enlace)
  if (enlace !== undefined && !esEnlaceWeb(enlace)) {
    errores.enlace = 'Pega el enlace entero, empezando por https://'
  }
  const capas = llevaCapas(borrador.categoria) ? capasVisibles(borrador) : undefined
  if (capas?.length === 0) errores.capas = 'Elige al menos uno.'
  if (Object.keys(errores).length > 0) return { valido: false, errores }

  const leido = etiquetasPrendaSchema.safeParse({
    ...borrador,
    marca: vacioAIndefinido(borrador.marca),
    referencia: vacioAIndefinido(borrador.referencia),
    talla: vacioAIndefinido(borrador.talla),
    composicion: composicion.valida ? composicion.composicion : undefined,
    enlace,
    capas,
  })
  if (leido.success) {
    const { data } = leido
    // Las claves van aunque estén vacías: al editar, `actualizarPrenda` solo quita lo que se le pasa.
    return {
      valido: true,
      etiquetas: {
        ...data,
        marca: data.marca,
        referencia: data.referencia,
        talla: data.talla,
        composicion: data.composicion,
        enlace: data.enlace,
        // Si deja de ser de arriba, `undefined` borra las capas que tuviera al editar.
        capas: data.capas,
      },
    }
  }
  for (const problema of leido.error.issues) {
    errores[problema.path[0] as keyof Borrador] = 'Revisa este campo.'
  }
  return { valido: false, errores }
}

/** Añade o quita un valor de una lista, sin cambiar el orden del resto. */
export function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
}

/** Las opciones fijas más los valores que ya traía la prenda y no están en la lista. */
export function conExtras(opciones: readonly string[], elegidos: string[]): string[] {
  return [...new Set([...opciones, ...elegidos.filter(Boolean)])]
}
