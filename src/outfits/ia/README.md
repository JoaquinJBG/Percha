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

## Qué hace

1. Calcula los 4 de las reglas. Si no sale ninguno (falta base o calzado), los devuelve sin llamar a la IA.
2. Manda a la IA, en texto y sin fotos, las mejores candidatas de cada categoría (`MAX_POR_CATEGORIA` = 8;
   solo las de ajuste `pleno` si las hay), el estilo, la ocasión y el tiempo.
3. Cada outfit de la IA se comprueba con `comprobarOutfit` contra las prendas enviadas: ids que existen,
   base, un calzado, abrigo si hoy hace falta y hay, como mucho un abrigo y dos accesorios. Se quitan los
   repetidos.
4. Los que falten hasta 4 se rellenan con los de las reglas, primero los que no repiten parte de arriba.
5. Sin clave, sin red, sin cupo (429), respuesta inválida o cualquier otro fallo: salen los de las reglas
   con el aviso `outfits sin IA: <mensaje de ErrorIA>`. Nunca lanza, salvo el `AbortError` de una
   cancelación con `signal`.

`ejemplo.ts` imprime el resultado con el proveedor falso (respuesta buena, prenda inventada y 429):
`node --experimental-strip-types src/outfits/ia/ejemplo.ts`.
