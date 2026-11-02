import type { EtiquetasPrenda } from './esquema';
import type { ResultadoLlamada } from './gemini';

const EJEMPLOS: Omit<EtiquetasPrenda, 'indice'>[] = [
  {
    nombre: 'Camiseta blanca básica',
    categoria: 'superior',
    subcategoria: 'camiseta',
    colores: ['blanco'],
    estampado: 'liso',
    estilos: ['casual', 'minimalista'],
    abrigo: 2,
    formalidad: 2,
    ocasiones: ['diario', 'viaje', 'casa'],
    temporadas: ['primavera', 'verano'],
    notas: 'Algodón, cuello redondo.',
  },
  {
    nombre: 'Vaqueros rectos azul medio',
    categoria: 'inferior',
    subcategoria: 'vaqueros',
    colores: ['vaquero'],
    estampado: 'liso',
    estilos: ['casual', 'streetwear'],
    abrigo: 3,
    formalidad: 2,
    ocasiones: ['diario', 'cita', 'viaje'],
    temporadas: ['primavera', 'otoño', 'invierno'],
    notas: 'Corte recto, tiro medio.',
  },
  {
    nombre: 'Zapatillas blancas de piel',
    categoria: 'calzado',
    subcategoria: 'zapatillas',
    colores: ['blanco', 'gris'],
    estampado: 'liso',
    estilos: ['casual', 'minimalista', 'smart casual'],
    abrigo: 3,
    formalidad: 2,
    ocasiones: ['diario', 'viaje', 'cita'],
    temporadas: ['primavera', 'verano', 'otoño'],
    notas: '',
  },
  {
    nombre: 'Chaqueta acolchada negra',
    categoria: 'abrigo',
    subcategoria: 'plumífero',
    colores: ['negro'],
    estampado: 'liso',
    estilos: ['gorpcore', 'casual'],
    abrigo: 5,
    formalidad: 2,
    ocasiones: ['diario', 'viaje'],
    temporadas: ['invierno'],
    notas: 'Con capucha.',
  },
  {
    nombre: 'Camisa de flores manga corta',
    categoria: 'superior',
    subcategoria: 'camisa',
    colores: ['azul marino', 'blanco', 'rojo'],
    estampado: 'flores',
    estilos: ['mediterráneo / verano', 'boho'],
    abrigo: 2,
    formalidad: 3,
    ocasiones: ['playa / piscina', 'cena', 'viaje'],
    temporadas: ['verano'],
    notas: 'Viscosa, cuello cubano.',
  },
];

/** Respuesta falsa con la misma forma que la de Gemini, para probar el flujo sin clave. */
export async function etiquetarSimulado(numImagenes: number): Promise<ResultadoLlamada> {
  const inicio = performance.now();
  await new Promise((r) => setTimeout(r, 400));
  const prendas = Array.from({ length: numImagenes }, (_, i) => ({ indice: i + 1, ...EJEMPLOS[i % EJEMPLOS.length]! }));
  return {
    texto: JSON.stringify({ prendas }),
    uso: {
      entrada: 900 + 260 * numImagenes,
      entradaImagen: 260 * numImagenes,
      salida: 140 * numImagenes,
      pensamiento: 0,
      total: 900 + 400 * numImagenes,
    },
    ms: performance.now() - inicio,
    modeloRespuesta: 'simulado',
  };
}
