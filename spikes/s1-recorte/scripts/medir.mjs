// Mide cada candidato en el Chrome del PC: primera carga (perfil limpio) y carga desde caché.
// Uso: con `pnpm dev` en marcha, `node scripts/medir.mjs [candidato:motor ...]`.
// Deja en resultados/ (ignorada por git) las medidas, una captura por candidato y los recortes en PNG.
import { chromium } from 'playwright-core';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ficheroMedidas = join(raiz, 'resultados', 'medidas.json');
const base = process.env.S1_URL ?? 'https://localhost:5173/';
const headless = process.env.S1_HEADLESS !== '0';

const pruebas = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['rembg:webgpu', 'rmbg14:webgpu', 'birefnet:webgpu', 'isnet:webgpu', 'mvanet:webgpu', 'rembg:wasm', 'rmbg14:wasm', 'isnet:wasm'];

async function abrir(perfil) {
  return chromium.launchPersistentContext(perfil, {
    channel: 'chrome',
    headless,
    ignoreHTTPSErrors: true,
    viewport: { width: 1100, height: 900 },
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
  });
}

async function ejecutar(ctx, c, d) {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const consola = [];
  page.on('console', (m) => m.type() === 'error' && consola.push(m.text()));
  await page.goto(`${base}?c=${c}&d=${d}&auto=1`);
  await page.waitForFunction(() => window.__s1 && (window.__s1.fotos.length === 5 || window.__s1.error), null, {
    timeout: 15 * 60_000,
    polling: 1000,
  });
  const estado = await page.evaluate(() => window.__s1);
  return { page, estado, consola: consola.slice(0, 5) };
}

async function guardarRecortes(page, carpeta) {
  await mkdir(carpeta, { recursive: true });
  const pngs = await page.evaluate(async () => {
    const leer = (b) =>
      new Promise((r) => {
        const fr = new FileReader();
        fr.onload = () => r(String(fr.result).split(',')[1]);
        fr.readAsDataURL(b);
      });
    return Promise.all([...window.__s1Recortes].map(async ([n, b]) => [n.replace(/\.\w+$/, '.png'), await leer(b)]));
  });
  for (const [nombre, b64] of pngs) await writeFile(join(carpeta, nombre), Buffer.from(b64, 'base64'));
}

let medidas = {};
try {
  medidas = JSON.parse(await readFile(ficheroMedidas, 'utf8'));
} catch {}
await mkdir(dirname(ficheroMedidas), { recursive: true });

for (const prueba of pruebas) {
  const [c, d] = prueba.split(':');
  const perfil = await mkdtemp(join(tmpdir(), 'percha-s1-'));
  const ctx = await abrir(perfil);
  try {
    const fria = await ejecutar(ctx, c, d);
    if (!fria.estado.error) {
      await fria.page.locator('#resultados').screenshot({ path: join(raiz, 'resultados', `${c}-${d}.png`) });
      await guardarRecortes(fria.page, join(raiz, 'resultados', `${c}-${d}`));
    }
    const caliente = fria.estado.error ? null : (await ejecutar(ctx, c, d)).estado;
    medidas[prueba] = { fria: fria.estado, caliente, consola: fria.consola };
    const t = fria.estado.fotos.map((f) => f.ms);
    console.log(
      prueba,
      fria.estado.error ??
        `${fria.estado.motor}/${fria.estado.dtype} · ${(fria.estado.descargaModeloMB + fria.estado.descargaRuntimeMB).toFixed(1)} MB · carga ${(fria.estado.cargaMs / 1000).toFixed(1)} s (caché ${(caliente.cargaMs / 1000).toFixed(1)} s) · fotos ${t.map((x) => (x / 1000).toFixed(2)).join(' ')}`,
    );
  } catch (e) {
    medidas[prueba] = { error: String(e) };
    console.log(prueba, 'ERROR', String(e).slice(0, 300));
  } finally {
    await ctx.close();
    await writeFile(ficheroMedidas, JSON.stringify(medidas, null, 2));
  }
}
