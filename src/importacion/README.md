Alta masiva: muchas fotos de golpe, una prenda por foto (decisión D16).

- `procesar.ts`: `procesarCola(dependencias, { signal, alCambiar })` va de 5 en 5: normaliza y recorta cada
  foto, etiqueta el lote en **una** petición a la IA y guarda cada prenda reconocida (`etiquetadaPor: 'ia'`).
  Entre peticiones deja `INTERVALO_PETICIONES_MS` (7 s) para no pasar las ~10 por minuto del nivel gratis.
  - Sin clave: recorta todo lo que queda (no gasta cupo) y para con un aviso.
  - Cupo agotado, sin red o clave mala: para con el mensaje de `ErrorIA`; lo que falta sigue en la cola.
  - Foto que no se abre o que la IA no reconoce: se queda en la cola con `estado: 'error'`.
  - Devuelve por qué paró (`terminado`, `parado`, `sin-ia`) y cuántas prendas añadió.
- La cola vive en `src/datos/cola.ts` (tabla `cola` de Dexie, versión 2). No va en la copia de seguridad.
- La pantalla es `src/pantallas/alta-masiva/` (`/prendas/varias`): sigue sola al volver si quedó trabajo y
  pide que la pantalla no se apague mientras procesa (Wake Lock).
