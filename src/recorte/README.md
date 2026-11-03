Recorte del fondo de las fotos de prendas en el propio navegador (decisión D10).

- `index.ts`: lo que usa la app.
  - `normalizarFoto(blob)`: endereza la foto según su EXIF, la reduce a `LADO_MAXIMO` (1280 px) y la
    devuelve en JPEG. Lanza `ErrorFoto` si no se puede abrir.
  - `recortar(blob, { alProgresar })`: devuelve un PNG con el fondo transparente, del mismo tamaño.
    `alProgresar` recibe `{ cargados, total }` en bytes mientras se carga el modelo. Lanza `ErrorRecorte`
    si falla.
- `recortador.ts`: crea el Web Worker con la primera foto y lo reutiliza; `crearRecortador` admite un
  worker falso para los tests.
- `worker.ts` + `modelo.ts`: Transformers.js con `briaai/RMBG-1.4`, cargado una vez por worker. WebGPU
  (fp16 si la GPU tiene `shader-f16`, si no fp32) y WASM q8 de respaldo. Recorta las fotos de una en una.

El modelo (88 MB en WebGPU, 44 MB en WASM) viene de Hugging Face y el runtime de ONNX (5,6 MB) de
jsDelivr; Transformers.js los guarda en la Cache API. Para que WASM use varios hilos hace falta
aislamiento entre orígenes: COOP/COEP en `vite.config.ts` (dev y preview) y `public/_headers`
(Cloudflare). Ese fichero también quita el Referer: Hugging Face no sirve el modelo a webs de `*.workers.dev`.
Licencia del modelo: CC BY-NC 4.0, solo uso no comercial.
