Collage 2×2 de los outfits en un canvas, para verlo, descargarlo y compartirlo.

- `crearCollage(outfits, { cargar?, crearLienzo? })` → `Blob` JPEG de **1080×1350** (4:5 vertical: llena
  la pantalla del móvil y es el tamaño vertical de las redes). Cada outfit es `{ prendas, motivo }`; se usa
  la foto recortada de la primera foto de cada prenda o, si no la hay, la original. Una foto que no se
  puede leer deja un hueco con el nombre de la prenda en vez de romper el collage. Con menos de 4 outfits,
  los recuadros que sobran quedan vacíos.
- `dibujarCollage(pincel, recuadros)`: el dibujo, sin cargar nada; `pincel` es lo que se usa del contexto
  2D (`Pincel`). Los tests le pasan `pincelFalso()`, que apunta cada orden.
- `disponer(lugares, caja)`: dónde va cada prenda en su recuadro, por su ranura (`base`, `media`,
  `exterior`…; si solo se sabe la categoría, `superior` cuenta como base y `abrigo` como exterior). En el
  centro, de arriba abajo, la base (o el vestido), la de abajo y el calzado; a la derecha, de fuera adentro,
  la exterior y las medias, y debajo los accesorios (62/38, o 55/45 con cuatro o más a la derecha). Caben
  hasta 8 prendas; sin nada a la derecha, el centro ocupa todo. `encajar` mete la foto entera, centrada y
  sin deformarla.
- Cada outfit puede traer `ranuras`; si no, salen de `ranurasDe` (`src/outfits/reglas/`), que las deduce del
  orden de dentro afuera.
- Cada recuadro lleva abajo su número (el mismo que la lista de la pantalla) y, a su lado, el motivo
  en dos líneas como mucho, con «…» si no cabe. Las fotos se leen una vez cada una, de una en una y a
  640 px de alto como mucho, para no disparar la memoria del móvil.
