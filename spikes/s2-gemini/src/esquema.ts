import { z } from 'zod';

// Listas fijas de docs/spec.md. Colores, estampados y temporadas son propuesta de este spike.
export const CATEGORIAS = ['superior', 'inferior', 'vestido', 'abrigo', 'calzado', 'accesorio'] as const;

export const ESTILOS = [
  'casual',
  'smart casual',
  'elegante',
  'formal',
  'business',
  'minimalista',
  'old money / quiet luxury',
  'streetwear',
  'deportivo / athleisure',
  'gorpcore',
  'preppy',
  'boho',
  'vintage / retro',
  'rockero',
  'grunge',
  'y2k',
  'techwear',
  'romántico',
  'clean girl',
  'cowboy / western',
  'mediterráneo / verano',
] as const;

export const OCASIONES = [
  'diario',
  'trabajo',
  'cita',
  'cena',
  'fiesta / noche',
  'evento formal',
  'boda',
  'deporte',
  'viaje',
  'playa / piscina',
  'casa',
] as const;

export const TEMPORADAS = ['primavera', 'verano', 'otoño', 'invierno'] as const;

export const COLORES = [
  'blanco',
  'crudo',
  'negro',
  'gris',
  'beige',
  'camel',
  'marrón',
  'azul marino',
  'azul',
  'celeste',
  'vaquero',
  'verde',
  'caqui',
  'rojo',
  'granate',
  'rosa',
  'morado',
  'amarillo',
  'naranja',
  'dorado',
  'plateado',
] as const;

export const ESTAMPADOS = [
  'liso',
  'rayas',
  'cuadros',
  'lunares',
  'flores',
  'animal',
  'geométrico',
  'gráfico / logo',
  'camuflaje',
  'tie-dye',
  'otro',
] as const;

const nivel = z.int().min(1).max(5);

export const EtiquetasPrenda = z.object({
  indice: z.int().min(1).describe('Número de la imagen (1, 2, 3…) en el orden en que se enviaron.'),
  nombre: z.string().describe('Nombre corto en español, p. ej. «Camiseta blanca de algodón».'),
  categoria: z.enum(CATEGORIAS),
  subcategoria: z.string().describe('Tipo concreto en minúsculas: camiseta, vaqueros, zapatillas, blazer…'),
  colores: z.array(z.enum(COLORES)).min(1).max(3).describe('De más a menos presente.'),
  estampado: z.enum(ESTAMPADOS),
  estilos: z.array(z.enum(ESTILOS)).min(1).max(4),
  abrigo: nivel.describe('1 = muy fresco (tirantes, sandalias) … 5 = muy abrigado (plumífero, botas de nieve).'),
  formalidad: nivel.describe('1 = deporte/estar en casa … 5 = etiqueta (traje, vestido de gala).'),
  ocasiones: z.array(z.enum(OCASIONES)).min(1).max(5),
  temporadas: z.array(z.enum(TEMPORADAS)).min(1).max(4),
  notas: z.string().describe('Material, corte o detalle útil para combinar. Cadena vacía si no hay nada.'),
});

export const RespuestaEtiquetado = z.object({
  prendas: z.array(EtiquetasPrenda).min(1),
});

export type EtiquetasPrenda = z.infer<typeof EtiquetasPrenda>;
export type RespuestaEtiquetado = z.infer<typeof RespuestaEtiquetado>;

/** JSON Schema para `responseJsonSchema`, sin las claves que Gemini no admite. */
export function esquemaParaGemini(): Record<string, unknown> {
  const json = z.toJSONSchema(RespuestaEtiquetado, { target: 'draft-2020-12' }) as Record<string, unknown>;
  delete json.$schema;
  return limpiar(json) as Record<string, unknown>;
}

// z.int() añade los límites de entero seguro de JS; sobran y ensucian el esquema.
function limpiar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(limpiar);
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) {
      if ((clave === 'minimum' || clave === 'maximum') && Math.abs(v as number) >= Number.MAX_SAFE_INTEGER) continue;
      salida[clave] = limpiar(v);
    }
    return salida;
  }
  return valor;
}
