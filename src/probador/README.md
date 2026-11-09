Cliente del **probador en el PC** (T7.1, D19): el servidor de CatVTON del usuario, publicado con Tailscale
Serve. El contrato de la API está en la carpeta de notas de la fase 7 (`probador-pc-contrato.md`); la guía
de instalación, en [`docs/probador-pc.md`](../../docs/probador-pc.md).

- `crearClienteProbador({ url, clave }, { fetch? })` → `salud`, `crearPrueba`, `estado`, `imagen`. Todas
  las llamadas llevan `Authorization: Bearer <clave>` y su tiempo de espera (`ESPERA_MS`: 3 s para
  `/salud`). Los fallos son `ErrorProbador` con `motivo`: `red` (no responde, CORS, tiempo), `clave`
  (401), `ocupado` (409), `grande` (413), `peticion` (400), `no-existe` (404), `prueba` (acabó en error
  en el PC) o `servidor` (respuesta rara). Si cancela quien llama, sale su `AbortError` tal cual.
- `prendasParaProbador(prendas)` → `{ envio, fuera }`: el vestido solo (`entero`); si no, lo de abajo
  (`abajo`) y **una** de arriba (`arriba`), la más exterior: el abrigo y, entre las demás, la que más
  abriga (`abrigo` 1–5). Sin calzado ni accesorios. `fuera` es la ropa que se queda sin vestir, para
  avisar de las capas.
- `probarEnPC(cliente, persona, prendas, { alProgreso, signal, esperar? })`: sube las fotos y pregunta
  cada 3 s (`seguirPrueba`) hasta la imagen. Aguanta 2 consultas seguidas sin respuesta; a la tercera
  falla con `red` y la prueba se puede seguir con su id. `segundosRestantes` calcula ~80 s por prenda.
- `leerConfigProbador()`: `{ url, clave }` de `ajustes` o `null` si falta alguna (entonces, Gemini).
  `comprobarUrlProbador(url)`: solo https, o http a `localhost` para el desarrollo.
- `mensajeProbador(fallo)` (`mensajes.ts`): el texto para el usuario de cada motivo.
- `servidorFalso(opciones)` (`servidorFalso.ts`): un `fetch` que cumple el contrato sin red, para los
  tests (`caido`, `ocupado`, `errorPrueba`, `cortesEstado`). Para verlo en `pnpm dev`:
  `node scripts/probador-falso.mjs` levanta uno en `http://127.0.0.1:7861` y enseña su clave.

La interfaz es `BotonPruebatelo` (`src/componentes/`) y la sección «Probador en tu PC» de Ajustes
(`ProbadorPC.tsx`). La URL y la clave se guardan solo en el móvil y no van en la copia; la foto de la
prueba se guarda con el outfit (`Outfit.prueba`) y sí va en la copia.
