// Captura de la página a 375 px de ancho tras recortar las 5 muestras con un candidato.
// Uso: con `pnpm dev` en marcha, `node scripts/captura-movil.mjs [candidato]`.
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const c = process.argv[2] ?? 'rmbg14';
const destino = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'spikes', 's1-recorte');
const navegador = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-webgpu'] });
const page = await (
  await navegador.newContext({ ignoreHTTPSErrors: true, viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 })
).newPage();
await page.goto(`${process.env.S1_URL ?? 'https://localhost:5173/'}?c=${c}&auto=1`);
await page.waitForFunction(() => window.__s1 && (window.__s1.fotos.length === 5 || window.__s1.error), null, {
  timeout: 10 * 60_000,
});
await page.screenshot({ path: join(destino, `movil-375-${c}.png`), fullPage: false });
await page.locator('#resultados').scrollIntoViewIfNeeded();
await page.screenshot({ path: join(destino, `movil-375-${c}-resultados.png`) });
await navegador.close();
