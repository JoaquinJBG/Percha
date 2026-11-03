Lo que comparten «Nueva prenda» y «Editar» para etiquetar una prenda con la IA. Se importa desde `index.ts`.

- `proveedorConClave()`: el proveedor Gemini con la clave y el modelo de Ajustes, o `null` si no hay clave (así
  la pantalla puede avisar antes de pedir nada). En `pnpm dev`, `localStorage['percha:ia-falsa']` = `ok` o un
  tipo de `ErrorIA` (`sin-cupo`, `sin-red`, `clave-mala`…) usa el proveedor falso con 1,5 s de espera (también al
  elegir outfits, para la pantalla Outfits); no llega al build.
- `useEtiquetadoIA(obtener)`: `etiquetar(fotos)` → `{ etiquetas }`, `{ aviso }` o `null` si se cancela;
  `cancelar()` y desmontar abortan la petición, y lo que llegue tarde se descarta.
- `AvisoEtiquetado`: el motivo, «Ir a Ajustes» si el arreglo está allí (sin clave, clave mala, modelo) y
  «Probar otra vez» si es pasajero (sin red, sin cupo, respuesta mala…).
- `etiquetadaPor(base, guardadas)`: D15. Sigue en `'ia'` si solo se afinan detalles; pasa a `'manual'` si cambia
  la categoría o el tipo.
- `fotosParaIA(fotos)`: la recortada de cada foto, o la original si no la hay.
