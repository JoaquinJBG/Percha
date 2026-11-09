# S4 — Probador en el PC y de la etiqueta a la prenda

Fecha: 2026-11-06 · Rama `spike/s4-probador-etiquetas` · **Solo estudio**: no se ha instalado ni descargado nada.

**Pregunta:** ¿se puede hacer a 0 € lo que propone Gemini (`percha-propuesta-gemini.md`)?
- un *try-on* realista con IDM-VTON o CatVTON en la RTX 3060 del usuario, llamado desde Percha;
- foto de la etiqueta → referencia → foto de catálogo y tabla de medidas → ajuste a 176 cm.

Las notas completas, con más de 150 fuentes, están en la carpeta de notas compartida (`s4-vton.md`,
`s4-red.md`, `s4-etiquetas.md`). Aquí van las conclusiones con las fuentes clave.

**Marcas:** CONFIRMADO (fuente oficial o varias) · INDICIO (una fuente, o cálculo mío) · SIN DATOS.

## Veredictos

| # | Parte | Veredicto |
|---|---|---|
| 1 | Probador VTON en la 3060 | **Se puede, con otro modelo.** IDM-VTON no cabe. **FASHN VTON v1.5** (Apache-2.0, ~2,5 GB, ~8 GB de VRAM) es el primero que probar; CatVTON es el plan B. Una prenda por pasada, sin capas ni zapatos, y nada de «remetido» ni «ajuste a tu altura» |
| 2 | Percha llamando al PC | **Se puede con Tailscale Serve** + un adaptador con token en el PC. Es gratis, tiene https válido, funciona dentro y fuera de casa, y las fotos solo viajan cifradas entre tus dispositivos. Cloudflare Tunnel **no** cumple la privacidad |
| 3 | Etiqueta → prenda | **Tal como lo propone Gemini, no se puede**: SerpAPI no se puede llamar desde el navegador y hacer scraping de Zara o Shein va contra sus condiciones y además está bloqueado. **Sí se puede la versión limpia**: Gemini lee la etiqueta, Percha ofrece enlaces que abre el usuario, este comparte la foto de vuelta y Gemini lee la tabla de tallas de una foto |
| 4 | Encaje con lo que hay | El probador local **complementa** a «Pruébatelo en Gemini», no lo sustituye: Gemini sigue siendo la vía sin PC y la única que viste un outfit entero con capas. Los datos de la etiqueta alimentan el modelo de prenda (material, talla, medidas) |

---

## 1. Probador VTON en este PC

**El PC (medido hoy):**
- RTX 3060 de 12 GB con driver 610.88 (CUDA 13.3), 1,1 GB de VRAM ya en uso;
- 16 GB de RAM, poca para modelos que descargan parte del trabajo de la GPU a la RAM;
- 115 GB libres en C: y **WSL sin instalar**.

La GPU se comparte con otro proyecto.

| Modelo | Licencia | Disco | VRAM | s/imagen en 3060 | Windows | Encaje |
|---|---|---|---|---|---|---|
| **FASHN VTON v1.5** (ene 2026) [1][2] | **Apache-2.0** (código y pesos) | ~2,5 GB | ~8 GB (lo dice el autor) | **~30–60 s** (INDICIO: 5 s en H100) | Python + ONNX, sin detectron2; sin notas de Windows | **Probar primero** |
| **CatVTON** [3][4] | CC BY-NC-SA 4.0 | ~5 GB (con SD1.5-inpainting) | <8 GB a 1024×768 | **~25–40 s** (INDICIO: 9 s en A100) | Nodo de ComfyUI con *wheels* para Windows [5]; muchos fallos de instalación documentados | Plan B |
| FLUX.2 klein 4B [6] | Apache-2.0 | ~13–15 GB (fp8 + codificador de texto) | ~8–13 GB | ~20–90 s (INDICIO, foros) | Nativo en ComfyUI | Experimental: viste por texto, pero copia peor la prenda |
| **IDM-VTON** [7][8] | CC BY-NC-SA 4.0 | **29,4 GB** | **>18 GB** (lo dice el autor) | 1,5–4 min con *offload* (INDICIO) | Nodo pide ≥16 GB | **Descartado** |
| OmniTry, CatVTON-FLUX, Any2AnyTryon | varias | base FLUX de ~24 GB | 28–40 GB | — | — | Descartados (no caben) |
| OOTDiffusion, StableVITON, Leffa | NC / MIT | 8–20 GB | 8–10 GB | ≥1 min | Linux o abandonados | No merecen la pena |

**Licencias:** las CC BY-NC-SA 4.0 (IDM-VTON, CatVTON, OOTD) prohíben el uso **comercial**, no el privado y
personal: **valen para Percha tal como es hoy** [9]. Si un día hubiera una versión de pago, solo FASHN y
FLUX.2 klein 4B (Apache-2.0) seguirían valiendo.

**Lo que hay que saber antes de ilusionarse (CONFIRMADO salvo donde se indica):**
- **Una prenda por pasada.** Para camiseta + pantalón hay que encadenar dos pasadas, y sumar los tiempos.
  **Capas** (sobrecamisa sobre camiseta): ningún modelo lo documenta; una segunda pasada de «arriba»
  sustituye la prenda en lugar de superponerla (INDICIO). **Zapatos:** solo OmniTry, que no cabe.
- **FASHN saca 576×864** (poca resolución) y avisa de que puede cambiar algo la forma del cuerpo [2].
- **Cuerpos grandes:** no hay ninguna prueba pública. Lo esperable es una silueta estándar o algo más delgada
  (INDICIO [10]).
- **«Camiseta por dentro», «tiro alto», «ajuste a 176 cm»:** no es realista con modelos abiertos. Se puede
  aproximar a mano con la máscara; un artículo de 2026 concluye que los *prompts* solos no bastan [10].
- **Pinokio:** no hay script de un clic para ninguno de estos modelos (SIN DATOS). La ruta real es un
  entorno de Python (FASHN) o ComfyUI (CatVTON).
- **Ojo con los 5 GB:** FASHN pesa 2,5 GB, pero **PyTorch con CUDA y las dependencias suman otros ~3 GB**,
  así que la prueba rondará los 5–6 GB en disco. Hace falta el OK del usuario.

## 2. Cómo lo usaría una PWA sin servidor

**El problema del navegador** (CONFIRMADO):
- Percha va en https y el PC habla http: Chrome **bloquea** el `fetch` a `http://192.168.x.x` por
  contenido mixto [11].
- Desde Chrome 142 hay un permiso nuevo, **Local Network Access**: si el usuario lo acepta, deja llamar a
  una IP privada escrita tal cual [12]. Que funcione igual en Android es INDICIO.
- **ComfyUI no tiene autenticación** y, sin `--enable-cors-header`, rechaza las llamadas de otra web [13].
  **No hay que exponerlo nunca**: desde marzo de 2026 hay una campaña que convierte en mineros los ComfyUI
  abiertos a internet [14].

| Opción | 0 € | Fuera de casa | Las fotos pasan por terceros | https válido |
|---|---|---|---|---|
| **Tailscale Serve** [15][16] | Sí (plan personal) | **Sí** (con la app de Tailscale activa en el móvil) | **No**: WireGuard de extremo a extremo [17] | **Sí** (`*.ts.net`, se renueva solo) |
| http a la IP del PC + permiso de red local | Sí | No | No (pero sin cifrar en el Wi-Fi) | No |
| Cloudflare Tunnel [18] | Rápido sí; nombre fijo pide dominio de pago | Sí | **Sí: Cloudflare descifra el tráfico** | Sí |
| Gradio `share=True` | Sí | Sí | Sí (proxy de Gradio) y enlace público | Sí |
| «Pruébatelo en Gemini» (D7/D13) | Sí | Sí | **Sí: Google** (72 h como mínimo, posible revisión humana [19]) | — |

**Cómo (recomendado):**
1. En el PC, el modelo (FASHN o ComfyUI) escucha solo en `127.0.0.1`.
2. Delante va un **adaptador** pequeño (Python) en `127.0.0.1:7861`, con dos rutas, `POST /tryon` y
   `GET /health`. Exige `Authorization: Bearer <token>` y responde CORS **solo** al origen de Percha.
3. `tailscale serve --bg 7861` lo publica en `https://pc-casa.<tailnet>.ts.net`, visible solo para los
   dispositivos del usuario.
4. En el móvil, la app de Tailscale conectada. Android solo admite una VPN a la vez.
5. En Percha › Ajustes, «URL del probador» y token. Antes de cada prueba, `/health` con ~3 s de espera; la
   prueba con ~3 min.
6. Si el PC no responde, Percha ofrece «Pruébatelo en Gemini» avisando de que **las fotos van a Google**.

**Limitación:** el PC tiene que estar encendido. Encenderlo a distancia por Tailscale no funciona sin otro
aparato siempre encendido en casa [20].

**Frente a D7/D13:** Gemini funciona sin PC, sin configuración y viste el outfit entero en ~30 s, pero las
fotos salen a Google. El PC da privacidad total y el resultado dentro de Percha, pero prenda a prenda, con
menos resolución y solo con el PC encendido.

## 3. De la etiqueta a la prenda

**La referencia sí identifica la prenda** (CONFIRMADO):
- **Zara:** la «REF 4085/021» de la etiqueta aparece en la URL pública como `-p04085021.html`. Se encuentra
  buscando `"p04085021" site:zara.com` [21].
- **Zapatillas:** los códigos de Nike (`DD1391-100`) y Adidas (`GZ2000`) se encuentran muy bien.
- **H&M:** el número de artículo, de 10 dígitos, va en la URL de la ficha.
- **Shein:** INDICIO contradictorio.
- **El código de barras no sirve** para ropa.
- Cuando la prenda se descataloga, la ficha desaparece (INDICIO).

**Lo que propone Gemini no vale a 0 € ni dentro de la ley:**

| Pieza | Problema | Estado |
|---|---|---|
| SerpAPI | 250 búsquedas al mes gratis, pero **prohíbe llamarla desde el navegador** (la clave quedaría a la vista); pide un servidor [22] | CONFIRMADO |
| Otras búsquedas | Google Custom Search cerrada a clientes nuevos (se apaga el 1-ene-2027); Bing retirada en 2025; Brave pide tarjeta [23][24] | CONFIRMADO |
| Scraping de zara.com o shein.com | Protección anti-bot, CORS (haría falta un servidor) y condiciones de uso que lo prohíben. Esas condiciones obligan por contrato (TJUE C-30/14) [25], y la excepción de uso privado de la ley española no cubre bases de datos electrónicas [26] | CONFIRMADO |
| APIs oficiales | Inditex tiene «Product Search» y «Visual Search» en su portal, sin acceso abierto confirmado [27]; Zalando y Shein, solo para socios | INDICIO |
| Medidas de la prenda | La guía de Zara da medidas **del cuerpo**, no de la prenda; la ficha dice a veces la altura, el peso y la talla del modelo («1,86 m, 87 kg, lleva L») [28] | CONFIRMADO |

**Cómo (versión limpia, 0 € y legal):**
1. **Gemini lee la etiqueta** (ya integrado, con la clave del usuario): marca, referencia, talla,
   composición. La composición sirve además para el campo de material de las reglas.
2. Percha **monta enlaces** («Buscar en Google», «Google Imágenes», «Tienda») que **abre el usuario**.
3. Desde la ficha, el usuario **comparte la URL o la foto** con Percha (Web Share Target) o sube una
   captura. Percha no descarga nada de la tienda.
4. **Tabla de tallas:** captura o foto → Gemini → JSON en cm. Se guarda por marca y tipo de prenda.
5. **Ajuste:** el usuario mide una vez su cuerpo y 1–3 prendas que le sientan bien (en plano). Percha
   compara en cm y recomienda talla.
6. **Altura y peso** solo sirven para una pista en texto frente al modelo de la ficha («mide 10 cm más
   que tú y lleva L: te quedará algo más largo»). **Verla puesta a tu altura y peso real no lo hace ningún
   modelo abierto** (§1).
7. **Opcional, por probar:** el *grounding* de Gemini (búsqueda de Google) es gratis en `gemini-2.5-flash`
   (500 al día) y no está en los modelos Gemini 3 [29]. Eso explicaría el 429 de D12. Con él, Gemini podría
   devolver directamente el enlace de la ficha.

**La idea del 3/11** (buscar la prenda online para tener foto y medidas y verla a tu altura y peso): la
foto y las medidas, sí, con los pasos 1–5. Verla a tu altura y peso, solo como pista de talla. La
imagen de la prenda puesta la daría el probador (§1) o Gemini (D13), sin ajuste real a las medidas.

## 4. Encaje con lo que hay

- **Motor de reglas:** no cambia. La etiqueta rellena campos que la investigación de moda ya pedía:
  `material` (lluvia, textura, lino con lana), talla y medidas. Ver `docs/investigacion/reglas-outfits.md`
  §8, P5.
- **Foto de catálogo:** es una foto de prenda mejor que la recortada en casa. Va bien para el collage y para
  FASHN, que acepta prendas planas.
- **Capas:** los outfits con capas que propone la investigación (camiseta + sobrecamisa + abrigo) **no los
  puede vestir el probador local**, que hace una prenda por pasada y no superpone. Propuesta: el probador
  local para «base + pantalón» y Gemini (D13) para el outfit entero con capas.
- **Privacidad:** el probador local es la única vía en la que las fotos del cuerpo no salen de los
  dispositivos del usuario.

## Fase A — Resultado de la prueba en el PC (2026-11-06)

FASHN VTON v1.5 instalado en `C:/Users/dotoy/proyectos/Percha-vton` (fuera del repo), con Python 3.11 nativo en
Windows, sin WSL. Lo probé con la foto de cuerpo del perfil del usuario y 9 pasadas de sus prendas de Percha. Las
fotos y los resultados se quedan en esa carpeta, no en el repo.

| Dato | Medido |
|---|---|
| Disco | **7,1 GB**: entorno de Python 4,7 GB, pesos 2,2 GB, parser 0,25 GB |
| Carga del modelo | 11–19 s |
| Tiempo por imagen | **57–61 s** (30 pasos). La pose va en CPU porque `onnxruntime-gpu` pide CUDA 13 (`cublasLt64_13.dll`) |
| VRAM | 3,0 GB de pico en PyTorch; ~5,4 GB por encima de la base según `nvidia-smi` |
| Resolución | 576 × 771 |

**Calidad con su foto** (cuerpo entero, de frente, fondo blanco, camiseta y bermuda):
- **Prendas de arriba abiertas o con estampado: bien.** La sobrecamisa marrón, las camisas de rayas y de pájaros
  y el abrigo camel salen con su cara, sus tatuajes y su complexión. El estampado se conserva y, como bonus, las
  prendas abiertas dejan ver una camiseta blanca debajo: una capa «gratis».
- **Fallos:**
  - La percha o el soporte de la foto de la prenda se cuelan en el cuello.
  - La camiseta blanca de manga larga, recortada sobre una silla blanca, sale sin mangas. Con la foto original sale
    de manga corta y lisa: pierde la manga larga.
- **Pantalones: mal.** Con la foto en bermuda, vaqueros y pinzas salen por la rodilla, y los vaqueros pierden el
  color. El modo con máscara (`segmentation_free=False`) no lo arregla.

**Veredicto de la fase A:** el probador **funciona en este PC** a ~1 min por prenda y cabe con holgura en la
3060. **Sirve para prendas de arriba**, no para pantalones si la foto del perfil es en bermuda.

**Si se sigue:**
1. Pedir en el perfil una foto de cuerpo con **pantalón largo** y camiseta lisa y ajustada, y repetir la prueba
   de los pantalones.
2. Fotos de prenda sin percha ni soporte (en plano sobre la cama o una pared), o la foto de catálogo de la fase D.
3. Mover la pose a GPU (bajar `onnxruntime-gpu` a una versión para CUDA 12, o añadir las DLL de CUDA 13) y probar
   20 pasos para bajar de ~45 s.
4. Solo después, B y C (Tailscale y el botón en Percha).

### Fase A bis — CatVTON y fotos de modelos (2026-11-09)

**Fotos de modelos de Unsplash con FASHN:** el largo del pantalón depende de la pose y no de la bermuda. Con dos
de los cuatro modelos, aunque lleven pantalón largo, los pantalones salen por la rodilla. Con la pose de
`foto-de-referencia.jpg` (de frente, manos en los bolsillos, fondo blanco) salen enteros. Cambiar la máscara,
recortar el margen de la foto o usar la foto original no lo arregla.

**CatVTON** en un entorno aparte (`.venv-cat`):
- diffusers 0.31, accelerate 1.x;
- pesos: UNet de SD-inpainting, VAE ft-mse y atención «mix»;
- el *safety checker* no se descarga.

Las máscaras salen del parser humano de FASHN (`mascaras.py`): arriba = top, torso y brazos; abajo = pantalón y
piernas. Así no hace falta DensePose ni detectron2, que en Windows dan problemas.

| Dato | CatVTON | FASHN |
|---|---|---|
| Disco (además de lo común) | +4,6 GB de entorno + 4,0 GB de pesos (total de la carpeta: 12 GB) | 7,1 GB |
| Tiempo por prenda | **~76 s** (50 pasos, 768 × 1024) | ~58 s (30 pasos, 576 × 864) |
| VRAM (pico en PyTorch) | 3,6 GB | 3,0 GB |
| Pantalones con su foto en bermuda | **Largos hasta el zapato** | Por la rodilla |
| Prendas de arriba | Bien; la sobrecamisa sale cerrada, como camisa | Bien; la sobrecamisa sale abierta sobre camiseta |

**Outfit encadenado** con su foto (pinzas → camisa → abrigo): pantalón y camisa salen bien. El abrigo
**sustituye** a la camisa en vez de ir encima, porque la máscara de arriba lo tapa todo. En cada pasada la cara
pierde algo de detalle.

**Veredicto:** CatVTON es mejor para Percha. Viste **pantalón + parte de arriba** con la foto que el usuario ya
tiene, a ~2,5 min por outfit de dos prendas. Las capas (prenda abierta sobre otra) siguen sin resolver en local:
habría que probar una máscara que deje libre la franja central del pecho, o dejar las capas para Gemini.

## Plan propuesto por fases

| Fase | Qué | Esfuerzo | Necesita | Criterio de corte |
|---|---|---|---|---|
| **A** | Instalar FASHN VTON en un entorno de Python en Windows, medir s/imagen y VRAM, y probarlo con 3 fotos caseras y 5 prendas de Percha | 0,5–1 día | **OK del usuario** (~5–6 GB en disco, GPU compartida) | Si pasa de ~90 s, si no cabe junto al otro proyecto o si la calidad con su cuerpo no convence, probar CatVTON (plan B) o parar |
| **B** | Adaptador con token y Tailscale Serve; llamada desde Chrome Android (permiso de red local) | 1 día | Cuenta de Tailscale y apps en el PC y el móvil | Si Android no llega por `ts.net`, probar en el mismo Wi-Fi |
| **C** | Percha: Ajustes (URL y token), botón «Pruébatelo en mi PC» en el outfit, *health check*, espera, vuelta a Gemini y guardar el resultado | 2–3 días | A y B en verde | — |
| **D** | Alta desde la etiqueta: Gemini lee la etiqueta, enlaces de búsqueda y Web Share Target para volver con la foto o la URL | 1–2 días | Nada (es independiente de A–C) | — |
| **E** | Tabla de tallas por foto, medidas del cuerpo y de «prendas patrón», y pista de talla | 2–3 días | D | — |
| **F** | Opcional: probar el *grounding* con `gemini-2.5-flash` para encontrar la ficha | 0,5 día | — | Si da 429 o enlaces malos, quedarse con D |

**Orden recomendado:** D y A en paralelo (D no depende de nada; A decide si sigue B–C), luego E, y B–C solo
si A convence.

**Decisiones que propondría para `docs/spec.md`** (no tomadas):
- El probador local es opcional y privado: Tailscale Serve y adaptador con token; nunca Cloudflare ni
  ComfyUI expuesto.
- Etiqueta → prenda sin scraping ni SerpAPI: lo abre y lo trae el usuario.

## Fuentes clave

1. FASHN VTON v1.5, repositorio: https://github.com/fashn-AI/fashn-vton-1.5
2. FASHN VTON v1.5, tarjeta y limitaciones: https://huggingface.co/fashn-ai/fashn-vton-1.5 · https://fashn.ai/research/vton-1-5
3. CatVTON, repositorio: https://github.com/Zheng-Chong/CatVTON
4. CatVTON, artículo (tiempos y memoria comparados): https://arxiv.org/html/2407.15886v2
5. Nodo de ComfyUI para CatVTON con *wheels* de Windows: https://github.com/pzc163/Comfyui-CatVTON
6. FLUX.2 klein en ComfyUI: https://docs.comfy.org/tutorials/flux/flux-2-klein
7. IDM-VTON, repositorio y pesos (29,4 GB): https://github.com/yisol/IDM-VTON · https://huggingface.co/yisol/IDM-VTON/tree/main
8. IDM-VTON, «>18GB VRAM»: https://github.com/yisol/IDM-VTON/issues/43
9. Licencia CC BY-NC-SA 4.0: https://creativecommons.org/licenses/by-nc-sa/4.0/
10. FitVTON (2026), ajuste y prompts: https://arxiv.org/html/2606.12012v1
11. MDN, contenido mixto: https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content
12. Chrome, permiso Local Network Access: https://developer.chrome.com/blog/local-network-access
13. ComfyUI, rutas del servidor: https://docs.comfy.org/development/comfyui-server/comms_routes
14. Censys, botnet de ComfyUI expuestos (6-abr-2026): https://censys.com/blog/comfyui-servers-cryptomining-proxy-botnet/
15. Tailscale Serve: https://tailscale.com/kb/1312/serve · https://tailscale.com/kb/1242/tailscale-serve
16. Tailscale, HTTPS y precios: https://tailscale.com/kb/1153/enabling-https · https://tailscale.com/pricing
17. Tailscale, tipos de conexión (cifrado de extremo a extremo): https://tailscale.com/kb/1257/connection-types
18. Cloudflare, dónde se descifra el TLS: https://developers.cloudflare.com/data-localization/regional-services/
19. Privacidad de las apps de Gemini: https://support.google.com/gemini/answer/13594961?hl=en
20. Tailscale y Wake-on-LAN: https://tailscale.com/blog/wake-on-lan-tailscale-upsnap
21. Referencia de Zara ↔ URL: https://apify.com/automation-lab/zara-product-details-scraper.md
22. SerpApi, precios y CORS: https://serpapi.com/pricing · https://serpapi.com/blog/using-serpapi-in-web-frontend-solve-cors-issue
23. Google Custom Search JSON API: https://developers.google.com/custom-search/v1/overview
24. Retirada de Bing Search API: https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement
25. TJUE C-30/14, Ryanair: https://www.ippt.eu/sites/ippt/files/2015/IPPT20150115_ECJ_Ryanair_v_PR_Aviation.pdf
26. Ley de Propiedad Intelectual, arts. 133–135: https://www.boe.es/buscar/act.php?id=BOE-A-1996-8930
27. Inditex, Product Search API: https://developer.inditex.com/apimktplc/web/products/pubapimkt/protocols/REST/apis/product-search/overview
28. Zara, guía de tallas y «altura modelo»: ver `s4-etiquetas.md` §5.2 (fragmentos indexados de zara.com)
29. Gemini API, nivel gratuito y *grounding*: https://aistudio.google.com/docs/pricing
