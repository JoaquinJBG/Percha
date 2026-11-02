# Percha — Instrucciones del proyecto

PWA de armario digital: fotos de prendas → recorte y etiquetado con IA → 4 outfits en collage 2×2.
**Sin servidor:** todo vive en el móvil (IndexedDB) y la IA se llama desde el navegador con la clave de
Gemini del propio usuario. Lee [`docs/spec.md`](docs/spec.md) (alcance y decisiones) y
[`docs/plan.md`](docs/plan.md) (tareas) antes de empezar.

## Stack

- Vite + React + TypeScript estricto, **pnpm**.
- Tailwind; `vite-plugin-pwa`; React Router.
- Dexie (IndexedDB), Zod para validar todo lo que viene de la IA o de una copia importada.
- `@google/genai` en el navegador, detrás de la interfaz `ProveedorIA` (`src/ia/`).
- Open-Meteo para el tiempo (sin clave).
- Vitest + Testing Library; Playwright para E2E con viewport móvil cuando haga falta.

## Zonas

- `src/app/` rutas y layout · `src/pantallas/` · `src/componentes/`
- `src/datos/` Dexie y copia · `src/ia/` proveedores · `src/recorte/` · `src/tiempo/` · `src/outfits/`
  (reglas, IA, collage)
- `spikes/<id>/` pruebas técnicas, fuera de la app · `docs/` spec, plan e informes de *spikes*

## Comandos

- `pnpm install` · `pnpm dev` (`pnpm dev --host` para abrirla desde el móvil)
- **`pnpm verify`**: lint + typecheck + test + build. Es el check obligatorio.

(Hasta que T0.1 esté en `main` no existen.)

## Flujo de trabajo

Se sigue la skill global **`ticket-flow`**, con estos datos del proyecto:

| Dato | Valor |
|---|---|
| Forja | GitHub, repo **privado** `github.com/JoaquinJBG/Percha` (`gh`); PR en borrador |
| Tracker | ninguno: las tareas y su estado están en `docs/plan.md` |
| Rama base | `main` |
| Ramas | `<tipo>/<id>-<slug>`: `chore/t0-1-esqueleto`, `feat/t1-2-alta-prenda`, `spike/s1-recorte`, `fix/<slug>` |
| Commits | Conventional Commits, ámbito = zona: `feat(armario): …`, `feat(ia): …`, `chore(pwa): …`, `docs(spikes): …` |
| Checks | `pnpm verify` |
| Revisor | nadie (proyecto personal) |

- **Cada tarea, en su worktree y su rama.** Las trabajadoras hacen commits en su rama y push de su rama
  (`git push -u origin <rama>`) en cuanto la crean y tras cada commit. **Nunca merge, PR ni force push.**
  La PR en borrador la abre la sesión jefe; el merge a `main` lo decide el usuario.
- **Antes de decir «listo»:** `pnpm verify` en verde, **verlo funcionar** (`pnpm dev` en el navegador con
  viewport de 375 px, captura) y autorevisión con la lista de casos límite de `ticket-flow`. Lo que solo se
  puede probar en un Android real (cámara, recorte, compartir) va como pasos numerados para el usuario.
- Al terminar, la rama actualiza el estado de su tarea en `docs/plan.md` (👀) y, si es un *spike*, deja su
  informe en `docs/spikes/<id>.md`.
- Una decisión nueva que cambie el alcance va a «Decisiones» de `docs/spec.md`.

## Reglas

- **Nunca** se escribe una clave de API en el repo, en tests ni en logs. Los tests usan un `ProveedorIA` falso.
- Las fotos reales de prueba van en `muestras/` (en `.gitignore`); en los tests, imágenes sintéticas.
- Textos de la app en español. Comentarios solo para un porqué no obvio.
- Coste cero: nada que obligue a pagar o a tener un servidor sin hablarlo antes con el usuario.
