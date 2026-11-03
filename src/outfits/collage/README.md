Collage 2×2 de los outfits en un canvas, para verlo, descargarlo y compartirlo.

- `crearCollage(outfits, { cargar?, crearLienzo? })` → `Blob` JPEG de **1080×1350** (4:5 vertical: llena
  la pantalla del móvil y es el tamaño vertical de las redes). Cada outfit es `{ prendas, motivo }`; se usa
  la foto recortada de la primera foto de cada prenda o, si no la hay, la original. Una foto que no se
  puede leer deja un hueco con el nombre de la prenda en vez de romper el collage. Con menos de 4 outfits,
  los recuadros que sobran quedan vacíos.
- `dibujarCollage(pincel, recuadros)`: el dibujo, sin cargar nada; `pincel` es lo que se usa del contexto
  2D (`Pincel`). Los tests le pasan `pincelFalso()`, que apunta cada orden.
- `disponer(categorias, caja)`: dónde va cada prenda en su recuadro. En el centro, de arriba abajo, la parte
  de arriba (o el vestido), la de abajo y el calzado; el abrigo y los accesorios, en una columna a la
  derecha (62/38). Sin abrigo ni accesorios, el centro ocupa todo. `encajar` mete la foto entera, centrada
  y sin deformarla.
- Cada recuadro lleva abajo su número (el mismo que la lista de la pantalla) y, a su lado, el motivo
  en dos líneas como mucho, con «…» si no cabe. Las fotos se leen una vez cada una, de una en una y a
  640 px de alto como mucho, para no disparar la memoria del móvil.
