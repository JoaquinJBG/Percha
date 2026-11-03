Pantalla Outfits: estilo, ocasión y tiempo de hoy → 4 outfits en un collage 2×2.

- `Outfits.tsx`: estilo y ocasión (listas fijas de `datos/modelo.ts`; la última elección se recuerda en
  `localStorage` con `eleccion.ts`), la tarjeta `TiempoHoy` (avisa del tiempo con `alCambiar`) y
  «Generar». Sin tiempo se genera igual, con la fecha local para la temporada. Si el selector no da
  outfits, enseña sus `avisos` («te falta calzado») con un enlace a `/prendas/nueva`.
- **Selector (`selector.ts`):** `SelectorOutfits = (peticion, intento) => Promise<ResultadoOutfits<Prenda>>`.
  Por defecto `outfitsPorReglas` (`cuatroOutfits` con `intento` como semilla, así «Generar otros» da otra
  tanda). **T2.5** pasa el de la IA en la prop `elegir` de `<Outfits />` (en `app/rutas.tsx`) o cambia ahí
  el valor por defecto; tiene que devolver la misma forma y meter en `avisos` lo que quiera decir
  («sin cupo de IA: outfits por reglas»).
- `Resultado.tsx`: se monta con una `key` por tanda. Dibuja el collage con `crearCollage`, lista los
  motivos numerados y tiene **Guardar** (cada outfit con `guardarOutfit`, uno a uno: si falla a medias,
  reintentar no duplica), la estrella de **favorito** (guarda el outfit si aún no lo estaba, o
  `marcarFavorito`), **Descargar** (`<a download>`) y **Compartir** (Web Share con el JPEG como fichero;
  solo aparece si `navigator.canShare({ files })` dice que sí). El texto no va en `share()`: con imágenes,
  Gemini y otras apps lo ignoran (D13).
- Todo se inyecta por props para los tests (`listar`, `componer`, `guardar`, `marcar`, `compartidor`,
  `almacenEleccion`, `propsTiempo`, `hoy`).
