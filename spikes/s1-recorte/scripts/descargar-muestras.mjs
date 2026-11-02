// Descarga las 5 fotos libres de Wikimedia Commons a muestras/ (ignorada por git).
// Las fotos reales del usuario también irían ahí, con los mismos nombres o cualquier otro.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'muestras');

const fotos = [
  ['1-camiseta.jpg', 'IMages Are Hopefully in Your head since 1982 shirt.jpg'],
  ['2-pantalon.jpg', "Men's trousers inside out.jpg"],
  ['3-zapatillas.jpg', 'Sneakers .jpg'],
  ['4-chaqueta.jpg', 'Jean jacket.jpg'],
  ['5-estampado.jpg', 'Pink Coral Aloha Shirt from HM.jpg'],
];

const cabeceras = { 'User-Agent': 'PerchaSpikeS1/0.1 (https://github.com/JoaquinJBG/Percha; prueba personal) node-fetch' };

// Commons responde 429 si se piden varios originales seguidos: reintenta con espera.
async function descargar(url, intentos = 5) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: cabeceras });
    if (res.ok) return res;
    if (i === intentos) throw new Error(`${res.status} al descargar ${url}`);
    await new Promise((r) => setTimeout(r, 15000 * i));
  }
}

await mkdir(destino, { recursive: true });
for (const [nombre, fichero] of fotos) {
  const ya = await stat(join(destino, nombre)).catch(() => null);
  if (ya && ya.size > 50_000) continue;
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: `File:${fichero}`,
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    // Miniatura de 2400 px: como una foto de móvil reducida, y Commons limita menos que los originales.
    iiurlwidth: '2400',
    iiextmetadatafilter: 'LicenseShortName|Artist',
  }).toString();
  const datos = await (await fetch(api, { headers: cabeceras })).json();
  const info = Object.values(datos.query.pages)[0].imageinfo[0];
  const foto = await descargar(info.thumburl ?? info.url);
  await writeFile(join(destino, nombre), Buffer.from(await foto.arrayBuffer()));
  const autor = (info.extmetadata.Artist?.value ?? '?').replace(/<[^>]+>/g, '').trim();
  console.log(`${nombre}: ${info.thumbwidth ?? info.width}x${info.thumbheight ?? info.height} · ${info.extmetadata.LicenseShortName.value} · ${autor} · ${info.descriptionurl}`);
}
