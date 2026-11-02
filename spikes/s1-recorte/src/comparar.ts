export {};

const params = new URLSearchParams(location.search);
const motor = params.get('motor') ?? 'webgpu';
const completa = params.get('vista') === 'completa';
// `c=rmbg14,mvanet` usa el motor de `motor`; `c=rmbg14:webgpu,rmbg14:wasm` compara motores.
const CANDIDATOS = (params.get('c') ?? 'rembg,rmbg14,birefnet1024,isnet,mvanet')
  .split(',')
  .map((c) => (c.includes(':') ? c.replace(':', '-') : `${c}-${motor}`));

// Zona de detalle de cada foto (fracciones del ancho y alto): donde el borde es más difícil.
const FOTOS: [string, [number, number, number, number]][] = [
  ['1-camiseta.png', [0, 0, 0.55, 0.4]],
  ['2-pantalon.png', [0.1, 0, 0.8, 0.35]],
  ['3-zapatillas.png', [0.05, 0.15, 0.7, 0.65]],
  ['4-chaqueta.png', [0.2, 0, 0.6, 0.4]],
  ['5-estampado.png', [0, 0.05, 0.8, 0.4]],
];

const tabla = document.getElementById('tabla') as HTMLTableElement;
const cabecera = tabla.insertRow();
cabecera.insertCell().textContent = '';
for (const c of CANDIDATOS) {
  const th = document.createElement('th');
  th.textContent = c;
  cabecera.append(th);
}

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

for (const [foto, [x, y, w, h]] of FOTOS) {
  const fila = tabla.insertRow();
  fila.insertCell().textContent = foto.replace('.png', '');
  for (const c of CANDIDATOS) {
    const celda = fila.insertCell();
    const img = await cargarImagen(`/resultados/${c}/${foto}`);
    if (!img) {
      celda.textContent = 'sin resultado';
      continue;
    }
    const [sx, sy, sw, sh] = completa
      ? [0, 0, img.width, img.height]
      : [x * img.width, y * img.height, w * img.width, h * img.height];
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    canvas.className = params.get('fondo') === 'oscuro' ? 'fondo-oscuro' : 'cuadros';
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    celda.append(canvas);
  }
}
