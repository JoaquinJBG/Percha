Pantalla «Desde la tienda» (`/compartido`, T5.1). Es el `share_target` del manifiesto (`vite.config.ts`,
GET con `title`, `text` y `url`): en Android, «Compartir» › Percha desde la ficha de una tienda.

- Sin un enlace web, explica cómo compartir.
- «Nueva prenda con este enlace» abre `/prendas/nueva` con el enlace en el estado de la navegación; allí se
  rellenan `enlace`, y la marca y la referencia si salen de la URL.
- O se elige una prenda del armario (con confirmación) y se le guarda `enlace` con `actualizarPrenda`;
  luego se abre su detalle.
- Percha no abre ni descarga el enlace (D17). La foto de la ficha vuelve como captura por el selector de
  fotos de «Nueva prenda».

`listar` y `actualizar` se pasan por props en los tests.
