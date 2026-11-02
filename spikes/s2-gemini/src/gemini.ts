import { GoogleGenAI, MediaResolution, ThinkingLevel, type GenerateContentResponse, type Part } from '@google/genai';
import { esquemaParaGemini } from './esquema';
import { INSTRUCCION_SISTEMA, textoImagen } from './prompt';

export interface ImagenPreparada {
  nombre: string;
  base64: string;
  mimeType: string;
  ancho: number;
  alto: number;
  bytes: number;
}

export interface OpcionesEtiquetado {
  clave: string;
  modelo: string;
  pensamiento: 'por-defecto' | 'MINIMAL' | 'LOW';
  resolucion: 'por-defecto' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Uso {
  entrada?: number;
  entradaImagen?: number;
  salida?: number;
  pensamiento?: number;
  total?: number;
}

export interface ResultadoLlamada {
  texto: string;
  uso: Uso;
  ms: number;
  modeloRespuesta?: string;
}

export async function etiquetar(imagenes: ImagenPreparada[], opciones: OpcionesEtiquetado): Promise<ResultadoLlamada> {
  const ai = new GoogleGenAI({ apiKey: opciones.clave });
  const partes: Part[] = imagenes.flatMap((img, i) => [
    { text: textoImagen(i + 1) },
    { inlineData: { data: img.base64, mimeType: img.mimeType } },
  ]);

  const inicio = performance.now();
  const respuesta = await ai.models.generateContent({
    model: opciones.modelo,
    contents: [{ role: 'user', parts: partes }],
    config: {
      systemInstruction: INSTRUCCION_SISTEMA,
      responseMimeType: 'application/json',
      responseJsonSchema: esquemaParaGemini(),
      temperature: 0.2,
      ...(opciones.pensamiento === 'por-defecto'
        ? {}
        : { thinkingConfig: { thinkingLevel: ThinkingLevel[opciones.pensamiento] } }),
      ...(opciones.resolucion === 'por-defecto'
        ? {}
        : { mediaResolution: MediaResolution[`MEDIA_RESOLUTION_${opciones.resolucion}`] }),
    },
  });
  return { texto: respuesta.text ?? '', uso: leerUso(respuesta), ms: performance.now() - inicio, modeloRespuesta: respuesta.modelVersion };
}

/** Pregunta con la búsqueda de Google activada para ver si el nivel gratis la deja usar. */
export async function probarBusqueda(clave: string, modelo: string): Promise<ResultadoLlamada & { busquedas: string[] }> {
  const ai = new GoogleGenAI({ apiKey: clave });
  const inicio = performance.now();
  const respuesta = await ai.models.generateContent({
    model: modelo,
    contents: '¿Qué colores de ropa son tendencia este otoño-invierno en España? Responde en dos frases.',
    config: { tools: [{ googleSearch: {} }] },
  });
  const metadatos = respuesta.candidates?.[0]?.groundingMetadata;
  return {
    texto: respuesta.text ?? '',
    uso: leerUso(respuesta),
    ms: performance.now() - inicio,
    modeloRespuesta: respuesta.modelVersion,
    busquedas: metadatos?.webSearchQueries ?? [],
  };
}

export async function listarModelos(clave: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: clave });
  const nombres: string[] = [];
  const pagina = await ai.models.list({ config: { pageSize: 200 } });
  for await (const modelo of pagina) {
    if (modelo.supportedActions?.includes('generateContent') && modelo.name) nombres.push(modelo.name.replace(/^models\//, ''));
  }
  return nombres.sort();
}

function leerUso(respuesta: GenerateContentResponse): Uso {
  const meta = respuesta.usageMetadata;
  return {
    entrada: meta?.promptTokenCount,
    entradaImagen: meta?.promptTokensDetails?.find((d) => d.modality === 'IMAGE')?.tokenCount,
    salida: meta?.candidatesTokenCount,
    pensamiento: meta?.thoughtsTokenCount,
    total: meta?.totalTokenCount,
  };
}

/** Mensaje legible de un error del SDK, sin cabeceras ni URL (nunca debe asomar la clave). */
export function describirError(error: unknown): string {
  if (error instanceof Error) {
    const estado = (error as { status?: number }).status;
    let mensaje = error.message.replace(/key=[^&\s"]+/g, 'key=***');
    // El SDK mete el JSON de error de Google tal cual en message.
    try {
      const cuerpo = JSON.parse(mensaje) as { error?: { status?: string; message?: string } };
      if (cuerpo.error?.message) mensaje = `${cuerpo.error.status ?? ''} ${cuerpo.error.message}`.trim();
    } catch {
      /* no era JSON */
    }
    return estado ? `HTTP ${estado}: ${mensaje}` : mensaje;
  }
  return String(error);
}
