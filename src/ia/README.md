Proveedores de IA detrás de la interfaz `ProveedorIA` (v1: Gemini con la clave del usuario). Se importa
todo desde `src/ia/index.ts`.

- `ProveedorIA`:
  - `etiquetarPrendas(prendas: { fotos: Blob[] }[], { signal }?)`: hasta `MAX_PRENDAS_POR_PETICION` (5)
    prendas con 1–2 fotos cada una, en **una** petición. Devuelve `(EtiquetasPrenda | null)[]` en el mismo
    orden: `null` si la IA no dio nada válido para esa prenda. Si no vale ninguna, lanza `ErrorIA`.
  - `elegirOutfits({ prendas, estilo, ocasion, tiempo, semilla? }, { signal }?)`: hasta 4 outfits
    (`{ prendas: string[], porque: string }`) elegidos entre las prendas recibidas, que van **en texto y
    sin fotos** (id y etiquetas). No comprueba que el outfit valga: eso lo hace `src/outfits/ia/`. Si no
    llega ninguno con forma válida, lanza `ErrorIA('respuesta')`.
  - `leerEtiqueta(foto, { signal }?)`: lee la foto de la etiqueta cosida y devuelve
    `{ marca?, referencia?, talla?, composicion? }` (T5.1). Solo lo que se ve; `{}` si no se lee nada. La
    foto va a 1536 px (la letra es pequeña). Prompt en `prompt-etiqueta.ts` y esquema en
    `esquema-etiqueta.ts`: para Gemini todo es obligatorio y «no se ve» es vacío; al leer se quitan los
    vacíos y un campo raro no tira el resto.
  - `comprobarClave({ signal }?)`: se resuelve si la clave y el modelo valen.
- `proveedorDesdeAjustes()`: el proveedor Gemini con la clave y el modelo guardados. Sin clave, sus llamadas
  lanzan `ErrorIA('sin-clave')`.
- `crearProveedorGemini({ clave, modelo })`: usa `@google/genai` (se carga al primer uso), salida JSON
  con esquema (`esquema.ts`) y prompt de `prompt.ts`. Las fotos se reducen a 768 px en JPEG con fondo
  blanco (`fotos.ts`).
- Outfits en Gemini: el prompt está en `prompt-outfits.ts` (v2, §9.1 de la investigación de moda: capas,
  formalidad, color y variedad, por bloques; el del perfil de cuerpo llega con T6.5) y el esquema en
  `esquema-outfits.ts` (hasta `MAX_PRENDAS_POR_OUTFIT` = 8 prendas por outfit). En la petición, cada
  prenda lleva sus `capas` (las guardadas o las de `capasDe`), su composición si la hay y «opcional» si es
  tercera pieza; el tiempo dice si la capa exterior es `obligatoria`, `opcional` o `no` (lo decide
  `src/outfits/ia/`). Cada
  prenda va como una línea con una referencia corta (`P1`, `P2`…) en vez de su UUID, que se traduce de
  vuelta al leer; una referencia que no se envió se deja tal cual para que se vea que no existe. La
  `semilla` va como `seed`.
- `crearProveedorFalso({ etiquetas?, outfits?, etiqueta?, error? })`, `ETIQUETAS_DE_PRUEBA`,
  `ETIQUETA_DE_PRUEBA` (una de Zara) y `outfitsDePrueba`: sin red, para tests y pantallas.
- `ErrorIA`: `tipo` (`sin-clave`, `clave-mala`, `sin-cupo`, `sin-red`, `modelo`, `no-disponible`,
  `respuesta`, `otro`) y `message` listo para enseñar. No guarda el error de Google ni la clave. Una
  cancelación con `signal` llega como el `AbortError` de siempre.

La respuesta se valida con Zod dos veces: con las listas cerradas de la IA (colores, estampados, 1–3
colores, 1–4 estilos…) y con `etiquetasPrendaSchema` de `src/datos/modelo.ts`. Las `capas` (T6.1) se leen
aparte: solo en `superior` y `abrigo`, y si faltan, vienen vacías o no valen, se ponen las de
`capasPorDefecto`, sin perder la prenda. El corte y
los detalles (T8.1) también: se quedan solo los que valen para el tipo de la prenda.
