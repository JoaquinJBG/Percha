Motor de outfits por reglas, sin IA ni UI (D8: reglas primero y la IA elige entre candidatos).

## API (`index.ts`)

- `candidatos({ prendas, estilo, ocasion, tiempo, fecha? })` → `{ contexto, candidatos, descartadas, avisos }`.
  `candidatos` va ordenado de más a menos `puntos`; cada uno lleva `ajuste` (`pleno` | `parcial`) y
  `motivos` cortos. `descartadas` dice por qué sobra cada prenda. Es lo que T2.3 le pasa a la IA.
- `cuatroOutfits(peticion, semilla = 1)` → `{ contexto, outfits, avisos }`. Hasta 4 outfits distintos, cada
  uno con `prendas` (en orden de collage: base, abrigo, calzado, accesorio), `principal`, `puntos` y
  `motivo` («abrigo por 8 °C, formal para trabajo, business»). La misma semilla da siempre lo mismo.
- `contexto`: temperatura (sensación media), precipitación, si hace falta abrigo, temporada, rango de
  formalidad y estilos afines. Sirve para el texto de la IA y para la cabecera de la pantalla.
- `avisos`: frases para el usuario («te falta calzado (con lluvia no va calzado abierto)»). Nunca se lanza
  un error por falta de prendas.
- Las funciones son genéricas: reciben `Prenda` (o cualquier cosa con sus campos) y devuelven los mismos
  objetos, con sus fotos, sin copiarlos.

## Reglas

1. **Temperatura**: sensación térmica media del día. Cada categoría espera un nivel de abrigo (1–5); a 3 o
   más niveles de distancia se descarta, a 2 puntúa menos. Por debajo de 16 °C lleva abrigo.
2. **Lluvia o nieve**: lleva abrigo; fuera calzado abierto (sandalias, chanclas, alpargatas) y ante,
   serraje o terciopelo, mirando la subcategoría y las notas. Suma lo que diga «agua» o «impermeable».
3. **Temporada**: con tiempo solo puntúa; sin tiempo, descarta lo que es solo de la temporada opuesta.
4. **Ocasión**: cada una pide un rango de formalidad. Un punto por encima se tolera; uno por debajo es
   `parcial`; a dos o más, fuera. Suma si la prenda está etiquetada para esa ocasión.
5. **Estilo**: exacto suma más que afín (tabla simétrica en `estilos.ts`); sin estilos vale para todo; otro
   estilo es `parcial`. Las parciales solo se usan si en su categoría no hay plenas.
6. **Composición**: superior + inferior o vestido, más calzado, más abrigo si hace falta, más un accesorio
   si combina. Sin base o sin calzado no sale ningún outfit; sin abrigo salen igual, con aviso.
7. **Colores**: neutros con todo, como mucho un color fuerte y una prenda estampada; el vaquero es neutro.
8. **Variedad**: no se repite la parte de arriba ni el vestido si se puede; luego la de abajo; los
   complementos se repiten lo menos posible.

`ejemplo.ts` imprime los 4 outfits del armario de ejemplo en varios días:
`node --experimental-strip-types src/outfits/reglas/ejemplo.ts`.
