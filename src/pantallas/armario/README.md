Pantalla Armario: lista de prendas con filtros, detalle y borrar.

- `Armario.tsx`: carga el armario con `listarPrendas()` y, si hay filtros, pide a `listarPrendas(filtros)`
  solo qué ids se ven (las fotos salen siempre de la lista completa, así las que siguen a la vista no recrean su URL).
  El detalle va en la URL (`/?prenda=<id>`) para que «atrás» lo cierre. Recibe `listar`, `borrar`,
  `actualizar` y `obtenerProveedor` para los tests.
- `FiltrosArmario.tsx`: categoría (botones), estilo y color (desplegables); solo ofrece opciones que
  existen en el armario.
- `RejillaPrendas.tsx`: rejilla de 3 columnas agrupada por categoría.
- `DetallePrenda.tsx`: fotos, etiquetas en solo lectura (con marca, referencia, talla y composición si las
  hay, y los enlaces de búsqueda de `src/etiqueta/`), «Editar» y borrar con confirmación.
- `EditarPrenda.tsx`: `FormularioPrenda` con la prenda, guarda con `actualizarPrenda` y tiene «Volver a
  etiquetar con IA» (las notas del usuario se quedan si la IA no trae ninguna). Va en la URL
  (`/?prenda=<id>&editar=1`), así que «atrás» vuelve al detalle.
- «Añadir prenda» (cabecera y armario vacío) lleva a `/prendas/nueva`.
- `FotoBlob.tsx`: `<img>` de un `Blob`; crea la URL al montarse y la libera al desmontarse.
