# S9 — Laboratorio de grounding

Fecha: 2026-11-11 · Rama: `spike/s9-grounding` (sale de `integra/fases-6-7-8`) · Pantalla: `/laboratorio`

**Estado:** 👀 El laboratorio está hecho y probado con el proveedor falso en `pnpm dev` a 375 px. **Falta la
prueba de verdad**, que solo puede hacer el usuario en su móvil con su clave: pasos abajo.

## Qué se quiere saber

Si Gemini con la búsqueda de Google (*grounding*), que es gratis en `gemini-2.5-flash` y no en Gemini 3
([S4](s4-probador-y-etiquetas.md) §3, punto 7; D12), encuentra la **ficha de la tienda** de las prendas del
usuario a partir de la foto y lo que se sabe (marca, referencia, tipo, corte, colores). Si acierta lo bastante,
T9.1 lo convierte en «Buscar la ficha» dentro de la app; si no, se queda la búsqueda manual de T5.1.

## Cómo está hecho

- **`ProveedorIA.buscarFicha(prenda, { signal })`** (`src/ia/gemini.ts`):
  - manda la primera foto (recortada si la hay, a 768 px) y un texto con tipo, colores, marca, referencia y
    corte;
  - usa siempre `gemini-2.5-flash` con `tools: [{ googleSearch: {} }]` y `temperature: 0`, aunque en Ajustes
    haya otro modelo;
  - con la búsqueda, Gemini 2.5 no admite salida con esquema, así que el JSON va en el texto. Se lee aunque
    venga entre `` ```json `` o con texto alrededor, y se valida con Zod candidata a candidata
    (`src/ia/esquema-ficha.ts`).
- **Qué devuelve:**
  - hasta 3 candidatas (nombre, tienda, enlace, foto de catálogo), solo con enlaces `http(s)`, sin
    repetidas;
  - las **fuentes** que Google dio a Gemini (`groundingChunks`: son enlaces de Google que redirigen a la
    página);
  - lo que buscó (`webSearchQueries`), los tokens y el tiempo.
- **Errores** (`ErrorIA`):
  - nuevo `de-pago` para el 429 con límite gratis 0 (`limit: 0`): es lo que pasaría si la búsqueda no fuera
    gratis. Todo 429 dice «check your plan and billing», así que eso no sirve para distinguirlo;
  - `sin-cupo` para el 429 normal;
  - los de siempre para clave mala, sin red y JSON que no se entiende (`respuesta`).
- **Pantalla `/laboratorio`** (`src/pantallas/laboratorio/`):
  - se llega desde Ajustes: **5 toques seguidos** en el pie «Percha · tus datos se quedan en este móvil» y
    sale el enlace «Laboratorio»;
  - se eligen hasta 10 prendas y «Buscar las fichas» va de una en una, con 6 s entre peticiones;
  - cada candidata sale con su enlace y su foto de catálogo en un `<img>` directo (sin Referer). Percha no
    hace `fetch` a ninguna tienda;
  - el usuario marca **Acierto**, **A medias** o **Fallo**;
  - sin cupo, de pago o sin clave, la prueba para con el aviso y lo que falta sigue pendiente;
  - la prueba se guarda en el móvil (`localStorage`) y sobrevive a salir y volver;
  - **«Exportar resultados»** descarga `percha-s9-grounding-AAAA-MM-DD.json`. Lleva cada prenda (sin fotos),
    las candidatas, las fuentes, las búsquedas, el veredicto, los tokens, el tiempo y el resumen. **Nunca la
    clave.**
- Nada de scraping ni SerpAPI.

**Requisito de Google:** las condiciones del *grounding* piden enseñar las «sugerencias de búsqueda»
(`searchEntryPoint`) cuando se muestran resultados a usuarios. Para este laboratorio privado no se pintan; si
T9.1 sigue adelante, hay que hacerlo.

## Cómo hacer la prueba (en tu móvil)

La clave y las prendas están en el almacenamiento de la app publicada, que es por dominio. La prueba tiene
que ir **en la app publicada**, así que esta rama tiene que estar en `main` (la sesión jefa la integra con tu
OK). El laboratorio no se ve sin los 5 toques.

1. Cuando esté publicada, abre Percha en Chrome del móvil (la app instalada vale).
2. Mira que tienes al menos 10 prendas con foto. Mejor si 5 o más tienen **marca y referencia** (de la
   etiqueta, T5.1) y hay de varias tiendas (Zara, H&M, Uniqlo…), alguna sin marca y alguna vieja o de
   segunda mano.
3. Ve a **Ajustes**, baja al final y toca **5 veces seguidas** «Percha · tus datos se quedan en este móvil».
   Sale **Laboratorio**: tócalo.
4. En «Añadir prendas», pulsa **Añadir** en 10 prendas.
5. Pulsa **Buscar las fichas** y no salgas de la pantalla. Tarda unos 6 s más lo que tarde Gemini por
   prenda, entre 1 y 3 minutos en total.
6. En cada prenda, abre **Abrir la ficha** de las candidatas y marca:
   - **Acierto**: alguna candidata es tu prenda exacta (mismo modelo y color);
   - **A medias**: es el modelo bueno en otro color, o la tienda buena con una muy parecida;
   - **Fallo**: ninguna sirve o no encontró nada.
7. Si sale «Esto no entra en el nivel gratis… facturación», apúntalo: es el resultado (la búsqueda no es
   gratis con tu clave) y no hace falta seguir.
8. Pulsa **Exportar resultados** y pásale el JSON a la sesión jefa. No lleva la clave ni las fotos.
9. Si quieres, en Ajustes pulsa **Ocultar** junto a «Laboratorio».

**Alternativa sin publicar:** `npx -y pnpm@12.16.1 dev --host` en el PC y abrir la dirección `Network` en
el móvil con la misma wifi. Ese es otro dominio, así que el armario está vacío y no hay clave. Antes hay que:
1. en la app publicada, ir a Ajustes y pulsar «Exportar copia»;
2. en la de desarrollo, importarla y pegar la clave.

Funciona, pero deja una copia del armario y la clave en otro sitio del móvil.

## Qué se mide

- **Tasa de acierto:** aciertos de 10, y aciertos + a medias de 10.
- **Con referencia frente a sin ella:** si la referencia es lo que hace acertar.
- **Tiempo por prenda** (`ms`) y **tokens** (`tokens.total`).
- **Cupo:** si da 429 y cuál («de-pago» o «sin-cupo»), y tras cuántas peticiones.
- **Calidad de los enlaces:** si los de las candidatas abren la ficha o son inventados (404, página de
  inicio). Si fallan, si alguna **fuente de Google** sí era la ficha buena.
- **Foto de catálogo:** si se ve, que dice si el enlace de la foto es real.

## Resultados — pendiente de la prueba

| # | Prenda (tipo · marca) | ¿Referencia? | Veredicto | ¿Enlace abre la ficha? | ¿Foto se ve? | Tiempo (s) | Tokens |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |
| 9 | | | | | | | |
| 10 | | | | | | | |

**Resumen:**
- Aciertos: __ / 10. A medias: __. Fallos: __.
- Tiempo medio: __ s. Tokens totales: __.
- 429: sí / no (tipo y en qué petición).

## Criterio para hacer T9.1

- **Sí a T9.1** con **≥ 6 aciertos de 10**, sin `de-pago` y con enlaces que abren la ficha de verdad.
- **Solo con referencia** si los aciertos salen casi todos de prendas con referencia (≥ 4 de 5 con ella y
  ≤ 1 sin ella). En ese caso, en T9.1 el botón solo sale con marca y referencia.
- **No a T9.1** con < 6 aciertos, si da `de-pago`, o si los enlaces suelen ser inventados aunque las
  fuentes acierten. Se queda la búsqueda manual de T5.1 (enlaces que abre el usuario).
- **Cupo:** si con 10 peticiones ya da `sin-cupo`, T9.1 tendría que ser un botón por prenda y nunca en lote.
