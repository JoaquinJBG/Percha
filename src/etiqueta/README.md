De la etiqueta a la prenda sin descargar nada de las tiendas (T5.1, D17). Solo lógica y un componente;
la lectura de la foto está en `src/ia/` (`leerEtiqueta`).

- `enlaces.ts`:
  - `enlacesDeBusqueda({ marca, referencia })`: «Buscar en Google», «Google Imágenes» y, si la marca es
    conocida y la referencia tiene su forma, «En la tienda». Sin referencia no hay enlaces.
  - Zara: `REF 4085/021/800` → `"p04085021" site:zara.com` (así sale en la URL de la ficha, S4 §3).
    H&M: número de artículo de 10 cifras → su ficha directa (`productpage.<n>.html`); con 7, su búsqueda.
    Nike (`DD1391-100`) y Adidas (`GZ2000`): su código y la búsqueda de su web. Otra marca: «marca "ref"».
  - **Sin comprobar:** que la búsqueda de zara.com acepte la referencia (`?searchTerm=04085021`); con una
    REF antigua dijo «sin resultados». La de Google con `site:zara.com` sí está confirmada en S4.
  - `datosDeEnlace(url)`: la marca por el dominio y, si la URL la lleva, la referencia. No abre la URL.
- `compartido.ts`: `leerCompartido(parámetros)` saca el enlace de lo que manda «Compartir» de Android
  (`url`, o dentro de `text`); `datosDesdeTienda(estado)` es lo que «Nueva prenda» rellena al llegar desde
  `/compartido`; `textoComposicion()` para enseñarla.
- `EnlacesBusqueda.tsx`: los enlaces como botones; abren otra pestaña con `noopener noreferrer`.
