/** `localStorage`, o `null` si el navegador lo bloquea (algunos modos privados lanzan al leerlo). */
export function almacenLocal(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}
