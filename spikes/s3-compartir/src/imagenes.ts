// Imágenes sintéticas dibujadas en canvas: así el spike no necesita fotos reales en el repo.

const CALIDAD_JPEG = 0.9;
const LADO_MAX = 1536;

function lienzo(ancho: number, alto: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  return [canvas, ctx];
}

function aJpeg(canvas: HTMLCanvasElement, nombre: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error(`No se pudo codificar ${nombre}`));
        resolve(new File([blob], nombre, { type: 'image/jpeg', lastModified: Date.now() }));
      },
      'image/jpeg',
      CALIDAD_JPEG,
    );
  });
}

function fondo(ctx: CanvasRenderingContext2D, ancho: number, alto: number, color = '#f4f1ec'): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ancho, alto);
}

function personaSintetica(): HTMLCanvasElement {
  const [c, ctx] = lienzo(768, 1024);
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#e9eef3');
  grad.addColorStop(1, '#cfd8e0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 1024);

  const piel = '#e0b48e';
  // piernas y pies
  ctx.fillStyle = '#5b5f66';
  ctx.fillRect(318, 560, 56, 380);
  ctx.fillRect(394, 560, 56, 380);
  ctx.fillStyle = '#2f3237';
  ctx.beginPath();
  ctx.ellipse(340, 950, 44, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(428, 950, 44, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // brazos
  ctx.fillStyle = piel;
  ctx.beginPath();
  ctx.roundRect(240, 300, 48, 290, 24);
  ctx.roundRect(480, 300, 48, 290, 24);
  ctx.fill();
  // torso con camiseta gris lisa
  ctx.fillStyle = '#9aa1a9';
  ctx.beginPath();
  ctx.roundRect(282, 280, 204, 300, 36);
  ctx.fill();
  // cuello y cabeza
  ctx.fillStyle = piel;
  ctx.fillRect(360, 240, 48, 50);
  ctx.beginPath();
  ctx.ellipse(384, 185, 72, 88, 0, 0, Math.PI * 2);
  ctx.fill();
  // pelo
  ctx.fillStyle = '#3b2a20';
  ctx.beginPath();
  ctx.ellipse(384, 130, 78, 46, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // cara
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(358, 185, 7, 0, Math.PI * 2);
  ctx.arc(410, 185, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a4b3a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(384, 215, 22, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  return c;
}

function camisetaSintetica(): HTMLCanvasElement {
  const [c, ctx] = lienzo(768, 768);
  fondo(ctx, 768, 768);
  ctx.fillStyle = '#2f8f6b';
  ctx.beginPath();
  ctx.moveTo(300, 150);
  ctx.quadraticCurveTo(384, 200, 468, 150);
  ctx.lineTo(620, 230);
  ctx.lineTo(570, 340);
  ctx.lineTo(510, 310);
  ctx.lineTo(510, 630);
  ctx.lineTo(258, 630);
  ctx.lineTo(258, 310);
  ctx.lineTo(198, 340);
  ctx.lineTo(148, 230);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1f6b4f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(300, 150);
  ctx.quadraticCurveTo(384, 200, 468, 150);
  ctx.stroke();
  return c;
}

function pantalonSintetico(): HTMLCanvasElement {
  const [c, ctx] = lienzo(768, 768);
  fondo(ctx, 768, 768);
  ctx.fillStyle = '#35558f';
  ctx.beginPath();
  ctx.moveTo(270, 90);
  ctx.lineTo(498, 90);
  ctx.lineTo(530, 690);
  ctx.lineTo(410, 690);
  ctx.lineTo(384, 260);
  ctx.lineTo(358, 690);
  ctx.lineTo(238, 690);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#28426f';
  ctx.fillRect(270, 90, 228, 34);
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(300, 140);
  ctx.quadraticCurveTo(320, 200, 290, 230);
  ctx.moveTo(468, 140);
  ctx.quadraticCurveTo(448, 200, 478, 230);
  ctx.stroke();
  ctx.setLineDash([]);
  return c;
}

function zapatillasSinteticas(): HTMLCanvasElement {
  const [c, ctx] = lienzo(768, 768);
  fondo(ctx, 768, 768, '#e6e2db');
  const zapatilla = (x: number, y: number): void => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#b9b4ab';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 40, y - 110, x + 150, y - 120);
    ctx.quadraticCurveTo(x + 200, y - 60, x + 300, y - 40);
    ctx.quadraticCurveTo(x + 330, y - 10, x + 320, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d8d3ca';
    ctx.fillRect(x - 6, y, 332, 22);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x + 130, y - 80, 70, 12);
  };
  zapatilla(200, 360);
  zapatilla(230, 580);
  return c;
}

export interface ImagenesBase {
  persona: File;
  prendas: File[];
}

export async function imagenesSinteticas(): Promise<ImagenesBase> {
  return {
    persona: await aJpeg(personaSintetica(), 'persona.jpg'),
    prendas: await Promise.all([
      aJpeg(camisetaSintetica(), 'prenda-1.jpg'),
      aJpeg(pantalonSintetico(), 'prenda-2.jpg'),
      aJpeg(zapatillasSinteticas(), 'prenda-3.jpg'),
    ]),
  };
}

/** Normaliza una foto del usuario: orientación EXIF aplicada, lado máximo acotado y JPEG. */
export async function normalizarFoto(origen: Blob, nombre: string): Promise<File> {
  const bitmap = await createImageBitmap(origen, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const [c, ctx] = lienzo(Math.round(bitmap.width * escala), Math.round(bitmap.height * escala));
  fondo(ctx, c.width, c.height, '#ffffff');
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return aJpeg(c, nombre);
}

function dibujarContenido(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  x: number,
  y: number,
  ancho: number,
  alto: number,
): void {
  const escala = Math.min(ancho / img.width, alto / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  ctx.drawImage(img, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
}

/** Una sola imagen 4:5: la persona a la izquierda y las prendas en columna a la derecha. */
export async function componer(base: ImagenesBase): Promise<File> {
  const ANCHO = 1200;
  const ALTO = 1500;
  const ANCHO_PERSONA = 720;
  const MARGEN = 24;
  const [c, ctx] = lienzo(ANCHO, ALTO);
  fondo(ctx, ANCHO, ALTO, '#ffffff');

  const persona = await createImageBitmap(base.persona);
  dibujarContenido(ctx, persona, MARGEN, MARGEN, ANCHO_PERSONA - 2 * MARGEN, ALTO - 2 * MARGEN);
  persona.close();

  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(ANCHO_PERSONA, MARGEN, 3, ALTO - 2 * MARGEN);

  const altoHueco = (ALTO - MARGEN) / base.prendas.length;
  for (const [i, prenda] of base.prendas.entries()) {
    const img = await createImageBitmap(prenda);
    dibujarContenido(
      ctx,
      img,
      ANCHO_PERSONA + MARGEN,
      MARGEN + i * altoHueco,
      ANCHO - ANCHO_PERSONA - 2 * MARGEN,
      altoHueco - MARGEN,
    );
    img.close();
  }
  return aJpeg(c, 'outfit-persona-y-prendas.jpg');
}
