# Percha — Especificación v1

Fecha: 2026-11-02. Estado: plan aprobado; fase 0 cerrada (esqueleto y *spikes* probados en Android).

## Qué es y para quién

Un armario digital en el móvil que propone outfits. Uso **privado**: el usuario y sus amigos cercanos.
Se reparte con un enlace; no hay tiendas de apps.

## Principios

- **Coste cero.** Nada de pago para probar la primera versión: ni servidor, ni imágenes de pago.
- **Sin servidor y sin PC encendido.** La PWA es estática y se aloja gratis.
- **Los datos se quedan en el móvil** (IndexedDB). Las fotos de cara y cuerpo no salen del teléfono,
  salvo hacia la IA que elija el usuario.
- **Cada usuario pone su IA** (*bring your own key*): su clave de API, guardada solo en su móvil.
  La v1 soporta **Gemini**, que tiene nivel gratis para leer fotos y texto.
- **La app funciona aunque no haya IA**: etiquetado a mano y outfits por reglas.

## MVP (v1)

1. **Armario**
   - Alta de prenda o calzado con **1–2 fotos** (cámara o galería). **Una prenda por foto.**
   - **Recorte del fondo en el propio móvil.**
   - **Etiquetado con IA** (editable a mano): categoría, subcategoría, colores, estampado, estilos (de la
     lista fija), nivel de abrigo (1–5), formalidad (1–5), ocasiones y temporada.
   - Lista del armario con filtros por categoría, estilo y color; editar y borrar.
2. **Perfil**
   - Fotos de cara y cuerpo (opcionales), guardadas solo en el móvil.
3. **Generar outfits**
   - El usuario elige **estilo** (lista fija y amplia) y **ocasión**.
   - **Tiempo**: por geolocalización o, si no la da, por la ciudad que escriba (Open-Meteo, sin clave).
   - Percha filtra candidatos por reglas (tiempo, ocasión, formalidad) y la IA elige **4 outfits** con una
     frase de por qué. Sin IA o sin cupo: 4 outfits por reglas.
   - Resultado: **una imagen collage 2×2**, un outfit por recuadro, con las prendas recortadas.
   - Guardar como favorito, descargar o compartir la imagen.
4. **«Pruébatelo en Gemini»** (*try-on* gratis y manual)
   - Prepara la foto del usuario, las prendas del outfit y un texto ya escrito, y los comparte con la app de
     Gemini del móvil (Web Share). La imagen la genera la cuenta de Gemini del propio usuario.
5. **Ajustes**: clave de Gemini, ciudad por defecto, **exportar e importar una copia** del armario.

**Plataforma objetivo de la v1: Android con Chrome.** En iPhone puede funcionar, pero no se prueba ni se
garantiza (Safari puede borrar los datos de las webs no instaladas).

## Fuera de la v1 (para más adelante)

- Varias prendas en una misma foto (que la IA las separe).
- *Try-on* automático dentro de la app (Gemini de pago, otro proveedor o la RTX 3060 en local).
- Más proveedores de IA: OpenAI, Claude.
- Sincronizar entre dispositivos, cuentas, compartir armarios entre amigos.
- Calendario de outfits, contador de usos, coste por uso.
- iPhone como plataforma soportada.
- Exponer el armario a ChatGPT/Claude (MCP o similar) para usar la suscripción del usuario.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | PWA y no app nativa | Un enlace y listo; nada de APK ni tiendas. |
| D2 | Sin backend; todo en IndexedDB | Coste cero, sin PC encendido y privacidad de las fotos. |
| D3 | La IA se llama desde el navegador con la clave del usuario | Sin servidor que la guarde; la clave es suya y no sale de su móvil. |
| D4 | Solo Gemini en v1, detrás de una interfaz `ProveedorIA` | Tiene nivel gratis con visión; añadir otros después no toca la app. |
| D5 | Las suscripciones de chat (ChatGPT Plus, Gemini Plus, Claude Max) no son el motor | No dan acceso de API y sus condiciones no lo permiten. |
| D6 | Collage de prendas recortadas, no imagen generada | Es lo que hacen las apps de armario y no cuesta nada. |
| D7 | *Try-on* compartiendo con la app de Gemini | Cero coste y usa la cuenta que el usuario ya tiene. |
| D8 | Reglas primero y la IA elige entre candidatos | Ahorra cupo gratis y evita outfits imposibles (sandalias con nieve). |
| D9 | Varias prendas por petición al etiquetar | El cupo diario gratis de Gemini es bajo y cambia; hay que medirlo (S2). |
| D10 | Recorte con Transformers.js + `briaai/RMBG-1.4` (WebGPU, con WASM de respaldo) | En Android: ~2,5 s por foto con WebGPU y 8 s con WASM ([S1](spikes/s1-recorte.md)). Licencia del modelo CC BY-NC 4.0: vale para uso personal y privado. |
| D11 | Etiquetar con `gemini-3.5-flash-lite` y salida JSON con esquema, validada con Zod | 5 prendas en una petición en 38 s, con buena calidad y desde el navegador ([S2](spikes/s2-gemini.md)). |
| D12 | Sin búsqueda en Google (*grounding*) en la v1 | Con la clave gratis da 429 a la primera ([S2](spikes/s2-gemini.md)). |
| D13 | *Try-on*: una imagen compuesta (persona + prendas) compartida con Gemini y el texto copiado al portapapeles | Si el texto va dentro de `share()`, Gemini no lo recibe; pegado, genera la foto en ~30 s ([S3](spikes/s3-compartir.md)). |
| D14 | Colores y estampados con lista cerrada en la IA y el formulario; el modelo de datos sigue admitiendo texto libre | Los filtros por color funcionan si todos dicen «azul marino» igual; las copias y prendas a mano de antes no se rompen. «figurativo» se añade porque en S2 la camisa de conejos salió «geométrico». |
| D15 | `etiquetadaPor` sigue en `'ia'` si el usuario solo afina lo que puso la IA (colores, estilos, notas, niveles…) y pasa a `'manual'` si cambia qué prenda es (categoría o tipo, sin contar mayúsculas ni espacios) | Revisar y retocar es lo normal y no debe borrar el origen; si la IA se equivocó de prenda, lo que queda es del usuario. Al volver a etiquetar con IA, la base pasa a ser la nueva respuesta. |
| D16 | Alta masiva: muchas fotos de golpe (galería con selección múltiple; carpeta en el PC), **una prenda por foto**, en una cola guardada en el móvil que se procesa de 5 en 5 (recortar → una petición a Gemini → guardar) con 7 s entre peticiones | Con cientos de prendas, de una en una no tiene sentido. La cola permite salir y seguir; los lotes de 5 y la pausa respetan el nivel gratis (~10 peticiones por minuto). Chrome de Android no deja elegir carpetas. Se guarda sin revisar una a una (con cientos no es práctico); se corrige después desde el detalle. Añadir una segunda foto a una prenda ya guardada aún no se puede (pendiente). |
| D17 | De la etiqueta a la prenda **sin scraping ni SerpAPI**: Gemini lee la foto de la etiqueta (marca, referencia, talla, composición), Percha monta enlaces de búsqueda que **abre el usuario** y él trae de vuelta la URL de la ficha (con «Compartir», `share_target` por GET) o una captura como foto normal. Percha nunca hace `fetch` a una tienda. La foto de la etiqueta no se guarda | SerpAPI no se puede llamar desde el navegador sin enseñar la clave y el scraping de Zara o Shein va contra sus condiciones y está bloqueado ([S4](spikes/s4-probador-y-etiquetas.md) §3). La referencia identifica la prenda (Zara `REF 4085/021` → `p04085021` en su URL). El `share_target` por POST, para recibir la imagen compartida, pediría pasar el *service worker* a `injectManifest`: se deja para cuando haga falta. |
| D19 | *Try-on* **primero en el PC del usuario, Gemini de segunda opción**: si en Ajustes hay URL y clave del probador, «Pruébatelo» manda la foto de cuerpo y las prendas a su servidor de CatVTON, publicado con **Tailscale Serve** (https `*.ts.net`, solo sus aparatos) y protegido con una clave (`Authorization: Bearer`). **Nunca Cloudflare Tunnel**. Si el PC no responde en 3 s o falla, se ofrece Gemini avisando de que las fotos van a Google. Al PC van lo de abajo y **una** prenda de arriba, la más exterior (el abrigo; si no, la que más abriga); el vestido va solo; sin calzado ni accesorios. La foto resultante se guarda con el outfit (`prueba`, opcional) y va en la copia; la URL y la clave no | Las fotos no salen de los aparatos del usuario y el resultado queda dentro de Percha. Tailscale da https válido (sin contenido mixto) dentro y fuera de casa, gratis y cifrado de extremo a extremo; Cloudflare descifra el tráfico ([S4](spikes/s4-probador-y-etiquetas.md) §2). CatVTON viste una prenda por pasada y una segunda de arriba sustituye a la primera en vez de ir encima, por eso solo la de fuera y se avisa de las capas. Gemini sigue siendo la vía sin PC y la única que viste todas las capas. |

## Modelo de datos (borrador)

- **Prenda**: `id`, `fotos` (original y recortada, `Blob`), `categoria` (`superior`, `inferior`,
  `vestido`, `abrigo`, `calzado`, `accesorio`), `subcategoria`, `colores[]`, `estampado`, `estilos[]`,
  `abrigo` (1–5), `formalidad` (1–5), `ocasiones[]`, `temporadas[]`, `notas`, `etiquetadaPor`
  (`ia` | `manual`), `creadaEn`. Opcionales (T5.1, D17): `marca`, `referencia`, `talla`,
  `composicion[]` (`material`, `porcentaje`?) y `enlace` (solo http o https).
- **Perfil**: `fotoCara`, `fotoCuerpo`, `ciudad`, `estilosFavoritos[]`.
- **Outfit**: `id`, `prendas[]`, `estilo`, `ocasion`, `tiempo` (temperatura, lluvia), `explicacion`,
  `favorito`, `creadoEn`. Opcional (T7.1, D19): `prueba` (`Blob`, la foto del probador del PC).
- **Ajustes**: `claveGemini`, `modeloGemini`, `urlProbador` y `claveProbador` (D19; `null` si no hay
  probador, y fuera de la copia).

## Listas cerradas de etiquetas

- **Colores:** blanco, crudo, negro, gris, beige, camel, marrón, azul marino, azul, celeste, vaquero, verde,
  caqui, rojo, granate, rosa, morado, amarillo, naranja, dorado, plateado.
- **Estampados:** liso, rayas, cuadros, lunares, flores, animal, geométrico, figurativo, gráfico / logo,
  camuflaje, tie-dye, otro.

## Listas fijas (borrador)

- **Estilos:** casual, smart casual, elegante, formal, business, minimalista, old money / quiet luxury,
  streetwear, deportivo / athleisure, gorpcore, preppy, boho, vintage / retro, rockero, grunge, y2k,
  techwear, romántico, clean girl, cowboy / western, mediterráneo / verano.
- **Ocasiones:** diario, trabajo, cita, cena, fiesta / noche, evento formal, boda, deporte, viaje,
  playa / piscina, casa.

## Riesgos que se prueban en la fase 0

- **S1:** que el recorte del fondo sea rápido y decente en un Android real.
- **S2:** que Gemini se pueda llamar desde el navegador (CORS) y cuánto da el nivel gratis de verdad.
- **S3:** que la app de Gemini reciba varias imágenes y el texto desde Web Share en Android.
