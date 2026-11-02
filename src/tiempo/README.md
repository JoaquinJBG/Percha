Tiempo de hoy por geolocalización o ciudad, con Open-Meteo (sin clave, llamadas directas desde el navegador).

- `buscarCiudades(texto)` → hasta 5 `Sitio` (geocodificación en español); `[]` si no hay ninguno.
- `obtenerUbicacion()` → `Sitio` «Tu ubicación» con la posición del navegador; rechaza con `ErrorTiempo`
  (`permiso-denegado`, `tiempo-agotado`, `sin-ubicacion`, `no-disponible` fuera de https).
- `tiempoDeHoy(sitio)` → `TiempoHoy`: temperatura y sensación (actual, mínima y máxima), lluvia, viento,
  `clima` (`termico`, `precipitacion`, `viento`) y `resumen` («frío y lluvia»). Zona horaria del sitio
  (`timezone=auto`). Caché de 1 h por sitio (~1 km) en memoria y `localStorage`, que caduca también al cambiar
  de día en el sitio. Errores: `sin-red`, `tiempo-agotado`, `servicio`.
- `crearServicioTiempo({ fetch, almacen, ahora })` para tests o para otra instancia.
- `AlmacenSitio` guarda el último sitio elegido; hoy `crearAlmacenSitioLocal()` (`localStorage`).
