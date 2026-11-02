# S2 — Gemini desde el navegador

Fecha: 2026-11-02 · Rama: `spike/s2-gemini` · Código: [`spikes/s2-gemini/`](../../spikes/s2-gemini/)

**Estado:** 👀 La página está hecha y probada con la respuesta simulada y contra la API real sin clave
(CORS). **Falta la parte con clave:** etiquetar las 5 prendas y confirmar los límites en Google AI Studio.
Los pasos para el usuario están al final.

## Resumen

- **Funciona desde el navegador.** La API de Gemini abre CORS: el navegador hace el *preflight* con la
  cabecera `x-goog-api-key` y lee la respuesta de Google. El SDK `@google/genai` (v2.32) usa su versión
  web y manda la clave en esa cabecera, no en la URL.
- **Modelo recomendado para etiquetar: `gemini-3.5-flash-lite`.** Es el que Google recomienda para
  proyectos nuevos junto a 3.8 Flash, tiene nivel gratis y es el que más peticiones al día da gratis
  (~500 RPD frente a ~20 de 3.8 Flash). Para elegir outfits (T2.3), probar `gemini-3.8-flash`: con 20 RPD
  da para unas cuantas generaciones al día.
- **La búsqueda de Google (*grounding*) no entra en el nivel gratis** de los modelos Gemini 3 o
  posteriores. Solo la tienen gratis 2.5 Flash y 2.5 Flash-Lite (500 RPD compartidas), y Google ya limita
  la familia 2.5 a quien la usaba antes. **Percha no debe depender de la búsqueda.**
- **El cuello de botella es el número de peticiones al día, no los tokens.** Conviene etiquetar varias
  prendas por petición (D9) y, en la app, mandar la foto con resolución baja si la calidad aguanta.
- **Ojo con la privacidad:** en el nivel gratis, Google puede usar lo que se envía para mejorar sus
  productos. Para fotos de prendas no es un problema; hay que decirlo en la guía de la clave (T4.2).

## Modelos y límites del nivel gratis

Fuentes: [precios](https://aistudio.google.com/docs/pricing), [modelos](https://aistudio.google.com/docs/models)
y [límites](https://aistudio.google.com/docs/rate-limits) de la doc oficial (consultadas el 2026-11-02).
La página oficial de límites **ya no publica las cifras del nivel gratis**: dice que se ven en AI Studio,
por proyecto. Las cifras de la tabla salen de [scriptbyai](https://www.scriptbyai.com/gemini-api-rate-limits/)
y de un [hilo del foro de Google](https://discuss.ai.google.dev/t/gemini-3-8-flash-free-tier-20-rpd-is-too-limited-for-practical-evaluation/180609);
**hay que confirmarlas en AI Studio**.

| Modelo | Gratis | RPM | TPM entrada | RPD | Búsqueda gratis | Nota |
|---|---|---|---|---|---|---|
| `gemini-3.5-flash-lite` | sí | 10 | 250K | 500 | no | **Recomendado para etiquetar** |
| `gemini-3.1-flash-lite` | sí | 10 | 250K | 500 | no | Plan B, misma cuota |
| `gemini-3.8-flash` | sí | 5 | 250K | 20 | no | Mejor modelo gratis; poco cupo |
| `gemini-3.6-flash` | sí | 5 | 250K | 20 | no | Generación anterior |
| `gemini-3-flash-preview` | sí | ? | ? | ? | no | *Preview*: puede desaparecer |
| `gemini-2.5-flash` / `-lite` | sí | ? | ? | ? | 500 RPD | Solo para quien ya la usaba |
| `gemini-3.1-pro-preview`, `gemini-4-argon` | **no** | — | — | — | — | Solo de pago |

Lo que dice la doc oficial y sí está confirmado:

- Los límites son **por proyecto, no por clave**: crear más claves en el mismo proyecto no da más cupo.
- Las peticiones diarias se reinician a **medianoche, hora del Pacífico** (las 9:00 en España).
- Para el nivel gratis basta un proyecto activo, sin facturación.
- Cada imagen cuesta **1.120 tokens** en Gemini 3+ con la resolución por defecto; **280** en baja y
  **560** en media (`mediaResolution`). El tamaño en píxeles no cambia ese número: reducir la foto solo
  ahorra subida.
- La búsqueda en Gemini 3+: «No disponible» en el nivel gratis; en el de pago, 5.000 búsquedas al mes
  gratis y después 14 $ por cada 1.000. Se puede probar a mano dentro de AI Studio, no por la API.

## Cuántas prendas caben en una petición

Con 250K tokens por minuto, una petición con 10 prendas a resolución por defecto son ~11K tokens de
entrada más ~1,5K de salida: el límite real no son los tokens sino el **número de peticiones al día** y que
la respuesta no se degrade con muchas imágenes. La página deja mandar hasta 10 fotos para medirlo.

Propuesta hasta tener datos: **lotes de hasta 5 prendas**. En el alta normal (una prenda con 1–2 fotos)
cada prenda es una petición; el lote sirve para la primera carga del armario y para reintentar las que se
quedaron sin etiquetar por falta de cupo. A confirmar con las pruebas 3 y 4 de abajo.

## Esquema (salida JSON)

Se define con Zod en [`esquema.ts`](../../spikes/s2-gemini/src/esquema.ts) y se convierte con
`z.toJSONSchema()` para `config.responseJsonSchema` (con `responseMimeType: 'application/json'`). La
respuesta se vuelve a validar con el mismo esquema Zod. Las listas cerradas van como `enum`, así el modelo
no se inventa estilos.

```ts
RespuestaEtiquetado = { prendas: EtiquetasPrenda[] }   // una por imagen

EtiquetasPrenda = {
  indice: int ≥ 1                 // «Imagen N» → N; así se casa cada respuesta con su foto
  nombre: string                  // «Sudadera gris con capucha»
  categoria: superior | inferior | vestido | abrigo | calzado | accesorio
  subcategoria: string            // camiseta, vaqueros, zapatillas…
  colores: Color[1..3]
  estampado: Estampado
  estilos: Estilo[1..4]           // lista fija de spec.md
  abrigo: int 1..5
  formalidad: int 1..5
  ocasiones: Ocasion[1..5]        // lista fija de spec.md
  temporadas: (primavera | verano | otoño | invierno)[1..4]
  notas: string                   // "" si no hay nada
}
```

**Propuestas nuevas para `spec.md`** (no estaban en el borrador):

- `nombre`: para mostrar la prenda en la lista sin tener que leer todas las etiquetas.
- **Colores, lista cerrada** (para que los filtros funcionen): blanco, crudo, negro, gris, beige, camel,
  marrón, azul marino, azul, celeste, vaquero, verde, caqui, rojo, granate, rosa, morado, amarillo,
  naranja, dorado, plateado.
- **Estampados, lista cerrada:** liso, rayas, cuadros, lunares, flores, animal, geométrico,
  gráfico / logo, camuflaje, tie-dye, otro.

Gemini **no aplica** `minLength`, `maxLength` ni `uniqueItems` (los quita sin avisar); `minItems`,
`maxItems`, `minimum` y `maximum` sí. Por eso la validación con Zod en el cliente es obligatoria.

## Prompt v0 de etiquetado

Va como `systemInstruction`, con `temperature: 0.2`. En el mensaje, cada foto va precedida de una línea
`Imagen N`. Copia de [`prompt.ts`](../../spikes/s2-gemini/src/prompt.ts):

```text
Eres el asistente de etiquetado de Percha, un armario digital.
Recibes fotos de prendas de ropa, calzado o accesorios. Cada foto contiene UNA sola prenda y va precedida
de una línea «Imagen N». Devuelve un objeto por imagen, con «indice» = N, en el mismo orden.

Criterios:
- categoria: superior (camisetas, camisas, jerséis, sudaderas, tops), inferior (pantalones, faldas,
  shorts), vestido (vestidos y monos), abrigo (chaquetas, abrigos, cazadoras, chalecos, blazers),
  calzado, accesorio (bolsos, gorras, cinturones, bufandas, joyas, gafas).
- subcategoria: el tipo concreto en minúsculas y en singular («camiseta», «vaqueros», «zapatillas»).
- colores: de 1 a 3, del más al menos presente; usa solo los de la lista. Un vaquero azul es «vaquero».
- estampado: «liso» si no tiene dibujo.
- estilos: de 1 a 4, solo los que encajen de verdad, el más claro primero.
- abrigo (1–5): cuánto abriga. 1 tirantes/sandalias, 2 camiseta/shorts, 3 camisa/vaquero/zapatilla,
  4 jersey grueso/chaqueta/bota, 5 plumífero/abrigo de lana/bota de nieve.
- formalidad (1–5): 1 deporte o casa, 2 casual, 3 smart casual, 4 oficina formal/cena elegante,
  5 etiqueta (traje, esmoquin, vestido de gala).
- ocasiones: de 1 a 5 de la lista, donde quedaría bien.
- temporadas: en qué estaciones se lleva en un clima templado (España).
- nombre: corto y descriptivo en español («Sudadera gris con capucha»).
- notas: material, corte o detalle útil para combinar; cadena vacía si no hay nada que añadir.

Si una foto no muestra una prenda, etiquétala igualmente con lo más parecido y explícalo en «notas».
```

## Qué se ha probado aquí

| Prueba | Resultado |
|---|---|
| CORS con `fetch` y `x-goog-api-key` (clave falsa) | ✅ El navegador lee el `400 API_KEY_INVALID` de Google: CORS abierto |
| SDK `@google/genai` en el navegador (clave falsa) | ✅ Llega a Google y devuelve el mismo 400, legible |
| Listar modelos y probar búsqueda (clave falsa) | ✅ Mismo 400; el error se muestra limpio |
| Flujo completo con respuesta simulada, 3 fotos sintéticas | ✅ JSON → Zod OK → métricas y registro |
| Reducción de fotos a 768 px en el navegador | ✅ 2000×1500 → 768×576, 4–7 KB en JPEG |
| Página a 375 px | ✅ Sin scroll horizontal |
| La clave no sale de `localStorage` | ✅ «Olvidar» la borra; no se escribe en consola ni en el registro |
| `vite build` | ✅ 497 KB (104 KB gzip), casi todo el SDK y Zod |

## Resultados con 5 prendas — pendiente de la clave

| # | Prueba | Modelo | Fotos | Tokens entrada / imagen / salida | Tiempo | Zod | ¿Etiquetas correctas? |
|---|---|---|---|---|---|---|---|
| 1 | Una a una | 3.5 Flash-Lite | 1 ×5 | | | | |
| 2 | Lote | 3.5 Flash-Lite | 3 | | | | |
| 3 | Lote | 3.5 Flash-Lite | 5 | | | | |
| 4 | Lote grande | 3.5 Flash-Lite | 10 | | | | |
| 5 | Resolución baja | 3.5 Flash-Lite | 5 | | | | |
| 6 | Mejor modelo | 3.8 Flash | 5 | | | | |
| 7 | Búsqueda | 3.5 Flash-Lite / 2.5 Flash | — | | | | |

## Para la app (T1.3 y siguientes)

- Guardar el **id del modelo en Ajustes** (`modeloGemini`), con `gemini-3.5-flash-lite` por defecto. No usar
  alias `-latest`: cambian de modelo por debajo.
- Tratar el **429** (sin cupo) como caso normal: guardar la prenda sin etiquetas, marcarla como pendiente
  y ofrecer reintentar después de las 9:00 o etiquetar a mano.
- La clave, en `localStorage` o IndexedDB, la puede leer cualquier script del mismo origen: nada de
  scripts de terceros en la PWA. En la guía de la clave (T4.2), proponer restringirla al dominio de Percha
  en Google Cloud (a comprobar si las claves de AI Studio lo admiten).
- El SDK pesa ~100 KB gzip. Si importa, la llamada se puede hacer con `fetch` a la API REST (es una
  petición POST); decidirlo en T1.3.
- En este PC, `pnpm` no está en el PATH y el pnpm de corepack (12.16.1) está roto; `npx pnpm@10` funciona.

## Pasos para el usuario

**A. Conseguir la clave gratis (5 min)**

1. Abre [aistudio.google.com/apikey](https://aistudio.google.com/apikey) con tu cuenta de Google y acepta
   las condiciones.
2. Pulsa **Create API key**. Si te pide proyecto, deja que cree uno nuevo. **No actives la facturación**:
   sin ella te quedas en el nivel gratis y no te pueden cobrar.
3. Copia la clave. No la pegues en el chat ni en ningún fichero.

**B. Mirar tus límites reales**

4. En AI Studio, abre **Usage / Rate limits** de tu proyecto (en la página de *Projects* sale tu nivel).
5. Apunta RPM y RPD de `gemini-3.5-flash-lite`, `gemini-3.8-flash` y, si aparece, `gemini-2.5-flash`, y
   dime si alguno sale distinto de la tabla de arriba.

**C. Probar la página en el PC**

6. En una terminal:
   ```
   cd C:\Users\dotoy\proyectos\Percha-wt-s2\spikes\s2-gemini
   npx pnpm@10 install
   npx pnpm@10 dev
   ```
7. Abre <http://localhost:5173>, pega la clave y pulsa **Ver modelos de mi clave** y **Comprobar CORS**.
8. Haz fotos de 5 prendas (camiseta, pantalón, zapatillas, chaqueta y algo con estampado) y guárdalas en
   `C:\Users\dotoy\proyectos\Percha-wt-s2\muestras\` (no se suben al repo).
9. Haz las pruebas 1–7 de la tabla de arriba. Para la 7, pon el modelo y pulsa **Probar búsqueda**.
10. Pulsa **Copiar en Markdown** y pégame la tabla. Dime también si alguna etiqueta está mal (p. ej. «la
    chaqueta salió con abrigo 2»).

**D. (Opcional) En el móvil**

11. Con el PC y el móvil en la misma wifi: `npx pnpm@10 dev --host` y abre en Chrome la dirección
    `Network` que sale. Pega la clave y prueba 1 foto hecha con la cámara.
