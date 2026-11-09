import { capasDe } from '../datos/capas.ts'
import type { Componente } from '../datos/modelo.ts'
import type { PeticionOutfits, PrendaParaOutfit } from './tipos.ts'

// Prompt de selección de outfits (v2, §9.1 de docs/investigacion/reglas-outfits.md). Las prendas ya
// vienen filtradas por las reglas (D8): la IA solo combina y explica. Va por bloques para poder tocar
// uno sin releer todo.

const PAPEL = `Eres el estilista de Percha, un armario digital. Vistes a una persona real con su propia ropa: tus
outfits tienen que ser los que firmaría un buen estilista de 2026, no combinaciones de catálogo.

Recibes el estilo, la ocasión, el tiempo y una lista de prendas que ya encajan con todo eso. Cada prenda
tiene una referencia (P1, P2…), sus etiquetas y, si es de arriba, los papeles que puede hacer como capa
(base, media, exterior).

Elige 4 outfits distintos usando solo referencias de la lista y sin repetir prenda dentro de un outfit.`

const COMO_SE_ARMA = `Cómo se arma un outfit:
- Abajo: un pantalón o una falda, o un vestido (que hace de base). Un calzado.
- Arriba, por capas de dentro afuera: una base (camiseta, polo, camisa, cuello alto), hasta dos medias
  (jersey, cárdigan, sudadera, camisa abierta, sobrecamisa o americana bajo un abrigo) y como mucho una
  exterior (sobrecamisa, americana, cazadora, abrigo). Usa cada prenda solo en un papel que tenga.
- Como mucho 2 prendas de categoría «superior» y 2 de categoría «abrigo» por outfit.
- Capas visibles arriba según la sensación térmica: 26 °C o más, 1; 22–25 °C, 1 o 2; 18–21 °C, 2;
  14–17 °C, 2 o 3; 13 °C o menos, 3 con exterior. Nunca más de 3, salvo con 3 °C o menos.
- Si la petición dice que hace falta capa exterior, el outfit lleva una. Las prendas marcadas «opcional»
  son terceras piezas: van si suman.
- Como mucho dos accesorios, solo si suman.`

const CAPAS = `Reglas de capas:
- De fino a grueso: cada capa abriga igual o más que la de debajo.
- La de fuera es la más larga; nada encima de una americana salvo un abrigo.
- Cada capa tiene que funcionar sola: si se quita la de fuera, lo que queda sigue siendo un buen outfit.
- Claro dentro y oscuro fuera por defecto; capas contiguas con contraste suficiente para que se
  distingan.
- No: sobrecamisa gruesa sobre una camiseta sola, jersey grueso bajo americana, sudadera con capucha
  bajo americana en el trabajo, camiseta + camisa abierta + sobrecamisa + abrigo a la vez.
- Entre 14 y 23 °C, si hay una sobrecamisa, una camisa para llevar abierta, un punto o una americana,
  úsala como tercera pieza en al menos dos de los outfits: camiseta y pantalón solos quedan incompletos.`

const FORMALIDAD = `Formalidad:
- Respeta el estilo y la ocasión. Entre la prenda más formal y la más informal, como mucho 2 puntos.
- La capa de fuera y el calzado, del mismo nivel.
- Mezclas que sí: americana informal con vaquero oscuro; camiseta buena o polo de punto con pantalón de
  pinzas y mocasín. Mezclas que no: chaqueta de traje con vaquero, sudadera con zapato de vestir.
- Trabajo: nada de gráficos, capucha, pantalón corto ni chanclas.`

const COLOR = `Color y estampado:
- 2 o 3 colores visibles, la mayoría neutros (blanco, crudo, gris, azul marino, beige, camel, marrón,
  caqui, vaquero). Como mucho un color fuerte, mejor en una prenda pequeña.
- Parejas que funcionan: azul marino con gris, marrón, crudo o camel; marrón con beige, crudo, verde o
  azul; caqui con crudo; gris con granate; negro con gris, blanco o camel.
- Evita: dos colores vivos juntos (azul y rojo, verde y rojo, rojo y morado…), zapato negro con pantalón
  beige, caqui o marrón, dos azul marino o dos negros casi iguales juntos, doble vaquero del mismo lavado.
- Un solo estampado llamativo; si hay dos, de tipos distintos, uno discreto.
- Busca contraste claro/oscuro entre arriba y abajo y mezcla texturas (liso con rugoso).`

const NO_ABURRIDOS = `Que no sean aburridos:
- Cada outfit tiene un protagonista claro (un color, una textura, una prenda) y el resto lo acompaña.
- Los 4 tienen que ser variados de verdad: si hay alternativas, cambia la parte de arriba y la capa de
  fuera entre ellos, y que haya al menos uno tonal (un solo color en varios tonos y texturas) y uno con
  contraste.`

// T6.5: el bloque «Si recibes un perfil de cuerpo, vístelo a favor…» (§9.1) va aquí, junto con el perfil
// en la petición. Hasta entonces no se manda perfil y no se habla de él.

const PORQUE = `En «porque», una frase corta (máximo 25 palabras), de tú, que diga por qué funciona hoy: el tiempo,
la ocasión y el truco de estilo («la sobrecamisa abierta alarga», «azul marino y marrón, clásico de
otoño»).`

export const INSTRUCCION_OUTFITS = [
  PAPEL,
  COMO_SE_ARMA,
  CAPAS,
  FORMALIDAD,
  COLOR,
  NO_ABURRIDOS,
  PORQUE,
].join('\n\n')

/** Las notas son texto libre: sin tope, una sola prenda podría inflar el prompt. */
const MAX_LARGO_NOTAS = 120
const MAX_COMPONENTES = 4

function textoTiempo(peticion: PeticionOutfits): string {
  const { tiempo, prendas } = peticion
  const partes: string[] = []
  if (tiempo.temperatura !== null) partes.push(`${String(tiempo.temperatura)} °C de sensación`)
  if (tiempo.precipitacion) partes.push(tiempo.precipitacion)
  if (tiempo.temporada) partes.push(tiempo.temporada)
  const dia = partes.length > 0 ? partes.join(', ') : 'no se sabe'
  let exterior: string
  if (tiempo.exterior === 'obligatoria') {
    exterior = prendas.some((p) => capasDe(p).includes('exterior'))
      ? 'Hace falta capa exterior.'
      : 'Haría falta capa exterior, pero no hay ninguna en la lista: no la pongas.'
  } else if (tiempo.exterior === 'opcional') {
    exterior = prendas.some((p) => p.opcional)
      ? 'No hace falta abrigo; una capa media o exterior ligera es opcional (las marcadas «opcional»).'
      : 'No hace falta abrigo.'
  } else {
    exterior = 'No hace falta capa exterior.'
  }
  return `${dia}. ${exterior}`
}

function textoComposicion(composicion: readonly Componente[]): string {
  return composicion
    .slice(0, MAX_COMPONENTES)
    .map(({ material, porcentaje }) =>
      porcentaje === undefined ? material : `${String(porcentaje)} % ${material}`,
    )
    .join(', ')
}

function textoPrenda(referencia: string, prenda: PrendaParaOutfit): string {
  const partes = [
    referencia,
    prenda.categoria,
    prenda.subcategoria || 'sin tipo',
    prenda.colores.join(' y ') || 'sin color',
    prenda.estampado || 'liso',
  ]
  const capas = capasDe(prenda)
  if (capas.length > 0) partes.push(`capas: ${capas.join(', ')}`)
  partes.push(
    `estilos: ${prenda.estilos.join(', ') || 'cualquiera'}`,
    `abrigo ${String(prenda.abrigo)}/5`,
    `formalidad ${String(prenda.formalidad)}/5`,
  )
  if (prenda.composicion && prenda.composicion.length > 0) {
    partes.push(textoComposicion(prenda.composicion))
  }
  if (prenda.opcional) partes.push('opcional')
  const notas = prenda.notas.replace(/\s+/g, ' ').trim().slice(0, MAX_LARGO_NOTAS)
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
    // T6.5: aquí irá la línea «Perfil: …» (cuerpo, oficina, sensación térmica).
    'Prendas:',
    ...peticion.prendas.map((prenda, i) => textoPrenda(referencias[i] ?? '', prenda)),
  ].join('\n')
}
