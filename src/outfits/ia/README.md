Selección de 4 outfits con IA y su explicación, sin UI (D8: las reglas filtran y la IA elige entre los
candidatos). Usa `src/outfits/reglas/` tal cual y el `ProveedorIA` de `src/ia/`.

## API (`index.ts`)

- `elegirOutfitsConIA(peticion, semilla = 1, { proveedor, signal? })` → `Promise<ResultadoOutfitsIA>`.
  Misma entrada y salida que `cuatroOutfits` (pero asíncrona), así que la pantalla puede cambiar una por
  otra. `proveedor` es un `ProveedorIA` o una función que lo da (p. ej. `proveedorDesdeAjustes`).
- `outfitsConIA(peticion, semilla?, signal?)`: lo mismo con la clave y el modelo de Ajustes. Es la que
  usa la pantalla (T2.5).
- Cada outfit lleva además `origen`: `ia` (su `motivo` es la frase de la IA) o `reglas` (relleno). El
  resultado lleva `errorIA`: el `TipoErrorIA` si no se pudo usar la IA, o `null`.
- `comprobarConCapas(ids, enviadas, { exterior, temperatura })`: el validador de los outfits de la IA
  (abajo).
- `exteriorDeHoy(contexto)` → `obligatoria` | `opcional` | `no`, con `LIMITE_EXTERIOR` (14 °C) y
  `LIMITE_TERCERA_PIEZA` (23 °C) de las reglas, sobre `contexto.temperaturaVestir` (con el ajuste del
  perfil por sensación térmica).
- `perfilParaIA(perfil)` → `{ cuerpo?, oficina? }` o `undefined`: lo que va del perfil a Gemini (T8.4).
  El cuerpo, con `cuerpoParaIA`: altura, complexión y los trozos de las notas sin cifras. **Nunca** el
  peso ni el pecho, la cintura, la cadera o el largo de pierna. La sensación térmica no va: ya cuenta en
  la exterior de hoy.

## Qué hace

1. Calcula los 4 de las reglas. Si no sale ninguno (falta base o calzado), los devuelve sin llamar a la IA.
2. Decide la capa exterior de hoy: `obligatoria` por debajo de 14 °C o con lluvia o nieve (salvo con
   24 °C o más); `opcional` entre 14 y 23 °C y sin tiempo; `no` con más calor y en casa.
3. Manda a la IA, en texto y sin fotos, las mejores candidatas de cada categoría
   (`MAX_POR_CATEGORIA_ARRIBA` = 10 en `superior` y `abrigo`, que reparten tres capas;
   `MAX_POR_CATEGORIA` = 8 en el resto), el estilo, la ocasión y el tiempo. Cada prenda va con sus
   `capas` (si faltan, las de por defecto de `src/datos/capas.ts`), su composición y su corte y detalles
   (`corte`, `tiro`, `largo`, `manga`, `cuello`) si los hay; con perfil, una línea «Perfil: …». Como las reglas: solo las de ajuste `pleno` si las hay y accesorios solo plenos. Categoría `abrigo`: nada con la
   exterior en `no`; con `opcional`, solo los ligeros (abrigo ≤ 3). Las de arriba van siempre (un punto
   grueso es capa media). Las ligeras que no pueden ir de base van marcadas `opcional` («tercera
   pieza»).
4. Cada outfit de la IA se comprueba con `comprobarConCapas` contra las prendas enviadas: ids que existen
   y sin repetir; algo de abajo (o un vestido, que hace de base) y un calzado; como mucho 2 «superior», 2
   «abrigo» y 2 accesorios; una base, hasta 2 medias y 1 exterior según los papeles de cada prenda;
   exterior si es obligatoria y hay alguna; como mucho 3 capas visibles (4 con 3 °C o menos; 2 sin
   exterior). Devuelve las prendas en orden de collage y, dentro de cada categoría, de dentro afuera. Se
   quitan los repetidos. Las reglas finas de capas (C1–C13: de fino a grueso, la de fuera la más
   larga…) son de T6.2; aquí solo se le piden a la IA en el prompt.
5. Los que falten hasta 4 se rellenan con los de las reglas, primero los que no repiten parte de arriba.
6. Sin clave, sin red, sin cupo (429), respuesta inválida (o ningún outfit de la IA válido) o cualquier
   otro fallo: salen los de las reglas con el aviso `outfits sin IA: <mensaje>` y `errorIA`. Nunca lanza, salvo el `AbortError` de una
   cancelación con `signal`.

`ejemplo.ts` imprime el resultado con el proveedor falso (respuesta buena, prenda inventada, 429 y
tercera pieza a 19 °C):
`node --experimental-strip-types src/outfits/ia/ejemplo.ts`.

Hasta juntar con T6.2: las reglas aún piden abrigo por debajo de 16 °C (`LIMITE_ABRIGO`), y aquí la
exterior solo es obligatoria por debajo de 14 °C. A 14–15 °C los outfits de la IA pueden salir sin abrigo
y los de relleno con él.

Pendiente para la pantalla (T2.5): cada llamada gasta una petición del cupo diario, así que conviene
guardar el resultado por petición y semilla y cancelar la anterior con `signal`. El `seed` de Gemini no
garantiza que la misma semilla dé la misma tanda. La IA no está obligada a variar la parte de arriba entre
los 4: solo se le pide en el prompt.
