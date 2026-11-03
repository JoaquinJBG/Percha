# Despliegue de Percha

Percha es una web estática: no hay servidor ni base de datos en la nube. Se aloja **gratis** en
**Cloudflare Workers** (archivos estáticos) y se publica sola con cada push a `main`.

- **URL:** `https://percha.<tu-subdominio>.workers.dev` (el subdominio lo elige Cloudflare al crear la cuenta).
- **Cuenta:** la Cloudflare del usuario, conectada al repo privado `JoaquinJBG/Percha` de GitHub.
- **Coste:** 0 €. El plan gratis de Workers sirve archivos estáticos sin límite de peticiones; lo único
  limitado son los ficheros (25 MiB cada uno y 20.000 en total), y Percha queda muy por debajo.
- **Privacidad:** cualquiera con la URL puede abrir la app, pero no hay datos en la nube. El armario, las
  fotos y la clave de Gemini de cada persona se quedan en su móvil.

## Configuración del repo

- `wrangler.jsonc`: publica `dist/` y manda las rutas desconocidas a `index.html` (la app es de una página).
- `public/_headers`: cabeceras COOP/COEP para que el recorte en WASM use varios hilos.
- `.node-version`: Node 22 para el build.
- `vite.config.ts` quita del build el runtime WASM de ONNX (27 MB); Transformers.js lo baja de jsDelivr.

## Crear el proyecto (una vez, lo hace el usuario)

Hace falta iniciar sesión y conectar GitHub, así que estos pasos los da el usuario en el panel de
Cloudflare. Los nombres de los menús pueden variar un poco.

1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com) e inicia sesión (o crea la cuenta gratis).
2. Menú **Workers & Pages** (o **Compute → Workers & Pages**) → **Create** / **Crear**.
3. Elige **Import a repository** / **Importar un repositorio** (pestaña *Workers*). Si te pide conectar
   GitHub, autoriza la app de Cloudflare **solo para el repo `JoaquinJBG/Percha`**.
4. Elige el repo `Percha` y rellena:

   | Campo | Valor |
   |---|---|
   | Project name | `percha` |
   | Production branch | `main` |
   | Build command | `npx -y pnpm@12.16.1 install --frozen-lockfile && npx -y pnpm@12.16.1 build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | (vacío) |

5. En **Variables** (o *Advanced settings → Build variables*) añade `SKIP_DEPENDENCY_INSTALL` = `1`, para que
   Cloudflare no intente instalar con su propio pnpm (el build ya instala con la versión del repo).
6. **Deploy**. El primer build tarda unos minutos. Al acabar, copia la URL `…workers.dev` que te enseña.

Desde ese momento, **cada push a `main` publica la versión nueva sola**. Las otras ramas no se publican
(si Cloudflare ofrece «previews» de ramas, se pueden dejar desactivadas).

**Si la pestaña Workers no deja importar el repo**, Cloudflare Pages también vale: *Pages → Connect to
Git*, mismo build command, **Build output directory** `dist`, la misma variable, y sin deploy command.
Pages lee `public/_headers` y, al no haber `404.html`, ya sirve `index.html` en cualquier ruta.

## Probar que va bien

En Chrome del móvil, abre la URL:

1. Carga la app y se ven las cuatro pestañas.
2. En **Armario → Añadir prenda**, la cámara funciona (hace falta HTTPS, y `workers.dev` lo tiene).
3. El recorte avisa «Cargando el recortador» la primera vez y después tarda unos segundos.
4. Si cambias de pantalla y recargas en `/prendas/nueva`, la app sigue cargando (no sale un 404).
