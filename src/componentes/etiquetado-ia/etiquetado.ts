import type { EtiquetasPrenda, Prenda } from '../../datos/modelo.ts'
import { leerAjustes } from '../../datos/repositorio.ts'
import {
  crearProveedorFalso,
  crearProveedorGemini,
  ErrorIA,
  type ProveedorIA,
  type TipoErrorIA,
} from '../../ia/index.ts'

/** `null` si no hay clave: así la pantalla lo sabe antes de pedir nada. */
export type ObtenerProveedor = () => Promise<ProveedorIA | null>

/** Solo en `pnpm dev`: `localStorage['percha:ia-falsa']` = `ok` o un tipo de error (`sin-cupo`…). */
const CLAVE_IA_FALSA = 'percha:ia-falsa'

const TIPOS_ERROR: TipoErrorIA[] = [
  'sin-clave',
  'clave-mala',
  'sin-cupo',
  'sin-red',
  'modelo',
  'no-disponible',
  'respuesta',
  'foto',
  'otro',
]

function leerModoFalso(): string | null {
  try {
    return localStorage.getItem(CLAVE_IA_FALSA)
  } catch {
    return null
  }
}

function proveedorFalsoDeDesarrollo(): ProveedorIA | null {
  const modo = leerModoFalso()
  if (modo !== 'ok' && !TIPOS_ERROR.includes(modo as TipoErrorIA)) return null
  const falso = crearProveedorFalso(
    modo === 'ok' ? {} : { error: new ErrorIA(modo as TipoErrorIA) },
  )
  return {
    ...falso,
    async etiquetarPrendas(prendas, opciones) {
      await new Promise((listo) => setTimeout(listo, 1500))
      return falso.etiquetarPrendas(prendas, opciones)
    },
    async elegirOutfits(peticion, opciones) {
      await new Promise<void>((listo, fallo) => {
        const espera = setTimeout(listo, 1500)
        opciones?.signal?.addEventListener('abort', () => {
          clearTimeout(espera)
          fallo(new DOMException('Cancelado', 'AbortError'))
        })
      })
      return falso.elegirOutfits(peticion, opciones)
    },
  }
}

export async function proveedorConClave(): Promise<ProveedorIA | null> {
  if (import.meta.env.DEV) {
    const falso = proveedorFalsoDeDesarrollo()
    if (falso) return falso
  }
  const { claveGemini, modeloGemini } = await leerAjustes()
  return claveGemini ? crearProveedorGemini({ clave: claveGemini, modelo: modeloGemini }) : null
}

export type Etiquetador = 'ia' | 'manual'

/** De dónde salen los valores con los que se abrió el formulario. */
export interface BaseEtiquetas {
  etiquetas: Partial<EtiquetasPrenda>
  por: Etiquetador
}

export const BASE_VACIA: BaseEtiquetas = { etiquetas: {}, por: 'manual' }

function normalizar(texto: string | undefined): string {
  return (texto ?? '').trim().toLocaleLowerCase('es')
}

/**
 * Sigue siendo de la IA si el usuario solo afina (colores, estilos, notas…); si cambia qué prenda es
 * (categoría o tipo), pasa a «manual» (D15).
 */
export function etiquetadaPor(base: BaseEtiquetas, guardadas: EtiquetasPrenda): Etiquetador {
  if (base.por === 'manual') return 'manual'
  const misma =
    base.etiquetas.categoria === guardadas.categoria &&
    normalizar(base.etiquetas.subcategoria) === normalizar(guardadas.subcategoria)
  return misma ? 'ia' : 'manual'
}

/** Lo que se manda a la IA de cada foto: la recortada si la hay. */
export function fotosParaIA(fotos: Prenda['fotos']): Blob[] {
  return fotos.map((foto) => foto.recortada ?? foto.original)
}

export interface AvisoIA {
  titulo: string
  texto: string
  /** El arreglo está en Ajustes (falta la clave, o no vale). */
  ajustes: boolean
  /** Puede salir bien si se prueba otra vez (sin red, sin cupo…). */
  reintentar: boolean
}

const DE_AJUSTES: TipoErrorIA[] = ['sin-clave', 'clave-mala', 'modelo']

export const AVISO_SIN_CLAVE: AvisoIA = {
  titulo: 'Falta la clave de Gemini',
  texto: 'Para que la IA etiquete tus prendas, ponla en Ajustes.',
  ajustes: true,
  reintentar: false,
}

export function avisoDeError(error: unknown): AvisoIA {
  const deIA = error instanceof ErrorIA ? error : new ErrorIA('otro')
  if (deIA.tipo === 'sin-clave') return AVISO_SIN_CLAVE
  return {
    titulo: 'La IA no ha podido etiquetarla',
    texto: deIA.message,
    ajustes: DE_AJUSTES.includes(deIA.tipo),
    reintentar: !DE_AJUSTES.includes(deIA.tipo),
  }
}

export type ResultadoIA = { etiquetas: EtiquetasPrenda } | { aviso: AvisoIA }

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Etiqueta una prenda. Devuelve `null` si se cancela. */
export async function etiquetarUna(
  obtener: ObtenerProveedor,
  fotos: Blob[],
  signal: AbortSignal,
): Promise<ResultadoIA | null> {
  try {
    const proveedor = await obtener()
    if (!proveedor) return { aviso: AVISO_SIN_CLAVE }
    const [etiquetas] = await proveedor.etiquetarPrendas([{ fotos }], { signal })
    if (signal.aborted) return null
    return etiquetas ? { etiquetas } : { aviso: avisoDeError(new ErrorIA('respuesta')) }
  } catch (error) {
    if (signal.aborted || esCancelacion(error)) return null
    if (!(error instanceof ErrorIA)) console.error(error)
    return { aviso: avisoDeError(error) }
  }
}
