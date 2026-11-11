Tablas de tallas de las tiendas (T10.1, D22).

- `TablasTallas.tsx`: lista, «Añadir desde foto», «Escribirla a mano», «Ver», «Editar» y «Borrar» (con
  confirmación).
  - Sin `de`, enseña todas: se usa en Perfil, bajo «Tus tallas por marca».
  - Con `de={{ marca, tipo }}`, solo la de esa marca y tipo: se usa en el detalle de una prenda con marca.
    Ahí la tabla leída se guarda con la marca y el tipo de la prenda, aunque la captura diga otra cosa.
  - Si se va a guardar una tabla de una marca y tipo que ya tienen otra, pregunta antes de sustituirla.
  - Recibe `listar`, `guardar`, `borrar` y `obtenerProveedor` para los tests. Por defecto usa el
    repositorio y `proveedorConClave`.
- `EditorTablaTallas.tsx`: revisar lo leído o escribirlo a mano.
  - Marca, tipo y «las medidas son de tu cuerpo / de la prenda».
  - Una fila por talla, con las columnas de `MEDIDAS_POR_TIPO` en cm (admite coma decimal).
  - Tiene scroll horizontal propio, para que la página no se salga de los 375 px.
- `tablas.ts`:
  - `tipoTallaDe(categoria)`: qué tabla usa una prenda; los accesorios no tienen.
  - El borrador del editor y `validarBorradorTabla`: solo cuentan las medidas del tipo, y las filas vacías se
    ignoran.
  - Errores claros para la marca vacía, una talla sin medidas, números raros y tallas repetidas.
- La captura la hace el usuario. Percha nunca descarga la guía de la tienda.
