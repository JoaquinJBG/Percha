Base de datos local con Dexie (IndexedDB) y exportar/importar la copia del armario.

- `modelo.ts`: listas fijas (`CATEGORIAS`, `ESTILOS`, `OCASIONES`, `TEMPORADAS`), esquemas Zod
  (`prendaSchema`, `camposPrendaSchema` sin fotos, `outfitSchema`, `perfilSchema`, `ajustesSchema`) y
  sus tipos. `COLORES` y `ESTAMPADOS` son las listas cerradas que usan la IA y el formulario (D14); el
  modelo sigue admitiendo texto libre. `etiquetasPrendaSchema` / `EtiquetasPrenda`: solo los campos que
  etiqueta la IA o el formulario (sin `id`, fotos, `etiquetadaPor` ni fecha). Una prenda tiene 1–2 `fotos`, cada una `{ original: Blob, recortada: Blob | null }`.
- `repositorio.ts`: `crearPrenda`, `leerPrenda`, `listarPrendas({ categoria, estilo, color })`,
  `actualizarPrenda`, `borrarPrenda`; `guardarOutfit`, `listarOutfits`, `marcarFavorito`, `borrarOutfit`;
  `leerPerfil`/`guardarPerfil` y `leerAjustes`/`guardarAjustes` (guardan solo los campos que se pasan).
  Todo lo que escribe valida con Zod y lanza `ZodError` si los datos no valen.
- `copia.ts`: `exportarCopia()` devuelve un zip (`percha.json` + `fotos/`) sin la clave de Gemini;
  `importarCopia(fichero, 'reemplazar' | 'fusionar')` lo valida entero y lo aplica en una transacción, o
  lanza `ErrorCopia` con un mensaje para el usuario.
- `db.ts`: la base (`db`) y `pedirAlmacenamientoPersistente()`, que se llama al arrancar.

Los tests que tocan la base corren en Node (`// @vitest-environment node`) con `fake-indexeddb/auto`:
el `Blob` de jsdom no se puede guardar en fake-indexeddb.
