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
| T1.6 | Alta en lote: «Añadir varias», hasta 5 prendas etiquetadas en una sola petición (D9) | T1.5 | ⏳ |

T1.2, T1.3, T1.4 y T2.2 van **en paralelo**, cada una en su zona, sin tocar las de las otras:

- **T1.2:** `src/recorte/` y la pantalla «Nueva prenda» (`src/pantallas/nueva-prenda/`). Guarda la prenda con
  la categoría elegida a mano y `etiquetadaPor: 'manual'`.
- **T1.3:** `src/ia/`, la clave en Ajustes y el formulario de etiquetas (`src/componentes/formulario-prenda/`).
  No lo monta en otras pantallas.
- **T1.4:** `src/pantallas/armario/` (lista, filtros y detalle con borrar). Sin formulario de edición.
- **T2.2:** `src/outfits/reglas/`, solo lógica, sin UI.

Cada una puede añadir **una línea** a la navegación (`src/app/`) si la necesita. Lo que haga falta coser entre
ellas va a T1.5.

### T1.6 — Alta en lote
- **Qué:** botón «Añadir varias» junto a «Añadir prenda»: elegir hasta 5 fotos de la galería (una por prenda),
  recortarlas, etiquetarlas en **una** petición (`etiquetarPrendas` con 5 prendas, D9) y revisarlas una a una
  con `FormularioPrenda` antes de guardar. Si la IA devuelve `null` para alguna, esa va vacía con aviso.
- **Por qué aparte:** T1.5 deja el flujo de una prenda; el lote necesita su propia pantalla (cola de revisión,
  qué pasa si se cancela a medias) y una petición de 5 tarda ~40 s (S2).

## Fase 2 — Outfits

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T2.1 | Tiempo: geolocalización o ciudad, con Open-Meteo | T0.1 | ✅ |
| T2.2 | Motor de candidatos por reglas (tiempo, ocasión, formalidad) + 4 outfits sin IA | T1.1 | ✅ |
| T2.3 | Selección de 4 outfits con IA y su explicación (lógica, sin UI) | T2.2, T1.3 | ✅ |
| T2.4 | Pantalla Outfits: estilo, ocasión, tiempo, generar con reglas; collage 2×2; guardar, descargar y compartir | T2.2 | ✅ |
| T2.5 | Conectar la IA de T2.3 a la pantalla de T2.4 (con las reglas de respaldo) | T2.3, T2.4 | 👀 |

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
| T3.2 | Botón «Pruébatelo en Gemini» | T3.1, T2.4, S3 | ⏳ |

## Fase 4 — Publicar y probar con amigos

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T4.1 | Alojar gratis en Cloudflare Workers ([`despliegue.md`](despliegue.md)) y guía para instalarla en Android ([`guia-movil.md`](guia-movil.md)) | — | 👀 falta que el usuario cree el proyecto en Cloudflare |
| T4.2 | Guía para conseguir la clave gratis de Gemini: en [`guia-movil.md`](guia-movil.md) y enlace en Ajustes | T1.3 | ✅ |
