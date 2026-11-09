import { z } from 'zod'
import type { Zona } from './prendas.ts'

/** Dónde está el probador del PC (Tailscale Serve) y su clave. Se guardan en `ajustes` (D19). */
export interface ConfigProbador {
  url: string
  clave: string
}

/**
 * Por qué falló una llamada al probador:
 * - `red`: no responde (apagado, sin Tailscale, sin conexión o pasado el tiempo de espera);
 * - `clave`: 401, la clave no vale; `ocupado`: 409, ya está con otra prueba;
 * - `grande`: 413, las fotos pasan de 20 MB; `peticion`: 400, faltan la persona o las prendas;
 * - `imagen`: 400, el PC no puede abrir alguna foto;
 * - `no-existe`: 404 de una prueba (el servidor se reinició o ya la borró);
 * - `prueba`: la prueba acabó en error en el PC; `servidor`: cualquier otra respuesta rara.
 */
export type MotivoProbador =
  | 'red'
  | 'clave'
  | 'ocupado'
  | 'grande'
  | 'peticion'
  | 'imagen'
  | 'no-existe'
  | 'prueba'
  | 'servidor'

export class ErrorProbador extends Error {
  readonly motivo: MotivoProbador

  constructor(motivo: MotivoProbador, detalle?: string, opciones?: ErrorOptions) {
    super(detalle ? `${motivo}: ${detalle}` : motivo, opciones)
    this.name = 'ErrorProbador'
    this.motivo = motivo
  }
}

const saludSchema = z.object({
  ok: z.literal(true),
  modelo: z.string(),
  version: z.number(),
  ocupado: z.boolean(),
})

const pruebaCreadaSchema = z.object({ id: z.string().min(1), total: z.int().positive() })

const estadoPruebaSchema = z.object({
  estado: z.enum(['en-cola', 'probando', 'lista', 'error']),
  hechas: z.int().nonnegative(),
  total: z.int().positive(),
  segundos: z.number().nonnegative(),
  error: z.string().nullable(),
})

export type SaludProbador = z.infer<typeof saludSchema>
export type EstadoPrueba = z.infer<typeof estadoPruebaSchema>

export interface PrendaEnviada {
  foto: Blob
  zona: Zona
}

export interface ClienteProbador {
  salud: (signal?: AbortSignal) => Promise<SaludProbador>
  crearPrueba: (
    persona: Blob,
    prendas: readonly PrendaEnviada[],
    signal?: AbortSignal,
  ) => Promise<{ id: string; total: number }>
  estado: (id: string, signal?: AbortSignal) => Promise<EstadoPrueba>
  imagen: (id: string, signal?: AbortSignal) => Promise<Blob>
}

/** Esperas: `/salud` las 3 s del contrato; subir las fotos por datos móviles puede tardar más. */
export const ESPERA_MS = { salud: 3000, subir: 60_000, estado: 10_000, imagen: 30_000 }

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function nombreFichero(nombre: string, foto: Blob): string {
  return `${nombre}.${EXTENSIONES[foto.type] ?? 'jpg'}`
}

const MOTIVO_POR_ESTADO: Partial<Record<number, MotivoProbador>> = {
  400: 'peticion',
  401: 'clave',
  404: 'no-existe',
  409: 'ocupado',
  413: 'grande',
}

async function codigoDeError(respuesta: Response): Promise<string | null> {
  const cuerpo: unknown = await respuesta.json().catch(() => null)
  return cuerpo &&
    typeof cuerpo === 'object' &&
    'error' in cuerpo &&
    typeof cuerpo.error === 'string'
    ? cuerpo.error
    : null
}

/** La URL tal como la escribe el usuario, sin la barra del final. */
export function baseProbador(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function crearClienteProbador(
  config: ConfigProbador,
  { fetch: pedirRed = globalThis.fetch.bind(globalThis) }: { fetch?: typeof fetch } = {},
): ClienteProbador {
  const base = baseProbador(config.url)

  async function pedir(
    ruta: string,
    esperaMs: number,
    signal: AbortSignal | undefined,
    init: RequestInit = {},
  ): Promise<Response> {
    const senales = [AbortSignal.timeout(esperaMs), ...(signal ? [signal] : [])]
    let respuesta: Response
    try {
      respuesta = await pedirRed(`${base}${ruta}`, {
        ...init,
        headers: { Authorization: `Bearer ${config.clave}` },
        signal: AbortSignal.any(senales),
      })
    } catch (fallo) {
      // Si lo cancela quien llama, se propaga tal cual; el resto (sin red, CORS, tiempo) es «no responde».
      if (signal?.aborted) throw signal.reason
      throw new ErrorProbador('red', undefined, { cause: fallo })
    }
    if (!respuesta.ok) {
      let motivo = MOTIVO_POR_ESTADO[respuesta.status] ?? 'servidor'
      if (motivo === 'peticion' && (await codigoDeError(respuesta)) === 'imagen') motivo = 'imagen'
      throw new ErrorProbador(motivo, `HTTP ${String(respuesta.status)}`)
    }
    return respuesta
  }

  async function json<T>(respuesta: Response, esquema: z.ZodType<T>): Promise<T> {
    const leido = esquema.safeParse(await respuesta.json().catch(() => null))
    if (!leido.success) throw new ErrorProbador('servidor', 'respuesta inesperada')
    return leido.data
  }

  const ruta = (id: string) => `/pruebas/${encodeURIComponent(id)}`

  return {
    async salud(signal) {
      return json(await pedir('/salud', ESPERA_MS.salud, signal), saludSchema)
    },
    async crearPrueba(persona, prendas, signal) {
      const datos = new FormData()
      datos.append('persona', persona, nombreFichero('persona', persona))
      // Cada prenda seguida de su zona: vale tanto si el servidor lee las listas como si va parte a parte.
      prendas.forEach(({ foto, zona }, i) => {
        datos.append('prenda', foto, nombreFichero(`prenda-${String(i + 1)}`, foto))
        datos.append('zona', zona)
      })
      const respuesta = await pedir('/pruebas', ESPERA_MS.subir, signal, {
        method: 'POST',
        body: datos,
      })
      return json(respuesta, pruebaCreadaSchema)
    },
    async estado(id, signal) {
      return json(await pedir(ruta(id), ESPERA_MS.estado, signal), estadoPruebaSchema)
    },
    async imagen(id, signal) {
      const respuesta = await pedir(`${ruta(id)}/imagen`, ESPERA_MS.imagen, signal)
      const blob = await respuesta.blob()
      if (!blob.type.startsWith('image/')) throw new ErrorProbador('servidor', 'no es una imagen')
      return blob
    },
  }
}
