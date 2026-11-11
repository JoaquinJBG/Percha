import type { Ajustes } from '../datos/modelo.ts'
import { leerAjustes } from '../datos/repositorio.ts'
import type { ConfigProbador } from './cliente.ts'

const LOCALES = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * `null` si la URL vale; si no, por qué. Tiene que ser https (Tailscale Serve lo da): desde una web en
 * https, Chrome bloquea las llamadas a http. Solo `localhost` se admite en http, para el desarrollo.
 */
export function comprobarUrlProbador(texto: string): string | null {
  let url: URL
  try {
    url = new URL(texto.trim())
  } catch {
    return 'Escribe la dirección entera, empezando por https://'
  }
  if (url.protocol === 'https:') return null
  if (url.protocol === 'http:' && LOCALES.has(url.hostname)) return null
  return 'La dirección tiene que empezar por https:// (la que te da Tailscale Serve).'
}

/** La URL y la clave del probador si están las dos; si no, `null` (se usa Gemini como siempre). */
export async function leerConfigProbador(
  leer: () => Promise<Ajustes> = leerAjustes,
): Promise<ConfigProbador | null> {
  const { urlProbador, claveProbador } = await leer()
  return urlProbador && claveProbador ? { url: urlProbador, clave: claveProbador } : null
}
