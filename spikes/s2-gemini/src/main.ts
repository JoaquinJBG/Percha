import { RespuestaEtiquetado } from './esquema';
import {
  describirError,
  etiquetar,
  listarModelos,
  probarBusqueda,
  type ImagenPreparada,
  type OpcionesEtiquetado,
  type ResultadoLlamada,
} from './gemini';
import { etiquetarSimulado } from './simulado';

const CLAVE_LS = 'percha.s2.claveGemini';
const REGISTRO_LS = 'percha.s2.registro';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const campoClave = $<HTMLInputElement>('clave');
const estadoClave = $('estado-clave');
const casillaSimulado = $<HTMLInputElement>('simulado');
const campoModelo = $<HTMLInputElement>('modelo');
const listaModelos = $<HTMLDataListElement>('modelos');
const selPensamiento = $<HTMLSelectElement>('pensamiento');
const selLado = $<HTMLSelectElement>('lado');
const selResolucion = $<HTMLSelectElement>('resolucion');
const campoFotos = $<HTMLInputElement>('fotos');
const miniaturas = $('miniaturas');
const botonEtiquetar = $<HTMLButtonElement>('etiquetar');
const estado = $('estado');
const metricas = $('metricas');
const validacion = $('validacion');
const salidaJson = $('json');
const tablaRegistro = $<HTMLTableElement>('registro');

interface FilaRegistro {
  hora: string;
  modelo: string;
  fotos: number;
  lado: string;
  razonamiento: string;
  resolucion: string;
  entrada?: number;
  entradaImagen?: number;
  salida?: number;
  pensamiento?: number;
  ms?: number;
  resultado: string;
}

// --- Clave: solo en localStorage, nunca en consola ni en el DOM fuera del campo ---

function leerLS(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function escribirLS(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* modo privado: la clave vive solo mientras la página esté abierta */
  }
}

campoClave.value = leerLS(CLAVE_LS) ?? '';
pintarEstadoClave();
campoClave.addEventListener('input', () => {
  escribirLS(CLAVE_LS, campoClave.value.trim() || null);
  pintarEstadoClave();
});
$('olvidar').addEventListener('click', () => {
  campoClave.value = '';
  escribirLS(CLAVE_LS, null);
  pintarEstadoClave();
});
function pintarEstadoClave() {
  const clave = campoClave.value.trim();
  estadoClave.textContent = clave ? `Clave guardada en este navegador (${clave.length} caracteres).` : 'Sin clave.';
}
function claveOAviso(): string | null {
  const clave = campoClave.value.trim();
  if (!clave) pintarEstado('Pega tu clave primero.', 'mal');
  return clave || null;
}

// --- Fotos ---

let imagenes: ImagenPreparada[] = [];
let archivos: File[] = [];

campoFotos.addEventListener('change', () => {
  archivos = Array.from(campoFotos.files ?? []).slice(0, 10);
  void prepararImagenes();
});
selLado.addEventListener('change', () => void prepararImagenes());
casillaSimulado.addEventListener('change', actualizarBoton);

async function prepararImagenes() {
  const lado = Number(selLado.value);
  imagenes = await Promise.all(archivos.map((f) => prepararImagen(f, lado)));
  miniaturas.replaceChildren(
    ...imagenes.map((img, i) => {
      const figura = document.createElement('figure');
      const imagen = document.createElement('img');
      imagen.src = `data:${img.mimeType};base64,${img.base64}`;
      imagen.alt = img.nombre;
      const pie = document.createElement('figcaption');
      pie.textContent = `${i + 1} · ${img.ancho}×${img.alto} · ${Math.round(img.bytes / 1024)} KB`;
      figura.append(imagen, pie);
      return figura;
    }),
  );
  actualizarBoton();
}

async function prepararImagen(archivo: File, ladoMax: number): Promise<ImagenPreparada> {
  const mapa = await createImageBitmap(archivo);
  const escala = ladoMax > 0 ? Math.min(1, ladoMax / Math.max(mapa.width, mapa.height)) : 1;
  const ancho = Math.round(mapa.width * escala);
  const alto = Math.round(mapa.height * escala);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext('2d')!.drawImage(mapa, 0, 0, ancho, alto);
  mapa.close();
  const dataUrl = lienzo.toDataURL('image/jpeg', 0.85);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { nombre: archivo.name, base64, mimeType: 'image/jpeg', ancho, alto, bytes: Math.round((base64.length * 3) / 4) };
}

function actualizarBoton() {
  botonEtiquetar.disabled = imagenes.length === 0 && !casillaSimulado.checked;
}

// --- Etiquetar ---

botonEtiquetar.addEventListener('click', async () => {
  const simulado = casillaSimulado.checked;
  const clave = simulado ? '' : claveOAviso();
  if (!simulado && !clave) return;
  const opciones: OpcionesEtiquetado = {
    clave: clave ?? '',
    modelo: campoModelo.value.trim(),
    pensamiento: selPensamiento.value as OpcionesEtiquetado['pensamiento'],
    resolucion: selResolucion.value as OpcionesEtiquetado['resolucion'],
  };
  const numFotos = simulado ? Math.max(imagenes.length, 3) : imagenes.length;
  const fila: FilaRegistro = {
    hora: new Date().toLocaleTimeString('es-ES'),
    modelo: simulado ? 'simulado' : opciones.modelo,
    fotos: numFotos,
    lado: selLado.selectedOptions[0]?.textContent ?? '',
    razonamiento: selPensamiento.selectedOptions[0]?.textContent ?? '',
    resolucion: selResolucion.selectedOptions[0]?.textContent ?? '',
    resultado: '',
  };

  botonEtiquetar.disabled = true;
  pintarEstado(`Enviando ${numFotos} foto(s) a ${fila.modelo}…`);
  metricas.replaceChildren();
  validacion.replaceChildren();
  salidaJson.textContent = '';
  try {
    const r = simulado ? await etiquetarSimulado(numFotos) : await etiquetar(imagenes, opciones);
    Object.assign(fila, r.uso, { ms: Math.round(r.ms) });
    pintarMetricas(r);
    fila.resultado = validar(r.texto, numFotos);
    pintarEstado(`Respuesta en ${(r.ms / 1000).toFixed(1)} s.`, 'ok');
  } catch (error) {
    fila.resultado = describirError(error).slice(0, 120);
    pintarEstado(describirError(error), 'mal');
  } finally {
    añadirAlRegistro(fila);
    actualizarBoton();
  }
});

function validar(texto: string, esperadas: number): string {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    salidaJson.textContent = texto;
    pintarValidacion('El texto no es JSON.', 'mal');
    return 'JSON roto';
  }
  salidaJson.textContent = JSON.stringify(datos, null, 2);
  const resultado = RespuestaEtiquetado.safeParse(datos);
  if (!resultado.success) {
    const fallos = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    pintarValidacion(`Zod: ${fallos.length} fallo(s) — ${fallos.slice(0, 5).join(' · ')}`, 'mal');
    return `Zod ✗ (${fallos.length})`;
  }
  const indices = resultado.data.prendas.map((p) => p.indice).sort((a, b) => a - b);
  const completos = indices.length === esperadas && indices.every((n, i) => n === i + 1);
  if (!completos) {
    pintarValidacion(`Zod OK, pero esperaba índices 1…${esperadas} y llegaron [${indices.join(', ')}].`, 'mal');
    return `índices ✗ (${indices.length}/${esperadas})`;
  }
  pintarValidacion(`Zod OK: ${esperadas} prenda(s) con todos los campos.`, 'ok');
  return 'OK';
}

// --- Botones de comprobación ---

$('listar').addEventListener('click', async () => {
  const clave = claveOAviso();
  if (!clave) return;
  pintarEstado('Pidiendo la lista de modelos…');
  try {
    const nombres = await listarModelos(clave);
    listaModelos.replaceChildren(...nombres.map((n) => Object.assign(document.createElement('option'), { value: n })));
    salidaJson.textContent = nombres.join('\n');
    pintarEstado(`${nombres.length} modelos con generateContent. Ahora salen en el desplegable.`, 'ok');
  } catch (error) {
    pintarEstado(describirError(error), 'mal');
  }
});

// Clave falsa a propósito: si el navegador deja leer el 400 de Google, CORS está abierto.
$('cors').addEventListener('click', async () => {
  pintarEstado('Llamando a la API con una clave falsa…');
  try {
    const respuesta = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': 'clave-falsa-para-probar-cors' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'hola' }] }] }),
      },
    );
    const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
    salidaJson.textContent = JSON.stringify(cuerpo, null, 2);
    pintarEstado(
      `CORS OK: el navegador pudo leer la respuesta (HTTP ${respuesta.status}: ${cuerpo.error?.message ?? 'sin mensaje'}).`,
      'ok',
    );
  } catch (error) {
    pintarEstado(`CORS bloqueado o sin red: ${describirError(error)}`, 'mal');
  }
});

$('busqueda').addEventListener('click', async () => {
  const clave = claveOAviso();
  if (!clave) return;
  const modelo = campoModelo.value.trim();
  pintarEstado(`Probando la búsqueda de Google con ${modelo}…`);
  const fila: FilaRegistro = {
    hora: new Date().toLocaleTimeString('es-ES'),
    modelo: `${modelo} + búsqueda`,
    fotos: 0,
    lado: '-',
    razonamiento: '-',
    resolucion: '-',
    resultado: '',
  };
  try {
    const r = await probarBusqueda(clave, modelo);
    Object.assign(fila, r.uso, { ms: Math.round(r.ms) });
    fila.resultado = r.busquedas.length ? `búsqueda OK (${r.busquedas.length})` : 'sin búsquedas';
    pintarMetricas(r);
    salidaJson.textContent = `${r.texto}\n\nBúsquedas: ${r.busquedas.join(' | ') || 'ninguna'}`;
    pintarEstado(r.busquedas.length ? 'La búsqueda funciona con esta clave.' : 'Respondió, pero sin buscar.', 'ok');
  } catch (error) {
    fila.resultado = describirError(error).slice(0, 120);
    pintarEstado(describirError(error), 'mal');
  } finally {
    añadirAlRegistro(fila);
  }
});

// --- Pintar ---

function pintarEstado(texto: string, tipo?: 'ok' | 'mal') {
  estado.textContent = texto;
  estado.className = `nota ${tipo ?? ''}`;
}
function pintarValidacion(texto: string, tipo: 'ok' | 'mal') {
  const p = document.createElement('p');
  p.className = tipo;
  p.textContent = texto;
  validacion.replaceChildren(p);
}
function pintarMetricas(r: ResultadoLlamada) {
  const pares: [string, string][] = [
    ['Modelo', r.modeloRespuesta ?? '?'],
    ['Tiempo', `${Math.round(r.ms)} ms`],
    ['Tokens entrada', fmt(r.uso.entrada)],
    ['… de imagen', fmt(r.uso.entradaImagen)],
    ['Tokens salida', fmt(r.uso.salida)],
    ['Razonamiento', fmt(r.uso.pensamiento)],
    ['Total', fmt(r.uso.total)],
  ];
  metricas.replaceChildren(
    ...pares.flatMap(([t, d]) => [
      Object.assign(document.createElement('dt'), { textContent: t }),
      Object.assign(document.createElement('dd'), { textContent: d }),
    ]),
  );
}
const fmt = (n?: number) => (n === undefined ? '—' : n.toLocaleString('es-ES'));

// --- Registro ---

const COLUMNAS: [keyof FilaRegistro, string][] = [
  ['hora', 'Hora'],
  ['modelo', 'Modelo'],
  ['fotos', 'Fotos'],
  ['lado', 'Lado'],
  ['razonamiento', 'Razon.'],
  ['resolucion', 'Resol.'],
  ['entrada', 'Tok. entrada'],
  ['entradaImagen', 'Tok. imagen'],
  ['salida', 'Tok. salida'],
  ['pensamiento', 'Tok. razon.'],
  ['ms', 'ms'],
  ['resultado', 'Resultado'],
];

function leerRegistro(): FilaRegistro[] {
  try {
    return JSON.parse(leerLS(REGISTRO_LS) ?? '[]') as FilaRegistro[];
  } catch {
    return [];
  }
}
function añadirAlRegistro(fila: FilaRegistro) {
  const filas = [...leerRegistro(), fila];
  escribirLS(REGISTRO_LS, JSON.stringify(filas));
  pintarRegistro(filas);
}
function pintarRegistro(filas: FilaRegistro[]) {
  const cabecera = document.createElement('tr');
  cabecera.append(...COLUMNAS.map(([, t]) => Object.assign(document.createElement('th'), { textContent: t })));
  tablaRegistro.replaceChildren(
    cabecera,
    ...filas.map((f) => {
      const tr = document.createElement('tr');
      tr.append(...COLUMNAS.map(([c]) => Object.assign(document.createElement('td'), { textContent: String(f[c] ?? '—') })));
      return tr;
    }),
  );
}
pintarRegistro(leerRegistro());

$('copiar').addEventListener('click', async () => {
  const filas = leerRegistro();
  const md = [
    `| ${COLUMNAS.map(([, t]) => t).join(' | ')} |`,
    `|${COLUMNAS.map(() => '---').join('|')}|`,
    ...filas.map((f) => `| ${COLUMNAS.map(([c]) => String(f[c] ?? '—').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n');
  try {
    await navigator.clipboard.writeText(md);
    pintarEstado('Tabla copiada. Pégala en el chat o en el informe.', 'ok');
  } catch {
    salidaJson.textContent = md;
    pintarEstado('No se pudo copiar; la tienes abajo para copiarla a mano.');
  }
});
$('vaciar').addEventListener('click', () => {
  escribirLS(REGISTRO_LS, null);
  pintarRegistro([]);
});
