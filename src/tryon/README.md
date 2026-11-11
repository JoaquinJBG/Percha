*Try-on* con la app de Gemini del móvil (D13, variante D de [S3](../../docs/spikes/s3-compartir.md)): una
sola imagen con la persona y las prendas, y el prompt copiado al portapapeles (dentro de `share()` Gemini no
lo recibe).

- `prepararTryOn(fotoCuerpo, prendas, { cargar?, crearLienzo? })` → `{ fichero, texto }`. El fichero es un
  JPEG de **1200×1500** (`percha-pruebatelo.jpg`): fondo blanco, la foto de cuerpo entero a la izquierda
  (720 px) y las prendas en columna a la derecha, de arriba abajo en el orden en que se llevan (abrigo,
  arriba, vestido, abajo, calzado, accesorios). Usa la foto recortada de cada prenda o, si no la hay, la
  original (`fotoDe` del collage). Una prenda cuya foto no se lee se queda fuera **de la imagen y del
  texto**; sin persona o sin ninguna prenda falla con `ErrorTryOn` (`motivo`: `'foto-persona'` |
  `'sin-prendas'`). Los tests pasan un `cargar` y un lienzo falsos.
- `promptTryOn(prendas)`: el prompt v0 de S3 para la imagen compuesta, en primera persona, con cada prenda
  descrita por `describirPrenda` a partir de sus etiquetas: «camisa de color azul y blanco, de rayas». El
  color va con «de color» para no concordar el género; liso y «otro» no se dicen.
- `copiarTexto(texto)`: `clipboard.writeText` y, si no deja, selección + `execCommand('copy')`. Devuelve si
  copió.

La interfaz es `BotonPruebatelo` (`src/componentes/`), montado en cada outfit de
`pantallas/outfits/Resultado.tsx`. Desde T7.1, si hay probador del PC en Ajustes va primero allí
(`src/probador/`, D19) y Gemini queda como «Probar con Gemini» cuando el PC falla o hay capas. Con Gemini:
lee `fotoCuerpo` del perfil al pulsar (sin foto, explica y enlaza a
Perfil), prepara la imagen una vez, copia el texto, comprueba `navigator.canShare({ files })` y abre la hoja
de compartir con **solo** la imagen. Sin Web Share con ficheros ofrece «Descargar imagen» y «Copiar texto».
Si `share()` da `NotAllowedError` (el toque ya no cuenta como gesto porque preparar tardó), pide otro
toque en «Compartir». La primera vez el aviso dice que la foto solo sale del móvil al elegir a dónde
compartirla (`localStorage`, `percha:tryon:privacidad-vista`).

**Pendiente (T8.4 lo dejó sin tocar):** `describirPrenda` podría añadir el `corte` y el `largo` de T8.1
(«vaqueros de color azul, corte recto, tobilleros»), que es lo que más cambia cómo cae la prenda en la
foto. Lo mismo para el probador del PC (`src/probador/`). Del cuerpo, como mucho la altura y la
complexión, nunca las medidas.
