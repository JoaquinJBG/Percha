Base de datos local con Dexie (IndexedDB) y exportar/importar la copia del armario.

- `modelo.ts`: listas fijas (`CATEGORIAS`, `ESTILOS`, `OCASIONES`, `TEMPORADAS`), esquemas Zod
  (`prendaSchema`, `camposPrendaSchema` sin fotos, `outfitSchema`, `perfilSchema`, `ajustesSchema`) y
  sus tipos. `COLORES` y `ESTAMPADOS` son las listas cerradas que usan la IA y el formulario (D14); el
  modelo sigue admitiendo texto libre. `etiquetasPrendaSchema` / `EtiquetasPrenda`: solo los campos que
  etiqueta la IA o el formulario (sin `id`, fotos, `etiquetadaPor` ni fecha). Una prenda tiene 1–2 `fotos`, cada una `{ original: Blob, recortada: Blob | null }`.
- `detalles.ts` (T8.1, D20): `detallesQueAplican({ categoria, subcategoria })` da, para cada detalle que va
  con ese tipo (`corte`, `tiro`, `largo`, `manga`, `cuello`), su lista de opciones; `soloLosQueAplican`
  quita lo que no vale (con las claves en `undefined`, para que `actualizarPrenda` lo borre al editar) y
  `resumenCorte` da «Zara · balloon · 44». `listarPrendas({ corte })` filtra por corte.
- `capas.ts` (T6.1, D18): `capasDe(prenda)` da los papeles de una prenda de arriba (`base`, `media`,
  `exterior`): los guardados en `capas` o, si no hay (prendas de antes), `capasPorDefecto({ categoria,
  subcategoria })` con la tabla de la investigación de outfits. `llevaCapas(categoria)`: solo `superior` y
  `abrigo`. Quien monte outfits debe usar `capasDe`, no `prenda.capas`.

- Perfil (T8.2): además de fotos, ciudad y estilos, lleva opcionales `cuerpo` (`cuerpoSchema`: medidas
  en cm y kg con su rango en `MEDIDAS`, `complexion` de `COMPLEXIONES` y `notas`), `tallas`
  (`tallaMarcaSchema`, como mucho `MAX_TALLAS`), `oficina` (`TIPOS_OFICINA` y `viernesCasual`) y
  `sensacionTermica` (`SENSACIONES_TERMICAS`). Los perfiles y copias de antes siguen valiendo; al fusionar
  una copia, el cuerpo se mezcla medida a medida.
- Privado (T8.3, D21): `privadoSchema` con `fotoInterior`, la foto en ropa interior solo para el probador
  del PC. Va en su propia tabla `privado` (Dexie v3) y no en el perfil: la copia no la exporta ni la
  importa (tampoco la borra al reemplazar) y Gemini nunca la ve. `leerFotoInterior()` y
  `guardarFotoInterior(foto | null)` en `repositorio.ts`.
- `cuerpo.ts`: `resumenCuerpo(perfil)`, el cuerpo en una línea corta para un prompt.
- `repositorio.ts`: `crearPrenda`, `leerPrenda`, `listarPrendas({ categoria, estilo, color })`,
  `actualizarPrenda`, `borrarPrenda`; `guardarOutfit`, `listarOutfits`, `marcarFavorito`, `guardarPrueba` (la foto del probador del PC, T7.1),
  `borrarOutfit`;
  `leerPerfil`/`guardarPerfil` y `leerAjustes`/`guardarAjustes` (guardan solo los campos que se pasan).
  Todo lo que escribe valida con Zod y lanza `ZodError` si los datos no valen.
- `copia.ts`: `exportarCopia()` devuelve un zip (`percha.json` + `fotos/`) sin la clave de Gemini;
  `importarCopia(fichero, 'reemplazar' | 'fusionar')` lo valida entero y lo aplica en una transacción, o
  lanza `ErrorCopia` con un mensaje para el usuario.
- `db.ts`: la base (`db`) y `pedirAlmacenamientoPersistente()`, que se llama al arrancar.

Los tests que tocan la base corren en Node (`// @vitest-environment node`) con `fake-indexeddb/auto`:
el `Blob` de jsdom no se puede guardar en fake-indexeddb.
