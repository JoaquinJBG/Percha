# Probador en tu PC

Con el probador en tu PC, «Pruébatelo» viste el outfit con **tu foto** en tu propia tarjeta gráfica, y tus fotos
no salen de tus dispositivos. Si el PC está apagado, Percha ofrece Gemini como segunda opción.

Necesitas: Windows con una NVIDIA de 8 GB o más (probado en una RTX 3060 de 12 GB), unos 12 GB libres en disco y el PC
encendido cuando quieras probarte ropa. Tarda ~80 s por prenda.

## 1. Instalar el modelo (una vez)

Ya está hecho en el PC de Joaquín (`C:\Users\dotoy\proyectos\Percha-vton`). Para otro PC:

1. Instala Python 3.11 y [uv](https://docs.astral.sh/uv/).
2. En una carpeta `Percha-vton`:
   ```
   git clone --depth 1 https://github.com/Zheng-Chong/CatVTON catvton
   uv venv -p 3.11 .venv-cat
   uv pip install -p .venv-cat\Scripts\python.exe torch torchvision --index-url https://download.pytorch.org/whl/cu128
   uv pip install -p .venv-cat\Scripts\python.exe -r <repo de Percha>\probador-pc\requirements.txt
   uv pip install -p .venv-cat\Scripts\python.exe --no-deps fashn-human-parser
   ```
3. Los pesos (~4 GB) se descargan solos la primera vez que arranca, en `Percha-vton\hf`.

## 2. Arrancar el servidor

Doble clic en `probador-pc\arrancar.cmd`. La ventana enseña la **clave**: la necesitas en el paso 4. Déjala abierta
mientras uses el probador. Solo escucha en `127.0.0.1:7861`: desde fuera del PC no se ve hasta el paso 3.

## 3. Tailscale (para llegar desde el móvil, en casa o fuera)

Tailscale crea una red privada entre tus dispositivos. El plan personal es gratis.

1. Instala Tailscale en el PC (<https://tailscale.com/download/windows>) y entra con tu cuenta (Google, Microsoft…).
2. Instala la app de Tailscale en el móvil y entra con **la misma cuenta**.
3. En la consola de administración de Tailscale (<https://login.tailscale.com/admin/dns>), activa **MagicDNS** y
   **HTTPS Certificates**.
4. En el PC, en una terminal:
   ```
   tailscale serve --bg 7861
   ```
   Te dirá una dirección del tipo `https://<nombre-del-pc>.<algo>.ts.net`. Esa es la **URL del probador**.
5. Para quitarlo: `tailscale serve reset`.

Nunca uses Cloudflare Tunnel ni abras el puerto en el router: el probador quedaría a la vista de internet.

## 4. Conectar Percha

1. En el móvil, con Tailscale conectado, abre Percha › **Ajustes › Probador en tu PC**.
2. Pega la URL del paso 3 y la clave del paso 2. Pulsa **Comprobar**.
3. En un outfit, **Pruébatelo**: si el PC responde, lo viste allí; si no, te ofrece Gemini.

Android solo deja una VPN a la vez: si usas otra, Tailscale no podrá estar conectado.

## Qué viste y qué no

- El pantalón y **una** prenda de arriba (la más exterior del outfit). Una prenda encima de otra la sustituye en vez de
  superponerse, así que para ver todas las capas usa Gemini.
- No viste calzado ni accesorios.
- Va mejor con una foto de cuerpo entero, de frente, con fondo liso. Con bermuda también sirve.

## Contrato de la API (para desarrollo)

Todas las rutas piden `Authorization: Bearer <clave>` (si no, `401 {"error": "clave"}`). CORS solo para
`https://percha.joaquinjesusbeltrangarcia.workers.dev` y `http://localhost:5173`, con
`Access-Control-Allow-Private-Network`. Como mucho 20 MB y una prueba a la vez.

| Ruta | Respuesta |
|---|---|
| `GET /salud` | `{"ok": true, "modelo": "catvton", "version": 1, "ocupado": false}` |
| `POST /pruebas` (multipart: `persona`; `prenda` + `zona` repetidas, en el orden en que se visten; `zona` = `abajo` · `arriba` · `entero`) | `202 {"id", "total"}` · `400 {"error": "sin-persona" \| "sin-prendas" \| "zona" \| "imagen"}` · `409 {"error": "ocupado"}` · `413` |
| `GET /pruebas/{id}` | `{"estado": "en-cola" \| "probando" \| "lista" \| "error", "hechas", "total", "segundos", "error"}` |
| `GET /pruebas/{id}/imagen` | `image/jpeg` 768 × 1024 cuando está lista; si no, `404` |
