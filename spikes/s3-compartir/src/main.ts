import { componer, imagenesSinteticas, normalizarFoto, type ImagenesBase } from './imagenes';
import { promptTryOn, type Disposicion } from './prompt';

type Variante = 'A' | 'B' | 'C' | 'D';

const NOMBRES_SINTETICOS = ['camiseta verde de manga corta', 'pantalón vaquero azul', 'zapatillas blancas'];

const DEFINICION: Record<Variante, { disposicion: Disposicion; textoEnShare: boolean }> = {
  A: { disposicion: 'separadas', textoEnShare: true },
  B: { disposicion: 'separadas', textoEnShare: false },
  C: { disposicion: 'compuesta', textoEnShare: true },
  D: { disposicion: 'compuesta', textoEnShare: false },
};

function $<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Falta ${selector}`);
  return el;
}

const huecos = $<HTMLDivElement>('#huecos');
const usarTres = $<HTMLInputElement>('#usar-tres');
const imgCompuesta = $<HTMLImageElement>('#compuesta');
const preSeparadas = $<HTMLPreElement>('#prompt-separadas');
const preCompuesta = $<HTMLPreElement>('#prompt-compuesta');
const registro = $<HTMLPreElement>('#registro');

let sinteticas: ImagenesBase;
let persona: File;
let prendas: File[] = [];
let nombres = [...NOMBRES_SINTETICOS];
let compuesta: File | null = null;
let urlCompuesta: string | null = null;
let componiendo = false;

function anotar(mensaje: string): void {
  const hora = new Date().toLocaleTimeString('es-ES');
  registro.textContent += `[${hora}] ${mensaje}\n`;
  registro.scrollTop = registro.scrollHeight;
}

function kb(f: File): string {
  return `${f.name} ${Math.round(f.size / 1024)} KB`;
}

function base(): ImagenesBase {
  return { persona, prendas: usarTres.checked ? prendas : prendas.slice(0, 2) };
}

function nombresActivos(): string[] {
  return usarTres.checked ? nombres : nombres.slice(0, 2);
}

function textoPara(disposicion: Disposicion): string {
  return promptTryOn(nombresActivos(), disposicion);
}

function datosPara(variante: Variante): ShareData {
  const { disposicion, textoEnShare } = DEFINICION[variante];
  const b = base();
  const files = disposicion === 'separadas' ? [b.persona, ...b.prendas] : compuesta ? [compuesta] : [];
  return textoEnShare ? { files, text: textoPara(disposicion) } : { files };
}

function puedeCompartir(datos: ShareData): string {
  if (typeof navigator.canShare !== 'function') return 'canShare no existe';
  try {
    return navigator.canShare(datos) ? 'sí' : 'no';
  } catch (e) {
    return `error ${(e as Error).name}`;
  }
}

function pintarHuecos(): void {
  huecos.replaceChildren();
  const filas: { titulo: string; file: File; indice: number }[] = [
    { titulo: 'Persona', file: persona, indice: -1 },
    ...prendas.map((file, i) => ({ titulo: `Prenda ${i + 1}`, file, indice: i })),
  ];
  for (const { titulo, file, indice } of filas) {
    const caja = document.createElement('div');
    caja.className = 'hueco';
    if (indice === 2 && !usarTres.checked) caja.classList.add('apagado');

    const t = document.createElement('span');
    t.className = 'titulo';
    t.textContent = titulo;

    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.src = url;
    img.alt = titulo;
    img.onload = () => URL.revokeObjectURL(url);

    const cambiar = document.createElement('label');
    cambiar.className = 'cambiar';
    cambiar.textContent = 'Cambiar foto';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const elegido = input.files?.[0];
      if (elegido) void cambiarFoto(indice, elegido);
    });
    cambiar.append(input);

    caja.append(t, img);
    if (indice >= 0) {
      const nombre = document.createElement('input');
      nombre.type = 'text';
      nombre.value = nombres[indice] ?? '';
      nombre.placeholder = 'Descripción de la prenda';
      nombre.addEventListener('input', () => {
        nombres[indice] = nombre.value;
        pintarPrompts();
      });
      caja.append(nombre);
    }
    caja.append(cambiar);
    huecos.append(caja);
  }
}

function pintarPrompts(): void {
  preSeparadas.textContent = textoPara('separadas');
  preCompuesta.textContent = textoPara('compuesta');
}

async function recomponer(): Promise<void> {
  componiendo = true;
  try {
    compuesta = await componer(base());
    if (urlCompuesta) URL.revokeObjectURL(urlCompuesta);
    urlCompuesta = URL.createObjectURL(compuesta);
    imgCompuesta.src = urlCompuesta;
  } catch (e) {
    anotar(`Error al componer: ${(e as Error).message}`);
  } finally {
    componiendo = false;
  }
}

async function cambiarFoto(indice: number, origen: File): Promise<void> {
  try {
    const nombre = indice < 0 ? 'persona.jpg' : `prenda-${indice + 1}.jpg`;
    const foto = await normalizarFoto(origen, nombre);
    if (indice < 0) persona = foto;
    else prendas[indice] = foto;
    anotar(`Foto cambiada: ${kb(foto)} (original ${origen.type || '?'}, ${Math.round(origen.size / 1024)} KB)`);
    pintarHuecos();
    await recomponer();
  } catch (e) {
    anotar(`No se pudo leer la foto: ${(e as Error).message}`);
  }
}

async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    anotar(`clipboard.writeText falló (${(e as Error).name}); pruebo execCommand`);
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

async function compartir(variante: Variante): Promise<void> {
  // La activación por gesto del usuario caduca: todo lo pesado ya está preparado antes del clic.
  const datos = datosPara(variante);
  const files = datos.files ?? [];
  anotar(
    `Variante ${variante}: ${files.length} imagen(es) [${files.map(kb).join(', ')}], ` +
      `texto en share: ${datos.text ? 'sí' : 'no'}, canShare: ${puedeCompartir(datos)}`,
  );
  if (!DEFINICION[variante].textoEnShare) {
    const ok = await copiarAlPortapapeles(textoPara(DEFINICION[variante].disposicion));
    anotar(ok ? 'Texto copiado al portapapeles' : 'No se pudo copiar el texto');
  }
  if (typeof navigator.share !== 'function') {
    anotar('navigator.share no existe en este navegador');
    return;
  }
  const inicio = performance.now();
  try {
    await navigator.share(datos);
    anotar(`share() resuelto en ${Math.round(performance.now() - inicio)} ms (app elegida)`);
  } catch (e) {
    const err = e as Error;
    anotar(`share() rechazado: ${err.name} — ${err.message}`);
  }
}

function diagnostico(): void {
  anotar(`Navegador: ${navigator.userAgent}`);
  anotar(`Contexto seguro: ${window.isSecureContext ? 'sí' : 'no'}`);
  anotar(`navigator.share: ${typeof navigator.share === 'function' ? 'sí' : 'no'}`);
  anotar(`navigator.canShare: ${typeof navigator.canShare === 'function' ? 'sí' : 'no'}`);
  anotar(`Portapapeles: ${navigator.clipboard ? 'sí' : 'no'}`);
  for (const v of Object.keys(DEFINICION) as Variante[]) {
    anotar(`canShare ${v}: ${puedeCompartir(datosPara(v))}`);
  }
}

async function iniciar(): Promise<void> {
  sinteticas = await imagenesSinteticas();
  persona = sinteticas.persona;
  prendas = [...sinteticas.prendas];
  pintarHuecos();
  pintarPrompts();
  await recomponer();
  diagnostico();

  usarTres.addEventListener('change', () => {
    pintarHuecos();
    pintarPrompts();
    void recomponer();
  });

  $<HTMLButtonElement>('#restaurar').addEventListener('click', () => {
    persona = sinteticas.persona;
    prendas = [...sinteticas.prendas];
    nombres = [...NOMBRES_SINTETICOS];
    pintarHuecos();
    pintarPrompts();
    void recomponer();
    anotar('Imágenes sintéticas restauradas');
  });

  for (const boton of document.querySelectorAll<HTMLButtonElement>('[data-variante]')) {
    boton.addEventListener('click', () => {
      // Esperar a la composición podría agotar la activación del gesto: se avisa y se comparte la anterior.
      if (componiendo) anotar('Aviso: la imagen compuesta aún se estaba generando');
      void compartir(boton.dataset.variante as Variante);
    });
  }

  $<HTMLButtonElement>('#copiar-registro').addEventListener('click', () => {
    void copiarAlPortapapeles(registro.textContent ?? '').then((ok) =>
      anotar(ok ? 'Registro copiado' : 'No se pudo copiar el registro'),
    );
  });
}

void iniciar();
