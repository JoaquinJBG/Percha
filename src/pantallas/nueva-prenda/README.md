Pantalla «Nueva prenda» (`/prendas/nueva`), en tres pasos:

1. **Fotos:** 1–2 fotos de cámara o galería, normalizadas y recortadas (`src/recorte/`). Sin clave de Gemini,
   un aviso arriba lo dice desde el principio.
2. **Etiquetando:** «Siguiente» manda la prenda a la IA (`src/componentes/etiquetado-ia/`). «Etiquetar a mano»
   no espera.
3. **Revisar:** `FormularioPrenda` con lo que dijo la IA, o vacío con el motivo si no hay clave o la IA falla.
   «Cambiar fotos» vuelve al paso 1 sin perder lo cambiado; si las fotos siguen igual, no repite la petición.

Guarda con `crearPrenda` y `etiquetadaPor` según D15. `recortar`, `normalizar`, `guardar` y `obtenerProveedor`
se pasan por props en los tests.
