import { candidatos, type Candidato, type Motor, type Recortador } from './candidatos';

const MUESTRAS = ['1-camiseta.jpg', '2-pantalon.jpg', '3-zapatillas.jpg', '4-chaqueta.jpg', '5-estampado.jpg'];

type Foto = { nombre: string; ms: number; ancho: number; alto: number };

type Estado = {
  candidato: string;
  motor: Motor | null;
  dtype: string | null;
  gpu: string;
  f16: boolean;
  aislado: boolean;
  hilos: number;
  maxLado: number;
  descargaModeloMB: number;
  descargaRuntimeMB: number;
  cargaMs: number | null;
  fotos: Foto[];
  error: string | null;
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const params = new URLSearchParams(location.search);
const candidato: Candidato = candidatos.find((c) => c.id === params.get('c')) ?? candidatos[0];
const motorPedido = (params.get('d') ?? 'auto') as Motor | 'auto';
// Las fotos se reducen antes de recortar, como hará la app al guardarlas.
const maxLado = Number(params.get('max') ?? 1600);

const estado: Estado = {
  candidato: candidato.id,
  motor: null,
  dtype: null,
  gpu: '—',
  f16: false,
  aislado: crossOriginIsolated,
  hilos: navigator.hardwareConcurrency,
  maxLado,
  descargaModeloMB: 0,
  descargaRuntimeMB: 0,
  cargaMs: null,
  fotos: [],
  error: null,
};
const recortes = new Map<string, Blob>();
Object.assign(window, { __s1: estado, __s1Recortes: recortes });

let recortador: Promise<Recortador> | null = null;

// --- Interfaz -------------------------------------------------------------------------------

const selCandidato = $<HTMLSelectElement>('candidato');
for (const c of candidatos) selCandidato.add(new Option(c.nombre, c.id, false, c.id === candidato.id));
const selMotor = $<HTMLSelectElement>('motor');
selMotor.value = motorPedido;
$('licencia').textContent = `Modelo: ${candidato.modelo}. Licencia: ${candidato.licencia}.`;

// Cada candidato en una carga limpia de la página: rembg-webgpu parchea `fetch` y no se puede descargar.
function recargarCon(clave: string, valor: string) {
  params.set(clave, valor);
  location.search = params.toString();
}
selCandidato.onchange = () => recargarCon('c', selCandidato.value);
selMotor.onchange = () => recargarCon('d', selMotor.value);

function aviso(texto: string, error = false) {
  const p = $('estado');
  p.textContent = texto;
  p.classList.toggle('error', error);
}

const seg = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(2)} s`);
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function pintarMedidas() {
  const tiempos = estado.fotos.map((f) => f.ms);
  const filas: [string, string][] = [
    ['Motor', estado.motor ? `${estado.motor} · ${estado.dtype}` : '—'],
    ['GPU', `${estado.gpu}${estado.f16 ? ' · shader-f16' : ''}`],
    ['WASM', `${estado.aislado ? 'multihilo' : 'un hilo (sin aislamiento)'} · ${estado.hilos} núcleos`],
    ['Descarga modelo', `${estado.descargaModeloMB.toFixed(1)} MB`],
    ['Descarga runtime', `${estado.descargaRuntimeMB.toFixed(1)} MB`],
    ['Carga del modelo', seg(estado.cargaMs)],
    ['1.ª foto', seg(tiempos[0] ?? null)],
    ['Media resto', seg(media(tiempos.slice(1)))],
    ['Fotos', `${tiempos.length} (lado máx. ${maxLado} px)`],
  ];
  $('medidas').replaceChildren(
    ...filas.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }),
  );
}

// --- Medida de la descarga ------------------------------------------------------------------

async function contarDescargas() {
  const { env } = await import('@huggingface/transformers');
  const original = env.fetch;
  env.fetch = async (url, init) => {
    const res = await original(url, init);
    // Las peticiones de metadatos (Range 0-0, 206) no cuentan; desde caché no se llama a fetch.
    // rembg-webgpu lee la propia foto con fetch de una URL blob: tampoco cuenta.
    if (res.status === 200 && String(url).startsWith('http')) {
      const mb = Number(res.headers.get('content-length') ?? 0) / 1e6;
      if (/huggingface\.co|hf\.co/.test(String(url))) estado.descargaModeloMB += mb;
      else estado.descargaRuntimeMB += mb;
      pintarMedidas();
    }
    return res;
  };
}

// --- Carga ----------------------------------------------------------------------------------

async function detectarGpu(): Promise<boolean> {
  if (!('gpu' in navigator) || !navigator.gpu) return false;
  const adaptador = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adaptador) return false;
  const info = adaptador.info;
  estado.gpu = [info.vendor, info.architecture, info.description].filter(Boolean).join(' ') || 'sí';
  estado.f16 = adaptador.features.has('shader-f16');
  return true;
}

function cargar(): Promise<Recortador> {
  if (recortador) return recortador;
  recortador = (async () => {
    $<HTMLButtonElement>('cargar').disabled = true;
    try {
      const hayGpu = await detectarGpu();
      const motor: Motor = motorPedido === 'auto' ? (hayGpu ? 'webgpu' : 'wasm') : motorPedido;
      if (motor === 'webgpu' && !hayGpu) throw new Error('Este navegador no tiene WebGPU');
      estado.motor = motor;
      aviso(`Descargando y preparando ${candidato.nombre} (${motor})…`);
      pintarMedidas();
      await contarDescargas();
      const t0 = performance.now();
      const r = await candidato.cargar(motor, estado.f16);
      estado.cargaMs = performance.now() - t0;
      estado.dtype = r.dtype;
      aviso('Modelo listo. Haz una foto o elige de la galería.');
      pintarMedidas();
      return r;
    } catch (e) {
      estado.error = String(e);
      aviso(`Error al cargar: ${String(e)}`, true);
      recortador = null;
      $<HTMLButtonElement>('cargar').disabled = false;
      throw e;
    }
  })();
  return recortador;
}

// --- Recorte --------------------------------------------------------------------------------

async function prepararEntrada(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

function pintarTarjeta(nombre: string, original: Blob, recorte: Blob, foto: Foto) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta';
  const pareja = document.createElement('div');
  pareja.className = 'pareja';
  const a = new Image();
  a.src = URL.createObjectURL(original);
  a.alt = `Original: ${nombre}`;
  const b = new Image();
  b.src = URL.createObjectURL(recorte);
  b.alt = `Recorte: ${nombre}`;
  b.className = 'cuadros';
  pareja.append(a, b);
  const pie = document.createElement('p');
  pie.textContent = `${nombre} · ${foto.ancho}×${foto.alto} · ${seg(foto.ms)}`;
  tarjeta.append(pareja, pie);
  $('resultados').append(tarjeta);
}

async function procesar(nombre: string, blob: Blob) {
  const r = await cargar();
  aviso(`Recortando ${nombre}…`);
  const t0 = performance.now();
  const entrada = await prepararEntrada(blob);
  const recorte = await r.recortar(entrada);
  const foto: Foto = { nombre, ms: performance.now() - t0, ancho: entrada.width, alto: entrada.height };
  estado.fotos.push(foto);
  recortes.set(nombre, recorte);
  pintarTarjeta(nombre, blob, recorte, foto);
  pintarMedidas();
}

async function procesarVarias(fotos: { nombre: string; blob: () => Promise<Blob> }[]) {
  try {
    for (const f of fotos) await procesar(f.nombre, await f.blob());
    aviso(`Hecho: ${fotos.length} foto(s).`);
  } catch (e) {
    estado.error = String(e);
    aviso(`Error: ${String(e)}`, true);
  }
}

function alElegir(input: HTMLInputElement) {
  input.onchange = () => {
    const ficheros = [...(input.files ?? [])];
    input.value = '';
    void procesarVarias(ficheros.map((f) => ({ nombre: f.name, blob: async () => f })));
  };
}
alElegir($('camara'));
alElegir($('galeria'));

$('cargar').onclick = () => void cargar().catch(() => {});

$('muestras').onclick = () =>
  void procesarVarias(
    MUESTRAS.map((nombre) => ({
      nombre,
      blob: async () => {
        const res = await fetch(`/muestras/${nombre}`);
        if (!res.ok) throw new Error(`Falta muestras/${nombre}: ejecuta scripts/descargar-muestras.mjs`);
        return res.blob();
      },
    })),
  );

$('copiar').onclick = async () => {
  const t = estado.fotos.map((f) => f.ms);
  const fila = [
    navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? navigator.userAgent,
    candidato.nombre,
    `${estado.motor} ${estado.dtype}`,
    `${(estado.descargaModeloMB + estado.descargaRuntimeMB).toFixed(0)} MB`,
    seg(estado.cargaMs),
    seg(t[0] ?? null),
    seg(media(t.slice(1))),
  ];
  const texto = `| ${fila.join(' | ')} |`;
  try {
    await navigator.clipboard.writeText(texto);
    aviso('Copiado. Pégalo en la tabla del informe.');
  } catch {
    aviso(texto);
  }
};

$('borrar').onclick = async () => {
  for (const nombre of await caches.keys()) await caches.delete(nombre);
  aviso('Modelos borrados. Recarga la página para medir una primera carga.');
};

if (params.get('auto') === '1') void $<HTMLButtonElement>('muestras').click();
pintarMedidas();
