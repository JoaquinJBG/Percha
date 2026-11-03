Motor de outfits por reglas, sin IA ni UI (D8: reglas primero y la IA elige entre candidatos).

## API (`index.ts`)

- `candidatos({ prendas, estilo, ocasion, tiempo, fecha? })` → `{ contexto, candidatos, descartadas, avisos }`.
  `candidatos` va ordenado de más a menos `puntos`; cada uno lleva `ajuste` (`pleno` | `parcial`) y
  `motivos` cortos. `descartadas` dice por qué sobra cada prenda. Es lo que T2.3 le pasa a la IA.
  `fecha` (`AAAA-MM-DD`, fecha **local**, no `toISOString()`) solo se usa sin `tiempo`, para la temporada,
  y entonces se supone el hemisferio norte.
- `mejoresPorCategoria(candidatos, n)`: las `n` mejores de cada categoría, para no gastar cupo de la IA.
- `comprobarOutfit(ids, resultadoDeCandidatos)` → `{ prendas }` en orden de collage o `{ error }`: valida
  un outfit que elija la IA (base, un calzado, abrigo si hoy hace falta y lo hay, hasta 2 accesorios).
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
   más niveles se descarta (a 2 si sobra en abrigos y accesorios), a 2 puntúa menos. Por debajo de 16 °C
   lleva abrigo y no hay pantalón corto; por debajo de 14 °C, nada de calzado abierto.
2. **Lluvia o nieve**: abrigo salvo que haga 24 °C o más; fuera calzado abierto (sandalias, chanclas,
   alpargatas) y ante, serraje o terciopelo (subcategoría, o «de ante» en las notas). Suma lo que diga
   «agua» o «impermeable» en la subcategoría. En casa no cuenta el tiempo de fuera.
3. **Temporada**: con tiempo solo puntúa; sin tiempo, descarta lo que es solo de la temporada opuesta.
4. **Ocasión**: cada una pide un rango de formalidad. Un punto por encima se tolera; uno por debajo es
   `parcial`; a dos o más, fuera. Suma si la prenda está etiquetada para esa ocasión.
5. **Estilo**: exacto suma más que afín (tabla simétrica en `estilos.ts`); sin estilos vale para todo; otro
   estilo es `parcial` (y fuera si además es algo informal). Las parciales solo se usan si en su categoría
   no hay plenas.
6. **Composición**: superior + inferior o vestido, más calzado, más abrigo si hace falta, más un accesorio
   si combina. Sin base o sin calzado no sale ningún outfit; sin abrigo salen igual, con aviso.
7. **Colores**: neutros con todo; un solo color fuerte, salvo los de una prenda (estampada) si el resto
   repite como mucho uno de ellos; una sola estampada; el vaquero es neutro.
8. **Variedad**: no se repite la parte de arriba ni el vestido si se puede; luego la de abajo; los
   complementos se repiten lo menos posible. Con armarios grandes combina las 40 mejores de arriba y de
   abajo.

`ejemplo.ts` imprime los 4 outfits del armario de ejemplo en varios días:
`node --experimental-strip-types src/outfits/reglas/ejemplo.ts`.
