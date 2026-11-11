Pantalla Perfil: fotos de cuerpo entero y de cara, tu cuerpo, tallas por marca, trabajo y temperatura,
ciudad por defecto y estilos favoritos.

- `Perfil.tsx`: lee el perfil con `leerPerfil()` y guarda cada cambio con `guardarPerfil()`, solo el campo
  que cambia. Las fotos pasan por `normalizarFoto` (EXIF, 1280 px, JPEG) antes de guardarse; no se
  recortan. La ciudad se guarda con su botón y los estilos al tocarlos. Recibe `leer`, `guardar` y
  `normalizar` para los tests.
- **Fotos (T8.3, D21):** la de cuerpo entero es la **foto de referencia** y lleva al lado
  `GuiaFotoReferencia.tsx`, plegada: ropa (tirantes ajustada y mallas, lisas), pose y encuadre, con un
  dibujo SVG hecho en código. La sección «Foto en ropa interior» es opcional y solo para el probador del
  PC: se lee y guarda con `leerFotoInterior` / `guardarFotoInterior` (props `leerInterior` y
  `guardarInterior`), aparte del perfil; nunca va a Gemini ni en la copia.
- `FotoPerfil.tsx`: la tarjeta de una foto, con «Cámara» (frontal para la cara, trasera para el cuerpo),
  «Galería» y «Borrar» con confirmación.
- `CuerpoPerfil.tsx` (T8.2): medidas con «Cómo medirte» en cada una, complexión y una línea libre. Se
  guardan juntas con «Guardar medidas» y se validan con `cuerpoSchema`; admite coma decimal y, si se vacía
  todo, el perfil se queda sin `cuerpo`.
- `TallasPerfil.tsx` (T8.2): tallas por marca y tipo. Una marca (sin distinguir mayúsculas) y un tipo
  tienen una sola talla: añadirla otra vez la cambia. Como mucho `MAX_TALLAS`.
- Debajo, «Tablas de tallas de las tiendas» (T10.1): `TablasTallas` de `src/componentes/tablas-tallas/`
  con todas las tablas guardadas. El mismo componente sale en el detalle de una prenda con marca, solo con
  la de su marca y tipo.
- `TrabajoPerfil.tsx` (T8.2): tipo de oficina, viernes casual y sensación térmica; se guardan al tocarlos
  y se desmarcan con otro toque.
- `comun.ts` y `LineaAviso.tsx`: clases y el aviso de cada parte.

**Para leer el perfil:** `leerPerfil()` de `src/datos/repositorio.ts`. Las fotos (`fotoCuerpo`,
`fotoCara`) son `Blob` JPEG de 1280 px de lado mayor como mucho, o `null`. `cuerpo`, `tallas`, `oficina`
y `sensacionTermica` son opcionales. `resumenCuerpo(perfil)` de `src/datos/cuerpo.ts` deja el cuerpo en
una línea («176 cm, 100 kg, complexión grande, hombros anchos»); todavía no se manda a Gemini (T8.4).
