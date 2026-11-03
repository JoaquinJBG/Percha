Pantalla Outfits: estilo, ocasión y tiempo de hoy → 4 outfits en un collage 2×2.

- `Outfits.tsx`: estilo y ocasión (listas fijas de `datos/modelo.ts`; la última elección se recuerda en
  `localStorage` con `eleccion.ts`), la tarjeta `TiempoHoy` (avisa del tiempo con `alCambiar`) y
  «Generar». Sin tiempo se genera igual, con la fecha local para la temporada. Si el selector no da
  outfits, enseña sus `avisos` («te falta calzado») con un enlace a `/prendas/nueva`.
- **Selector (`selector.ts`):** `SelectorOutfits = (peticion, intento, { signal, alPreguntarIA }) =>
  Promise<ResultadoSelector>`: lo de `cuatroOutfits` con `origen` (`ia` o `reglas`) en cada outfit y
  `avisoIA` aparte de `avisos`. `intento` empieza en 1 y sube en cada «Generar»: es la semilla de las
  reglas y de Gemini, así «Generar otros» da otra tanda. Por defecto `outfitsPorReglas`; la app
  (`app/rutas.tsx`) pasa `outfitsConIAoReglas`: con clave (`proveedorConClave`, que en `pnpm dev` acepta el
  proveedor falso de `localStorage['percha:ia-falsa']`) usa `elegirOutfitsConIA`; sin clave, las reglas
  sin decir nada. Si las reglas no sacan ninguno (falta calzado…), no se pregunta a la IA. Si la IA falla o no hay cupo, salen las reglas con el aviso de `elegirOutfitsConIA`
  en `avisoIA`, que la pantalla enseña aparte (no es ropa que falte).
- **Con IA**, el botón dice «Gemini está eligiendo…» y aparece **Cancelar**: aborta la petición y vuelve
  a la tanda anterior tal cual (sigue montada, oculta, mientras se espera). Salir de la pantalla también
  aborta. Lo que llegue tarde se descarta.
- **Variedad:** la API de la IA no admite «evitar estos outfits», así que «Generar otros» solo cambia la
  semilla. Las reglas sí cambian de tanda; Gemini suele variar, pero no está garantizado.
- `Resultado.tsx`: se monta con una `key` por tanda. Dibuja el collage con `crearCollage`, lista los
  motivos numerados (la frase de Gemini o el motivo de las reglas, con «Elegido por …» debajo) y tiene
  **Guardar** (cada outfit con `guardarOutfit`, uno a uno: si falla a medias, reintentar no duplica), la estrella de **favorito** (guarda el outfit si aún no lo estaba, o
  `marcarFavorito`), **Descargar** (`<a download>`) y **Compartir** (Web Share con el JPEG como fichero;
  solo aparece si `navigator.canShare({ files })` dice que sí). El texto no va en `share()`: con imágenes,
  Gemini y otras apps lo ignoran (D13).
- Todo se inyecta por props para los tests (`listar`, `componer`, `guardar`, `marcar`, `compartidor`,
  `almacenEleccion`, `propsTiempo`, `hoy`).
