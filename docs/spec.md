# Percha — Especificación v1

Fecha: 2026-11-02. Estado: aprobada la idea; pendiente el OK al plan ([`plan.md`](plan.md)).

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

## Modelo de datos (borrador)

- **Prenda**: `id`, `fotos` (original y recortada, `Blob`), `categoria` (`superior`, `inferior`,
  `vestido`, `abrigo`, `calzado`, `accesorio`), `subcategoria`, `colores[]`, `estampado`, `estilos[]`,
  `abrigo` (1–5), `formalidad` (1–5), `ocasiones[]`, `temporadas[]`, `notas`, `etiquetadaPor`
  (`ia` | `manual`), `creadaEn`.
- **Perfil**: `fotoCara`, `fotoCuerpo`, `ciudad`, `estilosFavoritos[]`.
- **Outfit**: `id`, `prendas[]`, `estilo`, `ocasion`, `tiempo` (temperatura, lluvia), `explicacion`,
  `favorito`, `creadoEn`.
- **Ajustes**: `claveGemini`, `modeloGemini`.

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
