Pantalla Perfil: fotos de cuerpo entero y de cara, ciudad por defecto y estilos favoritos.

- `Perfil.tsx`: lee el perfil con `leerPerfil()` y guarda cada cambio con `guardarPerfil()`, solo el campo
  que cambia. Las fotos pasan por `normalizarFoto` (EXIF, 1280 px, JPEG) antes de guardarse; no se
  recortan. La ciudad se guarda con su botón y los estilos al tocarlos. Recibe `leer`, `guardar` y
  `normalizar` para los tests.
- `FotoPerfil.tsx`: la tarjeta de una foto, con «Cámara» (frontal para la cara, trasera para el cuerpo),
  «Galería» y «Borrar» con confirmación.

**Para leer las fotos (T3.2):** `leerPerfil()` de `src/datos/repositorio.ts` devuelve
`{ fotoCuerpo, fotoCara, ciudad, estilosFavoritos }`. Cada foto es un `Blob` JPEG de 1280 px de lado
mayor como mucho, o `null` si el usuario no la ha puesto.
