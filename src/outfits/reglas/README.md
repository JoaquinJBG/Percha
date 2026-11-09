Motor de outfits por reglas, sin IA ni UI (D8: reglas primero y la IA elige entre candidatos). Desde
T6.2 monta la parte de arriba **por capas** (D18 y §1 de `docs/investigacion/reglas-outfits.md`).

## API (`index.ts`)

- `candidatos({ prendas, estilo, ocasion, tiempo, fecha? })` → `{ contexto, candidatos, descartadas, avisos }`.
  `candidatos` va ordenado de más a menos `puntos`; cada uno lleva `ajuste` (`pleno` | `parcial`),
  `motivos` cortos, `capas` (los papeles que puede hacer **hoy**: `base`, `media`, `exterior`; vacío si no
  es de arriba) y `opcional` (solo va encima y hoy no hace falta: tercera pieza). `descartadas` dice por
  qué sobra cada prenda. `fecha` (`AAAA-MM-DD`, fecha **local**) solo se usa sin `tiempo`, para la
  temporada, y entonces se supone el hemisferio norte.
- `mejoresPorCategoria(candidatos, n)`: las `n` mejores de cada categoría, para no gastar cupo de la IA.
- `comprobarOutfit(ids, resultadoDeCandidatos)` → `{ prendas, ranuras, principal }` o `{ error }`: valida
  un outfit que elija la IA y le **reparte las capas** (prueba todos los órdenes de lo de arriba). Pide base
  + inferior o vestido, un calzado, la exterior si hoy hace falta y la hay, hasta 3 accesorios y 8 prendas,
  y que la pila cumpla las reglas duras.
- `cuatroOutfits(peticion, semilla = 1)` → `{ contexto, outfits, avisos }`. Hasta 4 outfits distintos, cada
  uno con `prendas` y `ranuras` (de dentro afuera: base o vestido, medias, exterior, inferior, calzado,
  accesorio; `prendas[0]` es siempre `principal`), `puntos` y `motivo` («con sobrecamisa para 18 °C,
  informal para diario, casual»). La misma semilla da siempre lo mismo.
- `ranurasDe(outfit)`: las `ranuras` del outfit o, si no las trae (outfits guardados de antes o de la IA),
  deducidas del orden y la categoría. Lo usa el collage.
- `contexto`: temperatura (sensación media), precipitación, `necesitaAbrigo` (exterior obligatoria),
  `terceraPieza`, temporada, rango de formalidad y estilos afines.
- `avisos`: frases para el usuario («te falta calzado (con lluvia no va calzado abierto)»). Nunca se lanza
  un error por falta de prendas.
- Las funciones son genéricas: reciben `Prenda` (o cualquier cosa con sus campos) y devuelven los mismos
  objetos, con sus fotos, sin copiarlos.

## Reglas

1. **Temperatura**: sensación térmica media del día. Lo de abajo, el calzado y los accesorios esperan un
   nivel de abrigo (1–5); a 3 o más niveles se descarta (a 2 si sobra en abrigos y accesorios). Lo de
   arriba solo se descarta si abriga de más: si se queda corto, se le pone otra capa. Por debajo de 16 °C
   no hay pantalón corto; por debajo de 14 °C, nada de calzado abierto.
2. **Capas por temperatura** (`clima.ts`): por debajo de `LIMITE_EXTERIOR = 14` °C, exterior obligatoria;
   hasta `LIMITE_TERCERA_PIEZA = 23` °C, una media o una exterior que abrigue 3 o menos es opcional; por
   encima, solo la base (con lluvia, también un chubasquero fino). El abrigo de toda la parte de arriba
   (la capa más gruesa + 1 por capa de más) tiene que caer en el rango de `rangoArriba`.
3. **Reglas de capa** (`pilas.ts`): 1 base (o vestido) + 0–2 medias + 0–1 exterior, y cada prenda solo en un
   papel que tenga (`capas`, o las de por defecto con `capasDe`). Duras: de fino a grueso con un nivel de
   margen (C1), 4 capas solo con ≤3 °C y una fina (C2), el abrigo largo siempre fuera y una chaqueta de
   media solo bajo un abrigo largo (C3, C4), un solo estampado (C9), las prohibidas de C10, camisa abierta
   solo sobre camiseta, nada de partes de arriba sobre un vestido, jersey o sudadera nunca encima de otra
   capa, con lluvia la exterior es un abrigo, y con ≤3 °C un abrigo de verdad. Blandas: C1 suave, C5, C6,
   C7, C8, C13 y el abrigo justo; C11 y C12 salen como consejo en el motivo.
4. **Lluvia o nieve**: exterior salvo que haga 24 °C o más; fuera calzado abierto y ante, serraje o
   terciopelo. Suma lo que diga «agua» o «impermeable» en la subcategoría. En casa no cuenta el tiempo de
   fuera y no hay exterior.
5. **Temporada**: con tiempo solo puntúa; sin tiempo, descarta lo que es solo de la temporada opuesta.
6. **Ocasión y estilo**: rango de formalidad por ocasión (un punto por encima se tolera, uno por debajo es
   `parcial`, dos fuera); estilo exacto, afín (tabla simétrica en `estilos.ts`) o `parcial`. Las parciales
   solo se usan si no hay plenas para ese papel.
7. **Colores**: neutros con todo; un solo color fuerte, salvo los de una prenda estampada si el resto
   repite como mucho uno de ellos; el vaquero es neutro.
8. **Variedad**: no se repite la base ni el vestido si se puede; luego la de abajo; la capa de fuera no es
   la misma en los cuatro si hay otra que valga, y lo demás se repite lo menos posible. Una base con la que
   no encaja ninguna capa se salta. Con armarios grandes combina las 40 mejores bases e inferiores y las
   12 mejores medias y exteriores.

`ejemplo.ts` imprime los 4 outfits del armario de ejemplo con capas en varios días:
`node --experimental-strip-types src/outfits/reglas/ejemplo.ts`.
