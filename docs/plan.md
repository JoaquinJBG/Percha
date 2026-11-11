# Percha — Plan por fases

Fecha: 2026-11-02. Sin tracker: este fichero es la lista de tareas. Cada tarea tiene un ID (`T1.2`, `S1`)
que va en el nombre de la rama. Al terminar una tarea, su rama actualiza aquí el estado.

Estados: ⏳ pendiente · 🔨 en curso · 👀 lista para probar · ✅ en `main`.

## Fase 0 — Esqueleto y pruebas técnicas

T0.1 y los tres *spikes* son independientes: pueden ir **en paralelo**, cada uno en su worktree. Los *spikes*
viven en `spikes/<nombre>/` y no tocan `src/`.

| ID | Tarea | Rama | Estado |
|---|---|---|---|
| T0.1 | Esqueleto de la PWA | `chore/t0-1-esqueleto` | ✅ |
| S1 | Recorte de fondo en el navegador | `spike/s1-recorte` | ✅ |
| S2 | Gemini desde el navegador | `spike/s2-gemini` | ✅ |
| S3 | Compartir con la app de Gemini | `spike/s3-compartir` | ✅ |

### T0.1 — Esqueleto de la PWA
- **Qué:** Vite + React + TypeScript (estricto) con pnpm; Tailwind; `vite-plugin-pwa` (manifest «Percha»,
  iconos provisionales, *service worker*); React Router con cuatro pantallas vacías (Armario, Outfits,
  Perfil, Ajustes) y barra de navegación inferior; Vitest + Testing Library con un test de la navegación;
  ESLint (typescript-eslint) + Prettier.
- **Scripts de `package.json`:** `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `format` y
  **`verify`** (lint + typecheck + test + build).
- **Estructura:** `src/app/` (rutas y layout), `src/pantallas/`, `src/componentes/`, y carpetas vacías con
  `README` de una línea para `src/datos/`, `src/ia/`, `src/recorte/`, `src/tiempo/`, `src/outfits/`.
- **Hecho cuando:** `pnpm verify` en verde; `pnpm build && pnpm preview` se puede instalar como PWA en
  Chrome; captura a 375 px de ancho con la barra inferior.
- **Fuera:** lógica de producto, IndexedDB, IA.

### S1 — Recorte de fondo en el navegador
- **Qué:** página en `spikes/s1-recorte/` que recorta el fondo de una foto de prenda, con al menos dos
  candidatos: `rembg-webgpu` y Transformers.js con un modelo de recorte (p. ej. RMBG-1.4; anotar su
  licencia). Si hay otro mejor en 2026, añadirlo.
- **Medir** con 5 fotos reales de prendas (camiseta, pantalón, zapatillas, chaqueta, algo con estampado):
  tamaño de la descarga, tiempo de la primera carga, tiempo por foto y calidad del borde. En el PC y en un
  **Android real** (para el móvil hace falta HTTPS: `vite --host` con `@vitejs/plugin-basic-ssl`).
  La prueba en el móvil la hace el usuario con los pasos que le dejes.
- **Hecho cuando:** `docs/spikes/s1-recorte.md` con la tabla, capturas y la librería recomendada.
- **Fuera:** integrarlo en la app.

### S2 — Gemini desde el navegador
- **Qué:** página en `spikes/s2-gemini/` con un campo para pegar la clave (solo en `localStorage`, nunca en
  el repo) que manda 1–3 fotos de prendas a Gemini con el SDK `@google/genai` y pide **salida JSON con
  esquema** (el de la Prenda de [`spec.md`](spec.md)), validada con Zod.
- **Comprobar:** que funciona desde el navegador (CORS); qué modelos tienen nivel gratis y con qué límites
  reales (el usuario lo mira en Google AI Studio); tokens y tiempo por petición; cuántas prendas caben en una
  petición; si la búsqueda en Google (*grounding*) entra en el nivel gratis.
- **Hecho cuando:** `docs/spikes/s2-gemini.md` con el modelo recomendado, los límites, el prompt v0 de
  etiquetado y los resultados con 5 prendas.
- **Fuera:** generar outfits; otros proveedores.

### S3 — Compartir con la app de Gemini
- **Qué:** página en `spikes/s3-compartir/` que junta 3–4 imágenes (persona + prendas) y un texto, y llama a
  `navigator.share({ files, text })`.
- **Comprobar en Android:** que aparece la app de Gemini; si recibe varias imágenes y el texto; si no,
  alternativas: copiar el texto al portapapeles y compartir solo imágenes, o componer **una sola imagen**
  (persona + prendas) en un canvas. Probar también con ChatGPT por si sirve igual.
- **Hecho cuando:** `docs/spikes/s3-compartir.md` con qué funciona, capturas y el texto de prompt v0 para
  el *try-on*.
- **Fuera:** integrarlo en la app.

## Fase 1 — Armario (tras la fase 0)

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T1.1 | Modelo de datos con Dexie (IndexedDB) + exportar/importar copia | T0.1 | ✅ |
| T1.2 | Alta de prenda: cámara/galería, 1–2 fotos, recorte | T1.1, S1 | ✅ |
| T1.3 | Ajustes (clave Gemini) + etiquetado con IA y edición manual | T1.1, S2 | ✅ |
| T1.4 | Lista del armario con filtros, detalle y borrar | T1.1 | ✅ |
| T1.5 | Unir el flujo: alta → recorte → etiquetado con IA → revisar y guardar; editar desde el detalle | T1.2, T1.3, T1.4 | ✅ |
| T1.6 | Alta masiva: muchas fotos de golpe, cola persistente y etiquetado de 5 en 5 (D16) | T1.5 | ✅ |

T1.2, T1.3, T1.4 y T2.2 van **en paralelo**, cada una en su zona, sin tocar las de las otras:

- **T1.2:** `src/recorte/` y la pantalla «Nueva prenda» (`src/pantallas/nueva-prenda/`). Guarda la prenda con
  la categoría elegida a mano y `etiquetadaPor: 'manual'`.
- **T1.3:** `src/ia/`, la clave en Ajustes y el formulario de etiquetas (`src/componentes/formulario-prenda/`).
  No lo monta en otras pantallas.
- **T1.4:** `src/pantallas/armario/` (lista, filtros y detalle con borrar). Sin formulario de edición.
- **T2.2:** `src/outfits/reglas/`, solo lógica, sin UI.

Cada una puede añadir **una línea** a la navegación (`src/app/`) si la necesita. Lo que haga falta coser entre
ellas va a T1.5.

### T1.6 — Alta masiva
- **Qué:** «Añadir muchas» (`/prendas/varias`): muchas fotos de golpe, una prenda por foto, en una cola guardada
  en el móvil que se procesa de 5 en 5 y guarda cada prenda sin revisarla una a una (D16). Las que la IA no
  reconoce quedan en la cola para reintentar o descartar. Sustituye a la idea anterior de revisar un lote de 5.
- **Código:** `src/importacion/`, `src/datos/cola.ts`, `src/pantallas/alta-masiva/`.

## Fase 2 — Outfits

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T2.1 | Tiempo: geolocalización o ciudad, con Open-Meteo | T0.1 | ✅ |
| T2.2 | Motor de candidatos por reglas (tiempo, ocasión, formalidad) + 4 outfits sin IA | T1.1 | ✅ |
| T2.3 | Selección de 4 outfits con IA y su explicación (lógica, sin UI) | T2.2, T1.3 | ✅ |
| T2.4 | Pantalla Outfits: estilo, ocasión, tiempo, generar con reglas; collage 2×2; guardar, descargar y compartir | T2.2 | ✅ |
| T2.5 | Conectar la IA de T2.3 a la pantalla de T2.4 (con las reglas de respaldo) | T2.3, T2.4 | ✅ |

**Tanda siguiente, en paralelo:** T1.5, T2.3, T2.4 y T3.1, cada una en su zona:

- **T1.5:** `src/pantallas/nueva-prenda/`, `src/pantallas/armario/` (botones «Añadir prenda» y «Editar») y el
  montaje de `src/componentes/formulario-prenda/`.
- **T2.3:** `src/outfits/ia/` y lo que añada a `src/ia/` (nuevo método del proveedor, sin cambiar los que hay).
- **T2.4:** `src/pantallas/outfits/` y `src/outfits/collage/`. El selector de outfits se pasa como función, con
  las reglas por defecto.
- **T3.1:** `src/pantallas/perfil/`.

Cada una puede añadir **una línea** a `src/app/rutas.tsx` si la necesita.

## Fase 3 — Perfil y try-on

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T3.1 | Perfil con fotos de cara y cuerpo | T1.1 | ✅ |
| T3.2 | Botón «Pruébatelo en Gemini» | T3.1, T2.4, S3 | ✅ |

## Fase 4 — Publicar y probar con amigos

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T4.1 | Alojar gratis en Cloudflare Workers ([`despliegue.md`](despliegue.md)) y guía para instalarla en Android ([`guia-movil.md`](guia-movil.md)) | — | ✅ |
| T4.2 | Guía para conseguir la clave gratis de Gemini: en [`guia-movil.md`](guia-movil.md) y enlace en Ajustes | T1.3 | ✅ |

## Fase 5 — De la etiqueta a la prenda

Sale del estudio [S4](spikes/s4-probador-y-etiquetas.md) §3 (fase D de su plan). Las fases E (tablas de
tallas y medidas) y F (*grounding*) quedan para después.

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T5.1 | Alta desde la etiqueta: foto de la etiqueta leída por Gemini, marca, referencia, talla, composición y enlace en la prenda, enlaces de búsqueda que abre el usuario y `share_target` para volver de la tienda (D17) | T1.5 | 👀 |

### T5.1 — Alta desde la etiqueta
- **Qué:** botón «Foto de la etiqueta» en «Nueva prenda» y «Editar» (`leerEtiqueta` de `ProveedorIA`; la
  foto no se guarda); campos opcionales `marca`, `referencia`, `talla`, `composicion` y `enlace`, editables
  y en el detalle; enlaces «Buscar en Google», «Google Imágenes» y «En la tienda» (Zara, H&M, Nike, Adidas
  y genérico); `share_target` GET a `/compartido` para guardar el enlace en una prenda o empezar una nueva.
- **Fuera:** tallas y medidas (fase E), *grounding* (fase F), probador. La foto de catálogo vuelve como
  captura por el selector de fotos de siempre; recibirla por `share_target` POST pediría `injectManifest`.

## Fase 6 — Outfits con capas

Sale de la investigación de moda (`docs/investigacion/reglas-outfits.md`, en la rama
`docs/investigacion-moda`): los outfits salen básicos porque Percha solo sabe poner una prenda por ranura.

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T6.1 | Capas en la prenda: campo `capas` (base, media, exterior), etiquetado con IA y por defecto según el tipo, editable y en el detalle (D18) | T5.1 | 👀 |
| T6.2 | Composición con capas y tercera pieza: 1 base + 0–2 medias + 0–1 exterior con las reglas C1–C13, tercera pieza entre 14 y 23 °C, collage de dentro afuera | T6.1 | 👀 |
| T6.3 | Prompt v2 de Gemini para elegir los 4 outfits (§9 de la investigación) | T6.2 | 👀 |
| T6.4 | Color y formalidad: clases de color, presupuesto de acentos y escalera de formalidad (§2–3) | T6.2 | ⏳ |
| T6.5 | Perfil de cuerpo, oficina y sensación térmica (§6 y P7) | T6.2 | ⏳ |

### T6.1 — Capas en la prenda
- **Qué:** `capas?: ('base' | 'media' | 'exterior')[]` en la prenda (`src/datos/modelo.ts`), sin repetidos y
  de dentro afuera; `capasPorDefecto` y `capasDe` en `src/datos/capas.ts` (tabla §1.2). Gemini las devuelve
  en el etiquetado (si faltan o no valen, las de por defecto) y el prompt define «abrigo» como «lo que va
  encima de otra parte de arriba» (P8). «Puede ir como» en el formulario, solo para `superior` y `abrigo`,
  y una línea en el detalle. El alta masiva las guarda con lo demás.
- **Fuera:** usar las capas para montar outfits (T6.2) y el prompt de outfits (T6.3). `largo`, `material` y
  las subcategorías cerradas (P4, P5) tampoco entran.

## Fase 7 — Probador en el PC

Sale del estudio [S4](spikes/s4-probador-y-etiquetas.md) §1–2 y de la decisión D19: el PC del usuario
(RTX 3060) viste el outfit con CatVTON y Gemini pasa a ser la segunda opción. El contrato de la API entre
Percha y el servidor está fijado por la sesión jefa (carpeta de notas de la fase 7).

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T7.1 | Probador del PC desde Percha: URL y clave en Ajustes con «Comprobar», «Pruébatelo» primero en el PC (progreso, guardar con el outfit, compartir) y Gemini si falla (D19) | T3.2 | 👀 falta probarlo con el servidor de verdad y Tailscale en el móvil |
| T7.2 | Servidor del probador en el PC: CatVTON detrás de un adaptador con clave en `127.0.0.1:7861`, publicado con Tailscale Serve, y guía [`probador-pc.md`](probador-pc.md) | S4 | 🔨 |

### T7.1 — Probador del PC desde Percha
- **Qué:** sección «Probador en tu PC» en Ajustes (URL https de Tailscale, clave, «Comprobar», «Quitar»,
  enlace a la guía); `src/probador/` (cliente con clave y esperas, qué prendas se mandan, seguimiento
  cada 3 s); «Pruébatelo» con probador: `/salud` en 3 s, fotos al PC, progreso con tiempo aproximado,
  imagen con «Guardar» (en `Outfit.prueba`) y «Compartir»; si el PC no responde, falla o está ocupado,
  mensaje claro y «Probar con Gemini» avisando de que las fotos van a Google. Aviso de capas cuando el
  outfit lleva más de una prenda de arriba.
- **Fuera:** el servidor (T7.2), ver la foto guardada en otra pantalla (de momento solo va en la copia y en
  la base), capas de verdad (cuando el servidor sepa hacerlas).

## Fase 8 — Ficha completa

Aprobada por el usuario el 2026-11-09 junto con las fases 9 (buscar la prenda con Gemini) y 10 (ajuste de
talla de verdad). T8.2 absorbe la T6.5.

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T8.1 | Corte y detalles por tipo (corte, tiro, largo, manga, cuello) con listas cerradas, que rellena Gemini y se corrigen a mano; marca, corte y talla sin foto de la etiqueta; filtro por corte en el armario (D20) | T6.1 | 👀 |
| T8.2 | Perfil de cuerpo: medidas, complexión, tallas habituales por marca, oficina y sensación térmica (absorbe T6.5) | — | 👀 |
| T8.3 | Fotos del perfil: foto de referencia ajustada con guía y pose; la de ropa interior, opcional y solo para el probador del PC (nunca a Gemini, a la nube ni a la copia) | T7.1 | 👀 falta hacerse las fotos de verdad y probarlas en el PC |
| T8.4 | Outfits y probador usan el corte y el cuerpo: reglas (§6 de la investigación, B1–B11), prompt de Gemini y avisos del probador | T6.2, T6.3, T8.1, T8.2 | 👀 sin avisos del probador (nota en `src/tryon/README.md`) |

### T8.1 — Corte y detalles por tipo
- **Qué:** campos opcionales `corte`, `tiro`, `largo`, `manga` y `cuello` en la prenda, con listas cerradas
  en `src/datos/modelo.ts`; `detallesQueAplican` (`src/datos/detalles.ts`) dice cuáles van con cada tipo:
  - pantalón y vaquero: corte (skinny, slim, regular / recto, relaxed, baggy, wide leg, balloon, bootcut,
    flare, tapered, cargo), tiro (bajo, medio, alto) y largo (completo, tobillero, cropped); shorts, corte y
    tiro; faldas, nada;
  - camiseta, sudadera, jersey y polo: corte (slim, regular, relaxed, oversize, boxy), largo (cropped,
    regular, largo) y manga (corta, larga, sin manga);
  - camisa y sobrecamisa de arriba: corte (slim, regular, relaxed, oversize, overshirt), manga y cuello
    (clásico, mao, cubano);
  - abrigo y chaqueta: corte (entallado, recto, oversize, boxy, cropped) y largo (corto, cadera, medio
    muslo, largo).

  Gemini los rellena (prompt v3); lo que no vale o no aplica se quita sin perder la prenda. Sección «Corte y
  detalles» en el formulario, junto a «Etiqueta y tienda» (marca y talla a mano). En el detalle, «Zara ·
  balloon · 44» bajo el título y una fila por detalle. Filtro «Corte» en el armario, con los cortes que hay.
  El alta masiva los guarda.
- **Fuera:** usarlos en outfits y probador (T8.4), tablas de tallas (T10.1).
