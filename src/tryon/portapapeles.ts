/**
 * Copia el texto con `clipboard.writeText` y, si el navegador no deja (sin permiso o sin contexto
 * seguro), con una selección y `execCommand('copy')`, que S3 vio funcionar en el navegador del PC.
 * Devuelve si se copió.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return copiarConSeleccion(texto)
  }
}

function copiarConSeleccion(texto: string): boolean {
  const area = document.createElement('textarea')
  area.value = texto
  area.setAttribute('readonly', '')
  // Fuera de la vista y sin zoom en el móvil al enfocarlo.
  area.style.position = 'fixed'
  area.style.opacity = '0'
  area.style.fontSize = '16px'
  document.body.append(area)
  try {
    area.select()
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- respaldo para cuando writeText no deja
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}
