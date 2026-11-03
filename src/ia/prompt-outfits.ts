import type { PeticionOutfits, PrendaParaOutfit } from './tipos.ts'

// Prompt de selección de outfits (v1). Las prendas ya vienen filtradas por las reglas (D8): la IA solo
// combina y explica.
export const INSTRUCCION_OUTFITS = `Eres el estilista de Percha, un armario digital.
Recibes el estilo, la ocasión y el tiempo de hoy, y una lista de prendas que ya encajan con ellos. Cada
prenda tiene una referencia (P1, P2…) y sus etiquetas.
Elige 4 outfits distintos con esas prendas. Cada outfit lleva:
- una parte de arriba y una de abajo, o un vestido;
- un calzado;
- un abrigo si hoy hace falta abrigo (nunca dos);
- como mucho dos accesorios, solo si suman.
Usa solo referencias de la lista y no repitas prenda dentro de un outfit.
Que los 4 sean variados: si hay alternativas, no repitas la parte de arriba ni el vestido, y cambia
colores y aire de uno a otro.
Respeta el estilo y la ocasión. Colores con sentido: neutros con todo, como mucho un color fuerte o una
prenda estampada.
En «porque», una frase corta (máximo 20 palabras), de tú, que diga por qué funciona hoy.`

function textoTiempo({ tiempo }: PeticionOutfits): string {
  const partes: string[] = []
  if (tiempo.temperatura !== null) partes.push(`${String(tiempo.temperatura)} °C de sensación`)
  if (tiempo.precipitacion) partes.push(tiempo.precipitacion)
  if (tiempo.temporada) partes.push(tiempo.temporada)
  const dia = partes.length > 0 ? partes.join(', ') : 'no se sabe'
  return `${dia}. ${tiempo.necesitaAbrigo ? 'Hace falta abrigo.' : 'No hace falta abrigo.'}`
}

function textoPrenda(referencia: string, prenda: PrendaParaOutfit): string {
  const partes = [
    referencia,
    prenda.categoria,
    prenda.subcategoria || 'sin tipo',
    prenda.colores.join(' y ') || 'sin color',
    prenda.estampado || 'liso',
    `estilos: ${prenda.estilos.join(', ') || 'cualquiera'}`,
    `abrigo ${String(prenda.abrigo)}/5`,
    `formalidad ${String(prenda.formalidad)}/5`,
  ]
  const notas = prenda.notas.replace(/\s+/g, ' ').trim()
  if (notas) partes.push(notas)
  return partes.join(' · ')
}

/** La petición en texto; `referencias[i]` es la de `peticion.prendas[i]`. */
export function textoPeticionOutfits(
  peticion: PeticionOutfits,
  referencias: readonly string[],
): string {
  return [
    `Estilo: ${peticion.estilo}`,
    `Ocasión: ${peticion.ocasion}`,
    `Tiempo: ${textoTiempo(peticion)}`,
    'Prendas:',
    ...peticion.prendas.map((prenda, i) => textoPrenda(referencias[i] ?? '', prenda)),
  ].join('\n')
}
