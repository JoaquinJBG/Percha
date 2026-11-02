// Captura de comparar.html (recortes guardados por medir.mjs) para el informe.
// Uso: con `pnpm dev` en marcha, `node scripts/captura-comparar.mjs "<query>" <fichero.png>`.
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [query = '', fichero = 'comparar.png'] = process.argv.slice(2);
const destino = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'spikes', 's1-recorte');
const navegador = await chromium.launch({ channel: 'chrome' });
const page = await (await navegador.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } })).newPage();
await page.goto(`${process.env.S1_URL ?? 'https://localhost:5173/'}comparar.html${query}`);
await page.waitForFunction(() => document.querySelectorAll('#tabla tr').length === 6);
await page.waitForTimeout(500);
await page.locator('#tabla').screenshot({ path: join(destino, fichero) });
await navegador.close();
