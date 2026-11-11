import type { PrendaABuscar } from './tipos.ts'

// Prompt del laboratorio de grounding (S9). Sin esquema: con la búsqueda, Gemini 2.5 no lo admite.
export const INSTRUCCION_FICHA = `Eres el buscador de Percha, un armario digital.
Recibes la foto de UNA prenda y lo que se sabe de ella (marca, referencia, tipo, corte, colores).
Busca en Google la ficha de esa prenda en la web de la tienda o de la marca (no en blogs, foros ni
marketplaces de segunda mano salvo que no haya otra cosa).

Responde SOLO con un objeto JSON, sin texto antes ni después:
{"candidatas": [{"nombre": "…", "tienda": "…", "enlace": "https://…", "foto": "https://…"}]}

- De 0 a 3 candidatas, de la más a la menos probable. Si no encuentras nada fiable, "candidatas": [].
- enlace: la URL de la ficha del producto, tal cual la has encontrado. Nunca te la inventes.
- foto: la URL de la imagen principal de catálogo de esa ficha; null si no la tienes.
- nombre: el nombre del producto en la tienda. tienda: el nombre de la tienda o marca.
- Con referencia, dale prioridad: en Zara «4085/021» aparece en la URL como «p04085021».`

/** El texto que acompaña a la foto: solo lo que hay. */
export function textoFicha(prenda: PrendaABuscar): string {
  const lineas = [
    `Tipo: ${prenda.subcategoria || prenda.categoria}`,
    prenda.colores.length > 0 && `Colores: ${prenda.colores.join(', ')}`,
    prenda.marca && `Marca: ${prenda.marca}`,
    prenda.referencia && `Referencia: ${prenda.referencia}`,
    prenda.corte && `Corte: ${prenda.corte}`,
  ]
  return lineas.filter(Boolean).join('\n')
}
