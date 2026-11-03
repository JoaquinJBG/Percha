/** Minúsculas y sin tildes: «Sandalias de Ante» → «sandalias de ante». */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
}

/** Palabras sueltas, para que «ante» no salte con «elegante». */
export function palabras(...textos: string[]): Set<string> {
  return new Set(
    textos.flatMap((texto) => normalizar(texto).split(/[^\p{L}\p{N}]+/u)).filter(Boolean),
  )
}

export function algunaPalabra(enTexto: Set<string>, buscadas: readonly string[]): boolean {
  return buscadas.some((palabra) => enTexto.has(palabra))
}
