Pantalla Armario: lista de prendas con filtros, detalle y borrar.

- `Armario.tsx`: carga el armario con `listarPrendas()` y, si hay filtros, pide a `listarPrendas(filtros)`
  solo qué ids se ven (las fotos salen siempre de la lista completa, así las que siguen a la vista no recrean su URL).
  El detalle va en la URL (`/?prenda=<id>`) para que «atrás» lo cierre. Recibe `listar` y `borrar` para
  los tests.
- `FiltrosArmario.tsx`: categoría (botones), estilo y color (desplegables); solo ofrece opciones que
  existen en el armario.
- `RejillaPrendas.tsx`: rejilla de 3 columnas agrupada por categoría.
- `DetallePrenda.tsx`: fotos, etiquetas en solo lectura y borrar con confirmación. **Editar (T1.5):** la
  prop `onEditar` hace aparecer el botón «Editar» junto a «Borrar»; `Armario.tsx` aún no la pasa.
- `FotoBlob.tsx`: `<img>` de un `Blob`; crea la URL al montarse y la libera al desmontarse.
