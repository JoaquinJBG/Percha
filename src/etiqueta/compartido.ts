import { esEnlaceWeb, type Componente, type DatosEtiqueta } from '../datos/modelo.ts'
import { datosDeEnlace } from './enlaces.ts'

export interface Compartido {
  /** El primer enlace web que llega (en `url` o dentro del texto); `null` si no hay ninguno. */
  enlace: string | null
  /** El título de la ficha, o el texto sin el enlace. Solo para enseñarlo. */
  titulo: string
}

const MAX_TITULO = 120
const ENLACE_EN_TEXTO = /https?:\/\/[^\s<>"]+/i

/**
 * Lee lo que manda Android con «Compartir» (share_target por GET). Chrome pone a veces el enlace en
 * `text` y no en `url`, y la tienda puede añadir «Mira esto en ZARA:» delante.
 */
export function leerCompartido(parametros: URLSearchParams): Compartido {
  const url = parametros.get('url')?.trim() ?? ''
  const texto = parametros.get('text')?.trim() ?? ''
  const titulo = parametros.get('title')?.trim() ?? ''
  const encontrado = ENLACE_EN_TEXTO.exec(texto)?.[0] ?? ''
  // El punto o el paréntesis que cierra la frase no son parte del enlace.
  const enTexto = encontrado.replace(/[.,;:!?)]+$/, '')
  const candidato = [url, enTexto].find((posible) => posible !== '' && esEnlaceWeb(posible))
  const resto = (titulo || texto.replace(encontrado, ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITULO)
  return { enlace: candidato ?? null, titulo: resto }
}

const porcentaje = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

/** «95 % algodón, 2,5 % elastano». */
export function textoComposicion(composicion: readonly Componente[] | undefined): string {
  return (composicion ?? [])
    .map(({ material, porcentaje: cuanto }) =>
      cuanto === undefined ? material : `${porcentaje.format(cuanto)} % ${material}`,
    )
    .join(', ')
}

/** Estado de navegación con el que «Compartido» abre «Nueva prenda». */
export function estadoDesdeTienda(enlace: string): { enlaceTienda: string } {
  return { enlaceTienda: enlace }
}

/** Lo que «Nueva prenda» rellena al llegar desde una tienda: el enlace y lo que diga su URL. */
export function datosDesdeTienda(
  estado: unknown,
): Pick<DatosEtiqueta, 'marca' | 'referencia'> & { enlace?: string } {
  const enlace = (estado as { enlaceTienda?: unknown } | null)?.enlaceTienda
  if (typeof enlace !== 'string' || !esEnlaceWeb(enlace)) return {}
  return { ...datosDeEnlace(enlace), enlace }
}
