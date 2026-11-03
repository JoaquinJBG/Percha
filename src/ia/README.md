Proveedores de IA detrás de la interfaz `ProveedorIA` (v1: Gemini con la clave del usuario). Se importa
todo desde `src/ia/index.ts`.

- `ProveedorIA`:
  - `etiquetarPrendas(prendas: { fotos: Blob[] }[], { signal }?)`: hasta `MAX_PRENDAS_POR_PETICION` (5)
    prendas con 1–2 fotos cada una, en **una** petición. Devuelve `(EtiquetasPrenda | null)[]` en el mismo
    orden: `null` si la IA no dio nada válido para esa prenda. Si no vale ninguna, lanza `ErrorIA`.
  - `comprobarClave({ signal }?)`: se resuelve si la clave y el modelo valen.
- `proveedorDesdeAjustes()`: el proveedor Gemini con la clave y el modelo guardados. Sin clave, sus llamadas
  lanzan `ErrorIA('sin-clave')`.
- `crearProveedorGemini({ clave, modelo })`: usa `@google/genai` (se carga al primer uso), salida JSON
  con esquema (`esquema.ts`) y prompt de `prompt.ts`. Las fotos se reducen a 768 px en JPEG con fondo
  blanco (`fotos.ts`).
- `crearProveedorFalso({ etiquetas?, error? })` y `ETIQUETAS_DE_PRUEBA`: sin red, para tests y pantallas.
- `ErrorIA`: `tipo` (`sin-clave`, `clave-mala`, `sin-cupo`, `sin-red`, `modelo`, `no-disponible`,
  `respuesta`, `otro`) y `message` listo para enseñar. No guarda el error de Google ni la clave. Una
  cancelación con `signal` llega como el `AbortError` de siempre.

La respuesta se valida con Zod dos veces: con las listas cerradas de la IA (colores, estampados, 1–3
colores, 1–4 estilos…) y con `etiquetasPrendaSchema` de `src/datos/modelo.ts`.
