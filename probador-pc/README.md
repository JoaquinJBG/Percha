Servidor del probador en el PC del usuario (fase 7, decisión D19): CatVTON en la GPU, detrás de una clave y
publicado solo para sus dispositivos con `tailscale serve`.

- `servidor.py`: FastAPI en `127.0.0.1:7861`. Rutas `/salud` y `/pruebas` según el contrato de
  [`docs/probador-pc.md`](../docs/probador-pc.md). Las fotos viven en memoria como mucho una hora; una prueba a la
  vez. Las máscaras salen del parser humano de FASHN, sin DensePose ni detectron2.
- `arrancar.cmd`: lo arranca con el entorno de `PERCHA_VTON_DIR` (por defecto `%USERPROFILE%\proyectos\Percha-vton`,
  donde están el código de CatVTON, los pesos en `hf/` y el entorno `.venv-cat`).
- La clave se crea la primera vez en `%APPDATA%\percha-probador\clave.txt` y se enseña en la consola al arrancar.
- No forma parte de la PWA ni de `pnpm verify`.
