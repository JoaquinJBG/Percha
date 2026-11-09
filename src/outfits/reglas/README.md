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
  deducidas del orden, la categoría y los papeles. Lo usa el collage.
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
   margen (C1); 4 capas solo con ≤3 °C y una fina (C2); el abrigo largo siempre fuera y una chaqueta de
   media solo bajo un abrigo largo (C3, C4); una chaqueta encima de todo es la exterior; un solo
   estampado (C9); las prohibidas de C10 (la sudadera bajo la americana, en toda ocasión arreglada); camisa
   + chaqueta bajo el abrigo (C13); camisa abierta solo sobre camiseta; sobre un vestido, ni camiseta, ni
   camisa, ni sudadera; nunca dos jerséis o sudaderas uno encima de otro; y el abrigo de toda la parte de
   arriba por encima de `rangoArriba`. Las que piden algo mejor solo descartan si el armario lo tiene
   (`Recursos`): bajo 14 °C o con lluvia la exterior es de la categoría abrigo, bajo 9 °C un abrigo de
   verdad (largo o de abrigo 4 o más), y el poco abrigo arriba solo si hay más capas que poner. Si así no
   sale ningún outfit, se vuelve a probar sin exigir y se avisa («con lo que tienes no vas del todo
   abrigado para 2 °C»). Blandas: C1 suave, C5, C6, C7, C8, el abrigo flojo bajo 9 °C y el abrigo justo;
   C11 y C12 salen como consejo en el motivo.
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
   12 mejores medias y exteriores, más los 4 mejores abrigos aunque puntúen menos. Con la exterior
   obligatoria, repetir abrigo no resta.

9. **Perfil** (T8.4, `perfil.ts` y `cuerpo.ts`; `Peticion.perfil` con el cuerpo, la oficina y la sensación
   térmica). Sin perfil, todo sale igual que antes.
   - **Sensación térmica**: las decisiones usan `contexto.temperaturaVestir` = sensación + 2 °C si es
     caluroso, −2 °C si es friolero (`ajusteTermico`). Es lo mismo que bajar 2 °C (caluroso) o subir 2 °C
     (friolero) `LIMITE_EXTERIOR`, `LIMITE_TERCERA_PIEZA`, `LIMITE_PUNTO_GRUESO` y el rango de abrigo de
     arriba. Los motivos siguen diciendo la temperatura de verdad.
   - **Oficina**: en «trabajo», formalidad 4–5 (conservadora), 3–4 (estándar) o 2–3 (creativa); el viernes
     casual baja un punto (`formalidadTrabajo`).
   - **Silueta** (con `corte`, siempre): amplio arriba y abajo resta (salvo streetwear e y2k); amplio con
     ajustado suma. Cuenta ya al elegir la base y la parte de abajo.
   - **Cuerpo** (`tipoCuerpo`: `grande` con complexión grande o atlética, IMC ≥ 28 o «hombros anchos» en las
     notas): B1 (pitillo −3, recto o relaxed +1), B2 (todo amplio resta más), B3 (capa abierta encima, con
     consejo en el motivo), B4 (columna de color en trabajo y minimalista), B5 (arriba claro y abajo
     oscuro), B6 (escote abierto, cuello alto), B7 (calzado con presencia), B8 (abrigo largo en trabajo o
     estilos arreglados), B9 (raya vertical mejor que horizontal, nada de gráfico), B10 (punto fino bajo
     estructura, no dos capas gruesas) y B11 (sudadera sin capa ni pantalón sastre). Todas blandas.

`ejemplo.ts` imprime los 4 outfits del armario de ejemplo con capas en varios días:
`node --experimental-strip-types src/outfits/reglas/ejemplo.ts`.
