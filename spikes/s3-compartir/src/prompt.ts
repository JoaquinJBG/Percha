export type Disposicion = 'separadas' | 'compuesta';

/** Prompt v0 del try-on. Va en primera persona porque lo envía el propio usuario desde su cuenta. */
export function promptTryOn(prendas: string[], disposicion: Disposicion): string {
  const lista = prendas.map((p) => p.trim()).filter(Boolean).join(', ');
  const intro =
    disposicion === 'separadas'
      ? `Te paso ${prendas.length + 1} imágenes. La primera es una foto mía. Las otras ${prendas.length} son prendas de ropa: ${lista}.`
      : `Te paso una imagen: a la izquierda estoy yo y a la derecha, en columna, unas prendas de ropa: ${lista}.`;

  return [
    intro,
    '',
    'Crea una imagen fotorrealista de mí llevando puesto este outfit completo.',
    '- Mantén mi cara, mi pelo, mi tono de piel, mi cuerpo y mis proporciones exactamente como en la foto: no cambies mis rasgos, mi edad, mi altura ni mi talla.',
    '- Copia cada prenda tal cual: color, estampado, tejido, largo y corte. No añadas otras prendas ni accesorios; si falta alguna parte (por ejemplo, el calzado), elige algo sencillo y neutro que combine.',
    '- Plano de cuerpo entero, de pie y de frente, con luz natural y fondo liso claro.',
    '- Sin texto ni marcas de agua.',
  ].join('\n');
}
