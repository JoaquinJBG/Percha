import type { Pincel } from './dibujar.ts'

export interface Trazo {
  orden: string
  argumentos: unknown[]
  fillStyle: unknown
}

/** Contexto 2D falso que apunta cada orden; `measureText` mide 10 px por carácter. */
export function pincelFalso() {
  const trazos: Trazo[] = []
  const estado = {
    fillStyle: '#000' as Pincel['fillStyle'],
    strokeStyle: '#000' as Pincel['strokeStyle'],
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  }
  const apuntar =
    (orden: string) =>
    (...argumentos: unknown[]) => {
      trazos.push({ orden, argumentos, fillStyle: estado.fillStyle })
    }
  const pincel = Object.assign(estado, {
    fillRect: apuntar('fillRect'),
    beginPath: apuntar('beginPath'),
    roundRect: apuntar('roundRect'),
    arc: apuntar('arc'),
    fill: apuntar('fill'),
    stroke: apuntar('stroke'),
    drawImage: apuntar('drawImage'),
    fillText: apuntar('fillText'),
    measureText: (texto: string) => ({ width: texto.length * 10 }) as TextMetrics,
  }) as Pincel

  const de = (orden: string) => trazos.filter((t) => t.orden === orden)
  return { pincel, trazos, de }
}
