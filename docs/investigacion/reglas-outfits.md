# Reglas de outfits para Percha (destilado de la investigación)

La investigación de [`moda.md`](moda.md), convertida en reglas que el motor (`src/outfits/reglas/`) y la IA
(`src/outfits/ia/`, `src/ia/prompt-outfits.ts`) pueden aplicar.

**Todo lo que cambia código o listas es una PROPUESTA**, no una decisión. Lo decide la sesión jefe con el
usuario y, si sale adelante, va a `docs/plan.md` y a «Decisiones» de `docs/spec.md`.

**Cómo leer las referencias**
- «M1A §3» = `moda.md`, parte 1A, sección 3. Ahí están las fuentes con URL.
- Cada regla dice si es **CONSENSO** (3+ fuentes), **OPINIÓN** (una) o **INFERENCIA** (deducción mía).
- Al final hay una lista corta de las fuentes clave.

---

## 0. Qué falla hoy y por qué los outfits salen básicos

Lo he comprobado leyendo el código de la rama `main` (commit `af83c97`).

| # | Qué pasa hoy | Dónde | Efecto |
|---|---|---|---|
| 1 | Un outfit lleva **exactamente 1 superior**, 1 inferior, 1 calzado, ≤1 abrigo y ≤2 accesorios | `comprobarOutfit`, `cuatroOutfits` | Imposible «camiseta + camisa abierta» o «camisa + jersey». No hay capas |
| 2 | Las prendas de `abrigo` **solo entran si hace falta abrigo** (<16 °C o lluvia) | `paraLaIA`, `cuatroOutfits` | Entre 16 y 24 °C nunca sale una sobrecamisa, una americana ni una cazadora: justo la «tercera pieza» que termina el look |
| 3 | La sobrecamisa, la americana y la cazadora son `abrigo` (así lo dice el prompt de etiquetado) | `src/ia/prompt.ts` | Con frío compiten con el abrigo: «sobrecamisa bajo abrigo» o «americana bajo abrigo» se rechaza por «más de un abrigo» |
| 4 | El color se juzga con «neutros con todo, máx. 1 color fuerte» y `granate` cuenta como `rojo` | `colores.ts` | Ve igual de bien azul + rojo vivo que marino + granate; no premia las parejas buenas ni el contraste claro/oscuro |
| 5 | La formalidad solo se mira prenda a prenda contra la ocasión | `ocasiones.ts` | Puede salir sudadera + zapato de vestir si ambos caben en el rango |
| 6 | El prompt de Gemini no sabe de capas, textura, protagonista ni cuerpo | `prompt-outfits.ts` | La IA elige entre lo que le dan con reglas de color mínimas |
| 7 | `MAX_PRENDAS_POR_OUTFIT = 6` en la respuesta de la IA | `esquema-outfits.ts` | No cabe un outfit de 3 capas + bajo + calzado + 2 accesorios (7) |

**Conclusión:** el cuello de botella no es la IA, es la **composición**. Mientras el validador solo admita
«arriba + abajo + calzado (+ abrigo)», ningún prompt dará capas.

---

## 1. Modelo de capas

### 1.1 Las cinco ranuras

Cada outfit se arma por ranuras, de dentro afuera (CONSENSO, M3 §1).

| Ranura | Qué es | Cuántas | Visible |
|---|---|---|---|
| **base** | Lo que toca la piel o la camisa que se ve | 1 (+1 interior oculta) | Sí |
| **media** | La capa de carácter: punto, camisa abierta, sobrecamisa bajo abrigo | 0–2 | Sí |
| **exterior** | Protege y da la silueta; la más larga | 0–1 | Sí |
| **inferior / vestido** | Pantalón, falda, vestido | 1 | Sí |
| **calzado** | | 1 | Sí |
| **accesorios** | Cinturón, reloj, bufanda, gorra, calcetines, bolso, gafas | 0–3 | — |

**Máximo de capas superiores visibles: 3.** La cuarta solo con ≤3 °C, y solo si es fina (chaleco, camisa
abierta fina) o queda oculta (térmica). CONSENSO (M3 §2.2).

### 1.2 Qué prenda puede ir en cada ranura

El papel **no es fijo**: depende de lo que vaya encima y del tiempo (CONSENSO, M3 §1.3). Por eso la propuesta
es guardar los **papeles posibles** de cada prenda, no uno solo.

| Subcategoría | Categoría hoy | base | media | exterior | Grosor típico (= `abrigo`) |
|---|---|---|---|---|---|
| camiseta, camiseta de tirantes | superior | ✔ | | solo con calor | 1–2 |
| camiseta de manga larga, henley, térmica | superior | ✔ | | | 2 |
| polo, polo de punto | superior | ✔ | | con calor | 2 |
| camisa (oxford, popelín, lino, vaquera, franela) | superior | ✔ cerrada | ✔ abierta sobre camiseta | con calor (lino abierta) | 2–3 |
| cuello alto fino | superior | ✔ | ✔ | | 2–3 |
| jersey fino (merino, algodón), quarter-zip | superior | a veces | ✔ | | 3 |
| jersey grueso (ochos, pescador) | superior | | ✔ (no bajo americana) | ✔ días suaves | 4 |
| cárdigan fino / grueso | superior | | ✔ | ✔ el grueso, días suaves | 3 / 4 |
| sudadera, sudadera con capucha | superior | | ✔ bajo abrigo o cazadora | ✔ | 3 |
| chaleco de punto | superior | | ✔ | ✘ nunca con frío | 2 |
| **sobrecamisa** (overshirt) | abrigo | | ✔ bajo abrigo | ✔ sobre camiseta | 3 |
| *shacket* (sobrecamisa gruesa, acolchada) | abrigo | | solo bajo abrigo amplio | ✔ (nunca sobre camiseta sola) | 4 |
| americana / blazer desestructurada | abrigo | | ✔ bajo abrigo | ✔ interior o tiempo suave | 3 |
| cazadora vaquera | abrigo | | ✔ bajo abrigo | ✔ | 3 |
| chaleco acolchado | abrigo | | ✔ bajo chaqueta | ✔ sobre jersey o sudadera | 3 |
| bomber, harrington, cazadora de piel, field jacket | abrigo | | solo si es corta y fina, bajo abrigo largo | ✔ | 3–4 |
| gabardina, trench, abrigo de paño, chaquetón, parka, plumífero | abrigo | | | ✔ siempre | 4–5 |

Fuentes: M3 §1.3 y §3; The Modest Man para sobrecamisa frente a *shacket*; Art of Manliness para la americana
como capa media bajo abrigo.

### 1.3 Reglas de capa (duras = descartan; blandas = restan o suman)

| # | Regla | Tipo | Cómo comprobarla con los datos de Percha | Nivel |
|---|---|---|---|---|
| C1 | **De fino a grueso:** cada capa abriga igual o más que la de debajo | dura | `abrigo` de media ≥ base, exterior ≥ media | CONSENSO |
| C2 | **≤3 capas superiores visibles** (4 solo con ≤3 °C y la cuarta fina) | dura | contar ranuras | CONSENSO |
| C3 | **La exterior es la más larga** (abrigo ≥ americana ≥ jersey) | dura si hay `largo`; si no, por subcategoría | sin campo `largo`: americana o cazadora nunca encima de un abrigo; nada encima de un abrigo largo | CONSENSO |
| C4 | **Nada encima de la americana** salvo un abrigo | dura | subcategoría | CONSENSO |
| C5 | **Cada capa visible vale sola**: al quitar la exterior, lo que queda es un outfit válido | blanda | volver a pasar las reglas sin la exterior | CONSENSO |
| C6 | **Claro dentro, oscuro fuera** por defecto | blanda (+) | claridad del color (§3.1) | CONSENSO |
| C7 | **Contraste entre capas contiguas**: dos azules o dos negros iguales se funden | blanda (−) | misma familia y misma claridad en capas vecinas | CONSENSO |
| C8 | **Textura: liso con rugoso**, no dos rugosas de la misma familia (pana + pana, tweed + pana + lana gruesa) | blanda (−) | `notas` o subcategoría con material | CONSENSO |
| C9 | **Un solo estampado** entre las capas (o separados por una lisa) | dura con 2 llamativos; blanda con 2 discretos | `estampado` | CONSENSO |
| C10 | **Prohibidas:** *shacket* grueso sobre camiseta sola; jersey grueso bajo americana; capucha bajo americana en trabajo; chaleco de punto como exterior con frío | dura | subcategoría + ocasión + temperatura | CONSENSO / OPINIÓN |
| C11 | **Camisa bajo jersey: cuello fuera, faldón dentro o tapado** | texto del «porque» | — | CONSENSO |
| C12 | **La exterior, abierta** si hay base o media con interés (crea línea vertical) | texto del «porque» | — | CONSENSO débil |
| C13 | **Cuatro capas «camiseta + camisa abierta + sobrecamisa + abrigo»**: evitar; quita la camisa o la sobrecamisa | blanda (−−) | patrón | CONSENSO (The Modest Man lo da como error) |

### 1.4 Patrones de capas que el motor debería saber montar

Plantillas probadas por las fuentes, con su rango de temperatura (sensación media) y ocasiones.
C = casual · SC = smart casual · T = trabajo · Ci = cita · N = noche. Detalle en M3 §3.

| Patrón | base | media | exterior | °C sin abrigo | °C con abrigo | Ocasiones |
|---|---|---|---|---|---|---|
| P1 Tercera pieza | camiseta / polo | — | sobrecamisa abierta | 16–22 | 4–12 (sobrecamisa pasa a media) | C, SC, T creativa, Ci |
| P2 Camisa abierta | camiseta lisa | — | camisa abierta (lino, vaquera, franela) | 20–28 lino · 15–20 franela | — | C, Ci casual |
| P3 Cuello fuera | camisa (OCBD mejor) | jersey fino redondo o de pico | (americana) | 12–17 | 3–11 | SC, T, Ci |
| P4 Punto + americana | polo de punto, merino, camiseta buena | — | americana desestructurada | 15–21 | ≤14 | SC, T, Ci, N |
| P5 Cárdigan | camisa | cárdigan | — | 14–19 | 5–12 | SC, T, Ci |
| P6 Sudadera arreglada | (camiseta) | sudadera sin logo | abrigo largo (raglán mejor) | — | 3–12 | C, SC con pantalón sastre |
| P7 Cuello alto | cuello alto fino | (americana) | americana o abrigo | 10–15 con americana | 0–10 | SC, T, Ci, N |
| P8 Chaleco | jersey o sudadera | — | chaleco acolchado abierto | 10–16 | — | C |
| P9 Vaquera bajo abrigo | camiseta / camisa / punto fino | cazadora vaquera | abrigo | 15–20 (vaquera sola) | 5–12 | C, SC, Ci |
| P10 Americana bajo abrigo | camisa / punto | americana | abrigo que la cubra | — | 3–10 | SC, T, Ci, N |
| P11 Camiseta + jersey | camiseta | jersey | (abrigo) | 12–17 | 3–11 | C |

### 1.5 Capas según la temperatura

Tabla de síntesis para España (INFERENCIA a partir de Weathernews, OCEANS, WhetherWear, Nike; M3 §4.2).
Temperatura = la sensación media que ya calcula `temperaturaDe`.

| Sensación | Capas superiores visibles | Exterior | Plantillas preferidas | Notas |
|---|---|---|---|---|
| ≥ 26 °C | 1 | no | base sola (camiseta, polo, camisa de lino) | P2 con lino finísimo como única excepción |
| 22–25 °C | 1–2 | no | base sola; P2; P4 (americana de lino) para trabajo o cena | La tercera pieza, opcional y ligera |
| 18–21 °C | 2 | ligera | P1, P4, P5, P9 (vaquera sola) | **Tercera pieza recomendada** |
| 14–17 °C | 2–3 | ligera o media | P3, P5, P7, P8, P11; P1 con punto debajo | Abrigo ligero opcional |
| 9–13 °C | 3 | sí | P3 + abrigo, P6, P9, P10 | Exterior obligatoria |
| 4–8 °C | 3 (+ bufanda) | sí, de paño o acolchada | P3 + abrigo largo, P6, P7 + abrigo, P10 | 4.ª capa solo si es fina |
| ≤ 3 °C | 3–4 | abrigo largo o plumífero | base + punto grueso + media fina + abrigo | Bufanda y gorro |

**Ajustes** (M3 §4.2):
- **Lluvia o viento:** exterior que corte el agua o el viento; +1 nivel de abrigo. Ya existe parte de esto.
- **Mucha diferencia entre mañana y tarde** (típico en España): elegir por la mínima al salir y asegurar que
  lo de debajo vale solo (C5). PROPUESTA: usar `sensacion.minima` además de la media cuando la amplitud
  pase de ~8 °C.
- **Calor corporal:** un cuerpo de 100 kg suele acusar más el calor; podría bajar todos los umbrales 1–2 °C.
  Sin fuente: es una hipótesis para un ajuste del usuario («soy caluroso / normal / friolero»).

**PROPUESTA de umbrales para el motor** (hoy hay uno solo, `LIMITE_ABRIGO = 16`):
- `LIMITE_EXTERIOR = 14`: por debajo, exterior obligatoria (como hoy, pero 2 °C más abajo porque entre 14 y 16
  basta una media + exterior ligera).
- `LIMITE_TERCERA_PIEZA = 23`: entre 14 y 23 °C, las prendas con papel `media` o `exterior` ligera entran
  como candidatas aunque no «haga falta abrigo». Esto arregla el problema 2 del §0.

---

## 2. Formalidad

### 2.1 Escalera por prenda

La IA ya etiqueta `formalidad` 1–5. Esta tabla sirve para revisar el prompt de etiquetado y para validar
(M2 §2.2). Escala de Percha: 1 deporte/casa · 2 casual · 3 smart casual · 4 oficina formal · 5 etiqueta.

| Familia | 1 | 2 | 2.5 | 3 | 3.5 | 4 | 5 |
|---|---|---|---|---|---|---|---|
| Arriba | camiseta técnica o gráfica | camiseta lisa, henley | polo de piqué | polo de punto, OCBD, camisa casual | popelín azul | popelín blanca | camisa de esmoquin |
| Capa media | sudadera con capucha | sudadera | jersey grueso | jersey fino, cárdigan, sobrecamisa | americana desestructurada | blazer liso | — |
| Exterior | chaqueta deportiva | cazadora vaquera, bomber, chaleco acolchado | field jacket, cuero | gabardina, chaquetón | abrigo de paño | abrigo de vestir | — |
| Abajo | chándal, corto deportivo | vaquero claro, bermuda, cargo | vaquero oscuro limpio | chino, pana, pinzas de algodón | pinzas de lana | pantalón de traje | esmoquin |
| Calzado | chancla, running | lona, alpargata | zapatilla de piel limpia | chukka, Chelsea o mocasín de ante | mocasín liso, derby | oxford | charol |

Reglas útiles para el etiquetado (CONSENSO, M2 §2.1):
- **Más oscuro, más liso y más brillo = más formal.** Más textura, mate y claro = más casual.
- La **chaqueta y el calzado** son los que más mueven la formalidad.
- **Pinzas de lana = 3.5; pinzas de algodón = 3.**

### 2.2 Reglas de mezcla

| # | Regla | Tipo | Nivel |
|---|---|---|---|
| F1 | **Dispersión:** formalidad máxima − mínima del outfit ≤ 2. Si es 2, solo con las mezclas alto-bajo buenas (F3) | dura > 2; blanda = 2 | CONSENSO |
| F2 | **Exterior (o capa más formal de arriba) y calzado a ±1** | blanda (−) | OPINIÓN (Permanent Style), muy repetida |
| F3 | **Mezclas alto-bajo que funcionan:** americana casual + vaquero oscuro; camiseta buena o polo de punto + pinzas + mocasín; zapatilla de piel limpia con americana desestructurada | blanda (+) | CONSENSO |
| F4 | **Mezclas que fallan:** chaqueta de traje con vaquero; corbata con vaquero; oxford brillante con vaquero; capucha con zapato de vestir | dura | CONSENSO |
| F5 | **Smart casual = al menos una pieza ≥3 y como mucho una ≤2** («una arreglada + una casual») | blanda | CONSENSO |
| F6 | **En la duda, un escalón por encima, no tres** | criterio de desempate | CONSENSO |
| F7 | **Cinturón = zapato** en color, familia y acabado (ante con ante) cuando el calzado es de piel y la formalidad ≥3 | blanda | CONSENSO |
| F8 | **Tejido de verano con tejido de invierno** (lino + pana, lino + franela) | blanda (−) | OPINIÓN |

---

## 3. Color

### 3.1 Clases de color (sustituye a la lista `NEUTROS`)

| Clase | Colores de Percha | Comportamiento |
|---|---|---|
| **Neutro base** | blanco, crudo, gris, azul marino, beige, vaquero | Con todo |
| **Neutro cálido** | camel, marrón, caqui | Con todo; el marrón es **el neutro de 2026** |
| **Casi neutro** | celeste (en camisa), verde oscuro u oliva | Cuentan como neutros si son apagados |
| **Neutro condicional** | negro | Bien con blanco, crudo, gris, camel y vaquero; **con cuidado** con marrón oscuro, caqui y colores vivos |
| **Acento suave** | granate, rosa pálido, azul medio, amarillo mantequilla | Se admiten dos, o uno suave + uno fuerte pequeño |
| **Acento fuerte** | rojo, naranja, morado, amarillo vivo, verde vivo | Uno por outfit, mejor en prenda pequeña o media |
| **Metálico** | dorado, plateado | Accesorios; dorado con cálidos, plateado con fríos |

Fuentes: M4 §2 y §9.1 (RMRS, Sartoria Lab, Permanent Style, Gentleman's Gazette).

**Claridad típica** (para C6, C7 y el contraste de valor): claros = blanco, crudo, beige, celeste, rosa,
amarillo; medios = gris, camel, caqui, azul, verde, rojo, naranja, vaquero medio; oscuros = negro, azul
marino, marrón, granate, morado, vaquero oscuro.

### 3.2 Presupuesto de acentos (sustituye a «máx. 1 color fuerte»)

- **2–3 colores visibles**, la mayoría neutros. La camiseta interior blanca y el zapato marrón apenas cuentan
  (CONSENSO, M4 §3.3).
- **Acentos:** 1 fuerte, o 2 suaves, o 1 suave + 1 fuerte si el fuerte va en prenda pequeña (calcetín, gorra,
  bufanda) (CONSENSO, M4 §2.2).
- **Una sola prenda protagonista** (color, estampado, textura o prenda llamativa); el resto, marco neutro
  (CONSENSO, M2 §3.1).

### 3.3 Parejas: las que descartan, las que restan y las que suman

**Descartan (✗), cuando los dos son prendas grandes y vivas** (M4 §9.3):

| Pareja | Por qué |
|---|---|
| azul + rojo | Dos primarios vivos «vibran» (marino + rojo sí vale) |
| verde + rojo | «Decoración navideña» (oliva o botella + granate sí vale) |
| verde + morado | Chocan (se relaja si uno es un accesorio) |
| rojo + morado, rojo + amarillo, rojo + naranja, morado + naranja | Dos acentos fuertes de la misma intensidad |

**Restan (~)** (M4 §9.2):
- negro con marrón oscuro, caqui o colores vivos;
- negro + azul marino (salvo que el marino se lea claramente azul);
- dos prendas del **mismo neutro oscuro** de telas distintas (dos marinos, dos negros): parecen un error;
- blanco + crudo juntos sin textura distinta;
- dos colores de la misma claridad y distinto tono (azul medio + verde medio);
- doble vaquero del mismo lavado;
- metal frío con neutros cálidos, y al revés.

**Suman (parejas «muy buenas»)** (M4 §9.3-C):
marino + gris · marino + marrón · marino + blanco/crudo · oliva/caqui + crudo · marrón + beige/crudo ·
marrón + verde · marrón + azul/celeste · camel + marino · negro + gris · negro + camel · gris + granate ·
marino + granate · vaquero + blanco · gris + celeste o vaquero · marino o celeste + amarillo pálido.

La matriz completa de 21 × 21 colores está en M4 §9.2.

### 3.4 Otras reglas de color

| # | Regla | Tipo | Nivel |
|---|---|---|---|
| K1 | **Contraste claro/oscuro entre arriba y abajo** suma; dos colores fuertes de la misma claridad restan | blanda | CONSENSO |
| K2 | **Tonal o monocromo** solo si varían la claridad y la textura | blanda | CONSENSO |
| K3 | **Repetir un color** (de la prenda estampada o protagonista en otra prenda) suma | blanda (+) | CONSENSO débil |
| K4 | **Vaquero:** neutro, pero el doble denim necesita lavados distintos (oscuro con medio o claro, no claro con claro) | dura con mismo lavado | CONSENSO |
| K5 | **Zapato según el pantalón:** negro con negro, gris o marino; **no negro** con beige, caqui, oliva o marrón; el marrón es el comodín | blanda | CONSENSO (Sartoro, GG, RMRS) |
| K6 | **Calcetín = pantalón** por defecto; sin calcetín solo con mocasín o alpargata, en casual y con calor | texto | CONSENSO probable |
| K7 | **Estación:** tierra y profundos en otoño-invierno; claros, pastel y especias en primavera-verano | blanda | CONSENSO |
| K8 | **Negro de pies a cabeza** solo para noche o minimalista, con texturas distintas | blanda | CONSENSO |

### 3.5 Estampados (sustituye a «máx. 1 estampada»)

- **Liso = ancla.** Como máximo 2 estampados por outfit (CONSENSO, M4 §6.1).
- Si son 2: de **familias distintas** (rayas + cuadros) o de la misma con **escala muy distinta**, y **uno
  discreto**. Suma si comparten un color.
- **Nunca 2 «llamativos»**: animal, camuflaje, tie-dye, gráfico grande, flores grandes, geométrico tipo Fair
  Isle. Estos van solos.
- **Textura cuenta como estampado discreto** (pana, punto de ochos, tweed).
- **En el trabajo**, nada de gráfico o logo, ni flores llamativas (España: muy consciente del contexto; M6 §4).
- Hoy no hay dato de escala: hace falta el campo propuesto en §8.

---

## 4. Reglas por estilo

Qué debe pedir o evitar el motor cuando el usuario elige cada estilo. Resumen de M1A y M1B.
«Plantilla» = la combinación tipo que el motor debería intentar primero.

| Estilo | Suman | Paleta | Plantilla | Lo rompen |
|---|---|---|---|---|
| **Casual** | camiseta gruesa lisa, sobrecamisa, vaquero recto, OCBD, chambray, punto con textura, zapatilla de piel, chukka | índigo, gris, crudo, oliva, piedra, marrón | camiseta + sobrecamisa abierta + vaquero + zapatilla (P1) | ropa de gimnasio, zapatilla gastada, camiseta sola sin capa, gráfico grande, doble vaquero del mismo tono |
| **Smart casual** | americana desestructurada, polo de punto, pinzas, chino bueno, vaquero oscuro, mocasín de ante | marino, gris, piedra, blanco, azul claro; marrones y tonal | punto + americana + pinzas + mocasín (P4) | vaquero roto, capucha, running, chaqueta de traje con vaquero, corbata sin chaqueta |
| **Elegante / formal** | traje marino o carbón (o marrón), popelín blanca, corbata, oxford o derby, abrigo a la rodilla | marino, carbón, chocolate; camisa blanca o azul | traje + camisa + corbata + oxford | solapa estrecha, pitillo, brillos, logos, negro de día; en etiqueta: ante, cinturón con esmoquin |
| **Business** | blazer marino, franela gris, chino, OCBD o popelín, jersey fino, derby o mocasín | marino, gris, carbón, beige; acento en corbata o pañuelo | camisa + jersey fino + pinzas + derby (P3) o blazer + pantalón gris (M6 §4) | gimnasio, chanclas, gráficos, camisa negra, zapatilla delante de clientes tradicionales |
| **Minimalista** | básicos bien cortados, punto fino, pantalón de lana, abrigo limpio, zapatilla blanca, Chelsea | 2–3 neutros; un solo acento | tonal con variación de textura (K2) | varios protagonistas, logos, volumen mal ajustado, tonal plano sin textura |
| **Old money / quiet luxury** | blazer marino, franela gris, cachemir, camel, mocasín, OCBD, abrigo camel | marino, carbón, camel, crema, marrón, oliva; un acento cada vez | jersey de cachemir + franela gris + mocasín de ante | logos, sintéticos brillantes, suela gruesa, disfraz de época |
| **Streetwear** | camiseta boxy, sudadera gruesa, vaquero recto u holgado, bomber, zapatilla | negro, gris, crudo, oliva; un color | **una sola pieza amplia** + resto controlado | volumen total (arriba y abajo amplios), demasiados logos |
| **Deportivo / athleisure** | quarter-zip, polo de punto, pantalón con cordón sastre, zapatilla fina | gris, marino, crudo | quarter-zip + pinzas + zapatilla fina | chándal de gimnasio fuera del gimnasio |
| **Gorpcore** | chaleco acolchado, cortavientos técnico, forro polar, bota o zapatilla de montaña | tierra, oliva, «soft outdoor» | técnico con natural (sudadera + chaleco + chino) | todo técnico y brillante a la vez |
| **Preppy** | OCBD, jersey de pico o de ochos, chino, blazer, mocasín, polo | marino, crema, verde, granate; rayas | OCBD + jersey de pico + chino + mocasín | logos gigantes, todo nuevo y conjuntado |
| **Workwear / americana** (no está en la lista) | chore coat, vaquero de peso, camisa de trabajo, bota moc-toe | índigo, marrón, oliva, crudo | chore coat + jersey de pescador + vaquero + bota | ropa nueva y brillante, demasiado limpio |
| **Mediterráneo / verano** | camisa de lino, polo de punto, pantalón de lino con cordón, mocasín sin calcetín visible | blanco, crudo, celeste, arena, marino | camisa de lino abierta + pantalón claro + mocasín | negro total con calor, chancla fuera de la playa |

Notas para el motor:
- **«Old money» es atemporal, no tendencia**: GQ (sept. 2026) lee la pasarela SS27 como el final del *quiet
  luxury* (M6 §3). No retirar el estilo; sí evitar que todo salga beige.
- **En minimalista y business, premiar la columna de color** (tonos cercanos de arriba abajo).
- **Workwear / americana falta en la lista de estilos** y sale fuerte en 2026 (propuesta §8).

---

## 5. Reglas por ocasión

Formalidad propuesta frente a la de hoy (`FORMALIDAD_POR_OCASION`). Detalle en M2 §1.

| Ocasión | Hoy | Propuesta | Funciona | Demasiado | Se queda corto |
|---|---|---|---|---|---|
| **trabajo** (oficina estándar) | 2–4 | **3–4** (2–3 si la oficina es creativa o es viernes) | camisa + pinzas o chino + derby o mocasín; jersey fino encima; americana opcional | traje completo en oficina casual; chaqueta + chaleco + corbata | bermudas, chanclas, capucha, gráficos, vaquero roto o claro, zapatilla de running |
| **diario** | 1–3 | 1–3 | camiseta gruesa + vaquero + zapatilla; sobrecamisa encima; jersey + vaquero + bota | americana de traje con vaquero, oxford | ropa de gimnasio, prendas deformadas, chanclas en ciudad |
| **cita** | 2–4 | 2–4, según el plan (café 2, copas 3, cena buena 3.5–4) | camisa + pantalón oscuro + Chelsea o mocasín; punto + americana | esmoquin, traje y corbata en un plan casual | calcetín alto con camiseta, logos, deportivas gastadas |
| **cena** | 2–4 | 2–4 | amigos: sobrecamisa + camiseta + vaquero; restaurante: camisa + pinzas + mocasín + americana o jersey | chaqueta + chaleco + corbata | running, vaquero roto |
| **fiesta / noche** | 2–5 | 2–4 | **una pieza protagonista** (camisa llamativa, cuero, terciopelo) y lo demás limpio | esmoquin sin que se pida | ante en discoteca con lluvia, gorra en local de nivel |
| **evento formal** | 4–5 | 4–5 | traje oscuro + camisa blanca + corbata (o cuello alto) + oxford o derby | — | sin americana, vaquero, zapatilla |
| **boda** | 4–5 | 4–5, y **aviso si no hay traje** | según invitación; sin código: traje («media etiqueta») | eclipsar al novio, blanco o crudo, negro total | camisa + pinzas + chaqueta suelta (3–3.5) |
| **viaje** | 1–3 | 1–3 | cómodo pero con estructura; calzado fácil de quitar | — | pijama de calle |

Reglas de ocasión (CONSENSO salvo que se diga):
- **Trabajo:** prohibidos corto, chancla, gráfico, capucha y zapatilla de running. Zapatilla de piel solo si la
  oficina es creativa o es viernes. Primeros días: el extremo formal del rango.
- **Trabajo en verano (España):** lino, popelín ligero, lana fría; colores claros; polo de punto en oficinas
  relajadas; manga larga remangada mejor que camisa de vestir de manga corta; **nunca bermudas**.
- **Boda:** el armario del usuario no tiene traje. Mejor un aviso («para boda te falta un traje») que un
  sustituto que se queda corto.
- **Afterwork** no es cóctel: el propio look de oficina sin corbata, o con la americana cambiada por
  sobrecamisa.

---

## 6. Perfil de cuerpo (176 cm, 100 kg, hombros anchos)

Reglas para cuando el perfil diga «grande / ancho de hombros». Detalle y fuentes en
[`mi-cuerpo.md`](mi-cuerpo.md) y M5.

| # | Regla | Tipo | Nivel |
|---|---|---|---|
| B1 | **Nunca pitillo**; bajo de pantalón recto o *relaxed* (20–23 cm). Pierna muy ancha solo en streetwear y con calzado con volumen | dura / blanda | CONSENSO |
| B2 | **Una sola pieza amplia** por outfit; nada de volumen total | blanda | CONSENSO |
| B3 | **Capas abiertas** (sobrecamisa, americana, cárdigan): suman por la línea vertical; decirlo en el «porque» | blanda (+) | CONSENSO |
| B4 | **Columna de color** (tonos cercanos arriba y abajo) suma en trabajo y minimalista | blanda (+) | CONSENSO |
| B5 | **Arriba oscuro o igual, abajo igual o más claro**; evitar parte de arriba clara y voluminosa con pantalón oscuro | blanda | OPINIÓN con apoyo |
| B6 | **Escote abierto** (V, henley abierto, camisa abierta) suma; cuello alto ceñido, con poca frecuencia | blanda | CONSENSO |
| B7 | **Calzado con presencia** (derby, mocasín con suela, chukka, Chelsea); evitar la suela fina | blanda | CONSENSO |
| B8 | **Abrigo largo** (a la rodilla) en trabajo y old money; cazadora a la cadera en casual | blanda | CONSENSO |
| B9 | **Estampado de escala media, raya vertical mejor que horizontal**; nada de gráfico grande en el pecho | blanda | CONSENSO |
| B10 | **Punto fino bajo estructura** (americana, abrigo); no apilar dos capas gruesas | blanda | CONSENSO |
| B11 | **Sudadera nunca sola y floja**: con capa encima o pantalón sastre | blanda | OPINIÓN con apoyo |

---

## 7. Que no sea aburrido: lo que suma

Bonificaciones para que, entre outfits válidos, ganen los que un estilista elegiría (M2 §3, M3 §3.11).

| Señal | Cómo detectarla | Peso sugerido |
|---|---|---|
| **Tercera pieza** entre 14 y 23 °C (capa media o exterior ligera) | ranura media/exterior ocupada | alto |
| **Mezcla de texturas** (liso + rugoso; algodón + punto + ante) | material en `notas` o subcategoría | medio |
| **Un protagonista claro** (un acento, un estampado o una prenda especial) y el resto neutro | §3.2 | medio |
| **Pareja de color «muy buena»** (§3.3) | matriz | medio |
| **Repetir un color** entre dos prendas no contiguas | colores | bajo |
| **Contraste claro/oscuro** entre arriba y abajo, o claro dentro y oscuro fuera | claridad | bajo |
| **Mezcla alto-bajo buena** (F3) | subcategoría + formalidad | medio |
| **Cuero con cuero** (cinturón = zapato) | colores de accesorio y calzado | bajo |
| **Variedad entre los 4**: un look de color, uno tonal, uno con capa, uno con protagonista | entre outfits | alto (en la IA) |

### Checklist de «outfit malo»

Señales para descartar (✗) o rebajar (−). Sirven para el motor, para el prompt y para una futura revisión.

| # | Señal | |
|---|---|---|
| 1 | Pitillo en un cuerpo grande | ✗ |
| 2 | Volumen total: arriba amplio y abajo amplio | − |
| 3 | Capa gruesa bajo capa fina (`abrigo` de dentro > de fuera) | ✗ |
| 4 | Más de 3 capas visibles con más de 3 °C | ✗ |
| 5 | Algo encima de la americana que no sea abrigo; americana más larga que el abrigo | ✗ |
| 6 | *Shacket* grueso sobre camiseta sola; jersey grueso bajo americana | ✗ |
| 7 | Formalidad: diferencia > 2 entre prendas; capucha con zapato de vestir; chaqueta de traje con vaquero | ✗ |
| 8 | Dos acentos fuertes en prendas grandes (§3.3 ✗) | ✗ |
| 9 | Dos estampados llamativos; dos estampados de la misma familia y escala | ✗ |
| 10 | Doble vaquero del mismo lavado | ✗ |
| 11 | Zapato negro con pantalón beige, caqui, oliva o marrón | − |
| 12 | Dos marinos o dos negros «casi iguales» en prendas contiguas | − |
| 13 | Tonal sin variar claridad ni textura | − |
| 14 | Dos prendas rugosas de la misma familia (pana + pana) | − |
| 15 | Lino con franela o pana | − |
| 16 | Camiseta sola en trabajo o cita de noche | − |
| 17 | Gráfico, logo, capucha, corto o chancla en trabajo | ✗ |
| 18 | Calzado abierto o ante con lluvia (ya existe) | ✗ |
| 19 | Ninguna capa entre 14 y 23 °C cuando hay sobrecamisa, americana o punto disponible | − |
| 20 | Los 4 outfits casi iguales (misma capa exterior, misma paleta) | − |

---

## 8. Cambios propuestos al modelo de datos y a `docs/spec.md`

Todas son **PROPUESTAS**, ordenadas por impacto. Ninguna cambia código en esta rama.

### P1. Campo `capas` en la prenda (lo más importante)
- `capas: ('base' | 'media' | 'exterior')[]`: los papeles que **puede** hacer la prenda (§1.2).
- Lo etiqueta la IA (añadirlo al esquema y al prompt de etiquetado) y, si falta, sale por defecto de la
  subcategoría con la tabla del §1.2. Editable a mano.
- `categoria` no cambia: sigue sirviendo para filtros y para el collage.
- Alternativa más simple: deducirlo siempre de la subcategoría, sin campo nuevo. Más frágil con texto libre.

### P2. Composición con capas (`comprobarOutfit`, `cuatroOutfits`)
- Arriba: 1 base + 0–2 medias + 0–1 exterior, con las reglas C1–C13.
- Permitir **2 superiores** (base + media: camisa + jersey, camiseta + camisa abierta) y **2 abrigos** (media +
  exterior: sobrecamisa o americana bajo abrigo).
- Subir `MAX_PRENDAS_POR_OUTFIT` de 6 a **8** en `esquema-outfits.ts`.
- Orden del collage: exterior, media, base, inferior, calzado, accesorios.

### P3. Candidatas de «tercera pieza» sin frío
- `LIMITE_EXTERIOR = 14` y `LIMITE_TERCERA_PIEZA = 23` (§1.5).
- Entre 14 y 23 °C, mandar a la IA (y a `cuatroOutfits`) las prendas con papel `media` o `exterior` ligera
  (`abrigo` ≤ 3), marcadas como opcionales.

### P4. Subcategorías cerradas
Hoy la subcategoría es texto libre. Una lista cerrada por categoría (con «otro») haría fiables las reglas de
capas, formalidad y lluvia. Propuesta mínima:
- **superior:** camiseta, camiseta de manga larga, henley, polo, polo de punto, camisa, camisa de lino, camisa
  vaquera, camisa de franela, cuello alto, jersey, jersey grueso, quarter-zip, cárdigan, sudadera, sudadera con
  capucha, chaleco de punto, top.
- **abrigo:** sobrecamisa, *shacket*, americana, cazadora vaquera, cazadora de piel, bomber, harrington, field
  jacket, chaleco acolchado, cortavientos, gabardina, abrigo, chaquetón, parka, plumífero.
- **inferior:** vaquero, chino, pantalón de pinzas, pantalón de traje, pana, pantalón de lino, cargo,
  pantalón de chándal, bermuda, falda.
- **calzado:** zapatilla de piel, zapatilla de lona, zapatilla de running, mocasín, derby, oxford, chukka,
  Chelsea, bota, alpargata, sandalia, chancla.
- **accesorio:** cinturón, reloj, bufanda, gorra, gorro, calcetines, gafas, bolso, mochila, joya, corbata,
  pañuelo.

### P5. Atributos pequeños que desbloquean reglas
| Campo | Valores | Para qué regla |
|---|---|---|
| `largo` (solo abrigo y media) | cintura, cadera, muslo, rodilla, largo | C3 (exterior la más larga), B8 |
| `lavado` (solo vaquero) | oscuro, medio, claro, negro, blanco | K4 (doble denim), zapato y color |
| `escala` (solo estampados) | pequeña, media, grande | §3.5 y B9 |
| `material` o textura | algodón, lino, lana, punto, ante, piel, técnico, denim… | C8, F8, lluvia (hoy se busca en `notas`) |
| `ajuste` | ceñido, recto, amplio | B1, B2 |

### P6. Listas cerradas de `docs/spec.md`
- **Colores:** añadir **«oliva»** (en España «caqui» suele ser verde militar y en inglés *khaki* es beige: la
  IA y el usuario lo usan distinto). Definir «caqui» en el prompt de etiquetado.
- **Colores, código:** separar `granate` de `rojo` en `SINONIMOS` (`colores.ts`): el granate es un acento suave
  que combina con marino y gris; el rojo, uno fuerte.
- **Estilos:** añadir **«workwear / americana»**. Afines: casual, gorpcore, vintage / retro, preppy.
- **Estampados:** sin cambios en la lista; añadir `escala` (P5).

### P7. Perfil del usuario
- `cuerpo`: altura, peso, complexión (`atlética`, `grande`, `delgada`, `media`) y una línea libre («hombros
  anchos, muslo grande»). Va al prompt de outfits (§9) y activa las reglas B1–B11.
- `oficina`: `conservadora` | `estándar` | `creativa`, y si hay viernes casual. Ajusta el rango de «trabajo».
- `sensacionTermica`: `caluroso` | `normal` | `friolero`. Desplaza los umbrales de §1.5 1–2 °C.

### P8. Prompt de etiquetado (`src/ia/prompt.ts`)
- Mover la definición de «abrigo» a: «prendas que van encima de otra parte de arriba: sobrecamisas,
  americanas, cazadoras, chalecos acolchados, abrigos».
- Pedir `capas`, `largo`, `lavado`, `escala` y `material` (P1, P5).
- Formalidad con la escalera del §2.1 (pinzas de lana 3.5, de algodón 3; mocasín de ante 3, derby 3.5).

### P9. «Qué te falta»
Las fuentes repiten piezas que desbloquean muchos outfits y que el usuario no tiene: **mocasín de ante
marrón, pantalón de franela gris, blazer marino desestructurado, polo de punto, jersey crema con textura,
cinturón de piel marrón**. Para una función futura de sugerencias (M1A §8).

---

## 9. Prompt mejorado para Gemini (selección de los 4 outfits)

### 9.1 Instrucción del sistema (para sustituir a `INSTRUCCION_OUTFITS`)

Pensado para cuando esté hecho P2 (capas en la composición). Al pegarlo, quita las marcas ⟨capas⟩.

**Si se usa antes de P2**, Percha descartaría los outfits con dos partes de arriba o dos abrigos. En ese caso:
1. borra el bloque «Reglas de capas» entero y cada viñeta marcada con ⟨capas⟩ (entera, aunque ocupe dos
   líneas);
2. añade en «Cómo se arma un outfit» la viñeta «- Arriba: una parte de arriba y, si hace falta abrigo, un
   abrigo (nunca dos).».

```text
Eres el estilista de Percha, un armario digital. Vistes a una persona real con su propia ropa: tus outfits
tienen que ser los que firmaría un buen estilista de moda masculina de 2026, no combinaciones de catálogo.

Recibes el estilo, la ocasión, el tiempo, a veces el perfil de la persona y una lista de prendas que ya
encajan con todo eso. Cada prenda tiene una referencia (P1, P2…), sus etiquetas y, si se sabe, los papeles
que puede hacer como capa (base, media, exterior).

Elige 4 outfits distintos usando solo referencias de la lista y sin repetir prenda dentro de un outfit.

Cómo se arma un outfit:
- Abajo: un pantalón (o falda), o un vestido. Un calzado.
- Arriba, por capas de dentro afuera: base (camiseta, polo, camisa, cuello alto), media (jersey, cárdigan,
  sudadera, camisa abierta, sobrecamisa o americana bajo un abrigo) y exterior (sobrecamisa, americana,
  cazadora, abrigo). ⟨capas⟩
- Número de capas visibles arriba según la sensación térmica: 26 °C o más, 1; 22–25 °C, 1 o 2; 18–21 °C, 2;
  14–17 °C, 2 o 3; 13 °C o menos, 3 con exterior. Nunca más de 3, salvo 3 °C o menos. ⟨capas⟩
- Si hace falta abrigo, el outfit lleva una prenda exterior. Como mucho dos accesorios, solo si suman.

Reglas de capas: ⟨capas⟩
- De fino a grueso: cada capa abriga igual o más que la de debajo. ⟨capas⟩
- La de fuera es la más larga; nada encima de una americana salvo un abrigo. ⟨capas⟩
- Cada capa tiene que funcionar sola: si se quita la de fuera, lo que queda sigue siendo un buen outfit. ⟨capas⟩
- Claro dentro y oscuro fuera por defecto; capas contiguas con contraste suficiente para que se distingan. ⟨capas⟩
- No: sobrecamisa gruesa sobre una camiseta sola, jersey grueso bajo americana, sudadera con capucha bajo
  americana en el trabajo, camiseta + camisa abierta + sobrecamisa + abrigo a la vez. ⟨capas⟩
- Entre 14 y 23 °C, si hay una sobrecamisa, una camisa para llevar abierta, un punto o una americana, úsala
  como tercera pieza en al menos dos de los outfits: camiseta y pantalón solos quedan incompletos.

Formalidad:
- Respeta el estilo y la ocasión. Entre la prenda más formal y la más informal, como mucho 2 puntos.
- La capa de fuera y el calzado, del mismo nivel.
- Mezclas que sí: americana informal con vaquero oscuro; camiseta buena o polo de punto con pantalón de
  pinzas y mocasín. Mezclas que no: chaqueta de traje con vaquero, sudadera con zapato de vestir.
- Trabajo: nada de gráficos, capucha, pantalón corto ni chanclas.

Color y estampado:
- 2 o 3 colores visibles, la mayoría neutros (blanco, crudo, gris, marino, beige, camel, marrón, caqui,
  oliva, vaquero). Como mucho un color fuerte, mejor en una prenda pequeña.
- Parejas que funcionan: marino con gris, marrón, crudo o camel; marrón con beige, crudo, verde o azul; oliva
  con crudo; gris con granate; negro con gris, blanco o camel.
- Evita: dos colores vivos juntos (azul y rojo, verde y rojo, rojo y morado…), zapato negro con pantalón
  beige, caqui o marrón, dos marinos o dos negros casi iguales juntos, doble vaquero del mismo lavado.
- Un solo estampado llamativo; si hay dos, de tipos distintos, uno discreto.
- Busca contraste claro/oscuro entre arriba y abajo y mezcla texturas (liso con rugoso).

Que no sean aburridos:
- Cada outfit tiene un protagonista claro (un color, una textura, una prenda) y el resto lo acompaña.
- Los 4 tienen que ser variados de verdad: si hay alternativas, cambia la parte de arriba y la capa de fuera
  entre ellos, y que haya al menos uno tonal (un solo color en varios tonos y texturas) y uno con contraste.

Si recibes un perfil de cuerpo, vístelo a favor:
- Cuerpo grande o ancho de hombros: capas abiertas que hagan una línea vertical, tonos cercanos de arriba
  abajo, nada de pantalón pitillo ni de todo holgado (como mucho una prenda amplia), calzado con presencia
  (derby, mocasín, Chelsea), estampados de escala media.

En «porque», una frase corta (máximo 25 palabras), de tú, que diga por qué funciona hoy: el tiempo, la
ocasión y el truco de estilo («la sobrecamisa abierta alarga», «marino y marrón, clásico de otoño»).
```

### 9.2 Cambios al texto de la petición (`textoPeticionOutfits`)

PROPUESTA, para que la IA tenga lo que el prompt le pide:
- Por prenda, añadir los **papeles de capa** y, si existen, `largo`, `lavado`, `escala` y material:
  `P3 · abrigo · sobrecamisa · oliva · liso · capas: media, exterior · abrigo 3/5 · formalidad 3/5 · largo cadera · algodón grueso`
- Añadir la **amplitud térmica** del día: «Tiempo: 12 °C de sensación (mín. 7, máx. 17), otoño. Hace falta
  exterior por la mañana; a mediodía sobra.»
- Añadir el **perfil** si existe: «Perfil: 176 cm, 100 kg, complexión grande, hombros anchos. Oficina
  estándar.»
- Mandar a la IA las prendas de «tercera pieza» entre 14 y 23 °C (P3).
- Subir `MAX_POR_CATEGORIA` de 8 a ~10 para `superior` y `abrigo`, que ahora reparten tres ranuras.

---

## 10. Prioridades (orden recomendado)

1. **Capas en la composición** (P1 + P2): campo o tabla de papeles, validador con 2 superiores y 2 abrigos,
   reglas C1–C13, collage con más prendas. Sin esto, nada de lo demás da capas.
2. **Tercera pieza sin frío** (P3): umbrales 14 / 23 °C y candidatas opcionales.
3. **Prompt v2 de Gemini** (§9) junto con 1 y 2.
4. **Color**: clases de color, presupuesto de acentos, matriz de pares, granate ≠ rojo, «oliva» (§3, P6).
5. **Formalidad**: dispersión ≤ 2, exterior y calzado alineados, mezclas alto-bajo (§2).
6. **Perfil de cuerpo, oficina y sensación térmica** (P7) y reglas B1–B11.
7. **Subcategorías cerradas** y etiquetado nuevo (P4, P5, P8).
8. **Bonificaciones «no aburrido»** y variedad entre los 4 (§7).
9. **Estilo «workwear / americana»** (P6).
10. **«Qué te falta»** (P9).

---

## Fuentes clave

La lista completa, con más de 250 fuentes, está al final de cada parte de [`moda.md`](moda.md).

- Capas: Man of Many, «Layering Clothes Is the Most Underrated Styling Skill» (27-04-2026). https://manofmany.com/style/how-to-layer-clothes-mens-guide
- Capas: Art of Manliness, «How to Layer Clothing With Style» (act. 03-2026). https://www.artofmanliness.com/style/clothing/how-to-layer-clothing-men/
- Capas: Real Men Real Style, «10 Rules To Properly Layer Your Clothes». https://www.realmenrealstyle.com/10-rules-layering/
- Capas: The Modest Man, «Shacket vs Overshirt» (act. 07-2026). https://www.themodestman.com/shacket-vs-overshirt/
- Capas: Peter Manning, «How to Wear Layers». https://petermanningnyc.com/blogs/news/how-to-wear-layers-men
- Capas: Dappered, «How to layer – 3 Easy Rules». https://dappered.com/2012/01/how-to-layer-three-basic-rules-for-getting-it-right/
- Tercera pieza: The VOU, «The Ralph Lauren 3 Piece Rule Explained» (act. 10-10-2026). https://thevou.com/?p=197655
- Capas: GQ, Spencer Phipps (20-10-2025). https://www.gq.com/story/how-to-layer-better-spencer-phipps-interview
- Temperatura: WhetherWear (act. 25-08-2026). https://whetherwear.pages.dev/blog/what-to-wear-by-temperature-decoded
- Temperatura: OCEANS (27-08-2026). https://oceans.tokyo.jp/choice/fashion/mens/todaysoutfit-mens
- Temperatura: Weathernews (01-06-2026). https://weathernews.jp/news/202605/310081/
- Color: Permanent Style, «What colour theory can teach you about clothing» (10-01-2024). https://www.permanentstyle.com/2024/01/what-colour-theory-can-teach-you-about-clothing.html
- Color: Real Men Real Style, «3 Main Rules To Match Colors». https://www.realmenrealstyle.com/match-colors-style-rules/
- Color: Irreverent Gent, «How to Match Colors for Men» (2026). https://www.irreverentgent.com/how-to-match-colors-men/
- Color: Sartoria Lab, colores en un outfit. https://sartorialab.squarespace.com/styling-advice-for-men/a-guide-for-men-on-how-to-put-colours-together-in-an-outfit
- Zapato y pantalón: Sartoro (2026). https://sartoro.co/blogs/sartorial/how-to-match-shoes-with-pants
- Calcetines: Darn Tough. https://darntough.com/blogs/the-alternate-stitch/what-color-should-dress-socks-be
- Estampados: He Spoke Style (06-03-2024). https://hespokestyle.com/pattern-mixing-rules
- Estampados: Articles of Style. https://articlesofstyle.com/blogs/news/a-simple-guide-to-patternmixing
- Formalidad: FashionBeans, «Smart Casual Dress Code» (09-2026). https://www.fashionbeans.com/article/mens-smart-casual-dress-guide
- Formalidad: Real Men Real Style, «Business Casual vs Smart Casual vs Dress Casual». https://www.realmenrealstyle.com/business-casual-vs-smart-casual-vs-dress-casual/
- Oficina: Gentleman's Gazette, «Business Casual». https://www.gentlemansgazette.com/business-casual-men-attire/
- Oficina 2026: The Gentleman's Journal (ES). https://www.thegentlemansjournal.com/es/article/el-estilo-business-casual-para-hombre-ha-muerto-en-2026-esto-es-lo-que-lo-sustituye/
- Protagonista: Blakemill, «How to Build Statement Menswear». https://blakemill.co.uk/blogs/news/how-to-build-statement-menswear-that-works
- España: Permanent Style, «Homage to Spain (and its style)» (05-08-2026). https://www.permanentstyle.com/2026/08/homage-to-spain-and-its-style.html
- Tendencias: GQ, Milán SS27 (29-09-2026). https://www.gq.com/story/milan-fashion-week-trends-2026
- Cuerpo: Real Men Real Style, «Slim vs. Wide Trousers 2026». https://www.realmenrealstyle.com/slim-vs-wide-trousers/
